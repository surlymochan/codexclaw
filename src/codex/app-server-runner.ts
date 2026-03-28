import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import type { Logger } from "../core/logger.js";
import type { CodexExecutionResult, ImageInputAsset } from "../types/channel.js";

export interface CodexAppServerRunnerOptions {
  codexBin: string;
  codexModel?: string;
  workdir: string;
  timeoutMs: number;
}

interface JsonRpcResponse {
  id: number;
  result?: unknown;
  error?: {
    code?: number;
    message?: string;
    data?: unknown;
  };
}

interface JsonRpcNotification {
  method: string;
  params?: any;
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
}

interface TurnTracker {
  threadId: string;
  replyText: string;
  completed: boolean;
  error?: unknown;
  promise: Promise<TurnTracker>;
  resolve: (value: TurnTracker) => void;
}

function createTurnTracker(threadId: string): TurnTracker {
  let resolve!: (value: TurnTracker) => void;
  const tracker: TurnTracker = {
    threadId,
    replyText: "",
    completed: false,
    promise: new Promise<TurnTracker>((innerResolve) => {
      resolve = innerResolve;
    }),
    resolve: (value) => resolve(value),
  };

  return tracker;
}

export class CodexAppServerRunner {
  private child?: ChildProcessWithoutNullStreams;
  private nextRequestId = 1;
  private stdoutBuffer = "";
  private stderrBuffer = "";
  private initialized = false;
  private startPromise?: Promise<void>;
  private readonly pendingRequests = new Map<number, PendingRequest>();
  private readonly loadedThreads = new Set<string>();
  private readonly turnTrackers = new Map<string, TurnTracker>();

  constructor(
    private readonly options: CodexAppServerRunnerOptions,
    private readonly log: Logger,
  ) {}

  async start(): Promise<void> {
    await this.ensureStarted();
  }

  async run(prompt: string, threadId?: string): Promise<CodexExecutionResult> {
    return this.runWithOptions(prompt, { threadId });
  }

  async runWithOptions(
    prompt: string,
    options: {
      threadId?: string;
      baseInstructions?: string;
      images?: ImageInputAsset[];
    },
  ): Promise<CodexExecutionResult> {
    await this.ensureStarted();

    try {
      const activeThreadId = await this.ensureThread(options.threadId, options.baseInstructions);
      const turnResponse = await this.request("turn/start", {
        threadId: activeThreadId,
        input: buildUserInputs(prompt, options.images),
      });

      const turnId = extractTurnId(turnResponse);
      const tracker = this.getOrCreateTurnTracker(turnId, activeThreadId);

      const completed = await Promise.race([
        tracker.promise,
        new Promise<TurnTracker>((_, reject) => {
          setTimeout(() => {
            reject(new Error("app-server turn timed out"));
          }, this.options.timeoutMs);
        }),
      ]).catch((error) => error as Error);

      if (completed instanceof Error) {
        this.turnTrackers.delete(turnId);
        return {
          ok: false,
          threadId: activeThreadId,
          timedOut: completed.message.includes("timed out"),
          exitCode: null,
          stderr: completed.message,
          rawEvents: [],
        };
      }

      this.turnTrackers.delete(turnId);
      const replyText = completed.replyText.trim() || undefined;

      return {
        ok: completed.completed && Boolean(replyText) && !completed.error,
        threadId: activeThreadId,
        replyText,
        timedOut: false,
        exitCode: completed.error ? 1 : 0,
        stderr: completed.error ? JSON.stringify(completed.error) : "",
        rawEvents: [],
      };
    } catch (error) {
      return {
        ok: false,
        threadId: options.threadId,
        timedOut: false,
        exitCode: null,
        stderr: (error as Error).message,
        rawEvents: [],
      };
    }
  }

  private async ensureStarted(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.startPromise) {
      await this.startPromise;
      return;
    }

    this.startPromise = this.spawnAndInitialize();
    await this.startPromise;
    this.startPromise = undefined;
  }

  private async spawnAndInitialize(): Promise<void> {
    this.child = spawn(
      this.options.codexBin,
      ["--cd", this.options.workdir, "app-server"],
      {
        cwd: this.options.workdir,
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => {
      this.handleStdout(chunk);
    });

    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk: string) => {
      this.stderrBuffer += chunk;
      this.log.warn("codex app-server stderr", {
        chunk: chunk.trim(),
      });
    });

    this.child.on("exit", (code, signal) => {
      this.initialized = false;
      this.child = undefined;
      this.loadedThreads.clear();

      const error = new Error(
        `codex app-server exited unexpectedly: code=${code ?? "null"} signal=${signal ?? "null"}`,
      );

      for (const pending of this.pendingRequests.values()) {
        pending.reject(error);
      }
      this.pendingRequests.clear();

      for (const tracker of this.turnTrackers.values()) {
        tracker.error = error.message;
        tracker.completed = true;
        tracker.resolve(tracker);
      }
      this.turnTrackers.clear();
    });

    await this.request("initialize", {
      clientInfo: {
        name: "codex-channel",
        version: "0.1.0",
      },
    });

    this.initialized = true;
    this.log.info("codex app-server initialized");
  }

  async compactThread(threadId: string): Promise<void> {
    await this.ensureStarted();
    await this.request("thread/compact/start", { threadId });
  }

  async archiveThread(threadId: string): Promise<void> {
    await this.ensureStarted();
    await this.request("thread/archive", { threadId });
    this.loadedThreads.delete(threadId);
  }

  private async ensureThread(threadId?: string, baseInstructions?: string): Promise<string> {
    if (!threadId) {
      const response = await this.request("thread/start", {
        cwd: this.options.workdir,
        approvalPolicy: "never",
        sandbox: "danger-full-access",
        model: this.options.codexModel ?? null,
        personality: "pragmatic",
        baseInstructions: baseInstructions ?? null,
      });

      const newThreadId = extractThreadId(response);
      this.loadedThreads.add(newThreadId);
      return newThreadId;
    }

    if (!this.loadedThreads.has(threadId)) {
      await this.request("thread/resume", {
        threadId,
        cwd: this.options.workdir,
        model: this.options.codexModel ?? null,
        personality: "pragmatic",
      });
      this.loadedThreads.add(threadId);
    }

    return threadId;
  }

  private request(method: string, params: unknown): Promise<any> {
    if (!this.child) {
      return Promise.reject(new Error("codex app-server is not running"));
    }

    const id = this.nextRequestId++;
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    });

    return new Promise<any>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.child!.stdin.write(`${payload}\n`);
    });
  }

  private handleStdout(chunk: string): void {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split("\n");
    this.stdoutBuffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      try {
        const message = JSON.parse(line) as JsonRpcResponse | JsonRpcNotification;
        if ("id" in message) {
          this.handleResponse(message);
        } else if ("method" in message) {
          this.handleNotification(message);
        }
      } catch (error) {
        this.log.warn("failed to parse app-server message", {
          line,
          error: (error as Error).message,
        });
      }
    }
  }

  private handleResponse(message: JsonRpcResponse): void {
    const pending = this.pendingRequests.get(message.id);
    if (!pending) {
      return;
    }

    this.pendingRequests.delete(message.id);
    if (message.error) {
      pending.reject(
        new Error(message.error.message ?? `JSON-RPC error ${message.error.code ?? "unknown"}`),
      );
      return;
    }

    pending.resolve(message.result);
  }

  private handleNotification(message: JsonRpcNotification): void {
    if (message.method === "item/agentMessage/delta") {
      const turnId = message.params?.turnId as string | undefined;
      const threadId = message.params?.threadId as string | undefined;
      if (!turnId || !threadId) {
        return;
      }

      const tracker = this.getOrCreateTurnTracker(turnId, threadId);
      tracker.replyText += String(message.params?.delta ?? "");
      return;
    }

    if (message.method === "item/completed") {
      const turnId = message.params?.turnId as string | undefined;
      const threadId = message.params?.threadId as string | undefined;
      const item = message.params?.item;
      if (!turnId || !threadId || !item) {
        return;
      }

      if (item.type === "agentMessage" && (item.phase === "final_answer" || !item.phase)) {
        const tracker = this.getOrCreateTurnTracker(turnId, threadId);
        tracker.replyText = String(item.text ?? tracker.replyText);
      }
      return;
    }

    if (message.method === "turn/completed") {
      const turnId = message.params?.turn?.id as string | undefined;
      const threadId = message.params?.threadId as string | undefined;
      if (!turnId || !threadId) {
        return;
      }

      const tracker = this.getOrCreateTurnTracker(turnId, threadId);
      tracker.completed = true;
      tracker.error = message.params?.turn?.error;
      tracker.resolve(tracker);
      return;
    }

    if (message.method === "error") {
      this.log.warn("codex app-server notification error", {
        params: message.params,
      });
    }
  }

  private getOrCreateTurnTracker(turnId: string, threadId: string): TurnTracker {
    const existing = this.turnTrackers.get(turnId);
    if (existing) {
      return existing;
    }

    const created = createTurnTracker(threadId);
    this.turnTrackers.set(turnId, created);
    return created;
  }
}

function buildUserInputs(prompt: string, images?: ImageInputAsset[]): Array<Record<string, string>> {
  const inputs: Array<Record<string, string>> = [
    {
      type: "text",
      text: prompt,
    },
  ];

  for (const image of images ?? []) {
    inputs.push({
      type: "localImage",
      path: image.path,
    });
  }

  return inputs;
}

function extractThreadId(result: any): string {
  const threadId = result?.thread?.id;
  if (typeof threadId !== "string" || !threadId) {
    throw new Error("thread/start did not return a thread id");
  }
  return threadId;
}

function extractTurnId(result: any): string {
  const turnId = result?.turn?.id;
  if (typeof turnId !== "string" || !turnId) {
    throw new Error("turn/start did not return a turn id");
  }
  return turnId;
}
