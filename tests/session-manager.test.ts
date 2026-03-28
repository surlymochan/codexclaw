import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { FileStore } from "../src/core/file-store.js";
import { SessionManager } from "../src/core/session-manager.js";

test("SessionManager persists conversation session mapping", async () => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-channel-state-"));
  const manager = new SessionManager(new FileStore(stateDir));
  await manager.init();

  await manager.upsertSession("oc_123", "thread_123");
  await manager.markProcessed("om_123");

  const reloaded = new SessionManager(new FileStore(stateDir));
  await reloaded.init();

  assert.equal(reloaded.getSession("oc_123")?.threadId, "thread_123");
  assert.equal(reloaded.hasProcessedMessage("om_123"), true);
});

test("SessionManager serializes work per conversation", async () => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-channel-lock-"));
  const manager = new SessionManager(new FileStore(stateDir));
  await manager.init();

  const order: string[] = [];

  const first = manager.withConversationLock("oc_123", async () => {
    order.push("first-start");
    await new Promise((resolve) => setTimeout(resolve, 20));
    order.push("first-end");
  });

  const second = manager.withConversationLock("oc_123", async () => {
    order.push("second-start");
    order.push("second-end");
  });

  await Promise.all([first, second]);
  assert.deepEqual(order, ["first-start", "first-end", "second-start", "second-end"]);
});

test("SessionManager persists pending image messages", async () => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-channel-pending-"));
  const manager = new SessionManager(new FileStore(stateDir));
  await manager.init();

  await manager.appendPendingImageMessage("oc_456", {
    messageId: "om_img_1",
    imageKeys: ["img_1"],
    createdAt: "2026-03-27T00:00:00.000Z",
  });

  const reloaded = new SessionManager(new FileStore(stateDir));
  await reloaded.init();

  assert.deepEqual(reloaded.getPendingImageMessages("oc_456"), [
    {
      messageId: "om_img_1",
      imageKeys: ["img_1"],
      createdAt: "2026-03-27T00:00:00.000Z",
    },
  ]);
});

test("SessionManager persists scheduled task run state", async () => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "codexclaw-scheduled-"));
  const manager = new SessionManager(new FileStore(stateDir));
  await manager.init();

  await manager.upsertScheduledTaskRun("daily-memory::oc_1::0 22 * * *", {
    lastRunAt: "2026-03-27T00:00:00.000Z",
    lastDeliveredText: "summary",
  });

  const reloaded = new SessionManager(new FileStore(stateDir));
  await reloaded.init();

  assert.deepEqual(reloaded.getScheduledTaskRun("daily-memory::oc_1::0 22 * * *"), {
    lastRunAt: "2026-03-27T00:00:00.000Z",
    lastDeliveredText: "summary",
  });
});

test("SessionManager persists heartbeat state", async () => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "codexclaw-heartbeat-"));
  const manager = new SessionManager(new FileStore(stateDir));
  await manager.init();

  await manager.upsertHeartbeatRun("oc_1", {
    lastRunAt: "2026-03-27T00:00:00.000Z",
    lastDeliveredText: "ping",
  });

  const reloaded = new SessionManager(new FileStore(stateDir));
  await reloaded.init();

  assert.deepEqual(reloaded.getHeartbeatRun("oc_1"), {
    lastRunAt: "2026-03-27T00:00:00.000Z",
    lastDeliveredText: "ping",
  });
});

test("SessionManager prunes sessions older than the configured TTL", async () => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-channel-prune-"));
  await fs.writeFile(
    path.join(stateDir, "state.json"),
    JSON.stringify(
      {
        sessions: {
          oc_old: {
            conversationId: "oc_old",
            threadId: "thread_old",
            updatedAt: "2026-03-25T00:00:00.000Z",
            needsGuidanceRefresh: false,
            pendingImageMessages: [],
          },
          oc_fresh: {
            conversationId: "oc_fresh",
            threadId: "thread_fresh",
            updatedAt: "2026-03-27T23:00:00.000Z",
            needsGuidanceRefresh: false,
            pendingImageMessages: [],
          },
        },
        processedMessageIds: ["om_1"],
        scheduledTaskRuns: {
          daily: {
            lastRunAt: "2026-03-27T00:00:00.000Z",
          },
        },
        heartbeatRuns: {
          oc_heartbeat: {
            lastRunAt: "2026-03-27T00:00:00.000Z",
          },
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  const manager = new SessionManager(new FileStore(stateDir));
  await manager.init();

  const removed = await manager.pruneExpiredSessions(
    24 * 60 * 60 * 1000,
    Date.parse("2026-03-28T00:00:00.000Z"),
  );

  assert.deepEqual(
    removed.map((session) => session.conversationId),
    ["oc_old"],
  );
  assert.equal(manager.getSession("oc_old"), undefined);
  assert.equal(manager.getSession("oc_fresh")?.threadId, "thread_fresh");
  assert.equal(manager.hasProcessedMessage("om_1"), true);
  assert.deepEqual(manager.getScheduledTaskRun("daily"), {
    lastRunAt: "2026-03-27T00:00:00.000Z",
  });
  assert.deepEqual(manager.getHeartbeatRun("oc_heartbeat"), {
    lastRunAt: "2026-03-27T00:00:00.000Z",
  });
});
