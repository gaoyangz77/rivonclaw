#!/usr/bin/env bash
set -euo pipefail

npm --prefix server/backend run verify:affiliate-outreach:local
pnpm run verify:affiliate-outreach:clients
