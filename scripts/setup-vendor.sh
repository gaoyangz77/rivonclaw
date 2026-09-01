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
# This checkout is generated from the pin and patch stack. Packaging may leave
# tracked vendor files modified (for example after dependency pruning), so make
# every setup run start from the exact pinned tree before replaying patches.
git checkout -B main "$HASH"
git reset --hard "$HASH"
rm -f .pruned vendor-runtime.tar vendor-runtime.tar.gz vendor-runtime-manifest.json

# OpenClaw may use a newer lockfile format than the RivonClaw workspace.
# Always honor the exact pnpm version declared by the pinned vendor instead of
# relying on whichever pnpm happens to be installed globally in CI. The pinned
# release is installed outside this checkout — the vendor .npmrc dependency
# cooldown must not veto the package manager the vendor itself pins. See
# scripts/vendor-pnpm.cjs.
VENDOR_PNPM="$(node "$REPO_ROOT/scripts/vendor-pnpm.cjs" "$REPO_ROOT/vendor/openclaw")"

vendor_pnpm() {
  "$VENDOR_PNPM" "$@"
}

echo "Using vendor pnpm $VENDOR_PNPM"

# Apply patches before dependency installation or the first build. Some patches
# fix platform-specific build failures, so a pristine build may never reach a
# later patch replay step on the affected platform.
PATCH_DIR="$REPO_ROOT/vendor-patches/openclaw"
if ls "$PATCH_DIR"/*.patch &>/dev/null; then
  echo "Applying vendor patches from $PATCH_DIR..."
  git config user.email "ci@rivonclaw.com"
  git config user.name "RivonClaw CI"
  git am --3way "$PATCH_DIR"/*.patch
fi

# Use env var for hoisted layout instead of modifying .npmrc,
# so vendor git stays clean (pre-commit hook checks for dirty state).
export npm_config_node_linker=hoisted

# Install dependencies (skip if CI cache hit)
if [ "${SKIP_VENDOR_INSTALL:-}" = "true" ]; then
  echo "Skipping pnpm install (cache hit)"
else
  vendor_pnpm install --frozen-lockfile
fi

# Build (skip if CI cache hit)
# When dist is cached, the cached output already includes patched builds
# (the cache key incorporates patch file hashes). Patches are still applied to
# source above so git state matches the built artifacts.
# If dist cache claims to be valid but any required build output is missing,
# the cache is incomplete (e.g. stale from a prior vendor version). OpenClaw
# workspace packages are linked from node_modules, so their dist directories
# are part of the runtime contract even though they live outside root dist/.
# Force a full rebuild by unsetting SKIP_VENDOR_BUILD.
VENDOR_BUILD_OUTPUTS=(
  "dist/.dist-complete"
  "dist-runtime/extensions/brave/openclaw.plugin.json"
  "packages/ai/dist/internal/runtime.mjs"
)
MISSING_VENDOR_BUILD_OUTPUT=""
for output in "${VENDOR_BUILD_OUTPUTS[@]}"; do
  if [ ! -f "$output" ]; then
    MISSING_VENDOR_BUILD_OUTPUT="$output"
    break
  fi
done

if [ "${SKIP_VENDOR_BUILD:-}" = "true" ] && [ -n "$MISSING_VENDOR_BUILD_OUTPUT" ]; then
  echo "WARNING: dist cache hit but $MISSING_VENDOR_BUILD_OUTPUT is missing — forcing rebuild"
  SKIP_VENDOR_BUILD=false
  # Dev dependencies are needed for build but cached node_modules may be
  # prod-only. pnpm won't re-install dev deps if it thinks the lockfile is
  # already satisfied, so remove node_modules first to force a clean install.
  rm -rf node_modules
  vendor_pnpm install --frozen-lockfile
fi

if [ "${SKIP_VENDOR_BUILD:-}" = "true" ]; then
  echo "Skipping pnpm run build (cache hit, dist verified)"
else
  # Ensure dev dependencies are available with hoisted layout.
  # The node_modules cache may have been created with a different linker mode
  # or may be prod-only. Force a clean install to guarantee @types/* and other
  # dev deps are resolvable in the flat hoisted layout that the build expects.
  rm -rf node_modules
  vendor_pnpm install --frozen-lockfile
  vendor_pnpm run build
  vendor_pnpm ui:build
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
