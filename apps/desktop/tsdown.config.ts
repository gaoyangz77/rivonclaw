import { defineConfig } from "tsdown";
import { cpSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  entry: ["src/main.ts"],
  format: "cjs",
  dts: false,
  clean: true,
  external: [
    "electron",
    "better-sqlite3",
  ],
  noExternal: [
    /^@rivonclaw\//,
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
});
