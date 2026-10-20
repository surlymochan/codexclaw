# CodexClaw — English README

> A local Codex assistant gateway for Feishu/Lark.
> [中文](README.md) · English

CodexClaw connects Feishu/Lark chats to local `codex` CLI threads. Conversations, memory, and background
tasks all stay on your own machine.

## Features

- Every Feishu conversation maps to its own Codex thread
- Plain text by default; Markdown replies are rendered as Feishu JSON 2.0 template cards
- A Markdown card lifts the first `#` heading into the card title and passes the body through to the
  official `markdown` component
- Sessions, de-duplication, memory, stories, and scheduled tasks are stored locally
- Guidance is loaded from local files in the repository root
- Heartbeat and cron background tasks are supported

## Requirements

- Node.js 22+
- A Feishu app with WebSocket event push enabled
- A working local `codex` CLI

## Quick start

```bash
cp .env.example .env
npm install
npm run init:local-guidance
npm run dev
```

The full startup walkthrough is in [docs/quickstart.md](docs/quickstart.md).

## One-line setup

To prepare the local environment and install the resident service in one command:

```bash
npx -y @surlymochan/codexclaw bootstrap --service
```

## Run as a resident service

On macOS, resident running uses `launchd`:

```bash
npm run service:install
npm run service:restart
npm run service:uninstall
```

`npm run selfcheck` verifies the Feishu credentials and the local `codex` binary.

## Local guidance

At runtime the gateway reads local files from the repository root. These files are gitignored.
Generic templates live in [docs/templates](docs/templates); the local guidance guide is in
[docs/local-guidance.md](docs/local-guidance.md).

## Markdown template cards

Markdown in assistant replies is rendered as a Feishu JSON 2.0 card:

- The `#` heading becomes the card title
- `body.elements` uses the official `markdown` component
- Standard Markdown syntax is passed through to Feishu for rendering
- This path is used for every Markdown reply — briefs, logs, and explanations alike

## Commands

- `/reset` — reset the current Codex session
- `/status` — show the session binding status
- `/diag` — show runtime diagnostics
- `/new` — create a new thread and reload guidance
- `/compact` — request compaction and re-inject guidance

## Documentation

- [docs/quickstart.md](docs/quickstart.md)
- [docs/local-guidance.md](docs/local-guidance.md)
- [docs/open-source.md](docs/open-source.md)
- [CHANGELOG.md](CHANGELOG.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT
