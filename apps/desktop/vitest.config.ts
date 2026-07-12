import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { createRequire } from "node:module";

// Resolve "graphql" from graphql-ws so both share the same instance (avoids pnpm dual-copy issue)
const require = createRequire(import.meta.url);
const graphqlWsPath = require.resolve("graphql-ws");
const graphqlPath = createRequire(graphqlWsPath).resolve("graphql");

export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}", "test/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/release/**", "**/.git/**", "**/e2e/**"],
    alias: {
      "@rivonclaw/logger": resolve(__dirname, "../../packages/logger/src/index.ts"),
      "@rivonclaw/gateway": resolve(__dirname, "../../packages/gateway/src/index.ts"),
      "@rivonclaw/core/node": resolve(__dirname, "../../packages/core/src/node.ts"),
      "@rivonclaw/core/models": resolve(__dirname, "../../packages/core/src/mst-models.ts"),
      "@rivonclaw/core/endpoints": resolve(__dirname, "../../packages/core/src/endpoints.ts"),
      "@rivonclaw/core/api-contract": resolve(__dirname, "../../packages/core/src/api-contract.ts"),
      "@rivonclaw/core": resolve(__dirname, "../../packages/core/src/index.ts"),
      "@rivonclaw/storage": resolve(__dirname, "../../packages/storage/src/index.ts"),
      "@rivonclaw/updater": resolve(__dirname, "../../packages/updater/src/index.ts"),
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
      "graphql": graphqlPath,
    },
  },
});
