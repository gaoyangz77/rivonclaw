---
name: update-vendor
description: Update vendor/openclaw to a specific commit, replay EasyClaw's vendor patch stack with AI review, rebuild, test, and decide whether each patch still belongs. Use when asked to upgrade, update, or pin vendor/openclaw to a new version or commit hash.
---

# Update Vendor

Update `vendor/openclaw` to a target commit, then replay and review the
EasyClaw patch stack. Clean replay is not enough: every patch must still be
inspected for necessity, scope, and semantic correctness.

## Step 1: Record current state and determine target

```bash
OLD_HASH=$(tr -d '[:space:]' < .openclaw-version)
cd vendor/openclaw && git fetch origin
```

If the user specifies a commit hash, use that. Otherwise use `origin/main`:

```bash
NEW_HASH=<user-specified or $(git rev-parse origin/main)>
```

## Step 2: Read the patch stack before touching vendor

Inspect `vendor-patches/openclaw/README.md` and every patch file in
`vendor-patches/openclaw/*.patch`.

For each patch, record:

- the feature/fix it exists for
- the EasyClaw tests that justify it
- the upstream condition that would let us drop it
- the vendor files and EasyClaw files most likely to be affected by upstream
  changes

If the patch body is missing this information, stop and repair the patch metadata
before continuing with the vendor upgrade.

## Step 3: Analyze upstream changes before replaying patches

In `vendor/openclaw/`:

```bash
git log --oneline $OLD_HASH..$NEW_HASH
git diff --stat $OLD_HASH..$NEW_HASH
```

Focus on files EasyClaw directly imports:

| Import | Used by | Check |
|--------|---------|-------|
| `src/infra/session-cost-usage.ts` | `apps/desktop/src/panel-server.ts` | Exported signatures, types |
| `src/shared/text/reasoning-tags.ts` | `apps/panel/vite.config.ts` (alias) | File existence, exports |
| `src/gateway/protocol/` | Gateway WebSocket client | Removed/renamed methods |
| `src/gateway/config-reload.ts` | SIGUSR1 reload behavior | Reload rule changes |
| `package.json` | Build script compatibility | New build steps |

Also compare upstream changes against each patch's stated purpose. AI review is
required here:

- If upstream clearly implemented the same behavior, plan to drop the patch.
- If upstream changed the surrounding code but not the behavior EasyClaw needs,
  expect replay or semantic conflicts and prepare to refresh the patch.
- If the upstream diff makes the original patch rationale unclear, stop and
  restate the rationale before proceeding.

## Step 4: Provision pristine vendor

```bash
bash .claude/skills/update-vendor/scripts/provision-vendor.sh $NEW_HASH
```

Handles: updating `.openclaw-version`, re-provisioning via `setup-vendor.sh`, fixing vendor git state for pre-commit hook (local `main` at pinned commit, clean `.npmrc`).

## Step 5: Replay the patch stack in a disposable patched workspace

```bash
bash scripts/provision-vendor-patched.sh
```

Interpret the result carefully:

- Replay conflict:
  - do not blindly force the patch through
  - inspect whether upstream already made the patch obsolete
  - if the patch is still needed, refresh it in the patched workspace with the
    smallest possible change

- Replay succeeds cleanly:
  - do not assume success means "done"
  - inspect whether the patch is still required, still minimal, and still
    covered by the right test

- Replay succeeds but build fails:
  - inspect whether the patch semantics are stale against the new vendor base
  - check for renamed symbols, moved files, changed runtime behavior, or missing
    dependency changes

When a patch becomes unnecessary, remove it from the stack instead of keeping a
"harmless" historical carry unless there is a strong operational reason to keep
it.

After replaying patches, rebuild vendor dist with `pnpm run build` (full rebuild).
**Never `rm -rf dist` before rebuilding.** The original dist was built by the
upstream release pipeline with the correct bundler configuration. Deleting it and
rebuilding locally produces a broken dist with leaked external imports
(`@modelcontextprotocol/sdk`, `@mariozechner/pi-agent-core`, etc.) because the
local env lacks the full upstream build config.

**Do NOT use `node scripts/tsdown-build.mjs` alone** — it only re-bundles changed
source files, leaving other plugin-sdk chunks with stale hashed filename
references. This produces an inconsistent dist that triggers
`ERR_INTERNAL_ASSERTION` in Electron's CJS/ESM module loader. Always use the
full `pnpm run build` which includes tsdown plus plugin-sdk metadata, hook
metadata, and type declarations — all of which must stay in sync after patches.

## Step 6: Sync KNOWN_CONFIG_KEYS

`packages/gateway/src/config-writer.ts` has a `KNOWN_CONFIG_KEYS` set that must match `OpenClawSchema` keys in `vendor/openclaw/src/config/zod-schema.ts`:

```bash
npx tsx -e "
import { OpenClawSchema } from './vendor/openclaw/src/config/zod-schema.ts';
console.log(JSON.stringify(Object.keys(OpenClawSchema.shape).sort()));
"
```

Compare against `KNOWN_CONFIG_KEYS` in `packages/gateway/src/config-writer.ts`. Add/remove keys as needed. A unit test also catches this in Step 8.

## Step 7: Sync operator scopes

`packages/gateway/src/rpc-client.ts` hardcodes operator scopes in `sendConnect()`. Must include every `OperatorScope` from `vendor/openclaw/src/gateway/method-scopes.ts`:

```bash
npx tsx -e "
import { ADMIN_SCOPE, READ_SCOPE, WRITE_SCOPE, APPROVALS_SCOPE, PAIRING_SCOPE } from './vendor/openclaw/src/gateway/method-scopes.ts';
console.log(JSON.stringify([ADMIN_SCOPE, READ_SCOPE, WRITE_SCOPE, APPROVALS_SCOPE, PAIRING_SCOPE].sort()));
"
```

Compare against the `scopes` array in `packages/gateway/src/rpc-client.ts`. Add/remove as needed.

## Step 8: Verify easyclaw-tools plugin patterns

The `extensions/easyclaw-tools/` plugin depends on vendor system prompt patterns and plugin hook APIs. Verify none have changed:

```bash
# All 4 must produce matches. If any returns 0, update easyclaw-tools accordingly.
grep -c 'CLI Quick Reference' vendor/openclaw/src/agents/system-prompt.ts
grep -c 'ownerOnly' vendor/openclaw/src/agents/tools/common.ts
grep -c 'before_prompt_build' vendor/openclaw/src/plugins/hooks.ts
grep -c 'prependContext' vendor/openclaw/src/plugins/hooks.ts
```

| Pattern | Plugin dependency | If missing |
|---------|-------------------|------------|
| `"OpenClaw CLI Quick Reference"` in system-prompt.ts | `easyclaw-context.ts` tells LLM to ignore this section | Update or remove the ignore instruction |
| `ownerOnly?: boolean` on `AnyAgentTool` in tools/common.ts | Plugin sets `ownerOnly: true` on its tools | Find new mechanism or remove flag |
| `before_prompt_build` hook in plugins/hooks.ts | Plugin injects runtime context via this hook | Find replacement hook |
| `prependContext` in hook result type | Plugin uses this to prepend context without replacing system prompt | Use new injection mechanism |

Also check `OWNER_ONLY_TOOL_NAME_FALLBACKS` in `src/agents/tool-policy.ts` — if `easyclaw` or `providers` get added to the fallback set, the plugin's `ownerOnly` flag becomes redundant (harmless, but note it).

## Step 9: Audit provider/model sync

```bash
node scripts/audit-provider-sync.mjs
```

Must exit 0 before proceeding. If exit 1, read [references/provider-audit.md](references/provider-audit.md) for fix instructions.

## Step 10: Audit channel/schema sync

```bash
node scripts/audit-channel-sync.mjs
```

Must exit 0 before proceeding. If exit 1, the channel-manager subagent should be delegated to fix the channel schema mismatches in `apps/panel/src/channel-schemas.ts` and related files.

## Step 11: Verify vendor bundle

Run `bundle-vendor-deps.cjs` to catch esbuild bundling regressions early. This
detects issues like missing runtime dependencies, CJS/ESM interop breaks, and
`isMainModule()` mismatches that would otherwise only surface during a full
installer build + test cycle.

**Important:** The bundle test must run on the **patched** vendor (matching what
CI builds), not the pristine vendor. Use `setup-vendor.sh` (which applies
patches) instead of `provision-vendor.sh` (which restores pristine state):

```bash
rm -rf vendor/openclaw
bash scripts/setup-vendor.sh --prod
cd apps/desktop && node scripts/bundle-vendor-deps.cjs
```

If it fails, see `docs/BUNDLE_VENDOR.md` for diagnosis and fix instructions.
After fixing, re-run `setup-vendor.sh --prod` from scratch before retrying
(the bundle script modifies `vendor/openclaw/dist/` and `node_modules/`).

After bundle verification succeeds, re-provision vendor to restore it to a
clean (unbundled) state for normal development:

```bash
bash .claude/skills/update-vendor/scripts/provision-vendor.sh $NEW_HASH
```

## Step 12: Compare size report

After bundle verification succeeds and vendor is re-provisioned, the pipeline will have written a size report to `tmp/vendor-size-report-<hash>.json`. Compare against the previous report:

```bash
NEW_HASH_SHORT=$(echo $NEW_HASH | cut -c1-7)
NEW_REPORT="tmp/vendor-size-report-${NEW_HASH_SHORT}.json"

# Find the previous report (most recent that isn't the one we just generated)
OLD_REPORT=$(ls -t tmp/vendor-size-report-*.json 2>/dev/null | grep -v "$NEW_HASH_SHORT" | head -1)
```

If both reports exist, read both JSON files and compare each category. Flag regressions:

| Category | Warning threshold | Hard limit |
|----------|------------------|------------|
| `entryBundle` | >20% increase | — |
| `pluginSdk` | >20% increase | — |
| `extensions.total` | >20% increase | 50 MB |
| `nodeModules` | >20% increase | — |
| `grandTotal` | >10 MB absolute increase | 120 MB |
| Any single extension | >1 MB growth | — |

If only the new report exists (first run or old report was cleaned up), note the baseline values for future comparisons. Do not block the upgrade.

## Step 13: Build and test

```bash
pnpm run build
pnpm run test
```

After tests pass, revisit the patch stack one more time:

- Are any patches now redundant because EasyClaw-side compatibility work removed
  the need for them?
- Did every carried patch keep its promised test coverage?
- Can any patch be narrowed to fewer files or fewer hunks?

If the answer is "yes", refresh the patch stack before committing the upgrade.

## Step 14: Run E2E dev tests

```bash
cd apps/desktop && pnpm run test:e2e:dev
```

## Step 15: Commit

Stage only EasyClaw files (vendor is gitignored):

```bash
git add .openclaw-version
# If a patch was added, refreshed, or removed:
git add vendor-patches/openclaw/
# Plus any EasyClaw code changes needed for compatibility
git commit -m "chore: upgrade vendor/openclaw to $NEW_HASH"
```

## Important notes

- `vendor/openclaw/` has its own `.git` — NOT a submodule, and is gitignored
- `release-local.sh` auto-checks vendor version and re-provisions if mismatched
- If the vendor update introduces breaking changes, fix them in EasyClaw before committing
- `KNOWN_CONFIG_KEYS` guards against invalid config keys crashing the gateway
- `scripts/provision-vendor-patched.sh` is a replay check, not an approval to
  keep all carried patches
- A patch that replays cleanly may still be obsolete, wrong, too broad, or
  missing test coverage
