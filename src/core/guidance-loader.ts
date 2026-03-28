import fs from "node:fs/promises";
import path from "node:path";

import type { GuidanceBundle, GuidanceContext } from "../types/channel.js";

const GUIDANCE_FILENAMES = [
  "SOUL.md",
  "META.md",
  "IDENTITY.md",
  "USER.md",
  "MEMORY.md",
  "STORY.md",
  "AGENTS.md",
];
const DAILY_MEMORY_DIRNAME = "daily-memory";
const DAILY_MEMORY_RECENT_FILES = 2;

export class GuidanceLoader {
  constructor(private readonly guidanceDirs: string[]) {}

  async load(context: GuidanceContext = "p2p"): Promise<GuidanceBundle> {
    const sections: string[] = [];
    const files: string[] = [];
    const filenames = getGuidanceFilenamesForContext(context);

    for (const filename of filenames) {
      for (const dir of this.guidanceDirs) {
        const fullPath = path.join(dir, filename);
        try {
          const content = (await fs.readFile(fullPath, "utf8")).trim();
          if (!content) {
            continue;
          }

          files.push(fullPath);
          sections.push(`## ${filename}\n${content}`);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw error;
          }
        }
      }
    }

    for (const dir of this.guidanceDirs) {
      const recentFiles = await loadRecentDailyMemoryFiles(path.join(dir, DAILY_MEMORY_DIRNAME));
      for (const file of recentFiles) {
        files.push(file.path);
        sections.push(`## ${file.label}\n${file.content}`);
      }
    }

    if (sections.length === 0) {
      return {
        files: [],
      };
    }

    return {
      baseInstructions: [
        "The following guidance files are part of the runtime contract for this thread.",
        "Follow them as high-priority operating instructions unless the user explicitly overrides them.",
        ...sections,
      ].join("\n\n"),
      files,
    };
  }
}

function getGuidanceFilenamesForContext(context: GuidanceContext): string[] {
  void context;
  return GUIDANCE_FILENAMES;
}

async function loadRecentDailyMemoryFiles(dir: string): Promise<Array<{
  path: string;
  label: string;
  content: string;
}>> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const markdownFiles = entries
    .filter((entry) => /^\d{4}-\d{2}-\d{2}\.md$/.test(entry))
    .sort()
    .slice(-DAILY_MEMORY_RECENT_FILES);

  const loaded: Array<{ path: string; label: string; content: string }> = [];
  for (const filename of markdownFiles) {
    const fullPath = path.join(dir, filename);
    const content = (await fs.readFile(fullPath, "utf8")).trim();
    if (!content) {
      continue;
    }
    loaded.push({
      path: fullPath,
      label: `${DAILY_MEMORY_DIRNAME}/${filename}`,
      content,
    });
  }

  return loaded;
}
