import fs from "node:fs/promises";
import path from "node:path";

import type { PersistedState } from "../types/channel.js";

const DEFAULT_STATE: PersistedState = {
  sessions: {},
  processedMessageIds: [],
  scheduledTaskRuns: {},
  heartbeatRuns: {},
};

export class FileStore {
  private readonly stateFilePath: string;

  constructor(private readonly stateDir: string) {
    this.stateFilePath = path.join(stateDir, "state.json");
  }

  async load(): Promise<PersistedState> {
    await fs.mkdir(this.stateDir, { recursive: true });

    try {
      const content = await fs.readFile(this.stateFilePath, "utf8");
      const parsed = JSON.parse(content) as Partial<PersistedState>;
      return {
        sessions: Object.fromEntries(
          Object.entries(parsed.sessions ?? {}).map(([conversationId, session]) => [
            conversationId,
            {
              ...session,
              pendingImageMessages: session?.pendingImageMessages ?? [],
            },
          ]),
        ),
        processedMessageIds: parsed.processedMessageIds ?? [],
        scheduledTaskRuns: parsed.scheduledTaskRuns ?? {},
        heartbeatRuns: parsed.heartbeatRuns ?? {},
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        await this.save(DEFAULT_STATE);
        return structuredClone(DEFAULT_STATE);
      }

      throw error;
    }
  }

  async save(state: PersistedState): Promise<void> {
    await fs.mkdir(this.stateDir, { recursive: true });
    await fs.writeFile(this.stateFilePath, JSON.stringify(state, null, 2), "utf8");
  }
}
