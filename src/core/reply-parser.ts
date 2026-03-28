import type { ParsedReplyPayload } from "../types/channel.js";

const IMAGE_MARKER = /\[\[image:(path|url)=([^\]]+)\]\]/g;

export function parseReplyPayload(reply: string): ParsedReplyPayload {
  const images: ParsedReplyPayload["images"] = [];
  const textParts: string[] = [];

  let lastIndex = 0;
  for (const match of reply.matchAll(IMAGE_MARKER)) {
    const [raw, source, value] = match;
    if (!source || !value) {
      continue;
    }
    const index = match.index ?? 0;
    const prefix = reply.slice(lastIndex, index).trim();
    if (prefix) {
      textParts.push(prefix);
    }

    images.push({
      source: source as "path" | "url",
      value: value.trim(),
    });
    lastIndex = index + raw.length;
  }

  const tail = reply.slice(lastIndex).trim();
  if (tail) {
    textParts.push(tail);
  }

  if (images.length === 0) {
    return {
      textParts: [reply.trim()].filter(Boolean),
      images: [],
    };
  }

  return {
    textParts,
    images,
  };
}
