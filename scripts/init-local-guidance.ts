import { copyLocalGuidance } from "../src/core/local-guidance.js";

async function main(): Promise<void> {
  const result = await copyLocalGuidance();
  process.stdout.write(`copied: ${summarizeList(result.copied)}\n`);
  process.stdout.write(`skipped: ${summarizeList(result.skipped)}\n`);
}

function summarizeList(items: string[]): string {
  return items.length > 0 ? items.join(", ") : "(none)";
}

main().catch((error) => {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exitCode = 1;
});
