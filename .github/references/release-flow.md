# RivonClaw Release Flow

## Overview

Production release has **two distinct phases**:

1. **Publish GitHub release** from CI draft artifacts
2. **Promote website/download infrastructure** so production users can actually fetch the new binaries

Do not treat these as the same step.

---

## Phase 1 — Build and publish GitHub release

### 1. Bump version and push
- Update `apps/desktop/package.json`
- Commit and push to `main`

### 2. Run CI build and local tests in parallel

**CI:** trigger `build.yml`
- Produces macOS arm64/x64 DMG + ZIP
- Produces Windows installer + portable exe
- Produces Linux AppImage + deb
- Produces updater manifests: `latest.yml`, `arm64-mac.yml`, `x64-mac.yml`, `latest-linux.yml`
- Creates a **draft** GitHub release

**Local:**
```bash
./scripts/test-local.sh
```

### 3. Publish the release
```bash
./scripts/publish-release.sh <version>
```

---

## Phase 2 — Promote production website + downloads

### 4. Update website files in `server/website/site/`
- `index.html`
- `update-manifest.json`
- `update-manifest-cn.json`

Update:
- version string
- production URLs
- SHA-256 hashes
- sizes
- mac split-arch metadata
- Windows / Linux links

### 5. Push server repo updates
```bash
cd server
git add website/site/index.html website/site/update-manifest.json website/site/update-manifest-cn.json
git commit -m "chore: publish RivonClaw <version> website downloads"
git push origin main
```

### 6. Pull and deploy on main-server
```bash
cd /home/gaoyangz/easyclaw/server
git pull --ff-only
./scripts/deploy.sh --current-env
```

### 7. Copy staging artifacts into production releases
Production downloads live in:
- `website/site/releases/`

Staging artifacts live in:
- `website/site/stg-releases/`

#### Important gotcha
This glob is insufficient:
```bash
cp website/site/stg-releases/RivonClaw-<version>* website/site/releases/
```
It does **not** copy:
- `RivonClaw.Setup.<version>.exe`
- `RivonClaw.Setup.<version>.exe.blockmap`

#### Use explicit copy commands
```bash
cp -f website/site/stg-releases/RivonClaw-<version>* website/site/releases/
cp -f website/site/stg-releases/RivonClaw.Setup.<version>.exe website/site/releases/
cp -f website/site/stg-releases/RivonClaw.Setup.<version>.exe.blockmap website/site/releases/
cp -f website/site/stg-releases/RivonClaw-<version>-portable.exe website/site/releases/
cp -f website/site/stg-releases/arm64-mac.yml website/site/releases/
cp -f website/site/stg-releases/x64-mac.yml website/site/releases/
cp -f website/site/stg-releases/latest.yml website/site/releases/
cp -f website/site/stg-releases/latest-linux.yml website/site/releases/
cp -f website/site/stg-releases/RivonClaw_<version>_amd64.deb website/site/releases/
```

### 8. Refresh CDN
```bash
./scripts/cdn-refresh.sh <version> --all
```

### 9. Verify live production URLs
```bash
curl -L https://www.rivonclaw.com/update-manifest.json
curl -I -L 'https://www.rivonclaw.com/releases/RivonClaw-<version>-arm64.dmg?bust=1'
curl -I -L 'https://www.rivonclaw.com/releases/RivonClaw.Setup.<version>.exe?bust=1'
```

Expected: `HTTP 200`

---

## Common failure modes
- GitHub release is public, but website still points at old version
- `update-manifest.json` updated, but `/releases/` files not copied
- mac works but Windows 404s because `RivonClaw.Setup.*` was not copied
- conflict markers accidentally left in `index.html`
- Cloudflare purge fails, so stale cached 404s remain visible
- cache-busting URL returns `MISS + 404`, which means origin/path is still wrong
