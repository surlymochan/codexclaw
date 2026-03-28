import { CodexChannelApp } from "./app.js";
import { loadConfig } from "./core/config.js";
import { loadEnv } from "./core/env.js";
import { logger } from "./core/logger.js";

async function main(): Promise<void> {
  loadEnv();
  const config = loadConfig();
  const app = new CodexChannelApp(config, logger);
  await app.start();
}

main().catch((error) => {
  logger.error("application failed to start", {
    error: (error as Error).message,
  });
  process.exitCode = 1;
});
