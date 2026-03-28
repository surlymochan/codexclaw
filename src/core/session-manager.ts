import { FileStore } from "./file-store.js";
import type {
  HeartbeatRunState,
  PendingImageMessage,
  PersistedState,
  ScheduledTaskRunState,
  SessionRecord,
} from "../types/channel.js";

const MAX_PROCESSED_IDS = 5_000;

export class SessionManager {
  private state: PersistedState = {
    sessions: {},
    processedMessageIds: [],
    scheduledTaskRuns: {},
    heartbeatRuns: {},
  };

  private readonly processedMessageIds = new Set<string>();
  private readonly conversationLocks = new Map<string, Promise<void>>();

  constructor(private readonly fileStore: FileStore) {}

  async init(): Promise<void> {
    this.state = await this.fileStore.load();
    for (const messageId of this.state.processedMessageIds) {
      this.processedMessageIds.add(messageId);
    }
  }

  hasProcessedMessage(messageId: string): boolean {
    return this.processedMessageIds.has(messageId);
  }

  getSession(conversationId: string): SessionRecord | undefined {
    return this.state.sessions[conversationId];
  }

  async upsertSession(conversationId: string, threadId: string, chatType?: string): Promise<void> {
    const previous = this.state.sessions[conversationId];
    this.state.sessions[conversationId] = {
      conversationId,
      threadId,
      chatType: chatType ?? previous?.chatType,
      updatedAt: new Date().toISOString(),
      needsGuidanceRefresh: previous?.needsGuidanceRefresh ?? false,
      pendingImageMessages: previous?.pendingImageMessages ?? [],
    };
    await this.persist();
  }

  async markGuidanceRefreshNeeded(conversationId: string, needed: boolean): Promise<void> {
    const session = this.state.sessions[conversationId];
    if (!session) {
      return;
    }

    session.needsGuidanceRefresh = needed;
    session.updatedAt = new Date().toISOString();
    await this.persist();
  }

  listSessions(): SessionRecord[] {
    return Object.values(this.state.sessions);
  }

  async deleteSession(conversationId: string): Promise<SessionRecord | undefined> {
    const existing = this.state.sessions[conversationId];
    if (!existing) {
      return undefined;
    }

    delete this.state.sessions[conversationId];
    await this.persist();
    return existing;
  }

  async pruneExpiredSessions(maxAgeMs: number, now = Date.now()): Promise<SessionRecord[]> {
    const expiredConversationIds = Object.values(this.state.sessions)
      .filter((session) => isSessionExpired(session.updatedAt, maxAgeMs, now))
      .map((session) => session.conversationId);

    if (expiredConversationIds.length === 0) {
      return [];
    }

    const expiredSessions: SessionRecord[] = [];
    for (const conversationId of expiredConversationIds) {
      const session = this.state.sessions[conversationId];
      if (session) {
        expiredSessions.push(session);
      }
      delete this.state.sessions[conversationId];
    }

    await this.persist();
    return expiredSessions;
  }

  async appendPendingImageMessage(
    conversationId: string,
    pending: PendingImageMessage,
  ): Promise<void> {
    const existing = this.state.sessions[conversationId];
    this.state.sessions[conversationId] = {
      conversationId,
      threadId: existing?.threadId,
      chatType: existing?.chatType,
      updatedAt: new Date().toISOString(),
      needsGuidanceRefresh: existing?.needsGuidanceRefresh ?? false,
      pendingImageMessages: [...(existing?.pendingImageMessages ?? []), pending],
    };

    await this.persist();
  }

  getPendingImageMessages(conversationId: string): PendingImageMessage[] {
    return this.state.sessions[conversationId]?.pendingImageMessages ?? [];
  }

  async clearPendingImageMessages(conversationId: string): Promise<void> {
    const session = this.state.sessions[conversationId];
    if (!session) {
      return;
    }

    session.pendingImageMessages = [];
    session.updatedAt = new Date().toISOString();
    await this.persist();
  }

  async markProcessed(messageId: string): Promise<void> {
    if (this.processedMessageIds.has(messageId)) {
      return;
    }

    this.processedMessageIds.add(messageId);
    this.state.processedMessageIds.push(messageId);

    if (this.state.processedMessageIds.length > MAX_PROCESSED_IDS) {
      const removed = this.state.processedMessageIds.splice(
        0,
        this.state.processedMessageIds.length - MAX_PROCESSED_IDS,
      );
      for (const id of removed) {
        this.processedMessageIds.delete(id);
      }
    }

    await this.persist();
  }

  getScheduledTaskRun(taskKey: string): ScheduledTaskRunState | undefined {
    return this.state.scheduledTaskRuns?.[taskKey];
  }

  async upsertScheduledTaskRun(taskKey: string, state: ScheduledTaskRunState): Promise<void> {
    this.state.scheduledTaskRuns ??= {};
    this.state.scheduledTaskRuns[taskKey] = state;
    await this.persist();
  }

  getHeartbeatRun(conversationId: string): HeartbeatRunState | undefined {
    return this.state.heartbeatRuns?.[conversationId];
  }

  async upsertHeartbeatRun(
    conversationId: string,
    state: HeartbeatRunState,
  ): Promise<void> {
    this.state.heartbeatRuns ??= {};
    this.state.heartbeatRuns[conversationId] = state;
    await this.persist();
  }

  async withConversationLock<T>(conversationId: string, work: () => Promise<T>): Promise<T> {
    const previous = this.conversationLocks.get(conversationId) ?? Promise.resolve();
    let release: (() => void) | undefined;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.conversationLocks.set(conversationId, previous.then(() => next));
    await previous;

    try {
      return await work();
    } finally {
      release?.();
      if (this.conversationLocks.get(conversationId) === next) {
        this.conversationLocks.delete(conversationId);
      }
    }
  }

  private async persist(): Promise<void> {
    await this.fileStore.save(this.state);
  }
}

function isSessionExpired(updatedAt: string, maxAgeMs: number, now: number): boolean {
  const updatedAtMs = Date.parse(updatedAt);
  if (Number.isNaN(updatedAtMs)) {
    return true;
  }

  return now - updatedAtMs >= maxAgeMs;
}
