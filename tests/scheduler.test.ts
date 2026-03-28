import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Scheduler } from "../src/core/scheduler.js";

test("Scheduler heartbeat reads HEARTBEAT.md and suppresses empty files", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "codexclaw-scheduler-"));
  const heartbeatFilePath = path.join(root, "HEARTBEAT.md");
  const observed: Array<{ conversationId: string; prompt: string; suppressReply?: string }> = [];

  await fs.writeFile(
    heartbeatFilePath,
    "# comment only\n\n- Check pending messages\n- Update MEMORY.md when needed\n",
  );

  const scheduler = new Scheduler(
    {
      heartbeatIntervalSec: 1_800,
      heartbeatFilePath,
      cronFilePath: path.join(root, "CRON.md"),
    },
    {
      listConversationIds: () => ["oc_1", "oc_2"],
      runPrompt: async (task) => {
        observed.push(task);
      },
    },
    createLogger(),
  );

  await scheduler["runHeartbeat"]();

  assert.equal(observed.length, 2);
  assert.equal(observed[0]?.conversationId, "oc_1");
  assert.equal(observed[0]?.suppressReply, "HEARTBEAT_OK");
  assert.match(observed[0]?.prompt ?? "", /HEARTBEAT_OK/);
  assert.match(observed[0]?.prompt ?? "", /Check pending messages/);
});

test("Scheduler skips heartbeat when HEARTBEAT.md is missing or comments only", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "codexclaw-scheduler-empty-"));
  const heartbeatFilePath = path.join(root, "HEARTBEAT.md");
  const observed: Array<{ conversationId: string; prompt: string }> = [];

  await fs.writeFile(heartbeatFilePath, "# nothing to do\n\n# still empty\n");

  const scheduler = new Scheduler(
    {
      heartbeatIntervalSec: 1_800,
      heartbeatFilePath,
      cronFilePath: path.join(root, "CRON.md"),
    },
    {
      listConversationIds: () => ["oc_1"],
      runPrompt: async (task) => {
        observed.push(task);
      },
    },
    createLogger(),
  );

  await scheduler["runHeartbeat"]();

  assert.deepEqual(observed, []);
});

function createLogger() {
  return {
    debug() {},
    info() {},
    warn() {},
    error() {},
  };
}
