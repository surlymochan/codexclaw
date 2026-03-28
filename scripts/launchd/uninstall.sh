#!/usr/bin/env bash
set -euo pipefail

LABEL="com.chenchao.codexclaw"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl bootout "gui/$UID" "$PLIST_PATH" >/dev/null 2>&1 || true
rm -f "$PLIST_PATH"

echo "Removed launchd agent: $LABEL"
