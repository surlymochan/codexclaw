import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const LOCAL_GUIDANCE_FILES = [
  "SOUL.md",
  "META.md",
  "IDENTITY.md",
  "USER.md",
  "MEMORY.md",
  "STORY.md",
  "AGENTS.md",
  "HEARTBEAT.md",
  "CRON.md",
] as const;

export interface LocalGuidanceCopyResult {
  copied: string[];
  skipped: string[];
}

export interface CopyLocalGuidanceOptions {
  sourceRoot?: string;
  targetRoot?: string;
}

export async function copyLocalGuidance(options: CopyLocalGuidanceOptions = {}): Promise<LocalGuidanceCopyResult> {
  const sourceRoot = options.sourceRoot ?? getPackageRoot();
  const targetRoot = options.targetRoot ?? process.cwd();
  const templateRoot = path.join(sourceRoot, "docs", "templates");
  const copied: string[] = [];
  const skipped: string[] = [];

  for (const fileName of LOCAL_GUIDANCE_FILES) {
    await copyIfMissing(path.join(templateRoot, fileName), path.join(targetRoot, fileName), copied, skipped);
  }

  await copyDailyMemoryTemplate(templateRoot, targetRoot, copied, skipped);

  return { copied, skipped };
}

function getPackageRoot(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, "../../..");
}

async function copyDailyMemoryTemplate(
  templateRoot: string,
  targetRoot: string,
  copied: string[],
  skipped: string[],
): Promise<void> {
  const sourceDir = path.join(templateRoot, "daily-memory");
  const targetDir = path.join(targetRoot, "daily-memory");
  await fs.mkdir(targetDir, { recursive: true });

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    await copyIfMissing(sourcePath, targetPath, copied, skipped, path.join("daily-memory", entry.name));
  }
}

async function copyIfMissing(
  sourcePath: string,
  targetPath: string,
  copied: string[],
  skipped: string[],
  label = path.basename(targetPath),
): Promise<void> {
  try {
    await fs.access(targetPath);
    skipped.push(label);
    return;
  } catch {
    // File does not exist yet.
  }

  await ensureParentDir(targetPath);
  const content = await fs.readFile(sourcePath, "utf8");
  await fs.writeFile(targetPath, content, "utf8");
  copied.push(label);
}

async function ensureParentDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}
