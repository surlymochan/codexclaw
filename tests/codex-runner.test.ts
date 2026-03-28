import test from "node:test";
import assert from "node:assert/strict";

import { reduceCodexJsonEvents } from "../src/codex/codex-runner.js";

test("reduceCodexJsonEvents extracts thread and final agent reply", () => {
  const result = reduceCodexJsonEvents([
    JSON.stringify({
      type: "thread.started",
      thread_id: "019d2eba-d4f9-73a1-86a9-aeff1f63681f",
    }),
    JSON.stringify({
      type: "item.completed",
      item: {
        type: "agent_message",
        text: "hello from codex",
      },
    }),
  ]);

  assert.equal(result.threadId, "019d2eba-d4f9-73a1-86a9-aeff1f63681f");
  assert.equal(result.replyText, "hello from codex");
  assert.equal(result.rawEvents.length, 2);
});
