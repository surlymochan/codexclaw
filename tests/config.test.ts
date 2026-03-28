import test from "node:test";
import assert from "node:assert/strict";

import { loadConfig } from "../src/core/config.js";

test("loadConfig uses default settings", () => {
  const previous = {
    FEISHU_APP_ID: process.env.FEISHU_APP_ID,
    FEISHU_APP_SECRET: process.env.FEISHU_APP_SECRET,
    HEARTBEAT_INTERVAL_SEC: process.env.HEARTBEAT_INTERVAL_SEC,
  };

  process.env.FEISHU_APP_ID = "cli_xxx";
  process.env.FEISHU_APP_SECRET = "secret";

  const config = loadConfig();
  assert.equal(config.heartbeatIntervalSec, 1800);
  assert.deepEqual(config.guidanceDirs, [process.cwd()]);

  if (previous.FEISHU_APP_ID === undefined) {
    delete process.env.FEISHU_APP_ID;
  } else {
    process.env.FEISHU_APP_ID = previous.FEISHU_APP_ID;
  }

  if (previous.FEISHU_APP_SECRET === undefined) {
    delete process.env.FEISHU_APP_SECRET;
  } else {
    process.env.FEISHU_APP_SECRET = previous.FEISHU_APP_SECRET;
  }

  if (previous.HEARTBEAT_INTERVAL_SEC === undefined) {
    delete process.env.HEARTBEAT_INTERVAL_SEC;
  } else {
    process.env.HEARTBEAT_INTERVAL_SEC = previous.HEARTBEAT_INTERVAL_SEC;
  }
});
