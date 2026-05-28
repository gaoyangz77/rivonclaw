# CI/CD & Release

## Release Workflow

Releases use a **parallel** pipeline: CI builds installers while the developer runs local tests.

### Step 1: Bump version and push

Update version in `apps/desktop/package.json`, commit, push to `main`.

### Step 2: Run CI build + local tests in parallel

**CI (triggered manually):**
Trigger the "Build & Release" workflow via GitHub Actions `workflow_dispatch`.
This builds Mac DMG/ZIP (separate arm64 + x64) + Windows EXE along with blockmap files and electron-updater manifests (`latest.yml`, `arm64-mac.yml`, `x64-mac.yml`), then creates a **draft** GitHub Release with all artifacts attached.

**Local (on developer machine):**
```bash
./scripts/test-local.sh           # full pipeline: build + unit tests + e2e dev + pack + e2e prod
./scripts/test-local.sh --skip-tests  # build + pack only
```

### Step 3: Publish the GitHub release

After both CI build and local tests complete successfully:

```bash
./scripts/publish-release.sh          # reads version from package.json
./scripts/publish-release.sh 1.2.8    # or specify explicitly
```

This validates the draft has at least 13 artifacts (arm64.dmg, x64.dmg, arm64.zip, x64.zip, arm64-mac.yml, x64-mac.yml, EXE, portable EXE, EXE.blockmap, latest.yml, AppImage, deb, latest-linux.yml), pushes the git tag `v{version}`, and promotes the draft release to public.

**Important:** this only publishes the GitHub release. Production rollout is not finished until the website, update manifests, production `/releases/` directory, and CDN are updated.

### Step 4: Promote production website + downloads

Follow `docs/release-flow.md` for the full production promotion checklist.

In short:
1. Update `server/website/site/index.html`
2. Update `server/website/site/update-manifest.json`
3. Update `server/website/site/update-manifest-cn.json`
4. Push the `server/` repo
5. On main-server, pull and run:
   ```bash
   ./scripts/deploy.sh --current-env
   ```
6. Copy the new version from `website/site/stg-releases/` to `website/site/releases/`
7. Run CDN refresh:
   ```bash
   ./scripts/cdn-refresh.sh <version> --all
   ```
8. Verify both macOS and Windows production URLs with cache-busting query params

**Incremental updates:** The build generates `.blockmap` files and `latest.yml`/`{arch}-mac.yml` manifests that enable `electron-updater` differential downloads. Users only download changed ~64KB blocks instead of the full installer.

If local tests fail, delete the draft release on GitHub and fix the issues.

## GitHub Actions Workflows

| File | Trigger | Purpose |
|------|---------|---------|
| `test-build.yml` | Push to `main` or PR | Verify builds compile on Windows + macOS (unsigned, no tests) |
| `build.yml` | Manual (`workflow_dispatch`) | Build signed installers + create draft GitHub Release |

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/test-local.sh` | Local build + full test suite (unit, e2e dev, e2e prod) |
| `scripts/publish-release.sh` | Publish a draft GitHub Release after CI + local tests pass |
| `scripts/rebuild-native.sh` | Prebuild better-sqlite3 for Node.js + Electron |

## File Structure

| File | Description |
|------|-------------|
| `RELEASE_BODY.md` | Template body appended to GitHub Releases |
| `AZURE_ARTIFACT_SIGNING_SETUP.md` | Azure Artifact Signing setup for Windows releases |
| `CI_CD.md` | This file |

## Code Signing Status

| Platform | Signing | Status |
|----------|---------|--------|
| **macOS** | Developer ID Application + notarization | Requires GitHub secrets: `MACOS_CERTIFICATE`, `MACOS_CERTIFICATE_PWD`, `KEYCHAIN_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` |
| **Windows** | Azure Artifact Signing Basic | Account created; identity validation, certificate profile, and CI principal still need setup (see `AZURE_ARTIFACT_SIGNING_SETUP.md`) |

## Vendor Pruning

`dist:mac` / `dist:win` scripts generate a staging-based runtime archive from `vendor/openclaw` (the canonical vendor directory is never modified). The `vendor-boundary` CI job runs boundary guard and artifact drift checks before build jobs.

## Troubleshooting

- **Native module errors**: Run `./scripts/rebuild-native.sh --force`
- **Build failures on CI**: Verify Node.js version matches (currently 24)
- **E2E test timeouts**: Ensure no stale RivonClaw processes are running
