# CodexClaw

Feishu WebSocket gateway to persistent local `codex` CLI sessions.

## Overview

- one Codex thread per Feishu conversation
- plain text by default, Markdown when it helps
- local state for sessions, dedupe, memory, story, and scheduled runs
- local guidance loaded from root-level files you create from templates
- heartbeat and cron hooks for background work

## Requirements

- Node.js 22+
- a Feishu app with WebSocket event delivery enabled
- the local `codex` CLI

## Quickstart

```bash
cp .env.example .env
npm install
npm run init:local-guidance
npm run dev
```

See [docs/quickstart.md](docs/quickstart.md) for the full setup flow.

## Service

Use the macOS `launchd` agent for always-on mode:

```bash
npm run service:install
npm run service:restart
npm run service:uninstall
```

`npm run selfcheck` validates Feishu credentials and local `codex`.

## Local Guidance

The runtime reads local files from the repo root when they exist. Those files
are gitignored. Generic templates live in [docs/templates](docs/templates) and
setup notes are in [docs/local-guidance.md](docs/local-guidance.md).

## Docs

- [docs/quickstart.md](docs/quickstart.md)
- [docs/local-guidance.md](docs/local-guidance.md)
- [docs/open-source.md](docs/open-source.md)
- [CHANGELOG.md](CHANGELOG.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)

## Commands

- `/reset` drops the current Codex session
- `/status` shows session binding
- `/diag` shows runtime diagnostics
- `/new` starts a fresh thread with guidance reloaded
- `/compact` requests compaction and reinjection
