# Changelog

All notable changes to CodexClaw will be documented in this file.

## v0.1.0

Initial public release.

### Added

- Feishu WebSocket gateway to persistent local Codex sessions.
- One Codex thread per Feishu conversation.
- Local guidance templates for workspace-specific runtime state.
- Heartbeat and cron support for background work.
- macOS `launchd` service scripts for always-on mode.
- MIT license.

### Notes

- Personal runtime files are created locally and ignored by git.
- The repository ships generic templates in `docs/templates/`.
