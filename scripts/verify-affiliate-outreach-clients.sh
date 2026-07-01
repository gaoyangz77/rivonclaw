#!/usr/bin/env bash
set -euo pipefail

node scripts/check-affiliate-outreach-codegen-sync.mjs

pnpm --dir apps/panel exec vitest run \
  src/pages/ecommerce/components/AffiliateOutreachOnboardingGate.test.tsx

pnpm --dir apps/desktop exec vitest run \
  src/app/auth-runtime.test.ts \
  src/cloud/backend-subscription-client.test.ts \
  src/affiliate/affiliate-work-item.test.ts \
  src/cs-bridge/customer-service-bridge.test.ts

pnpm --dir apps/panel build
pnpm --dir apps/desktop build
