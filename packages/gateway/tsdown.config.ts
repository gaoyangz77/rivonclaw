import { defineConfig } from "tsdown";
import { cpSync } from "node:fs";

export default defineConfig({
  entry: ["src/index.ts", "src/path-env.ts", "src/volcengine-stt-cli.ts"],
  format: "esm",
  dts: true,
  clean: true,
  checks: { pluginTimings: false },
  // zod is bundled because we import the vendor OpenClaw Zod schema
  // (used by stripUnknownKeys in config-writer.ts).
  inlineOnly: ["zod"],
  onSuccess() {
    // Copy the CJS preload script to dist/ so it's available in packaged apps
    cpSync("src/startup-timer.cjs", "dist/startup-timer.cjs");
  },
});
