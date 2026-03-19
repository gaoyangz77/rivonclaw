import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  dts: true,
  clean: true,
  noExternal: ["@rivonclaw/plugin-sdk", "@rivonclaw/policy", "@rivonclaw/logger"],
  inlineOnly: ["zod", "tslog"],
});
