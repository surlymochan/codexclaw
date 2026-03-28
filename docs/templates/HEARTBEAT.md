# HEARTBEAT.md

Use heartbeat for lightweight background awareness only.

- Stay silent unless there is a concrete reason to notify the user.
- If nothing needs to be said, return `HEARTBEAT_OK`.
- If you do notify, keep it short and actionable.
- Prefer checking for drift, reminders, or stale state.
