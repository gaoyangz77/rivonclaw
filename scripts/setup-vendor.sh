#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HASH="$(tr -d '[:space:]' < "$REPO_ROOT/.openclaw-version")"
PROD="${1:-}"

echo "Setting up OpenClaw vendor @ $HASH"
git clone https://github.com/openclaw/openclaw.git "$REPO_ROOT/vendor/openclaw"
cd "$REPO_ROOT/vendor/openclaw"
git checkout "$HASH"
git checkout -B main
echo 'node-linker=hoisted' > .npmrc
pnpm install --no-frozen-lockfile
pnpm run build

# Replay EasyClaw vendor patches (if any exist)
PATCH_DIR="$REPO_ROOT/vendor-patches/openclaw"
if ls "$PATCH_DIR"/*.patch &>/dev/null; then
  echo "Replaying vendor patches from $PATCH_DIR..."
  git config user.email "ci@rivonclaw.com"
  git config user.name "RivonClaw CI"
  git am --3way "$PATCH_DIR"/*.patch
  # Full rebuild after patches: tsdown (incremental, preserves original dist)
  # plus plugin-sdk and hook metadata so hashed chunk references stay in sync.
  pnpm run build
  echo "Vendor patches applied and rebuilt."
fi

# NOTE: Do NOT run pnpm install --prod here. Dev deps must remain available
# because bundle-vendor-deps.cjs (Phase 0.5a/b) needs the full node_modules
# to correctly resolve and bundle plugin-sdk + extensions. The prod pruning
# is handled later by prune-vendor-deps.cjs (Phase 1) which runs immediately
# before bundling during dist:mac/dist:win/dist:linux.

rm -f .gitignore
echo "OpenClaw vendor ready ($HASH)"
