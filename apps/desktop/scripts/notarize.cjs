// @ts-check
// afterSign hook for electron-builder — notarizes the macOS app.
// Requires: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID env vars.
// Skips silently when env vars are absent (local dev builds).

const path = require("path");

/**
 * @param {import("electron-builder").AfterPackContext} context
 */
exports.default = async function notarizeApp(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only notarize macOS builds
  if (electronPlatformName !== "darwin") {
    return;
  }

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  // Skip notarization if credentials are not configured
  if (!appleId || !appleIdPassword || !teamId) {
    console.log(
      "Skipping notarization: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, or APPLE_TEAM_ID not set.",
    );
    return;
  }

  // @electron/notarize is ESM-only, use dynamic import
  const { notarize } = await import("@electron/notarize");

  const productName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${productName}.app`;
  const notarytoolPath = path.join(__dirname, "notarytool-timeout-wrapper.cjs");

  console.log(`Notarizing ${appPath} ...`);
  if (process.env.NOTARIZE_TIMEOUT_SECONDS) {
    console.log(`Notarization wait timeout: ${process.env.NOTARIZE_TIMEOUT_SECONDS}s`);
  }

  await notarize({
    appPath,
    appleId,
    appleIdPassword,
    teamId,
    notarytoolPath,
  });

  console.log("Notarization complete.");
};
