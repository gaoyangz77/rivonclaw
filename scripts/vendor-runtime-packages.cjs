// Shared runtime package allowlist for vendor/openclaw bundling + verification.
// Keep this as the single source of truth for packages that must survive
// bundling/pruning because they are loaded natively or via runtime resolution.

const EXTERNAL_PACKAGES = [
  // OpenAI Codex OAuth no longer keeps the full pi-ai package at runtime.
  // create-runtime-archive extracts the upstream oauth helper into vendor/dist.

  // Native modules (contain .node or .dylib binaries)
  "sharp",
  "@img/*",
  "koffi",
  "@napi-rs/canvas",
  "@napi-rs/canvas-*",
  "@lydell/node-pty",
  "@lydell/node-pty-*",
  "@matrix-org/matrix-sdk-crypto-nodejs",
  "@discordjs/opus",
  "sqlite-vec",
  "sqlite-vec-*",
  "@snazzah/*",
  "better-sqlite3",
  "@lancedb/lancedb",
  "@lancedb/lancedb-*",

  // Complex dynamic loading patterns (runtime fs access, .proto files, etc.)
  "ajv",
  "protobufjs",
  "protobufjs/*",
  "playwright-core",
  "playwright",
  "chromium-bidi",
  "chromium-bidi/*",

  // Optional/missing (may not be installed, referenced in try/catch)
  "ffmpeg-static",
  "authenticate-pam",
  "esbuild",
  "node-llama-cpp",

  // Proxy dependency (needed by proxy-setup.cjs via createRequire)
  "undici",

  // Feishu SDK is resolved from the app workspace at runtime.
  "@larksuiteoapi/node-sdk",

  // Schema library used by both bundled code AND plugins loaded at runtime.
  "@sinclair/typebox",
  "@sinclair/typebox/*",
];

const RUNTIME_REQUIRED_PACKAGES = [];

function matchesPackagePattern(name, pattern) {
  return name === pattern
    || (pattern.endsWith("/*") && name.startsWith(pattern.slice(0, -1)))
    || (pattern.endsWith("-*") && name.startsWith(pattern.slice(0, -1)));
}

function matchesExternalPackage(name) {
  return EXTERNAL_PACKAGES.some((pattern) => matchesPackagePattern(name, pattern));
}

function isAllowlistedVendorRuntimeSpecifier(specifier) {
  if (specifier === "openclaw/plugin-sdk" || specifier.startsWith("openclaw/plugin-sdk/")) {
    return true;
  }
  return matchesExternalPackage(specifier);
}

module.exports = {
  EXTERNAL_PACKAGES,
  RUNTIME_REQUIRED_PACKAGES,
  isAllowlistedVendorRuntimeSpecifier,
  matchesExternalPackage,
  matchesPackagePattern,
};
