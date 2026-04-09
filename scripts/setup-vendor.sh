#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HASH="$(tr -d '[:space:]' < "$REPO_ROOT/.openclaw-version")"

# Parse flags
PROD=false
SKIP_CLONE=false
for arg in "$@"; do
  case "$arg" in
    --prod) PROD=true ;;
    --skip-clone) SKIP_CLONE=true ;;
  esac
done

echo "Setting up OpenClaw vendor @ $HASH"

# Clone unless --skip-clone (CI splits clone into a separate step for caching)
if [ "$SKIP_CLONE" = false ]; then
  git clone https://github.com/openclaw/openclaw.git "$REPO_ROOT/vendor/openclaw"
fi

cd "$REPO_ROOT/vendor/openclaw"
git checkout "$HASH"
git checkout -B main

# Use env var for hoisted layout instead of modifying .npmrc,
# so vendor git stays clean (pre-commit hook checks for dirty state).
export npm_config_node_linker=hoisted

# Install dependencies (skip if CI cache hit)
if [ "${SKIP_VENDOR_INSTALL:-}" = "true" ]; then
  echo "Skipping pnpm install (cache hit)"
else
  pnpm install --frozen-lockfile
fi

# Detect vendor patches
PATCH_DIR="$REPO_ROOT/vendor-patches/openclaw"
HAS_PATCHES=false
if ls "$PATCH_DIR"/*.patch &>/dev/null; then
  HAS_PATCHES=true
fi

# Build (skip if CI cache hit)
# When dist is cached, the cached output already includes patched builds
# (the cache key incorporates patch file hashes). We still apply patches
# to source so git state matches the built artifacts.
# If dist cache claims to be valid but .dist-complete marker is missing,
# the cache is incomplete (e.g. stale from a prior vendor version).
# Force a full rebuild by unsetting SKIP_VENDOR_BUILD.
if [ "${SKIP_VENDOR_BUILD:-}" = "true" ] && [ ! -f dist/.dist-complete ]; then
  echo "WARNING: dist cache hit but .dist-complete marker missing — forcing rebuild"
  SKIP_VENDOR_BUILD=false
  # Dev dependencies are needed for build but cached node_modules may be
  # prod-only. pnpm won't re-install dev deps if it thinks the lockfile is
  # already satisfied, so remove node_modules first to force a clean install.
  rm -rf node_modules
  pnpm install --frozen-lockfile
fi

if [ "${SKIP_VENDOR_BUILD:-}" = "true" ]; then
  echo "Skipping pnpm run build (cache hit, dist verified)"
  if [ "$HAS_PATCHES" = true ]; then
    echo "Applying patches to source (dist already cached with patches)..."
    git config user.email "ci@rivonclaw.com"
    git config user.name "RivonClaw CI"
    git am --3way "$PATCH_DIR"/*.patch
  fi
else
  # Ensure dev dependencies are available — node_modules cache may be prod-only
  # (SKIP_VENDOR_INSTALL=true only skips the first install, not this one).
  # npm_config_node_linker=hoisted is already exported at the top of this script.
  pnpm install --frozen-lockfile
  pnpm run build
  pnpm ui:build
  # Replay EasyClaw vendor patches (if any exist)
  if [ "$HAS_PATCHES" = true ]; then
    echo "Replaying vendor patches from $PATCH_DIR..."
    git config user.email "ci@rivonclaw.com"
    git config user.name "RivonClaw CI"
    git am --3way "$PATCH_DIR"/*.patch
    # Full rebuild after patches so plugin-sdk dist chunks stay consistent.
    # Incremental tsdown-build.mjs only rebuilds changed files, leaving other
    # chunks with stale references that trigger ERR_INTERNAL_ASSERTION in
    # Electron's CJS/ESM module loader.
    pnpm run build
    pnpm ui:build
    echo "Vendor patches applied and rebuilt."
  fi
  # Mark dist/ as complete so CI cache can verify integrity on restore.
  # Without this marker, a cached dist/ from an incomplete/failed build
  # would silently break the app (e.g. missing dist/plugins/runtime/).
  echo "$HASH" > dist/.dist-complete
fi

# NOTE: Do NOT run pnpm install --prod here. The vendor node_modules cache
# saves the state at job end — if we prune dev deps here, the cache stores
# prod-only modules, and subsequent CI runs fail TypeScript compilation
# (EasyClaw packages reference vendor extension types that need dev deps).
# Prod pruning happens later in prune-vendor-deps.cjs (afterPack) on the
# release COPY, not the original vendor.

# Make dist/ and dist-runtime/ visible to electron-builder's extraResources by
# removing them from .gitignore. node_modules/ stays ignored — copy-vendor-deps.cjs
# (afterPack hook) handles copying it manually because .gitignore blocks it.
# Copy original .gitignore to .git/info/exclude so git status stays clean.
cp .gitignore .git/info/exclude
sed -i.bak '/^dist$/d; /^dist-runtime$/d' .gitignore
rm -f .gitignore.bak
echo "OpenClaw vendor ready ($HASH)"
