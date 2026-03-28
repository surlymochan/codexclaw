function safeJsonParse(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function flattenPostContent(post: any): string {
  const locale = post?.zh_cn ?? post?.en_us ?? post;
  const title = typeof locale?.title === "string" ? locale.title.trim() : "";
  const rows = Array.isArray(locale?.content) ? locale.content : [];
  const lines = rows.map((row: any[]) =>
    row
      .map((item) => {
        if (typeof item?.text === "string") {
          return item.text;
        }
        if (typeof item?.href === "string" && typeof item?.text === "string") {
          return `[${item.text}](${item.href})`;
        }
        return "";
      })
      .filter(Boolean)
      .join(""),
  );

  return [title, ...lines].filter(Boolean).join("\n").trim();
}

function collectPostImageKeys(post: any): string[] {
  const locale = post?.zh_cn ?? post?.en_us ?? post;
  const rows = Array.isArray(locale?.content) ? locale.content : [];
  const keys: string[] = [];

  for (const row of rows) {
    if (!Array.isArray(row)) {
      continue;
    }

    for (const item of row) {
      const imageKey =
        typeof item?.image_key === "string"
          ? item.image_key
          : typeof item?.imageKey === "string"
            ? item.imageKey
            : undefined;
      if (imageKey) {
        keys.push(imageKey);
      }
    }
  }

  return keys;
}

function splitMarkdownTitle(markdown: string): { title: string; body: string } {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trimEnd());

  const firstContentLineIndex = lines.findIndex((line) => line.trim().length > 0);
  if (firstContentLineIndex === -1) {
    return { title: "消息", body: "" };
  }

  const firstLine = lines[firstContentLineIndex]!.trim();
  const headingMatch = firstLine.match(/^#{1,6}\s+(.+)$/);
  if (headingMatch?.[1]) {
    const title = headingMatch[1].trim() || "消息";
    const body = lines
      .slice(firstContentLineIndex + 1)
      .join("\n")
      .trim();
    return { title, body };
  }

  return {
    title: "消息",
    body: markdown.trim(),
  };
}

export function extractMessageText(msgType: string | undefined, rawContent: string | undefined): string {
  const content = rawContent?.trim() ?? "";
  if (!content) {
    return "";
  }

  if (msgType === "text") {
    const parsed = safeJsonParse(content);
    return typeof parsed?.text === "string" ? parsed.text.trim() : content;
  }

  if (msgType === "post") {
    const parsed = safeJsonParse(content);
    return flattenPostContent(parsed);
  }

  if (msgType === "interactive") {
    const parsed = safeJsonParse(content);
    if (typeof parsed === "string") {
      return parsed.trim();
    }
    return JSON.stringify(parsed);
  }

  if (msgType === "image") {
    return "";
  }

  return content;
}

export function buildPostMessageContent(markdown: string): string {
  const { title, body } = splitMarkdownTitle(markdown);
  const content = body.trim() || title;

  return JSON.stringify({
    schema: "2.0",
    config: {
      wide_screen_mode: true,
      enable_forward: true,
    },
    header: {
      template: "blue",
      title: {
        content: title,
        tag: "plain_text",
      },
    },
    body: {
      elements: [
        {
          tag: "markdown" as const,
          content,
        },
      ],
    },
  });
}

export function extractImageKey(rawContent: string | undefined): string | undefined {
  const parsed = safeJsonParse(rawContent ?? "");
  return typeof parsed?.image_key === "string" ? parsed.image_key : undefined;
}

export function extractImageKeys(
  msgType: string | undefined,
  rawContent: string | undefined,
): string[] {
  const parsed = safeJsonParse(rawContent ?? "");
  if (!parsed) {
    return [];
  }

  if (msgType === "image") {
    return typeof parsed?.image_key === "string" ? [parsed.image_key] : [];
  }

  if (msgType === "post") {
    return collectPostImageKeys(parsed);
  }

  return [];
}
