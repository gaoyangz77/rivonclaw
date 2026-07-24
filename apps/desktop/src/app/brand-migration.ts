import { app } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createLogger } from "@rivonclaw/logger";

const log = createLogger("brand-migration");

export const PRODUCT_NAME = "TK Copilot";
export const LEGACY_PRODUCT_NAME = "RivonClaw";

export function resolveCompatibleUserDataPath(
  appDataPath: string,
  platform: NodeJS.Platform,
  pathExists: (path: string) => boolean = existsSync,
): string {
  const legacyProductPath = join(appDataPath, LEGACY_PRODUCT_NAME);
  if (pathExists(legacyProductPath)) return legacyProductPath;

  // Very early Windows builds used the package name instead of productName.
  const legacyPackagePath = join(appDataPath, "@easyclaw", "desktop");
  if (platform === "win32" && pathExists(legacyPackagePath)) {
    return legacyPackagePath;
  }

  // Keep the historical path for new installs too. This prevents a future
  // display-name change from silently creating another Electron profile.
  return legacyProductPath;
}

/**
 * Change the user-visible application name while keeping the historical
 * Electron profile. The profile contains the extracted runtime, updater
 * state and CLI-shim target; the product database and credentials continue
 * to use the stable ~/.rivonclaw paths.
 */
export function configureDesktopBrandCompatibility(argv = process.argv): void {
  const hasExplicitUserDataDir = argv.some((arg) => arg.startsWith("--user-data-dir"));
  if (!hasExplicitUserDataDir) {
    const compatiblePath = resolveCompatibleUserDataPath(app.getPath("appData"), process.platform);
    app.setPath("userData", compatiblePath);
    log.info(`Preserving legacy Electron profile at ${compatiblePath}`);
  }

  app.setName(PRODUCT_NAME);
}
