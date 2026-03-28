#!/usr/bin/env node

import { bootstrapWorkspace } from "./core/bootstrap.js";
import { copyLocalGuidance } from "./core/local-guidance.js";

async function main(): Promise<void> {
  const { command, options } = parseArgs(process.argv.slice(2));

  switch (command) {
    case "bootstrap":
      await bootstrapWorkspace({
        installDependencies: !options.noInstall,
        installService: options.service,
      });
      return;
    case "init-local-guidance":
    case "init":
      await runInitLocalGuidance();
      return;
    case "help":
    default:
      printHelp();
      return;
  }
}

async function runInitLocalGuidance(): Promise<void> {
  const result = await copyLocalGuidance();
  process.stdout.write(`copied: ${summarizeList(result.copied)}\n`);
  process.stdout.write(`skipped: ${summarizeList(result.skipped)}\n`);
}

function parseArgs(args: string[]): { command: string; options: { service: boolean; noInstall: boolean } } {
  const command = args[0] ?? "help";
  const options = {
    service: args.includes("--service"),
    noInstall: args.includes("--no-install"),
  };
  return { command, options };
}

function printHelp(): void {
  process.stdout.write(
    [
      "CodexClaw CLI",
      "",
      "Usage:",
      "  codexclaw bootstrap [--service] [--no-install]",
      "  codexclaw init-local-guidance",
      "",
      "Commands:",
      "  bootstrap           Install dependencies, create local guidance, and optionally install the launchd service.",
      "  init-local-guidance  Copy the local guidance templates into the current directory.",
      "",
      "Options:",
      "  --service           Install the macOS launchd service after bootstrap.",
      "  --no-install        Skip npm install during bootstrap.",
    ].join("\n"),
  );
}

function summarizeList(items: string[]): string {
  return items.length > 0 ? items.join(", ") : "(none)";
}

main().catch((error) => {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exitCode = 1;
});
