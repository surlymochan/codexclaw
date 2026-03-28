import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { copyLocalGuidance } from "./local-guidance.js";

export interface BootstrapOptions {
  cwd?: string;
  installDependencies?: boolean;
  installService?: boolean;
  logger?: (message: string) => void;
}

export async function bootstrapWorkspace(options: BootstrapOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const log = options.logger ?? ((message: string) => {
    process.stdout.write(`${message}\n`);
  });

  await assertPackageJsonExists(cwd);

  if (options.installDependencies !== false) {
    if (await hasNodeModules(cwd)) {
      log("node_modules already exists, skipping npm install.");
    } else {
      await runCommand("npm", ["install"], cwd);
    }
  }

  const envExamplePath = path.join(cwd, ".env.example");
  const envPath = path.join(cwd, ".env");
  if (await fileExists(envExamplePath) && !(await fileExists(envPath))) {
    await fs.copyFile(envExamplePath, envPath);
    log("Created .env from .env.example.");
  }

  const guidanceResult = await copyLocalGuidance({ targetRoot: cwd });
  log(`Local guidance copied: ${summarizeList(guidanceResult.copied)}`);
  log(`Local guidance skipped: ${summarizeList(guidanceResult.skipped)}`);

  if (options.installService) {
    await runCommand("npm", ["run", "service:install"], cwd);
    return;
  }

  log("Bootstrap complete.");
  log("Next: run `npm run dev` for local development, or `npm run service:install` for always-on mode.");
}

async function assertPackageJsonExists(cwd: string): Promise<void> {
  if (!(await fileExists(path.join(cwd, "package.json")))) {
    throw new Error("bootstrap must be run from a directory that contains package.json");
  }
}

async function hasNodeModules(cwd: string): Promise<boolean> {
  return fileExists(path.join(cwd, "node_modules"));
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(signal ? `${command} terminated by ${signal}` : `${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

function summarizeList(items: string[]): string {
  return items.length > 0 ? items.join(", ") : "(none)";
}
