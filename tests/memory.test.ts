import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { MemoryStore } from "../src/core/memory.js";

test("MemoryStore appends daily entries", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "codexclaw-memory-"));
  const store = new MemoryStore(root);

  const filePath = await store.appendDailyEntry("Daily note", "2026-03-27");
  const content = await fs.readFile(filePath, "utf8");

  assert.match(content, /Daily note/);
  assert.match(filePath, /daily-memory\/2026-03-27\.md$/);
});

test("MemoryStore appends long-term entries", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "codexclaw-memory-long-"));
  const store = new MemoryStore(root);

  const filePath = await store.appendLongTermEntry("Durable lesson");
  const content = await fs.readFile(filePath, "utf8");

  assert.match(content, /Durable lesson/);
  assert.match(filePath, /MEMORY\.md$/);
});

test("MemoryStore appends story entries", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "codexclaw-memory-story-"));
  const store = new MemoryStore(root);

  const filePath = await store.appendStoryEntry("A turning point");
  const content = await fs.readFile(filePath, "utf8");

  assert.match(content, /A turning point/);
  assert.match(filePath, /STORY\.md$/);
});
