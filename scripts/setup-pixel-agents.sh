#!/usr/bin/env bash
set -euo pipefail

# Clones, builds, and stages the Pixel Agents office renderer.
#
# Mirrors scripts/setup-vendor.sh: the commit is pinned in .pixel-agents-version
# and vendor/pixel-agents is gitignored with its own .git.
#
# The renderer is driven over its own message protocol, so it carries far less
# carried source than the OpenClaw vendor: one patch, in
# vendor-patches/pixel-agents/, which lets the embedding host translate the four
# labels drawn over characters. Upstream has no i18n at all, so there is no
# protocol-level way to do it - and those labels are the only user-visible text
# inside the office. The patch is written to be upstreamable.
#
# The other modification is a host shim appended to the built index.html, which
# supplies the `acquireVsCodeApi` global its PostMessageTransport expects. That
# is the contract VS Code itself implements, not a fork.

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HASH="$(tr -d '[:space:]' < "$REPO_ROOT/.pixel-agents-version")"
VENDOR_DIR="$REPO_ROOT/vendor/pixel-agents"
STAGE_DIR="$REPO_ROOT/apps/desktop/build/office"

SKIP_CLONE=false
for arg in "$@"; do
  case "$arg" in
    --skip-clone) SKIP_CLONE=true ;;
  esac
done

echo "Setting up Pixel Agents vendor @ $HASH"

if [ "$SKIP_CLONE" = false ] && [ ! -d "$VENDOR_DIR/.git" ]; then
  mkdir -p "$REPO_ROOT/vendor"
  git clone https://github.com/pixel-agents-hq/pixel-agents.git "$VENDOR_DIR"
fi

cd "$VENDOR_DIR"
git checkout "$HASH"
git checkout -B main

PATCH_DIR="$REPO_ROOT/vendor-patches/pixel-agents"
if ls "$PATCH_DIR"/*.patch &>/dev/null; then
  echo "Applying vendor patches from $PATCH_DIR..."
  git config user.email "ci@rivonclaw.com"
  git config user.name "RivonClaw CI"
  git am --3way "$PATCH_DIR"/*.patch
fi

# --ignore-scripts: nothing in this dependency tree needs a lifecycle script to
# produce the webview bundle, and we are building third-party code we do not
# review line by line. Drop the flag only with a specific reason.
if [ "${SKIP_PIXEL_AGENTS_INSTALL:-}" = "true" ]; then
  echo "Skipping npm install (cache hit)"
else
  npm ci --ignore-scripts
fi

BUILD_DIR="$VENDOR_DIR/dist/webview"

# Build (skip if CI cache hit). The dist cache is keyed on the pin plus the
# patch stack, so a hit is exactly what these sources would produce; a hit that
# restored an incomplete tree falls through to a real build rather than staging
# a broken bundle. Without this the cache would be pure cost, since the build
# below would overwrite whatever it restored.
if [ "${SKIP_PIXEL_AGENTS_BUILD:-}" = "true" ] && [ -f "$BUILD_DIR/index.html" ]; then
  echo "Skipping npm run build:webview (cache hit, dist verified)"
else
  npm run build:webview
fi

if [ ! -f "$BUILD_DIR/index.html" ]; then
  echo "Expected a built webview at $BUILD_DIR/index.html" >&2
  exit 1
fi

echo "Staging office renderer into $STAGE_DIR"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"
cp -R "$BUILD_DIR/." "$STAGE_DIR/"

# Host shim. The renderer picks PostMessageTransport when `acquireVsCodeApi`
# exists and WebSocketTransport otherwise; we want the former, because our host
# owns the iframe and there is no socket to connect to.
cat > "$STAGE_DIR/office-host-shim.js" <<'JS'
// Injected by scripts/setup-pixel-agents.sh. Not part of Pixel Agents.
//
// Runs before the bundle, which is what both of its jobs require.

// 1. Satisfies the one global PostMessageTransport requires. Sends go to the
//    embedding host; receives already arrive as window 'message' events, which
//    the transport listens for on its own.
window.acquireVsCodeApi = function () {
  return {
    postMessage: function (message) {
      window.parent.postMessage(message, window.location.origin);
    },
  };
};

// 2. Host embedding controls, carried on the iframe URL. All of them have to
//    exist before the first frame paints, which is earlier than any message
//    could arrive. Malformed input is ignored so the renderer always falls back
//    to its own defaults.
//      labels  - translations for the labels drawn over characters
//      kiosk   - suppress the renderer's own toolbar/zoom/version chrome
//      zoom    - initial zoom, so the office fills the frame it is embedded in
try {
  var params = new URLSearchParams(window.location.search);
  var raw = params.get('labels');
  if (raw) window.__OFFICE_LABELS__ = JSON.parse(raw);
  if (params.get('kiosk') === '1') window.__OFFICE_KIOSK__ = true;
  var zoom = Number(params.get('zoom'));
  if (Number.isFinite(zoom) && zoom > 0) window.__OFFICE_ZOOM__ = zoom;
} catch (err) {
  console.warn('[office-host-shim] ignoring malformed embedding controls', err);
}
JS

node - "$STAGE_DIR/index.html" <<'NODE'
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
const html = readFileSync(file, "utf8");
const tag = '<script src="./office-host-shim.js"></script>';
if (html.includes(tag)) {
  console.log("Host shim already present");
} else if (!html.includes("</head>")) {
  throw new Error(`No </head> in ${file}; cannot inject host shim`);
} else {
  // A classic script anywhere in <head> runs before the deferred module bundle,
  // so the global is defined by the time the transport is constructed.
  writeFileSync(file, html.replace("</head>", `  ${tag}\n  </head>`));
  console.log("Injected host shim into index.html");
}
NODE

cd "$VENDOR_DIR"
# Layout first: it draws one desk per admissible run from the shared
# concurrency constants, and the extractor bakes the result into the bundle.
npx tsx "$REPO_ROOT/scripts/generate-office-layout.ts"
npx tsx "$REPO_ROOT/scripts/extract-pixel-agents-assets.ts"

echo "Pixel Agents office staged at $STAGE_DIR"
