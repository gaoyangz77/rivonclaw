// Shared runtime package allowlist for vendor/openclaw bundling + verification.
//
// Native modules are now AUTO-DETECTED by scanning node_modules for .node files,
// binding.gyp, or prebuild-install markers. Only packages that cannot be
// auto-detected (dynamic requires, runtime-resolution, shared runtime libs)
// need to be listed here.

// Packages that MUST be external but cannot be auto-detected by scanning for
// native binaries. Keep this list minimal — add a comment for every entry.
const ALWAYS_EXTERNAL_PACKAGES = [
  // Complex dynamic loading patterns (runtime fs access, .proto files, etc.)
  "ajv",
  "protobufjs",
  "protobufjs/*",
  "playwright-core",
  "playwright",
  "chromium-bidi",
  "chromium-bidi/*",

  // Pino uses worker_threads with dynamic file paths at runtime
  "pino",
  "pino-pretty",

  // Proxy dependency (needed by proxy-setup.cjs via createRequire)
  "undici",

  // Feishu SDK is resolved from the app workspace at runtime.
  "@larksuiteoapi/node-sdk",

  // The official Feishu plugin loads these production dependencies at runtime.
  "image-size",
  "zod",

  // Schema library used by both bundled code AND plugins loaded at runtime.
  "@sinclair/typebox",
  "@sinclair/typebox/*",

  // Optional/platform-specific native deps — not installed on all platforms,
  // but referenced via conditional require(). Must stay external so esbuild
  // doesn't try to resolve them.
  "ffmpeg-static",        // optional dep of prism-media (Discord voice)
  "authenticate-pam",     // Linux-only PAM auth
  "better-sqlite3",       // native module, may not be in vendor node_modules
];

// Legacy alias — the full effective externals list is now computed at bundle
// time by merging ALWAYS_EXTERNAL_PACKAGES with auto-detected native modules.
// This export is kept for check-extension-externals.mjs compatibility; it
// receives the union list from create-runtime-archive at build time, but for
// static checks it falls back to the always-external list.
const EXTERNAL_PACKAGES = ALWAYS_EXTERNAL_PACKAGES;

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
  ALWAYS_EXTERNAL_PACKAGES,
  EXTERNAL_PACKAGES,
  RUNTIME_REQUIRED_PACKAGES,
  isAllowlistedVendorRuntimeSpecifier,
  matchesExternalPackage,
  matchesPackagePattern,
};
