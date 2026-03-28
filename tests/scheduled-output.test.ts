import test from "node:test";
import assert from "node:assert/strict";

import {
  parseScheduledOutput,
  shouldDeliverScheduledOutput,
} from "../src/core/scheduled-output.js";

test("parseScheduledOutput separates internal and user sections", () => {
  const parsed = parseScheduledOutput(`
[[internal]]
notes
[[/internal]]

[[user]]
digest
[[/user]]
`);

  assert.equal(parsed.internalText, "notes");
  assert.equal(parsed.userText, "digest");
  assert.equal(parsed.hasExplicitUserSection, true);
  assert.equal(parsed.dailyMemoryText, "");
  assert.equal(parsed.longTermMemoryText, "");
});

test("parseScheduledOutput extracts memory sections", () => {
  const parsed = parseScheduledOutput(`
[[memory-daily]]
today
[[/memory-daily]]

[[memory-long]]
lesson
[[/memory-long]]

[[story]]
timeline
[[/story]]
`);

  assert.equal(parsed.dailyMemoryText, "today");
  assert.equal(parsed.longTermMemoryText, "lesson");
  assert.equal(parsed.storyText, "timeline");
});

test("background mode only delivers tagged user output", () => {
  assert.equal(
    shouldDeliverScheduledOutput({
      mode: "background",
      deliverWhen: "always",
      userText: "digest",
      hasExplicitUserSection: true,
    }),
    true,
  );

  assert.equal(
    shouldDeliverScheduledOutput({
      mode: "background",
      deliverWhen: "always",
      userText: "plain text",
      hasExplicitUserSection: false,
    }),
    false,
  );
});

test("on-change delivery suppresses duplicate summaries", () => {
  assert.equal(
    shouldDeliverScheduledOutput({
      mode: "background-then-chat",
      deliverWhen: "on-change",
      userText: "same summary",
      lastDeliveredText: "same summary",
    }),
    false,
  );
});
