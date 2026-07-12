import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    alias: {
      "@rivonclaw/logger": resolve(__dirname, "../logger/src/index.ts"),
      "@rivonclaw/secrets": resolve(__dirname, "../secrets/src/index.ts"),
      "@openclaw/normalization-core/string-coerce": resolve(
        __dirname,
        "../../vendor/openclaw/packages/normalization-core/src/string-coerce.ts",
      ),
      "@openclaw/normalization-core/string-normalization": resolve(
        __dirname,
        "../../vendor/openclaw/packages/normalization-core/src/string-normalization.ts",
      ),
      "@openclaw/normalization-core/number-coercion": resolve(
        __dirname,
        "../../vendor/openclaw/packages/normalization-core/src/number-coercion.ts",
      ),
      "@openclaw/normalization-core/record-coerce": resolve(
        __dirname,
        "../../vendor/openclaw/packages/normalization-core/src/record-coerce.ts",
      ),
    },
  },
});
