---
name: easyclaw
description: Develop, build, debug, and analyze EasyClaw — a desktop GUI wrapper for OpenClaw. Use for building installers, diagnosing issues, investigating errors, fixing code, or any dev/debug work related to EasyClaw.
---

# EasyClaw

Desktop app wrapping OpenClaw for non-technical users. Electron tray app supervises an OpenClaw gateway child process. No OpenClaw fork — integrates via plugin hooks + skill hot-reload + channel extensions.

## Architecture

```
EasyClaw Desktop (Electron)
├── Tray App + Gateway Supervisor
├── Local HTTP Server → Web Panel (apps/panel)
├── SQLite (rules, artifacts, settings)
├── OS Keychain/DPAPI (secrets)
└── OpenClaw Gateway (child process)
    ├── EasyClaw Plugin (packages/openclaw-plugin)
    │   ├── before_agent_start → policy fragment injection
    │   └── before_tool_call → guard enforcement
    ├── Skill files (hot-reloaded ~250ms)
    └── Channel extensions (WeCom etc.)
```

**Rule pipeline:** Rule (natural language) → LLM Compiler → Policy Fragment | Guard | Action Bundle

## Source Code

All repos at `~/projects/easyclaw/`:

| Directory | Repo | Contents |
|-----------|------|----------|
| `.` (root) | github:gaoyangz77/rivonclaw (public) | Electron app + panel + packages |
| `server/` | bitbucket:gaoyangz77/easyclaw-server (private) | Website, telemetry, docker |
| `docs/` | bitbucket:gaoyangz77/easyclaw (private) | PRD, ADRs, design |

## Release

**Two-phase release:**
1. Publish GitHub release from CI draft artifacts
2. Promote production website/download infrastructure

Do **not** stop after `scripts/publish-release.sh`.

### Core release commands
- `scripts/test-local.sh` — local build + test
- `scripts/publish-release.sh` — publish GitHub release draft
- `server/scripts/deploy.sh --current-env` — redeploy website nginx using active server `.env`
- `server/scripts/cdn-refresh.sh <version> --all` — refresh production CDN

### Production rollout requirements
After GitHub release publish, also do all of the following:
- update `server/website/site/index.html`
- update `server/website/site/update-manifest.json`
- update `server/website/site/update-manifest-cn.json`
- push `server/` repo
- pull on main-server and redeploy nginx
- copy artifacts from `website/site/stg-releases/` to `website/site/releases/`
- refresh CDN
- verify live production URLs

### Critical gotchas
- `website/site/stg-releases/` is **not** production
- `cp stg-releases/RivonClaw-<ver>* releases/` does **not** copy `RivonClaw.Setup.<ver>.exe`
- always copy Windows installer and blockmap explicitly
- if mac works but Windows 404s, check whether `RivonClaw.Setup.<ver>.exe` was copied into `website/site/releases/`
- if release URLs still 404 with `?bust=...`, origin may be missing the file instead of just stale CDN cache
- if Cloudflare purge auth fails, verify with cache-busting URLs before assuming deploy failed
- watch for accidental conflict markers in deployed `index.html`

### References
- `docs/release-flow.md`
- `.github/CI_CD.md`
- `server/scripts/cdn-refresh.sh`
- `server/scripts/deploy.sh`


## Release Lessons (2026-05)

- Production release is **not done** after `scripts/publish-release.sh`.
- Production binaries are served from `server/website/site/releases/`; CI/staging artifacts may already exist in `stg-releases/`.
- Always copy `RivonClaw.Setup.<version>.exe` and `.blockmap` explicitly; the `RivonClaw-<version>*` glob misses them.
- On production hosts that only keep the active `.env`, use `server/scripts/deploy.sh --current-env`.
- If Cloudflare purge fails, use cache-busting URL checks to distinguish stale CDN cache from missing origin files.
