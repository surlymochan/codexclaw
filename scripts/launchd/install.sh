#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LABEL="com.chenchao.codexclaw"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$PLIST_DIR/$LABEL.plist"
LOG_DIR="$ROOT_DIR/runtime/logs/launchd"
WRAPPER_DIR="$HOME/Library/Application Support/CodexClaw"
WRAPPER_PATH="$WRAPPER_DIR/launchd-wrapper.sh"

xml_escape() {
  local value="$1"
  value="${value//&/&amp;}"
  value="${value//</&lt;}"
  value="${value//>/&gt;}"
  printf '%s' "$value"
}

mkdir -p "$PLIST_DIR" "$LOG_DIR"
mkdir -p "$WRAPPER_DIR"

npm run selfcheck
npm run build

cat > "$WRAPPER_PATH" <<EOF
#!/usr/bin/env bash
set -euo pipefail

cd "$(xml_escape "$ROOT_DIR")"

if [[ ! -f dist/src/index.js ]]; then
  npm run build
fi

exec npm run start
EOF

chmod +x "$WRAPPER_PATH"

PATH_XML="$(xml_escape "$PATH")"
WRAPPER_XML="$(xml_escape "$WRAPPER_PATH")"
OUT_LOG_XML="$(xml_escape "$LOG_DIR/codexclaw.out.log")"
ERR_LOG_XML="$(xml_escape "$LOG_DIR/codexclaw.err.log")"

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$WRAPPER_XML</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$PATH_XML</string>
  </dict>
  <key>StandardOutPath</key>
  <string>$OUT_LOG_XML</string>
  <key>StandardErrorPath</key>
  <string>$ERR_LOG_XML</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$UID" "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$UID" "$PLIST_PATH"
launchctl enable "gui/$UID/$LABEL" >/dev/null 2>&1 || true
launchctl kickstart -k "gui/$UID/$LABEL"

echo "Installed launchd agent: $LABEL"
echo "Plist: $PLIST_PATH"
echo "Logs: $LOG_DIR"
