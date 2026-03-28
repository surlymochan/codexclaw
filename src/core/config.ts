import path from "node:path";

export interface AppConfig {
  feishuAppId: string;
  feishuAppSecret: string;
  feishuEncryptKey?: string;
  feishuVerificationToken?: string;
  codexBin: string;
  codexModel?: string;
  codexWorkdir: string;
  codexTimeoutMs: number;
  guidanceDirs: string[];
  heartbeatIntervalSec: number;
  heartbeatFilePath: string;
  cronFilePath: string;
  stateDir: string;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive number: ${value}`);
  }

  return parsed;
}

export function loadConfig(): AppConfig {
  return {
    feishuAppId: requireEnv("FEISHU_APP_ID"),
    feishuAppSecret: requireEnv("FEISHU_APP_SECRET"),
    feishuEncryptKey: process.env.FEISHU_ENCRYPT_KEY?.trim() || undefined,
    feishuVerificationToken: process.env.FEISHU_VERIFICATION_TOKEN?.trim() || undefined,
    codexBin: process.env.CODEX_BIN?.trim() || "codex",
    codexModel: process.env.CODEX_MODEL?.trim() || undefined,
    codexWorkdir: path.resolve(process.env.CODEX_WORKDIR?.trim() || process.cwd()),
    codexTimeoutMs: parseNumber(process.env.CODEX_TIMEOUT_MS, 120_000),
    guidanceDirs: [path.resolve(process.cwd())],
    heartbeatIntervalSec: parseNumber(process.env.HEARTBEAT_INTERVAL_SEC, 1_800),
    heartbeatFilePath: path.resolve(process.env.HEARTBEAT_FILE?.trim() || "HEARTBEAT.md"),
    cronFilePath: path.resolve(process.env.CRON_FILE?.trim() || "CRON.md"),
    stateDir: path.resolve(process.env.STATE_DIR?.trim() || ".data"),
  };
}
