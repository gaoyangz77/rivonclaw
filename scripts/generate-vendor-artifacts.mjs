#!/usr/bin/env node
/**
 * Generate vendor boundary artifacts.
 *
 * Reads selected source files from vendor/openclaw and produces self-contained
 * TypeScript modules under packages/core/src/generated/ so that the rest of
 * the monorepo never imports from vendor/ directly.
 *
 * Usage:  node scripts/generate-vendor-artifacts.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function loadEsbuild() {
  try {
    return require("esbuild");
  } catch {
    // esbuild is not always hoisted by pnpm; resolve it from the virtual store.
    const { readdirSync } = await import("node:fs");
    const pnpmDir = resolve(ROOT, "node_modules/.pnpm");
    const esbuildDir = readdirSync(pnpmDir).find((entry) => entry.startsWith("esbuild@"));
    if (!esbuildDir) throw new Error("Cannot find esbuild in node_modules/.pnpm/");
    return require(resolve(pnpmDir, esbuildDir, "node_modules/esbuild/lib/main.js"));
  }
}

async function generateReasoningTags() {
  const esbuild = await loadEsbuild();
  const sharedTextDir = resolve(ROOT, "vendor/openclaw/src/shared/text");
  const result = await esbuild.build({
    stdin: {
      contents: ['export * from "./final-tags.js";', 'export * from "./reasoning-tags.js";'].join(
        "\n",
      ),
      resolveDir: sharedTextDir,
      sourcefile: "reasoning-tags.generated-entry.ts",
      loader: "ts",
    },
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    target: "node22",
    alias: {
      "@openclaw/normalization-core": resolve(
        ROOT,
        "vendor/openclaw/packages/normalization-core/src/index.ts",
      ),
    },
  });

  const header = `// @ts-nocheck -- esbuild emits JavaScript syntax into this generated TypeScript module.
// AUTO-GENERATED from vendor/openclaw — do not edit manually.
// Re-generate with: node scripts/generate-vendor-artifacts.mjs

`;
  const publicTypes = `
export type ReasoningTagMode = "strict" | "preserve";
export type ReasoningTagTrim = "none" | "start" | "both";
export type ReasoningTagScope = "all" | "leading";
`;
  const output = header + result.outputFiles[0].text + publicTypes;

  const outPath = resolve(ROOT, "packages/core/src/generated/reasoning-tags.ts");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, output, "utf-8");
  console.log(`wrote ${outPath}`);
}

async function generateOpenClawSchema() {
  const esbuild = await loadEsbuild();

  const entryPoint = resolve(ROOT, "vendor/openclaw/src/config/zod-schema.ts");
  const outDir = resolve(ROOT, "packages/gateway/src/generated");
  mkdirSync(outDir, { recursive: true });

  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    target: "node22",
    external: ["zod"],
  });

  const jsCode = result.outputFiles[0].text;
  const header = `// AUTO-GENERATED from vendor/openclaw — do not edit manually.\n// Re-generate with: node scripts/generate-vendor-artifacts.mjs\n\n`;
  const jsOutPath = resolve(outDir, "openclaw-schema.js");
  writeFileSync(jsOutPath, header + jsCode, "utf-8");
  console.log(`wrote ${jsOutPath}`);

  const dtsContent = `// AUTO-GENERATED — do not edit manually.
// Re-generate with: node scripts/generate-vendor-artifacts.mjs
import { z } from "zod";
export declare const OpenClawSchema: z.ZodType<Record<string, unknown>>;
`;
  const dtsOutPath = resolve(outDir, "openclaw-schema.d.ts");
  writeFileSync(dtsOutPath, dtsContent, "utf-8");
  console.log(`wrote ${dtsOutPath}`);
}

async function generatePluginModelCatalog() {
  // Import the built entry rather than the TypeScript source. Newer OpenClaw
  // provider sources use package self-references that only resolve from the
  // installed package layout; the dist entry keeps those boundaries intact.
  const googleCatalogPath = resolve(
    ROOT,
    "vendor/openclaw/dist/extensions/google/provider-catalog.js",
  );
  const { buildGoogleStaticCatalogProvider, buildGoogleVertexStaticCatalogProvider } = await import(
    `${pathToFileURL(googleCatalogPath).href}?generated=${Date.now()}`
  );

  const toEntries = (provider) =>
    provider.models.map((model) => ({
      id: model.id,
      name: model.name,
      ...(Number.isFinite(model.contextWindow) ? { contextWindow: model.contextWindow } : {}),
    }));
  const google = toEntries(buildGoogleStaticCatalogProvider());
  const catalog = {
    google,
    "google-gemini-cli": google,
    "google-vertex": toEntries(buildGoogleVertexStaticCatalogProvider()),
  };
  const output = `// AUTO-GENERATED from vendor/openclaw — do not edit manually.
// Re-generate with: node scripts/generate-vendor-artifacts.mjs

export const OPENCLAW_PLUGIN_MODEL_CATALOG = ${JSON.stringify(catalog, null, 2)} as const;
`;
  const outPath = resolve(ROOT, "packages/gateway/src/generated/openclaw-plugin-model-catalog.ts");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, output, "utf-8");
  console.log(`wrote ${outPath}`);
}

await generateReasoningTags();
await generatePluginModelCatalog();
await generateOpenClawSchema();
