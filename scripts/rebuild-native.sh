#!/usr/bin/env bash
# Compatibility entrypoint for release scripts; implementation is cross-platform.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec node "$REPO_ROOT/scripts/rebuild-native.cjs" "$@"
