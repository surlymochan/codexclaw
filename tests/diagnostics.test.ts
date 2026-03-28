import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildConversationDiagnostics } from "../src/core/diagnostics.js";
import { GuidanceLoader } from "../src/core/guidance-loader.js";
import type { AppConfig } from "../src/core/config.js";

test("buildConversationDiagnostics reports guidance and heartbeat state", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "codexclaw-diag-"));
  await fs.writeFile(path.join(root, "SOUL.md"), "Soul");
  await fs.writeFile(path.join(root, "AGENTS.md"), "Agents");

  const config = {
    feishuAppId: "cli_xxx",
    feishuAppSecret: "secret",
    codexBin: "codex",
    codexWorkdir: root,
    codexTimeoutMs: 120000,
    guidanceDirs: [root],
    heartbeatIntervalSec: 1800,
    heartbeatFilePath: path.join(root, "HEARTBEAT.md"),
    cronFilePath: path.join(root, "CRON.md"),
    stateDir: path.join(root, ".data"),
  } satisfies AppConfig;

  const diagnostics = await buildConversationDiagnostics({
    config,
    guidanceLoader: new GuidanceLoader(config.guidanceDirs),
    conversationId: "oc_1",
    session: {
      conversationId: "oc_1",
      threadId: "thread_1",
      chatType: "p2p",
      updatedAt: "2026-03-27T00:00:00.000Z",
    },
    heartbeat: {
      lastRunAt: "2026-03-27T01:00:00.000Z",
      lastDeliveredText: "hello",
    },
  });

  assert.match(diagnostics, /conversation: oc_1/);
  assert.match(diagnostics, /thread: thread_1/);
  assert.match(diagnostics, /guidanceContext: p2p/);
  assert.match(diagnostics, /loadedGuidanceFiles:/);
  assert.match(diagnostics, /lastHeartbeatAt: 2026-03-27T01:00:00.000Z/);
});
