import test from "node:test";
import assert from "node:assert/strict";

import { parseReplyPayload } from "../src/core/reply-parser.js";
import { normalizeMarkdownText, shouldRenderAsMarkdown } from "../src/core/markdown.js";

test("parseReplyPayload splits text and image markers", () => {
  const result = parseReplyPayload(
    "Intro text\n[[image:path=/tmp/a.png]]\nTail text\n[[image:url=https://example.com/b.png]]",
  );

  assert.deepEqual(result.textParts, ["Intro text", "Tail text"]);
  assert.deepEqual(result.images, [
    {
      source: "path",
      value: "/tmp/a.png",
    },
    {
      source: "url",
      value: "https://example.com/b.png",
    },
  ]);
});

test("shouldRenderAsMarkdown detects italic and bold emphasis", () => {
  assert.equal(shouldRenderAsMarkdown("*italic*"), true);
  assert.equal(shouldRenderAsMarkdown("_italic_"), true);
  assert.equal(shouldRenderAsMarkdown("**bold**"), true);
});

test("shouldRenderAsMarkdown ignores plain text", () => {
  assert.equal(shouldRenderAsMarkdown("just text"), false);
});

test("normalizeMarkdownText removes backslash escapes before markdown punctuation", () => {
  assert.equal(normalizeMarkdownText("\\*italic\\*"), "*italic*");
  assert.equal(normalizeMarkdownText("\\_italic\\_"), "_italic_");
  assert.equal(normalizeMarkdownText("keep \\\\ slash"), "keep \\ slash");
});
