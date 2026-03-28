import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const templateDir = path.join(rootDir, "docs", "templates");
const fileMappings: Array<[string, string]> = [
  ["SOUL.md", "SOUL.md"],
  ["META.md", "META.md"],
  ["IDENTITY.md", "IDENTITY.md"],
  ["USER.md", "USER.md"],
  ["MEMORY.md", "MEMORY.md"],
  ["STORY.md", "STORY.md"],
  ["AGENTS.md", "AGENTS.md"],
  ["HEARTBEAT.md", "HEARTBEAT.md"],
  ["CRON.md", "CRON.md"],
];

async function main(): Promise<void> {
  const copied: string[] = [];
  const skipped: string[] = [];

  for (const [templateName, targetName] of fileMappings) {
    const sourcePath = path.join(templateDir, templateName);
    const targetPath = path.join(rootDir, targetName);
    await ensureParentDir(targetPath);

    try {
      await fs.access(targetPath);
      skipped.push(targetName);
      continue;
    } catch {
      // fall through
    }

    const content = await fs.readFile(sourcePath, "utf8");
    await fs.writeFile(targetPath, content, "utf8");
    copied.push(targetName);
  }

  const dailyMemorySourceDir = path.join(templateDir, "daily-memory");
  const dailyMemoryTargetDir = path.join(rootDir, "daily-memory");
  await fs.mkdir(dailyMemoryTargetDir, { recursive: true });

  const dailyEntries = await fs.readdir(dailyMemorySourceDir, { withFileTypes: true });
  for (const entry of dailyEntries) {
    if (!entry.isFile()) {
      continue;
    }

    const sourcePath = path.join(dailyMemorySourceDir, entry.name);
    const targetPath = path.join(dailyMemoryTargetDir, entry.name);
    try {
      await fs.access(targetPath);
      skipped.push(path.join("daily-memory", entry.name));
      continue;
    } catch {
      // fall through
    }

    const content = await fs.readFile(sourcePath, "utf8");
    await fs.writeFile(targetPath, content, "utf8");
    copied.push(path.join("daily-memory", entry.name));
  }

  const copiedText = copied.length > 0 ? copied.join(", ") : "(none)";
  const skippedText = skipped.length > 0 ? skipped.join(", ") : "(none)";
  process.stdout.write(
    [
      `copied: ${copiedText}`,
      `skipped: ${skippedText}`,
    ].join("\n"),
  );
}

async function ensureParentDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

main().catch((error) => {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exitCode = 1;
});
