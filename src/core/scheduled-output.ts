import type { ScheduledTaskDeliverWhen, ScheduledTaskMode } from "../types/channel.js";

export interface ScheduledOutputSections {
  internalText: string;
  userText: string;
  hasExplicitUserSection: boolean;
  dailyMemoryText: string;
  longTermMemoryText: string;
  storyText: string;
}

type ScheduledSectionTag = "internal" | "user" | "memory-daily" | "memory-long" | "story";

export function parseScheduledOutput(replyText: string): ScheduledOutputSections {
  const internalText = extractTaggedSection(replyText, "internal");
  const userText = extractTaggedSection(replyText, "user");
  const dailyMemoryText = extractTaggedSection(replyText, "memory-daily");
  const longTermMemoryText = extractTaggedSection(replyText, "memory-long");
  const storyText = extractTaggedSection(replyText, "story");

  if (internalText || userText || dailyMemoryText || longTermMemoryText || storyText) {
    return {
      internalText,
      userText,
      hasExplicitUserSection: Boolean(userText),
      dailyMemoryText,
      longTermMemoryText,
      storyText,
    };
  }

  return {
    internalText: "",
    userText: replyText.trim(),
    hasExplicitUserSection: false,
    dailyMemoryText: "",
    longTermMemoryText: "",
    storyText: "",
  };
}

export function shouldDeliverScheduledOutput(params: {
  mode: ScheduledTaskMode;
  deliverWhen: ScheduledTaskDeliverWhen;
  userText: string;
  hasExplicitUserSection?: boolean;
  lastDeliveredText?: string;
}): boolean {
  const text = params.userText.trim();

  if (!text) {
    return false;
  }

  if (params.mode === "background") {
    return params.hasExplicitUserSection === true;
  }

  if (params.deliverWhen === "if-needed") {
    return text !== "CRON_OK";
  }

  if (params.deliverWhen === "on-change") {
    return text !== params.lastDeliveredText;
  }

  return true;
}

function extractTaggedSection(content: string, tag: ScheduledSectionTag): string {
  const match = content.match(new RegExp(`\\[\\[${tag}\\]\\]([\\s\\S]*?)\\[\\[\\/${tag}\\]\\]`, "i"));
  return match?.[1]?.trim() ?? "";
}
