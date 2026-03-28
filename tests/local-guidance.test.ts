import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { LOCAL_GUIDANCE_FILES, copyLocalGuidance } from "../src/core/local-guidance.js";

test("copyLocalGuidance copies missing files and skips existing ones", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "codexclaw-guidance-"));
  const sourceRoot = path.join(rootDir, "source");
  const targetRoot = path.join(rootDir, "target");

  await fs.mkdir(path.join(sourceRoot, "docs", "templates", "daily-memory"), { recursive: true });
  await fs.mkdir(targetRoot, { recursive: true });

  for (const fileName of LOCAL_GUIDANCE_FILES) {
    await fs.writeFile(
      path.join(sourceRoot, "docs", "templates", fileName),
      `source ${fileName}`,
      "utf8",
    );
  }
  await fs.writeFile(path.join(sourceRoot, "docs", "templates", "daily-memory", "README.md"), "source daily", "utf8");
  await fs.writeFile(path.join(targetRoot, "USER.md"), "existing user", "utf8");

  const result = await copyLocalGuidance({
    sourceRoot,
    targetRoot,
  });

  assert.deepEqual(result.copied.sort(), [
    "AGENTS.md",
    "CRON.md",
    "HEARTBEAT.md",
    "IDENTITY.md",
    "MEMORY.md",
    "META.md",
    "SOUL.md",
    "STORY.md",
    "daily-memory/README.md",
  ]);
  assert.deepEqual(result.skipped, ["USER.md"]);
  assert.equal(await fs.readFile(path.join(targetRoot, "SOUL.md"), "utf8"), "source SOUL.md");
  assert.equal(await fs.readFile(path.join(targetRoot, "USER.md"), "utf8"), "existing user");
  assert.equal(
    await fs.readFile(path.join(targetRoot, "daily-memory", "README.md"), "utf8"),
    "source daily",
  );
});
