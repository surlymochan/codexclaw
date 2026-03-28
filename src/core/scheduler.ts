import fs from "node:fs/promises";
import path from "node:path";

import cron from "node-cron";
import YAML from "yaml";

import type { Logger } from "./logger.js";
import type { ScheduledTaskDeliverWhen, ScheduledTaskMode } from "../types/channel.js";

export interface SchedulerTask {
  schedule: string;
  prompt: string;
  conversationId: string;
  name?: string;
  timezone?: string;
  suppressReply?: string;
  mode?: ScheduledTaskMode;
  deliverWhen?: ScheduledTaskDeliverWhen;
  taskKey?: string;
}

export interface SchedulerOptions {
  heartbeatIntervalSec: number;
  heartbeatFilePath: string;
  cronFilePath: string;
}

export interface SchedulerHooks {
  listConversationIds(): string[];
  runPrompt(task: SchedulerTask): Promise<void>;
}

export class Scheduler {
  constructor(
    private readonly options: SchedulerOptions,
    private readonly hooks: SchedulerHooks,
    private readonly log: Logger,
  ) {}

  async start(): Promise<void> {
    if (this.options.heartbeatIntervalSec > 0) {
      setInterval(() => {
        void this.runHeartbeat();
      }, this.options.heartbeatIntervalSec * 1000);
    }

    for (const task of await loadCronTasks(this.options.cronFilePath)) {
      cron.schedule(
        task.schedule,
        () => {
          void this.runTask(task);
        },
        task.timezone ? { timezone: task.timezone } : undefined,
      );
      this.log.info("registered cron task", {
        name: task.name ?? null,
        schedule: task.schedule,
        conversationId: task.conversationId,
        timezone: task.timezone ?? null,
      });
    }
  }

  private async runHeartbeat(): Promise<void> {
    const prompt = await loadHeartbeatPrompt(this.options.heartbeatFilePath);
    if (!prompt) {
      return;
    }

    for (const conversationId of this.hooks.listConversationIds()) {
      await this.runTask({
        conversationId,
        prompt,
        schedule: "@heartbeat",
        name: "heartbeat",
        suppressReply: "HEARTBEAT_OK",
      });
    }
  }

  private async runTask(task: SchedulerTask): Promise<void> {
    try {
      await this.hooks.runPrompt({
        ...task,
        prompt: renderScheduledPrompt(task.prompt),
      });
    } catch (error) {
      this.log.warn("scheduled task failed", {
        conversationId: task.conversationId,
        name: task.name ?? null,
        error: (error as Error).message,
      });
    }
  }
}

async function loadCronTasks(filePath: string): Promise<SchedulerTask[]> {
  try {
    const content = await fs.readFile(path.resolve(filePath), "utf8");
    const blocks = Array.from(content.matchAll(/```cron\n([\s\S]*?)```/g));
    const parsedTasks = blocks.map((match, index) => ({
      ...(YAML.parse(match[1] ?? "") as Partial<SchedulerTask>),
      __index: index,
    }));

    return parsedTasks
      .filter(hasRequiredCronFields)
      .map((task) => ({
        schedule: task.schedule,
        prompt: task.prompt,
        conversationId: task.conversationId,
        name: task.name,
        timezone: task.timezone,
        suppressReply: task.suppressReply,
        mode: task.mode,
        deliverWhen: task.deliverWhen,
        taskKey: buildTaskKey(task, task.__index),
      }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function loadHeartbeatPrompt(filePath: string): Promise<string | null> {
  let content: string;
  try {
    content = await fs.readFile(path.resolve(filePath), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }

  const checklist = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .join("\n");

  if (!checklist) {
    return null;
  }

  return [
    "Read the HEARTBEAT.md checklist below and follow it strictly.",
    "Do not infer tasks that are not written there.",
    "If you need to tell the user something important, put only that message in [[user]]...[[/user]].",
    "If nothing needs attention, reply with exactly HEARTBEAT_OK.",
    "HEARTBEAT.md:",
    checklist,
  ].join("\n\n");
}

function renderScheduledPrompt(prompt: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return prompt.replaceAll("{{today}}", today);
}

function buildTaskKey(task: Partial<SchedulerTask>, index: number): string {
  const name = task.name?.trim() || `task-${index + 1}`;
  const conversationId = task.conversationId?.trim() || "unknown";
  const schedule = task.schedule?.trim() || "unscheduled";
  return `${name}::${conversationId}::${schedule}`;
}

function hasRequiredCronFields(
  task: Partial<SchedulerTask> & { __index: number },
): task is {
  schedule: string;
  prompt: string;
  conversationId: string;
  name?: string;
  timezone?: string;
  suppressReply?: string;
  mode?: ScheduledTaskMode;
  deliverWhen?: ScheduledTaskDeliverWhen;
  __index: number;
} {
  return Boolean(task.schedule && task.prompt && task.conversationId);
}
