import type { Logger } from "./core/logger.js";
import { buildConversationDiagnostics } from "./core/diagnostics.js";
import { MemoryStore } from "./core/memory.js";
import { CodexAppServerRunner } from "./codex/app-server-runner.js";
import { GuidanceLoader } from "./core/guidance-loader.js";
import { shouldDeliverHeartbeatReply } from "./core/heartbeat.js";
import { buildTurnPrompt, shouldRenderAsMarkdown } from "./core/markdown.js";
import { parseReplyPayload } from "./core/reply-parser.js";
import { parseScheduledOutput, shouldDeliverScheduledOutput } from "./core/scheduled-output.js";
import { Scheduler } from "./core/scheduler.js";
import { FeishuClient } from "./feishu/feishu-client.js";
import type { AppConfig } from "./core/config.js";
import { FileStore } from "./core/file-store.js";
import { SessionManager } from "./core/session-manager.js";
import type {
  CodexExecutionResult,
  GuidanceContext,
  NormalizedChannelMessage,
  ScheduledTaskDeliverWhen,
  ScheduledTaskMode,
} from "./types/channel.js";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export class CodexChannelApp {
  private readonly sessionManager: SessionManager;
  private readonly codexRunner: CodexAppServerRunner;
  private readonly feishuClient: FeishuClient;
  private readonly guidanceLoader: GuidanceLoader;
  private readonly memoryStore: MemoryStore;
  private readonly scheduler: Scheduler;
  private readonly inFlightMessageIds = new Set<string>();
  private sessionCleanupTimer?: NodeJS.Timeout;

  constructor(
    private readonly config: AppConfig,
    private readonly log: Logger,
  ) {
    this.sessionManager = new SessionManager(new FileStore(config.stateDir));
    this.codexRunner = new CodexAppServerRunner(
      {
        codexBin: config.codexBin,
        codexModel: config.codexModel,
        workdir: config.codexWorkdir,
        timeoutMs: config.codexTimeoutMs,
      },
      log,
    );
    this.feishuClient = new FeishuClient(
      {
        appId: config.feishuAppId,
        appSecret: config.feishuAppSecret,
        encryptKey: config.feishuEncryptKey,
        verificationToken: config.feishuVerificationToken,
      },
      log,
    );
    this.guidanceLoader = new GuidanceLoader(config.guidanceDirs);
    this.memoryStore = new MemoryStore(config.codexWorkdir);
    this.scheduler = new Scheduler(
      {
        heartbeatIntervalSec: config.heartbeatIntervalSec,
        heartbeatFilePath: config.heartbeatFilePath,
        cronFilePath: config.cronFilePath,
      },
      {
        listConversationIds: () => this.sessionManager.listSessions().map((session) => session.conversationId),
        runPrompt: async (task) => {
          await this.runScheduledPrompt(task);
        },
      },
      log,
    );
  }

  async start(): Promise<void> {
    await this.sessionManager.init();
    await this.pruneExpiredSessions("startup");
    await this.codexRunner.start();
    await this.scheduler.start();
    this.startSessionCleanupLoop();
    await this.feishuClient.start(async (message) => {
      try {
        await this.handleIncomingMessage(message);
      } catch (error) {
        this.log.error("failed to handle message", {
          error: (error as Error).message,
          messageId: message.messageId,
        });
      }
    });
  }

  private async handleIncomingMessage(message: NormalizedChannelMessage): Promise<void> {
    await this.pruneExpiredSessions("message");

    if (this.sessionManager.hasProcessedMessage(message.messageId)) {
      this.log.info("skipping processed message", { messageId: message.messageId });
      return;
    }

    if (this.inFlightMessageIds.has(message.messageId)) {
      this.log.info("skipping in-flight duplicate", { messageId: message.messageId });
      return;
    }

    this.inFlightMessageIds.add(message.messageId);
    let reactionId: string | undefined;

    try {
      try {
        reactionId = await this.feishuClient.addReaction(message.messageId, "OK");
      } catch (error) {
        this.log.warn("failed to add processing reaction", {
          messageId: message.messageId,
          error: (error as Error).message,
        });
      }

      await this.sessionManager.withConversationLock(message.conversationId, async () => {
        const commandReply = await this.handleCommand(message);
        if (commandReply) {
          await this.sendReply(message.conversationId, commandReply);
          await this.sessionManager.markProcessed(message.messageId);
          return;
        }

        if (message.messageType === "image" && !message.text.trim()) {
          this.log.info("queueing image-only message for the next text turn", {
            conversationId: message.conversationId,
            messageId: message.messageId,
            imageCount: message.imageKeys.length,
          });
          await this.sessionManager.appendPendingImageMessage(message.conversationId, {
            messageId: message.messageId,
            imageKeys: message.imageKeys,
            createdAt: new Date().toISOString(),
          });
          await this.sessionManager.markProcessed(message.messageId);
          return;
        }

        const existingSession = this.sessionManager.getSession(message.conversationId);
        const guidance = await this.guidanceLoader.load(resolveMessageGuidanceContext(message));
        const quotedMessage = message.parentMessageId
          ? await this.feishuClient.getQuotedMessage(message.parentMessageId)
          : null;
        const pendingImageMessages = this.sessionManager.getPendingImageMessages(
          message.conversationId,
        );
        const imageMessages = [
          ...pendingImageMessages,
          ...(message.imageKeys.length > 0
            ? [
                {
                  messageId: message.messageId,
                  imageKeys: message.imageKeys,
                  createdAt: new Date().toISOString(),
                },
              ]
            : []),
        ];
        this.log.info("preparing codex turn", {
          conversationId: message.conversationId,
          messageId: message.messageId,
          quotedMessageId: message.parentMessageId ?? null,
          pendingImageMessageCount: pendingImageMessages.length,
          imageMessageCount: imageMessages.length,
        });
        const inputImages =
          imageMessages.length > 0
            ? await this.feishuClient.downloadMessageImages(imageMessages)
            : [];
        const prompt = buildTurnPrompt({
          userText: message.text,
          quotedMessage: quotedMessage ?? undefined,
          guidanceRefresh:
            existingSession?.needsGuidanceRefresh && guidance.baseInstructions
              ? guidance.baseInstructions
              : undefined,
        });

        let result = await this.codexRunner.runWithOptions(prompt, {
          threadId: existingSession?.threadId,
          baseInstructions: existingSession?.threadId ? undefined : guidance.baseInstructions,
          images: inputImages,
        });

        if (
          existingSession?.threadId &&
          !result.ok &&
          isMissingSessionError(result.stderr)
        ) {
          this.log.warn("stored codex session missing, retrying with a new session", {
            conversationId: message.conversationId,
            threadId: existingSession.threadId,
          });
          await this.archiveThreadBestEffort(
            existingSession.threadId,
            `missing-session:${message.conversationId}`,
          );
          await this.sessionManager.deleteSession(message.conversationId);
          result = await this.codexRunner.runWithOptions(prompt, {
            baseInstructions: guidance.baseInstructions,
            images: inputImages,
          });
        }

        this.log.info("codex result", {
          conversationId: message.conversationId,
          ok: result.ok,
          timedOut: result.timedOut,
          exitCode: result.exitCode,
          threadId: result.threadId ?? null,
          hasReplyText: Boolean(result.replyText),
          stderr: result.stderr || null,
        });

        const reply = buildReplyText(result);
        await this.sendReply(message.conversationId, reply);

        if (result.ok && result.threadId) {
          await this.sessionManager.upsertSession(
            message.conversationId,
            result.threadId,
            message.chatType,
          );
          if (imageMessages.length > 0) {
            await this.sessionManager.clearPendingImageMessages(message.conversationId);
          }
          if (existingSession?.needsGuidanceRefresh) {
            await this.sessionManager.markGuidanceRefreshNeeded(message.conversationId, false);
          }
        }

        await this.sessionManager.markProcessed(message.messageId);
      });
    } finally {
      if (reactionId) {
        try {
          await this.feishuClient.removeReaction(message.messageId, reactionId);
        } catch (error) {
          this.log.warn("failed to remove processing reaction", {
            messageId: message.messageId,
            reactionId,
            error: (error as Error).message,
          });
        }
      }

      this.inFlightMessageIds.delete(message.messageId);
    }
  }

  private startSessionCleanupLoop(): void {
    if (this.sessionCleanupTimer) {
      return;
    }

    this.sessionCleanupTimer = setInterval(() => {
      void this.pruneExpiredSessions("interval");
    }, SESSION_CLEANUP_INTERVAL_MS);
    this.sessionCleanupTimer.unref?.();
  }

  private async pruneExpiredSessions(reason: "startup" | "message" | "interval"): Promise<void> {
    const expiredSessions = await this.sessionManager.pruneExpiredSessions(SESSION_TTL_MS);
    if (expiredSessions.length > 0) {
      for (const session of expiredSessions) {
        if (session.threadId) {
          await this.archiveThreadBestEffort(session.threadId, `expired:${session.conversationId}`);
        }
      }

      this.log.info("pruned expired codex sessions", {
        reason,
        expiredConversationIds: expiredSessions.map((session) => session.conversationId),
        ttlMs: SESSION_TTL_MS,
      });
    }
  }

  private async archiveThreadBestEffort(threadId: string, reason: string): Promise<void> {
    try {
      await this.codexRunner.archiveThread(threadId);
    } catch (error) {
      this.log.warn("failed to archive codex thread", {
        reason,
        threadId,
        error: (error as Error).message,
      });
    }
  }

  private async handleCommand(message: NormalizedChannelMessage): Promise<string | null> {
    const command = message.text.trim();

    if (command === "/reset") {
      const session = this.sessionManager.getSession(message.conversationId);
      if (session?.threadId) {
        await this.archiveThreadBestEffort(session.threadId, `reset:${message.conversationId}`);
      }
      await this.sessionManager.deleteSession(message.conversationId);
      return "Reset the current Codex session binding. The old thread has been archived, and the next message will start a new thread with guidance reloaded.";
    }

    if (command === "/new") {
      const session = this.sessionManager.getSession(message.conversationId);
      if (session?.threadId) {
        await this.archiveThreadBestEffort(session.threadId, `new:${message.conversationId}`);
      }
      await this.sessionManager.deleteSession(message.conversationId);
      return "Created a new session boundary. The old thread has been archived, and the next message will start a new thread with `SOUL.md` / `META.md` / `IDENTITY.md` / `USER.md` / `MEMORY.md` / `STORY.md` / `AGENTS.md` reloaded.";
    }

    if (command === "/compact") {
      const session = this.sessionManager.getSession(message.conversationId);
      if (!session?.threadId) {
        return "This conversation does not have a Codex thread that can be compacted yet.";
      }

      await this.codexRunner.compactThread(session.threadId);
      await this.sessionManager.markGuidanceRefreshNeeded(message.conversationId, true);
      return "Requested compaction for the current thread. The next valid message will reload guidance.";
    }

    if (command === "/status") {
      const session = this.sessionManager.getSession(message.conversationId);
      const heartbeat = this.sessionManager.getHeartbeatRun(message.conversationId);
      return session?.threadId
        ? [
            "This conversation is bound to a Codex session.",
            `conversation: ${message.conversationId}`,
            `thread: ${session.threadId}`,
            `chatType: ${session.chatType ?? "unknown"}`,
            `updatedAt: ${session.updatedAt}`,
            `needsGuidanceRefresh: ${session.needsGuidanceRefresh ? "yes" : "no"}`,
            `lastHeartbeatAt: ${heartbeat?.lastRunAt ?? "never"}`,
            `lastHeartbeatDelivered: ${heartbeat?.lastDeliveredText ? "yes" : "no"}`,
          ].join("\n")
        : `This conversation does not have a Codex session bound yet.\nconversation: ${message.conversationId}`;
    }

    if (command === "/diag") {
      const session = this.sessionManager.getSession(message.conversationId);
      const heartbeat = this.sessionManager.getHeartbeatRun(message.conversationId);
      return await buildConversationDiagnostics({
        config: this.config,
        guidanceLoader: this.guidanceLoader,
        session,
        conversationId: message.conversationId,
        heartbeat,
      });
    }

    return null;
  }

  private async runScheduledPrompt(task: {
    conversationId: string;
    prompt: string;
    name?: string;
    suppressReply?: string;
    taskKey?: string;
    mode?: ScheduledTaskMode;
    deliverWhen?: ScheduledTaskDeliverWhen;
  }): Promise<void> {
    const session = this.sessionManager.getSession(task.conversationId);
    if (!session?.threadId) {
      return;
    }

    const mode = task.mode ?? "chat";
    const deliverWhen = task.deliverWhen ?? "always";
    const guidance = await this.guidanceLoader.load(resolveScheduledGuidanceContext(mode));
    const result = await this.codexRunner.runWithOptions(
      buildTurnPrompt({
        userText: buildScheduledTaskPrompt(task.prompt, mode, deliverWhen),
        guidanceRefresh: session.needsGuidanceRefresh ? guidance.baseInstructions : undefined,
      }),
      {
        threadId: session.threadId,
      },
    );

    if (task.taskKey) {
      await this.sessionManager.upsertScheduledTaskRun(task.taskKey, {
        lastRunAt: new Date().toISOString(),
        lastDeliveredText: this.sessionManager.getScheduledTaskRun(task.taskKey)?.lastDeliveredText,
      });
    }

    if (!result.ok) {
      return;
    }

    if (session.needsGuidanceRefresh) {
      await this.sessionManager.markGuidanceRefreshNeeded(task.conversationId, false);
    }

    if (result.replyText) {
      if (task.suppressReply && result.replyText.trim() === task.suppressReply) {
        if (task.name === "heartbeat") {
          await this.sessionManager.upsertHeartbeatRun(task.conversationId, {
            lastRunAt: new Date().toISOString(),
            lastDeliveredText: this.sessionManager.getHeartbeatRun(task.conversationId)?.lastDeliveredText,
          });
        }
        return;
      }

      const sections = parseScheduledOutput(result.replyText);
      await this.persistScheduledMemory(
        sections.dailyMemoryText,
        sections.longTermMemoryText,
        sections.storyText,
      );
      const lastRun = task.taskKey
        ? this.sessionManager.getScheduledTaskRun(task.taskKey)
        : undefined;
      const shouldDeliver = shouldDeliverScheduledOutput({
        mode,
        deliverWhen,
        userText: sections.userText,
        hasExplicitUserSection: sections.hasExplicitUserSection,
        lastDeliveredText: lastRun?.lastDeliveredText,
      });

      if (task.taskKey) {
        await this.sessionManager.upsertScheduledTaskRun(task.taskKey, {
          lastRunAt: new Date().toISOString(),
          lastDeliveredText: shouldDeliver ? sections.userText : lastRun?.lastDeliveredText,
        });
      }

      if (task.name === "heartbeat") {
        const lastHeartbeat = this.sessionManager.getHeartbeatRun(task.conversationId);
        const shouldDeliverHeartbeat = shouldDeliverHeartbeatReply({
          replyText: result.replyText,
          lastDeliveredText: lastHeartbeat?.lastDeliveredText,
        });

        await this.sessionManager.upsertHeartbeatRun(task.conversationId, {
          lastRunAt: new Date().toISOString(),
          lastDeliveredText: shouldDeliverHeartbeat
            ? result.replyText.trim()
            : lastHeartbeat?.lastDeliveredText,
        });

        if (!shouldDeliverHeartbeat) {
          return;
        }
      }

      if (shouldDeliver) {
        await this.sendReply(task.conversationId, sections.userText);
      }
    }
  }

  private async persistScheduledMemory(
    dailyMemoryText: string,
    longTermMemoryText: string,
    storyText: string,
  ): Promise<void> {
    if (dailyMemoryText.trim()) {
      await this.memoryStore.appendDailyEntry(dailyMemoryText);
    }

    if (longTermMemoryText.trim()) {
      await this.memoryStore.appendLongTermEntry(longTermMemoryText);
    }

    if (storyText.trim()) {
      await this.memoryStore.appendStoryEntry(storyText);
    }
  }

  private async sendReply(conversationId: string, reply: string): Promise<void> {
    const payload = parseReplyPayload(reply);

    for (const text of payload.textParts) {
      if (shouldRenderAsMarkdown(text)) {
        await this.feishuClient.sendMarkdown(conversationId, text);
      } else {
        await this.feishuClient.sendText(conversationId, text);
      }
    }

    for (const image of payload.images) {
      const imageKey =
        image.source === "path"
          ? await this.feishuClient.uploadImageFromPath(image.value)
          : await this.feishuClient.uploadImageFromUrl(image.value);
      await this.feishuClient.sendImageByKey(conversationId, imageKey);
    }
  }
}

function isMissingSessionError(stderr: string): boolean {
  return /session|thread/i.test(stderr) && /not found|missing|unknown/i.test(stderr);
}

function resolveMessageGuidanceContext(message: NormalizedChannelMessage): GuidanceContext {
  void message;
  return "p2p";
}

function resolveScheduledGuidanceContext(mode: ScheduledTaskMode): GuidanceContext {
  if (mode === "background") {
    return "scheduled-background";
  }

  return "p2p";
}

function buildScheduledTaskPrompt(
  prompt: string,
  mode: ScheduledTaskMode,
  deliverWhen: ScheduledTaskDeliverWhen,
): string {
  const lines = [prompt.trim()];

  if (mode === "background") {
    lines.push(
      "This is a background scheduled task.",
      "Do the work quietly.",
      "If you want to update daily memory, wrap the entry in [[memory-daily]]...[[/memory-daily]].",
      "If you want to update long-term memory, wrap the entry in [[memory-long]]...[[/memory-long]].",
      "If you want to update the story timeline, wrap the distilled event in [[story]]...[[/story]].",
      "Only include a user-facing notification if absolutely necessary by wrapping it in [[user]]...[[/user]].",
      "If there is nothing to notify, reply with [[internal]]CRON_OK[[/internal]].",
    );
  } else if (mode === "background-then-chat") {
    lines.push(
      "This is a background-then-chat scheduled task.",
      "Do the work first, then provide the final user-facing digest.",
      "Optionally put working notes inside [[internal]]...[[/internal]].",
      "Use [[memory-daily]]...[[/memory-daily]] for diary or daily notes you want persisted.",
      "Use [[memory-long]]...[[/memory-long]] for durable lessons or preferences worth appending to MEMORY.md.",
      "Use [[story]]...[[/story]] for a timeline-style distillation of the event into STORY.md.",
      "Put the final user-facing message inside [[user]]...[[/user]] when you want exact delivery control.",
      `Delivery policy: ${deliverWhen}.`,
    );
  }

  return lines.join("\n\n");
}

function buildReplyText(result: CodexExecutionResult): string {
  if (result.ok && result.replyText) {
    return result.replyText;
  }

  if (result.timedOut) {
    return "Codex execution timed out. Please try again later.";
  }

  return "Codex execution failed. Check the service logs.";
}
