#!/usr/bin/env bash
# generate-patch.sh
# Creates webos-driver-improvements.patch from the diff between the published
# npm package (appium-lg-webos-driver@0.5.0) and the current project.
#
# Usage: bash scripts/generate-patch.sh
# Output: scripts/webos-driver-improvements.patch

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PATCH_FILE="$SCRIPT_DIR/webos-driver-improvements.patch"
TMP_DIR="$(mktemp -d)"
NPM_PKG_VERSION="0.5.0"

echo "→ Downloading appium-lg-webos-driver@${NPM_PKG_VERSION} from npm..."
npm pack "appium-lg-webos-driver@${NPM_PKG_VERSION}" --pack-destination "$TMP_DIR" 2>/dev/null
tar -xzf "$TMP_DIR/appium-lg-webos-driver-${NPM_PKG_VERSION}.tgz" -C "$TMP_DIR" --strip-components=1

echo "→ Generating patch..."

# Files to patch (lib/ JS sources + package.json)
PATCH_FILES=(
  "lib/cli/ares.js"
  "lib/constraints.js"
  "lib/driver.js"
  "lib/remote/lg-remote-client.js"
  "lib/remote/lg-socket-client.js"
  "package.json"
)

# Write unified diff for each changed file
{
  for f in "${PATCH_FILES[@]}"; do
    orig="$TMP_DIR/$f"
    curr="$PROJECT_DIR/$f"
    if [ ! -f "$orig" ]; then
      echo "  ! Skipping $f (not in npm package)"
      continue
    fi
    if ! diff -q "$orig" "$curr" >/dev/null 2>&1; then
      diff -u \
        --label "a/$f" \
        --label "b/$f" \
        "$orig" "$curr" || true   # diff exits 1 when files differ; "|| true" prevents set -e abort
    fi
  done
} > "$PATCH_FILE"

echo "→ Cleaning up..."
rm -rf "$TMP_DIR"

LINES=$(wc -l < "$PATCH_FILE" | tr -d ' ')
echo "✔ Patch written to: $PATCH_FILE  (${LINES} lines)"

