import fs from "node:fs/promises";
import path from "node:path";

export class MemoryStore {
  constructor(private readonly rootDir: string) {}

  async appendDailyEntry(content: string, date = getTodayDateString()): Promise<string> {
    const filePath = path.join(this.rootDir, "daily-memory", `${date}.md`);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await appendSection(filePath, content.trim());
    return filePath;
  }

  async appendLongTermEntry(content: string): Promise<string> {
    const filePath = path.join(this.rootDir, "MEMORY.md");
    await ensureFile(filePath, "# Memory\n");
    await appendSection(filePath, content.trim());
    return filePath;
  }

  async appendStoryEntry(content: string): Promise<string> {
    const filePath = path.join(this.rootDir, "STORY.md");
    await ensureFile(filePath, "# STORY.md\n");
    await appendSection(filePath, content.trim());
    return filePath;
  }
}

async function ensureFile(filePath: string, initialContent: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, initialContent, "utf8");
  }
}

async function appendSection(filePath: string, content: string): Promise<void> {
  if (!content) {
    return;
  }

  const timestamp = new Date().toISOString();
  const block = `\n\n## ${timestamp}\n${content}\n`;
  await fs.appendFile(filePath, block, "utf8");
}

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}
