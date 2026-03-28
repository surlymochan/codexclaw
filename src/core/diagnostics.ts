import type { AppConfig } from "./config.js";
import { GuidanceLoader } from "./guidance-loader.js";
import type { GuidanceContext, SessionRecord } from "../types/channel.js";

export async function buildConversationDiagnostics(params: {
  config: AppConfig;
  guidanceLoader: GuidanceLoader;
  session?: SessionRecord;
  conversationId: string;
  heartbeat?: {
    lastRunAt?: string;
    lastDeliveredText?: string;
  };
}): Promise<string> {
  const context = resolveGuidanceContext(params.session);
  const guidance = await params.guidanceLoader.load(context);

  return [
    "Diagnostics",
    `conversation: ${params.conversationId}`,
    `chatType: ${params.session?.chatType ?? "unknown"}`,
    `thread: ${params.session?.threadId ?? "none"}`,
    `needsGuidanceRefresh: ${params.session?.needsGuidanceRefresh ? "yes" : "no"}`,
    `guidanceContext: ${context}`,
    `guidanceDirs: ${params.config.guidanceDirs.join(", ") || "(none)"}`,
    `loadedGuidanceFiles: ${guidance.files.length > 0 ? guidance.files.join(", ") : "(none)"}`,
    `heartbeatIntervalSec: ${params.config.heartbeatIntervalSec}`,
    `heartbeatFile: ${params.config.heartbeatFilePath}`,
    `lastHeartbeatAt: ${params.heartbeat?.lastRunAt ?? "never"}`,
    `lastHeartbeatDelivered: ${params.heartbeat?.lastDeliveredText ? "yes" : "no"}`,
    `cronFile: ${params.config.cronFilePath}`,
    `stateDir: ${params.config.stateDir}`,
  ].join("\n");
}

function resolveGuidanceContext(session?: SessionRecord): GuidanceContext {
  void session;
  return "p2p";
}
