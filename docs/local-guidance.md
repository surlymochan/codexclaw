# Local Guidance Files

These files are local runtime inputs. The app loads them from the repository root when present.

## Files

- `SOUL.md`: current voice and operating state
- `META.md`: cold self-observation and calibration
- `IDENTITY.md`: identity anchor
- `USER.md`: the user from the assistant's point of view
- `MEMORY.md`: verified long-term memory
- `STORY.md`: timeline of key events
- `AGENTS.md`: workspace rules for the runtime
- `HEARTBEAT.md`: heartbeat policy
- `CRON.md`: scheduled task policy
- `daily-memory/`: raw daily notes

## Setup

Use `npm run init:local-guidance` to copy templates from `docs/templates/` into the repository root.

## Rules

- Keep local guidance out of git.
- Keep the templates in `docs/templates/` as generic defaults so users can bootstrap their own copy.
- Treat the root-level files as user-specific runtime state, not project source.
