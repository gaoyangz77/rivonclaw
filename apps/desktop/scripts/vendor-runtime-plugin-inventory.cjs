// @ts-check

// Desktop writes these plugin ids into openclaw.json. Keep the inventory here
// aligned with those settings so packaged clients never need npm to repair a
// supported first-party configuration during Gateway startup.

const BUILT_VENDOR_PLUGIN_IDS = [
  "brave",
  "feishu",
  "google",
  "ollama",
  "openai",
  "telegram",
  "xai",
];

// OpenClaw publishes these providers separately and marks them with
// openclaw.build.bundledDist=false. Desktop still exposes them in Settings, so
// stage their source packages from the pinned vendor checkout into the trusted
// bundled runtime. They have no external runtime dependencies and OpenClaw's
// plugin loader handles their TypeScript entrypoints through jiti.
const STAGED_VENDOR_SOURCE_PLUGINS = [
  { id: "groq", packageName: "@openclaw/groq-provider" },
  { id: "mistral", packageName: "@openclaw/mistral-provider" },
  { id: "moonshot", packageName: "@openclaw/moonshot-provider" },
  { id: "perplexity", packageName: "@openclaw/perplexity-plugin" },
  { id: "voyage", packageName: "@openclaw/voyage-provider" },
];

const DESKTOP_REQUIRED_BUNDLED_PLUGIN_IDS = [
  ...BUILT_VENDOR_PLUGIN_IDS,
  ...STAGED_VENDOR_SOURCE_PLUGINS.map((plugin) => plugin.id),
].sort();

module.exports = {
  BUILT_VENDOR_PLUGIN_IDS,
  DESKTOP_REQUIRED_BUNDLED_PLUGIN_IDS,
  STAGED_VENDOR_SOURCE_PLUGINS,
};
