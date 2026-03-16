/**
 * Ad-hoc sign the ARM64 app and recreate the DMG.
 * macOS requires ARM64 binaries to be signed (even ad-hoc) to run on Apple Silicon.
 * electron-builder skips signing when identity is null, so we do it manually.
 *
 * IMPORTANT: Do NOT use --deep. It re-signs the Electron Framework's internal
 * components with a flat ad-hoc signature, breaking the framework's own
 * code signature chain and causing the app to silently exit on launch.
 * Instead, sign only the components that need it in inside-out order.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const { version } = require("../package.json");
const path = require("path");

const appPath = path.join(__dirname, "..", "release", "mac-arm64", "EasyClaw.app");
const dmgPath = path.join(__dirname, "..", "release", `EasyClaw-${version}-arm64.dmg`);

console.log("[sign-arm64] Ad-hoc signing:", appPath);

// Sign helper apps first (inside-out order)
const frameworksDir = path.join(appPath, "Contents", "Frameworks");
for (const entry of fs.readdirSync(frameworksDir)) {
  if (entry.endsWith(".app")) {
    const helperPath = path.join(frameworksDir, entry);
    execSync(`codesign --force --sign - "${helperPath}"`, { stdio: "inherit" });
  }
}

// Sign the main app bundle (this covers the main binary)
execSync(`codesign --force --sign - "${appPath}"`, { stdio: "inherit" });

console.log("[sign-arm64] Recreating DMG:", dmgPath);
execSync(`hdiutil create -volname EasyClaw -srcfolder "${appPath}" -ov -format UDZO "${dmgPath}"`, { stdio: "inherit" });

console.log("[sign-arm64] Done.");
