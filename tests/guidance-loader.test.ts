import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { GuidanceLoader } from "../src/core/guidance-loader.js";

test("GuidanceLoader loads identity, memory, story, and recent daily-memory files", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "codexclaw-guidance-"));
  const dailyMemoryDir = path.join(root, "daily-memory");

  await fs.mkdir(dailyMemoryDir, { recursive: true });
  await fs.writeFile(path.join(root, "SOUL.md"), "Soul");
  await fs.writeFile(path.join(root, "META.md"), "Meta");
  await fs.writeFile(path.join(root, "IDENTITY.md"), "Identity");
  await fs.writeFile(path.join(root, "AGENTS.md"), "Agents");
  await fs.writeFile(path.join(root, "USER.md"), "User");
  await fs.writeFile(path.join(root, "MEMORY.md"), "Memory");
  await fs.writeFile(path.join(root, "STORY.md"), "Story");
  await fs.writeFile(path.join(dailyMemoryDir, "2026-03-25.md"), "Old");
  await fs.writeFile(path.join(dailyMemoryDir, "2026-03-26.md"), "Yesterday");
  await fs.writeFile(path.join(dailyMemoryDir, "2026-03-27.md"), "Today");

  const guidance = await new GuidanceLoader([root]).load();

  assert.ok(guidance.baseInstructions?.includes("## META.md\nMeta"));
  assert.ok(guidance.baseInstructions?.includes("## IDENTITY.md\nIdentity"));
  assert.ok(guidance.baseInstructions?.includes("## MEMORY.md\nMemory"));
  assert.ok(guidance.baseInstructions?.includes("## STORY.md\nStory"));
  assert.ok(guidance.baseInstructions?.includes("## daily-memory/2026-03-26.md\nYesterday"));
  assert.ok(guidance.baseInstructions?.includes("## daily-memory/2026-03-27.md\nToday"));
  assert.ok(!guidance.baseInstructions?.includes("## daily-memory/2026-03-25.md\nOld"));
});

test("GuidanceLoader includes MEMORY.md in p2p context", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "codexclaw-guidance-p2p-"));

  await fs.writeFile(path.join(root, "SOUL.md"), "Soul");
  await fs.writeFile(path.join(root, "META.md"), "Meta");
  await fs.writeFile(path.join(root, "IDENTITY.md"), "Identity");
  await fs.writeFile(path.join(root, "AGENTS.md"), "Agents");
  await fs.writeFile(path.join(root, "USER.md"), "User");
  await fs.writeFile(path.join(root, "MEMORY.md"), "Memory");
  await fs.writeFile(path.join(root, "STORY.md"), "Story");

  const guidance = await new GuidanceLoader([root]).load("p2p");

  assert.ok(guidance.baseInstructions?.includes("## META.md\nMeta"));
  assert.ok(guidance.baseInstructions?.includes("## IDENTITY.md\nIdentity"));
  assert.ok(guidance.baseInstructions?.includes("## MEMORY.md\nMemory"));
  assert.ok(guidance.baseInstructions?.includes("## STORY.md\nStory"));
});
