import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  clean: true,
  external: ["qrcode-terminal", "silk-wasm", /^openclaw\//],
  noExternal: [/^@tencent-weixin\//, /^zod/],
  inlineOnly: [/^@tencent-weixin\//, /^zod/],
  onSuccess: async () => {
    const { copyFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    copyFileSync(
      join(process.cwd(), "openclaw.plugin.json"),
      join(process.cwd(), "dist", "openclaw.plugin.json"),
    );
  },
});
