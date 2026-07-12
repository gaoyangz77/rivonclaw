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

function generateReasoningTags() {
  const codeRegionsSrc = readFileSync(
    resolve(ROOT, "vendor/openclaw/src/shared/text/code-regions.ts"),
    "utf-8",
  );
  const reasoningTagsSrc = readFileSync(
    resolve(ROOT, "vendor/openclaw/src/shared/text/reasoning-tags.ts"),
    "utf-8",
  );
  const finalTagsSrc = readFileSync(
    resolve(ROOT, "vendor/openclaw/src/shared/text/final-tags.ts"),
    "utf-8",
  );

  // --- Transform code-regions: strip exports, keep as file-private -----------
  const codeRegionsBody = codeRegionsSrc
    // Remove "export " keyword — these become file-private
    .replace(/^export /gm, "");

  // --- Transform reasoning-tags: remove inlined imports, keep exports --------
  const reasoningTagsBody = reasoningTagsSrc.replace(
    /^import\s*\{[^}]*\}\s*from\s*["']\.\/(?:code-regions|final-tags)\.js["'];?\s*\n/gm,
    "",
  );

  const output = `// AUTO-GENERATED from vendor/openclaw — do not edit manually.
// Re-generate with: node scripts/generate-vendor-artifacts.mjs

// ---------------------------------------------------------------------------
// Inlined from vendor/openclaw/src/shared/text/code-regions.ts (private)
// ---------------------------------------------------------------------------

${codeRegionsBody.trim()}

// ---------------------------------------------------------------------------
// Inlined from vendor/openclaw/src/shared/text/final-tags.ts (public exports)
// ---------------------------------------------------------------------------

${finalTagsSrc.trim()}

// ---------------------------------------------------------------------------
// From vendor/openclaw/src/shared/text/reasoning-tags.ts (public exports)
// ---------------------------------------------------------------------------

${reasoningTagsBody.trim()}
`;

  const outPath = resolve(ROOT, "packages/core/src/generated/reasoning-tags.ts");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, output, "utf-8");
  console.log(`wrote ${outPath}`);
}

async function generateOpenClawSchema() {
  // esbuild is not hoisted to root node_modules by pnpm. Resolve it from
  // the .pnpm flat store via a known consumer package (tsdown).
  let esbuild;
  try {
    esbuild = require("esbuild");
  } catch {
    // Fallback: resolve from the pnpm virtual store
    const { readdirSync } = await import("node:fs");
    const pnpmDir = resolve(ROOT, "node_modules/.pnpm");
    const esbuildDir = readdirSync(pnpmDir).find((d) => d.startsWith("esbuild@"));
    if (!esbuildDir) throw new Error("Cannot find esbuild in node_modules/.pnpm/");
    esbuild = require(resolve(pnpmDir, esbuildDir, "node_modules/esbuild/lib/main.js"));
  }

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
  const googleCatalogPath = resolve(ROOT, "vendor/openclaw/extensions/google/provider-catalog.ts");
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

generateReasoningTags();
await generatePluginModelCatalog();
await generateOpenClawSchema();
