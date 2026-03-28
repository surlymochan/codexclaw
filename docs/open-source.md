# Open Source Notes

CodexClaw is MIT licensed. The repository contains code, docs, and templates, but
your personal runtime files are meant to live outside git.

## What Stays in Git

- application code
- tests
- documentation
- generic templates in `docs/templates/`

## What Stays Local

- root-level guidance files created from templates
- `daily-memory/`
- `HEARTBEAT.md`
- `CRON.md`
- `.env`
- `.data/`

## Why

The repository should be safe to publish without leaking private memory or
workspace-specific state. Users bootstrap their own local guidance with
`npm run init:local-guidance`.
