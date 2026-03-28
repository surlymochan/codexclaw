import { spawnSync } from "node:child_process";

import { loadConfig } from "../core/config.js";
import { loadEnv } from "../core/env.js";
import { logger } from "../core/logger.js";
import { FeishuClient } from "../feishu/feishu-client.js";

async function main(): Promise<void> {
  loadEnv();
  const config = loadConfig();

  const codexVersion = spawnSync(config.codexBin, ["--version"], {
    cwd: config.codexWorkdir,
    encoding: "utf8",
  });

  if (codexVersion.status !== 0) {
    throw new Error(`codex unavailable: ${codexVersion.stderr || codexVersion.stdout}`);
  }

  logger.info("codex available", {
    version: codexVersion.stdout.trim(),
  });

  const feishuClient = new FeishuClient(
    {
      appId: config.feishuAppId,
      appSecret: config.feishuAppSecret,
      encryptKey: config.feishuEncryptKey,
      verificationToken: config.feishuVerificationToken,
    },
    logger,
  );

  const result = await feishuClient.selfCheck();
  if (!result.ok) {
    throw new Error(`feishu credential check failed: ${result.code ?? "unknown"} ${result.msg ?? ""}`);
  }

  logger.info("feishu credentials valid");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    logger.error("selfcheck failed", {
      error: (error as Error).message,
    });
    process.exit(1);
  });
