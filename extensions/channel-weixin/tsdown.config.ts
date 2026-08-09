import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  clean: true,
  outputOptions: { codeSplitting: false },
  external: ["qrcode-terminal", "silk-wasm", /^openclaw\//],
  noExternal: [/^@tencent-weixin\//, /^zod/],
  inlineOnly: [/^@tencent-weixin\//, /^zod/],
  onSuccess: async () => {
    const { copyFileSync, readFileSync, writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const outputPath = join(process.cwd(), "dist", "index.mjs");
    const retiredSdkPath = "openclaw/plugin-sdk/channel-runtime";
    const currentSdkPath = "openclaw/plugin-sdk/channel-reply-pipeline";
    const vendorPackage = JSON.parse(
      readFileSync(join(process.cwd(), "..", "..", "vendor", "openclaw", "package.json"), "utf-8"),
    ) as { exports?: Record<string, unknown> };
    if (!vendorPackage.exports?.["./plugin-sdk/channel-reply-pipeline"]) {
      throw new Error(`channel-weixin compatibility target is not exported: ${currentSdkPath}`);
    }
    const output = readFileSync(outputPath, "utf-8").replaceAll(retiredSdkPath, currentSdkPath);
    writeFileSync(outputPath, output, "utf-8");
    if (output.includes(retiredSdkPath)) {
      throw new Error("channel-weixin bundle retained the retired OpenClaw channel-runtime import");
    }
    copyFileSync(
      join(process.cwd(), "openclaw.plugin.json"),
      join(process.cwd(), "dist", "openclaw.plugin.json"),
    );
  },
});
