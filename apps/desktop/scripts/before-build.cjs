module.exports = async function beforeBuild(context) {
  if (context.platform?.nodeName === "darwin") {
    console.log("[before-build] macOS node_modules are prepared by pnpm install/rebuild-native; skipping electron-builder dependency collection.");
    return false;
  }

  return true;
};
