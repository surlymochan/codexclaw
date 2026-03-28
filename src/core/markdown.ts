import type { QuotedMessageContext } from "../types/channel.js";

export function buildTurnPrompt(params: {
  userText: string;
  quotedMessage?: QuotedMessageContext;
  guidanceRefresh?: string;
}): string {
  const sections: string[] = [
    "Reply in plain text by default.",
    "Only use Markdown when formatting materially improves readability, such as lists, headings, code blocks, or links.",
    "If you want the channel to send an image, emit one or more explicit markers on separate lines:",
    "[[image:path=/absolute/path/to/file.png]]",
    "[[image:url=https://example.com/file.png]]",
    "Do not describe these markers; output them directly.",
  ];

  if (params.guidanceRefresh) {
    sections.push("Re-apply the following guidance for this thread:", params.guidanceRefresh);
  }

  if (params.quotedMessage) {
    sections.push(
      [
        "Quoted Feishu message:",
        `- message_id: ${params.quotedMessage.messageId}`,
        `- sender_id: ${params.quotedMessage.senderId ?? "unknown"}`,
        `- type: ${params.quotedMessage.msgType ?? "unknown"}`,
        "Content:",
        params.quotedMessage.text || "(empty)",
      ].join("\n"),
    );
  }

  sections.push(`User message:\n${params.userText}`);
  return sections.join("\n\n");
}

export function shouldRenderAsMarkdown(text: string): boolean {
  const value = text.trim();
  if (!value) {
    return false;
  }

  return [
    /^#{1,6}\s/m,
    /^\s*[-*+]\s/m,
    /^\s*\d+\.\s/m,
    /```[\s\S]*```/,
    /\[[^\]]+\]\([^)]+\)/,
    /^\s*>\s/m,
    /\*\*[^*]+\*\*/,
  ].some((pattern) => pattern.test(value));
}
