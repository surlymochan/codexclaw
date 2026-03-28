import type { NormalizedChannelMessage } from "../types/channel.js";
import { extractImageKeys, extractMessageText } from "./feishu-message-content.js";

export interface FeishuMessageEvent {
  sender?: {
    sender_id?: {
      open_id?: string;
      user_id?: string;
      union_id?: string;
    };
    sender_type?: string;
  };
  message?: {
    message_id?: string;
    parent_id?: string;
    chat_id?: string;
    chat_type?: string;
    message_type?: string;
    content?: string;
    mentions?: Array<{
      id?: {
        open_id?: string;
        user_id?: string;
        union_id?: string;
      };
    }>;
  };
}

export function parseFeishuMessageEvent(
  event: FeishuMessageEvent,
): NormalizedChannelMessage | null {
  const msg = event.message;
  if (event.sender?.sender_type !== "user") {
    return null;
  }

  const messageType = msg?.message_type;
  if (!messageType || !["text", "image", "post"].includes(messageType)) {
    return null;
  }

  if (!msg) {
    return null;
  }

  const messageId = msg.message_id;
  const conversationId = msg.chat_id;
  const chatType = msg.chat_type ?? "";
  const parentMessageId = msg.parent_id;
  const senderId =
    event.sender.sender_id?.open_id ||
    event.sender.sender_id?.user_id ||
    event.sender.sender_id?.union_id;

  if (!messageId || !conversationId || !senderId || !chatType) {
    return null;
  }

  const text = extractMessageText(messageType, msg.content);
  const imageKeys = extractImageKeys(messageType, msg.content);

  if (!text && imageKeys.length === 0) {
    return null;
  }

  const mentions = (msg.mentions ?? [])
    .map((mention) => mention.id?.open_id || mention.id?.user_id || mention.id?.union_id)
    .filter((value): value is string => Boolean(value));

  return {
    channel: "feishu",
    conversationId,
    messageId,
    parentMessageId,
    senderId,
    senderType: event.sender.sender_type,
    chatType,
    messageType,
    text,
    imageKeys,
    mentions,
    rawEvent: event,
  };
}
