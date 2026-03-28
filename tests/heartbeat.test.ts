import test from "node:test";
import assert from "node:assert/strict";

import { shouldDeliverHeartbeatReply } from "../src/core/heartbeat.js";

test("heartbeat suppresses plain text and HEARTBEAT_OK", () => {
  assert.equal(
    shouldDeliverHeartbeatReply({
      replyText: "HEARTBEAT_OK",
    }),
    false,
  );

  assert.equal(
    shouldDeliverHeartbeatReply({
      replyText: "plain reminder",
    }),
    false,
  );
});

test("heartbeat delivers explicit user reminders", () => {
  assert.equal(
    shouldDeliverHeartbeatReply({
      replyText: "[[user]]go to sleep[[/user]]",
    }),
    true,
  );
});

test("heartbeat suppresses duplicate delivered reminders", () => {
  assert.equal(
    shouldDeliverHeartbeatReply({
      replyText: "[[user]]go to sleep[[/user]]",
      lastDeliveredText: "go to sleep",
    }),
    false,
  );
});
