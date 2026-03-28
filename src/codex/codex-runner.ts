import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Logger } from "../core/logger.js";
import type { CodexExecutionResult } from "../types/channel.js";

export interface CodexRunnerOptions {
  codexBin: string;
  codexModel?: string;
  workdir: string;
  timeoutMs: number;
}

export interface ParsedCodexState {
  threadId?: string;
  replyText?: string;
  rawEvents: unknown[];
}

export function reduceCodexJsonEvents(lines: string[]): ParsedCodexState {
  const state: ParsedCodexState = {
    rawEvents: [],
  };

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const event = JSON.parse(line) as {
      type?: string;
      thread_id?: string;
      item?: { type?: string; text?: string };
    };
    state.rawEvents.push(event);

    if (event.type === "thread.started" && typeof event.thread_id === "string") {
      state.threadId = event.thread_id;
    }

    if (event.type === "item.completed" && event.item?.type === "agent_message") {
      state.replyText = event.item.text?.trim() || state.replyText;
    }
  }

  return state;
}

export class CodexRunner {
  constructor(
    private readonly options: CodexRunnerOptions,
    private readonly log: Logger,
  ) {}

  async run(prompt: string, threadId?: string): Promise<CodexExecutionResult> {
    const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-channel-"));
    const outputFile = path.join(outputDir, "last-message.txt");
    const args = this.buildArgs(prompt, threadId, outputFile);
    this.log.info("running codex", {
      threadId: threadId ?? null,
      workdir: this.options.workdir,
    });

    return new Promise<CodexExecutionResult>((resolve) => {
      const child = spawn(this.options.codexBin, args, {
        cwd: this.options.workdir,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdoutBuffer = "";
      let stderr = "";
      let timedOut = false;
      const jsonLines: string[] = [];

      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, this.options.timeoutMs);

      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdoutBuffer += chunk;
        const lines = stdoutBuffer.split("\n");
        stdoutBuffer = lines.pop() ?? "";
        jsonLines.push(...lines.filter(Boolean));
      });

      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });

      child.on("close", async (exitCode) => {
        clearTimeout(timeout);

        if (stdoutBuffer.trim()) {
          jsonLines.push(stdoutBuffer.trim());
        }

        let outputLastMessage = "";
        try {
          outputLastMessage = (await fs.readFile(outputFile, "utf8")).trim();
        } catch {
          outputLastMessage = "";
        }

        let parsed: ParsedCodexState = { rawEvents: [] };
        let parseError: Error | undefined;

        try {
          parsed = reduceCodexJsonEvents(jsonLines);
        } catch (error) {
          parseError = error as Error;
        }

        if (parseError) {
          await fs.rm(outputDir, { recursive: true, force: true });
          resolve({
            ok: false,
            timedOut,
            exitCode,
            stderr: `${stderr}\n${parseError.message}`.trim(),
            rawEvents: [],
          });
          return;
        }

        const replyText = parsed.replyText || outputLastMessage || undefined;
        await fs.rm(outputDir, { recursive: true, force: true });
        resolve({
          ok: exitCode === 0 && !timedOut && Boolean(replyText),
          threadId: parsed.threadId ?? threadId,
          replyText,
          timedOut,
          exitCode,
          stderr: stderr.trim(),
          rawEvents: parsed.rawEvents,
        });
      });

      child.on("error", (error) => {
        clearTimeout(timeout);
        resolve({
          ok: false,
          timedOut,
          exitCode: null,
          stderr: error.message,
          rawEvents: [],
        });
      });
    });
  }

  private buildArgs(prompt: string, threadId?: string, outputFile?: string): string[] {
    const globalArgs = ["--cd", this.options.workdir];
    const shared = ["--json", "--skip-git-repo-check"];

    if (this.options.codexModel) {
      globalArgs.push("--model", this.options.codexModel);
    }

    if (outputFile) {
      shared.push("--output-last-message", outputFile);
    }

    if (threadId) {
      return [...globalArgs, "exec", "resume", ...shared, threadId, prompt];
    }

    return [...globalArgs, "exec", ...shared, prompt];
  }
}
