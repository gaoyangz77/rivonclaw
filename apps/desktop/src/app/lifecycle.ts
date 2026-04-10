import { app, nativeImage, BrowserWindow, dialog } from "electron";
import { createLogger } from "@rivonclaw/logger";
import { DEFAULTS } from "@rivonclaw/core";
import { resolveUpdateMarkerPath, resolveHeartbeatPath } from "@rivonclaw/core/node";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, unlinkSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { brandName } from "../i18n/brand.js";

const log = createLogger("lifecycle");

// ---------------------------------------------------------------------------
// Dock icon
// ---------------------------------------------------------------------------

export function setDockIcon(): void {
  const iconPath = resolve(dirname(fileURLToPath(import.meta.url)), "../build/icon.png");
  const icon = nativeImage.createFromPath(iconPath);
  if (!icon.isEmpty()) {
    app.dock?.setIcon(icon);
  }
}

// ---------------------------------------------------------------------------
// Update marker
// ---------------------------------------------------------------------------

/**
 * Check if a pending update blocks this launch.
 * Returns true if the OLD app is running while the installer is updating.
 */
export function checkUpdateBlocked(): boolean {
  const UPDATE_MARKER = resolveUpdateMarkerPath();
  const UPDATE_MARKER_MAX_AGE_MS = DEFAULTS.desktop.updateMarkerMaxAgeMs;

  if (!existsSync(UPDATE_MARKER)) return false;

  try {
    const targetVersion = readFileSync(UPDATE_MARKER, "utf-8").trim();
    if (targetVersion && targetVersion !== app.getVersion()) {
      const markerAge = Date.now() - statSync(UPDATE_MARKER).mtimeMs;
      if (markerAge < UPDATE_MARKER_MAX_AGE_MS) {
        return true;
      }
      // Marker is stale (>5 min) — installation probably failed, clean up.
      try { unlinkSync(UPDATE_MARKER); } catch { }
    } else {
      // Version matches (new app) or empty marker — installation complete, clean up.
      try { unlinkSync(UPDATE_MARKER); } catch { }
    }
  } catch {
    // Malformed marker — clean up.
    try { unlinkSync(UPDATE_MARKER); } catch { }
  }

  return false;
}

/**
 * Show a blocking dialog informing the user that an update is in progress,
 * then exit the app.
 */
export function showUpdateBlockedDialog(): void {
  const isZh = app.getLocale().startsWith("zh");
  const updateLocale = isZh ? "zh" : "en";
  dialog.showMessageBoxSync({
    type: "info",
    title: brandName(updateLocale),
    message: isZh
      ? `${brandName(updateLocale)} 正在更新中，请等待安装完成后再打开。`
      : `${brandName(updateLocale)} is being updated. Please wait for the installation to finish.`,
    buttons: ["OK"],
  });
  app.exit(0);
}

// ---------------------------------------------------------------------------
// Heartbeat — lets duplicate-instance detection distinguish healthy vs stale
// ---------------------------------------------------------------------------

const HEARTBEAT_PATH = resolveHeartbeatPath();

export function writeHeartbeat(): void {
  try {
    writeFileSync(HEARTBEAT_PATH, JSON.stringify({ pid: process.pid, ts: Date.now() }));
  } catch { }
}

export function removeHeartbeat(): void {
  try { unlinkSync(HEARTBEAT_PATH); } catch { }
}

/**
 * Start a periodic heartbeat and return the interval handle.
 */
export function startHeartbeatInterval(): ReturnType<typeof setInterval> {
  writeHeartbeat();
  return setInterval(writeHeartbeat, DEFAULTS.desktop.heartbeatIntervalMs);
}

// ---------------------------------------------------------------------------
// Single-instance lock
// ---------------------------------------------------------------------------

/**
 * Attempt to acquire the single-instance lock.
 * If another instance holds it, either exit (healthy) or kill & relaunch (stale).
 * Returns true if this instance should proceed, false if it should exit.
 */
export function acquireSingleInstanceLock(): boolean {
  const gotTheLock = app.requestSingleInstanceLock();
  if (gotTheLock) return true;

  // Could not acquire lock — check if the holder is healthy or stale
  let isStale = true;
  try {
    if (existsSync(HEARTBEAT_PATH)) {
      const data = JSON.parse(readFileSync(HEARTBEAT_PATH, "utf-8"));
      const age = Date.now() - data.ts;
      if (age < DEFAULTS.desktop.heartbeatStaleMs) {
        isStale = false;
      }
    }
  } catch { }

  if (isStale) {
    let killedStale = false;
    try {
      if (process.platform === "win32") {
        const out = execSync('wmic process where "name=\'RivonClaw.exe\'" get ProcessId 2>nul', {
          encoding: "utf-8",
          timeout: 3000,
        }).trim();
        const pids = out
          .split("\n")
          .slice(1)
          .map((line) => parseInt(line.trim(), 10))
          .filter((pid) => pid !== process.pid && !isNaN(pid));
        for (const pid of pids) {
          try {
            process.kill(pid, "SIGKILL");
            killedStale = true;
          } catch { }
        }
      } else {
        const out = execSync("pgrep -x RivonClaw 2>/dev/null || true", {
          encoding: "utf-8",
          timeout: 3000,
        }).trim();
        const pids = out
          .split("\n")
          .filter(Boolean)
          .map(Number)
          .filter((pid) => pid !== process.pid && !isNaN(pid));
        for (const pid of pids) {
          try {
            process.kill(pid, "SIGKILL");
            killedStale = true;
          } catch { }
        }
      }
    } catch { }

    if (killedStale) {
      removeHeartbeat();
      app.relaunch();
    }
  }

  app.exit(0);
  return false;
}

// ---------------------------------------------------------------------------
// Window helpers
// ---------------------------------------------------------------------------

export function showMainWindow(mainWindow: BrowserWindow | null): void {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
  app.dock?.show();
}
