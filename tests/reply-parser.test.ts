import test from "node:test";
import assert from "node:assert/strict";

import { parseReplyPayload } from "../src/core/reply-parser.js";

test("parseReplyPayload splits text and image markers", () => {
  const result = parseReplyPayload(
    "Intro text\n[[image:path=/tmp/a.png]]\nTail text\n[[image:url=https://example.com/b.png]]",
  );

  assert.deepEqual(result.textParts, ["Intro text", "Tail text"]);
  assert.deepEqual(result.images, [
    {
      source: "path",
      value: "/tmp/a.png",
    },
    {
      source: "url",
      value: "https://example.com/b.png",
    },
  ]);
});
