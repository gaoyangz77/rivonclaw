/**
 * Ad-hoc sign the ARM64 app and recreate the DMG.
 * macOS requires ARM64 binaries to be signed (even ad-hoc) to run on Apple Silicon.
 * electron-builder skips signing when identity is null, so we do it manually.
 */
const { execSync } = require("child_process");
const { version } = require("../package.json");
const path = require("path");

const appPath = path.join(__dirname, "..", "release", "mac-arm64", "TK Copilot.app");
const dmgPath = path.join(__dirname, "..", "release", `TK-Copilot-${version}-arm64.dmg`);

console.log("[sign-arm64] Ad-hoc signing:", appPath);
execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: "inherit" });

console.log("[sign-arm64] Recreating DMG:", dmgPath);
execSync(`hdiutil create -volname "TK Copilot" -srcfolder "${appPath}" -ov -format UDZO "${dmgPath}"`, { stdio: "inherit" });

console.log("[sign-arm64] Done.");
