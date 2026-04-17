import { defineConfig } from "tsdown";
import { cpSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Two separate build configs so the image compression worker does NOT share
// chunks with main.cjs. If rolldown shares a chunk (rolldown's default code-
// splitting behavior for multi-entry builds), the worker's chunk ends up
// `require`ing main.cjs — which imports `electron`, blowing up in a plain
// Node worker thread. Separate builds guarantee bundle isolation.
export default defineConfig([
  {
    name: "desktop-main",
    entry: ["src/main.ts"],
    format: "cjs",
    dts: false,
    clean: true,
    external: [
      "electron",
      "better-sqlite3",
      // jimp is large and pure JS — keep it out of the main bundle so the
      // main process never pays its load cost. Only the worker imports it.
      "jimp",
    ],
    noExternal: [
      /^@rivonclaw\//,
      "https-proxy-agent",
      "agent-base",
    ],
    treeshake: true,
    inlineOnly: false,
    define: {
      __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
    },
    onSuccess() {
      // Copy startup-timer.cjs so the launcher finds the full version (with
      // plugin-sdk resolution optimization) instead of falling back to the
      // minimal inline version. Without this, the packaged app takes ~60s
      // longer to start because jiti babel-transforms the 17 MB plugin-sdk.
      const src = join(__dirname, "..", "..", "packages", "gateway", "dist", "startup-timer.cjs");
      if (existsSync(src)) {
        cpSync(src, join(__dirname, "dist", "startup-timer.cjs"));
      }
    },
  },
  {
    name: "image-compression-worker",
    entry: ["src/cs-bridge/image-compression-worker.ts"],
    format: "cjs",
    dts: false,
    // Do NOT clean — runs after the main build and they share dist/.
    clean: false,
    // Flatten output: emit `dist/image-compression-worker.cjs` (sibling to
    // main.cjs) rather than `dist/cs-bridge/image-compression-worker.cjs`.
    // This matches the WORKER_FILENAME path used in image-compressor.ts.
    outDir: "dist",
    outputOptions: {
      entryFileNames: "[name].cjs",
    },
    external: ["electron"],
    noExternal: [/^@rivonclaw\//],
    treeshake: true,
    inlineOnly: false,
  },
]);
