import { parseScheduledOutput } from "./scheduled-output.js";

export function shouldDeliverHeartbeatReply(params: {
  replyText: string;
  lastDeliveredText?: string;
}): boolean {
  const sections = parseScheduledOutput(params.replyText);
  if (!sections.hasExplicitUserSection) {
    return false;
  }

  const next = sections.userText.trim();
  if (!next || next === "HEARTBEAT_OK") {
    return false;
  }

  return next !== params.lastDeliveredText?.trim();
}
