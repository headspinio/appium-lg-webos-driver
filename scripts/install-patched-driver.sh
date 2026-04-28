#!/usr/bin/env bash
# install-patched-driver.sh
# 1. Installs appium-lg-webos-driver globally via npm
# 2. Applies the improvements patch
# 3. Registers the patched driver with Appium
#
# Usage: bash scripts/install-patched-driver.sh
# Requires: patch, npm, appium

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCH_FILE="$SCRIPT_DIR/webos-driver-improvements.patch"

# ── 1. Locate npm global prefix ──────────────────────────────────────────────
NPM_PREFIX="$(npm config get prefix)"
DRIVER_DIR="$NPM_PREFIX/lib/node_modules/appium-lg-webos-driver"

echo "══════════════════════════════════════════════════"
echo " LG WebOS Driver – patched install"
echo "══════════════════════════════════════════════════"

# ── 2. Check patch file exists ────────────────────────────────────────────────
if [ ! -f "$PATCH_FILE" ]; then
  echo "✖ Patch file not found: $PATCH_FILE"
  echo "  Run  bash scripts/generate-patch.sh  first."
  exit 1
fi

# ── 3. Remove existing webos driver (yaml + both directories) ────────────────
echo ""
echo "→ Removing existing webos driver..."

# Remove from both extensions.yaml locations using python3 (always available on macOS)
for YAML_FILE in \
  "$HOME/.appium/extensions.yaml" \
  "$HOME/.appium/node_modules/.cache/appium/extensions.yaml"; do
  if [ -f "$YAML_FILE" ]; then
    python3 -c "
import yaml, sys
with open('$YAML_FILE') as f: doc = yaml.safe_load(f) or {}
if doc.get('drivers', {}).pop('webos', None) is not None:
    with open('$YAML_FILE', 'w') as f: yaml.dump(doc, f, default_flow_style=False)
    print('  ✔ Removed webos from $YAML_FILE')
else:
    print('  - webos not found in $YAML_FILE')
" 2>/dev/null || true
  fi
done

# Remove from ~/.appium/node_modules (Appium's own install location)
APPIUM_DRIVER_DIR="$HOME/.appium/node_modules/appium-lg-webos-driver"
if [ -d "$APPIUM_DRIVER_DIR" ]; then
  rm -rf "$APPIUM_DRIVER_DIR"
  echo "  ✔ Removed $APPIUM_DRIVER_DIR"
fi

# Remove from global npm prefix
if [ -d "$DRIVER_DIR" ]; then
  rm -rf "$DRIVER_DIR"
  echo "  ✔ Removed $DRIVER_DIR"
fi

# ── 4. Install the published driver globally ──────────────────────────────────
echo ""
echo "→ Step 1/3 – Installing appium-lg-webos-driver from npm..."
npm install -g appium-lg-webos-driver
echo "✔ Installed to: $DRIVER_DIR"

# ── 4. Apply patch ───────────────────────────────────────────────────────────
echo ""
echo "→ Step 2/3 – Applying patch..."
pushd "$DRIVER_DIR" > /dev/null

# Dry-run first to detect any issues
if ! patch --dry-run -p1 --forward < "$PATCH_FILE" > /dev/null 2>&1; then
  echo "  ⚠ Dry-run check failed – attempting to apply anyway (patch may be partially applied)..."
fi

patch -p1 --forward --reject-file=/tmp/webos-driver.rej < "$PATCH_FILE" && {
  echo "✔ Patch applied successfully"
} || {
  EXIT=$?
  if [ $EXIT -eq 1 ] && [ -f /tmp/webos-driver.rej ]; then
    echo "✖ Some hunks failed to apply. Rejected hunks saved to /tmp/webos-driver.rej"
    cat /tmp/webos-driver.rej
    popd > /dev/null
    exit 1
  fi
}

# Fix version in package.json to 0.6.0
sed -i '' 's/"version": "0.5.0"/"version": "0.6.0"/' "$DRIVER_DIR/package.json" 2>/dev/null || \
  sed -i 's/"version": "0.5.0"/"version": "0.6.0"/' "$DRIVER_DIR/package.json"

echo "✔ Version bumped to 0.6.0 in $DRIVER_DIR/package.json"

popd > /dev/null

# ── 5. Register with Appium via extensions.yaml cache ────────────────────────
echo ""
echo "→ Step 3/3 – Registering driver with Appium..."

APPIUM_CACHE_DIR="$HOME/.appium/node_modules/.cache/appium"
APPIUM_EXT_YAML="$APPIUM_CACHE_DIR/extensions.yaml"
mkdir -p "$APPIUM_CACHE_DIR"

# Create cache yaml if it doesn't exist
if [ ! -f "$APPIUM_EXT_YAML" ]; then
  echo "drivers: {}" > "$APPIUM_EXT_YAML"
  echo "plugins: {}" >> "$APPIUM_EXT_YAML"
  echo "schemaRev: 4" >> "$APPIUM_EXT_YAML"
fi

# Remove existing webos entry if present, then append fresh entry
node -e "
const fs = require('fs');
const yaml = require('js-yaml');
const file = process.env.HOME + '/.appium/node_modules/.cache/appium/extensions.yaml';
let doc = {};
try { doc = yaml.load(fs.readFileSync(file, 'utf8')) || {}; } catch(e) {}
if (!doc.drivers) doc.drivers = {};
if (!doc.plugins) doc.plugins = {};
if (!doc.schemaRev) doc.schemaRev = 4;
doc.drivers.webos = {
  pkgName: 'appium-lg-webos-driver',
  version: '0.6.0',
  installType: 'npm',
  installSpec: 'appium-lg-webos-driver',
  installPath: '$HOME/.appium/node_modules/appium-lg-webos-driver',
  appiumVersion: '^3.0.0',
  automationName: 'webOS',
  platformNames: ['LGTV'],
  mainClass: 'WebOSDriver'
};
fs.writeFileSync(file, yaml.dump(doc));
console.log('✔ webos entry written to ' + file);
" || {
  # Fallback: append raw YAML if js-yaml not available
  python3 -c "
import yaml, os, sys
file = os.path.expanduser('~/.appium/node_modules/.cache/appium/extensions.yaml')
with open(file) as f: doc = yaml.safe_load(f) or {}
if 'drivers' not in doc: doc['drivers'] = {}
if 'plugins' not in doc: doc['plugins'] = {}
if 'schemaRev' not in doc: doc['schemaRev'] = 4
home = os.path.expanduser('~')
doc['drivers']['webos'] = {
  'pkgName': 'appium-lg-webos-driver',
  'version': '0.6.0',
  'installType': 'npm',
  'installSpec': 'appium-lg-webos-driver',
  'installPath': home + '/.appium/node_modules/appium-lg-webos-driver',
  'appiumVersion': '^3.0.0',
  'automationName': 'webOS',
  'platformNames': ['LGTV'],
  'mainClass': 'WebOSDriver'
}
with open(file, 'w') as f: yaml.dump(doc, f, default_flow_style=False)
print('✔ webos entry written (python fallback)')
"
}

echo ""
echo "══════════════════════════════════════════════════"
echo "✔ Done! appium-lg-webos-driver (patched) is ready."
echo "══════════════════════════════════════════════════"
appium driver list --installed 2>&1 | grep -i "webos\|tizen\|uiautomator" || true

