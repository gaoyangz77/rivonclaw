import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  dts: true,
  clean: true,
  inlineOnly: ["@sinclair/typebox", "ws"],
  noExternal: ["@rivonclaw/plugin-sdk", "@rivonclaw/core/extension-client"],
});
