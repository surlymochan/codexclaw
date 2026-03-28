import test from "node:test";
import assert from "node:assert/strict";

import { buildPostMessageContent } from "../src/feishu/feishu-message-content.js";

test("buildPostMessageContent wraps markdown in an interactive card with a derived title", () => {
  const card = JSON.parse(
    buildPostMessageContent("# AI 新闻推送\n\n1. 第一条\n2. 第二条"),
  );

  assert.equal(card.schema, "2.0");
  assert.equal(card.header.template, "blue");
  assert.equal(card.header.title.content, "AI 新闻推送");
  assert.equal(card.config.wide_screen_mode, true);
  assert.deepEqual(card.body.elements, [
    {
      tag: "markdown",
      content: "1. 第一条\n2. 第二条",
    },
  ]);
});

test("buildPostMessageContent falls back to a generic title when no heading is present", () => {
  const card = JSON.parse(buildPostMessageContent("第一行\n第二行"));

  assert.equal(card.header.title.content, "消息");
  assert.deepEqual(card.body.elements, [
    {
      tag: "markdown",
      content: "第一行\n第二行",
    },
  ]);
});

test("buildPostMessageContent preserves inline markdown and links", () => {
  const card = JSON.parse(
    buildPostMessageContent("这是 **粗体**、*斜体*、~~删除线~~、`代码` 和 [链接](https://example.com)"),
  );

  assert.deepEqual(card.body.elements, [
    {
      tag: "markdown",
      content: "这是 **粗体**、*斜体*、~~删除线~~、`代码` 和 [链接](https://example.com)",
    },
  ]);
});

test("buildPostMessageContent keeps the markdown body intact for the new card markdown renderer", () => {
  const card = JSON.parse(
    buildPostMessageContent(
      "# 总标题\n\n## 小节\n### 子节\n\n> 引用块\n\n1. 第一项\n2. 第二项\n- 第三项\n\n```ts\nconst a = 1;\n```",
    ),
  );

  assert.equal(card.header.title.content, "总标题");
  assert.deepEqual(card.body.elements, [
    {
      tag: "markdown",
      content:
        "## 小节\n### 子节\n\n> 引用块\n\n1. 第一项\n2. 第二项\n- 第三项\n\n```ts\nconst a = 1;\n```",
    },
  ]);
});
