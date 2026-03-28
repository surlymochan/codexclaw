export interface NormalizedChannelMessage {
  channel: "feishu";
  conversationId: string;
  messageId: string;
  parentMessageId?: string;
  senderId: string;
  senderType: string;
  chatType: string;
  messageType: string;
  text: string;
  imageKeys: string[];
  mentions: string[];
  rawEvent: unknown;
}

export interface SessionRecord {
  conversationId: string;
  threadId?: string;
  chatType?: string;
  updatedAt: string;
  needsGuidanceRefresh?: boolean;
  pendingImageMessages?: PendingImageMessage[];
}

export interface PersistedState {
  sessions: Record<string, SessionRecord>;
  processedMessageIds: string[];
  scheduledTaskRuns?: Record<string, ScheduledTaskRunState>;
  heartbeatRuns?: Record<string, HeartbeatRunState>;
}

export interface ScheduledTaskRunState {
  lastRunAt: string;
  lastDeliveredText?: string;
}

export interface HeartbeatRunState {
  lastRunAt: string;
  lastDeliveredText?: string;
}

export interface PendingImageMessage {
  messageId: string;
  imageKeys: string[];
  createdAt: string;
}

export interface CodexExecutionResult {
  ok: boolean;
  threadId?: string;
  replyText?: string;
  timedOut: boolean;
  exitCode: number | null;
  stderr: string;
  rawEvents: unknown[];
}

export interface GuidanceBundle {
  baseInstructions?: string;
  files: string[];
}

export type GuidanceContext =
  | "p2p"
  | "scheduled-background";

export interface QuotedMessageContext {
  messageId: string;
  text: string;
  msgType?: string;
  senderId?: string;
}

export interface ImageInputAsset {
  path: string;
  mimeType?: string;
}

export interface ReplyImageAsset {
  source: "path" | "url";
  value: string;
}

export interface ParsedReplyPayload {
  textParts: string[];
  images: ReplyImageAsset[];
}

export type ScheduledTaskMode = "chat" | "background" | "background-then-chat";
export type ScheduledTaskDeliverWhen = "always" | "if-needed" | "on-change";
