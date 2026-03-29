import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/client-tools.ts"],
  format: "esm",
  dts: true,
  clean: true,
  inlineOnly: ["@sinclair/typebox", "ws"],
  noExternal: ["@rivonclaw/plugin-sdk", "@rivonclaw/core/client-tools", "@rivonclaw/core/extension-client"],
});
