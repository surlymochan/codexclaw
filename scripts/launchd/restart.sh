#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LABEL="com.chenchao.codexclaw"

cd "$ROOT_DIR"

npm run build
launchctl kickstart -k "gui/$UID/$LABEL"

echo "Restarted launchd agent: $LABEL"
