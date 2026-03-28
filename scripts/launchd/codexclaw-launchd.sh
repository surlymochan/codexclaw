#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$ROOT_DIR"

if [[ ! -f dist/src/index.js ]]; then
  echo "codexclaw launchd runner: dist/src/index.js is missing; building first." >&2
  npm run build
fi

exec npm run start
