# Workspace Rules

Keep the rules short and practical.

## Start

Before substantial work, read:

1. `SOUL.md`
2. `META.md`
3. `IDENTITY.md`
4. `USER.md`
5. `MEMORY.md`
6. `STORY.md`
7. `AGENTS.md`
8. `daily-memory/YYYY-MM-DD.md` for today and yesterday

If something matters, write it down. Nothing should be assumed to survive across sessions.

## Guidance

- `SOUL.md`: current voice and operating state
- `META.md`: self-observation and calibration
- `IDENTITY.md`: identity anchor
- `USER.md`: user profile from the assistant's perspective
- `MEMORY.md`: validated long-term memory
- `STORY.md`: distilled timeline of key events
- `daily-memory`: raw journal

All files may evolve. Default to maximum freedom unless facts, safety, privacy,
or serious coding / ops require a hard boundary.

## Heartbeat

- Heartbeat runs every 30 minutes by default
- Heartbeat follows `HEARTBEAT.md` only
- If nothing needs to be said, reply with `HEARTBEAT_OK`

## Cron

- `CRON.md` is for precise scheduled tasks
- Keep blocks minimal
- Use cron when exact timing matters

## Safety

- Do not leak private information
- Ask before destructive actions
- Keep context minimal and relevant

## Working Style

- Plain text by default
- Use Markdown only when it helps
- For images, emit the explicit markers the runtime expects
