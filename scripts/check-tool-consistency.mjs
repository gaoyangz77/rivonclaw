#!/usr/bin/env node
/**
 * Validate tool ID consistency across all layers.
 *
 * Checks:
 * A) Every extension tool name has a matching ToolId in the generated types
 *    (name.toUpperCase() must exist as a ToolId value).
 * B) Every ToolId in the generated types has i18n entries in both en.ts and zh.ts
 *    (key pattern: tools.selector.name.{TOOL_ID}).
 * C) Every ToolId in the backend enum exists in the generated graphql.ts
 *    (catches stale codegen).
 *
 * Run: node scripts/check-tool-consistency.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------------------
// 1. Parse generated ToolId values from packages/core/src/generated/graphql.ts
// ---------------------------------------------------------------------------

const graphqlPath = join(root, "packages/core/src/generated/graphql.ts");
const graphqlTs = readFileSync(graphqlPath, "utf8");

const toolIdBlockMatch = graphqlTs.match(
  /export\s+const\s+ToolId\s*=\s*\{([^}]+)\}\s*as\s+const/s,
);
if (!toolIdBlockMatch) {
  console.error("ERROR: Could not find ToolId const in generated/graphql.ts");
  process.exit(1);
}

/** Set of UPPER_CASE ToolId values from the generated file. */
const generatedToolIds = new Set();
const valuePattern = /:\s*['"]([A-Z_]+)['"]/g;
let m;
while ((m = valuePattern.exec(toolIdBlockMatch[1])) !== null) {
  generatedToolIds.add(m[1]);
}

console.log(`Found ${generatedToolIds.size} ToolId values in generated/graphql.ts`);

// ---------------------------------------------------------------------------
// 2. Parse backend ToolId enum from server/backend/src/types/tool-enums.ts
// ---------------------------------------------------------------------------

const backendEnumPath = join(
  root,
  "server/backend/src/types/tool-enums.ts",
);
const backendToolIds = new Set();

if (existsSync(backendEnumPath)) {
  const backendTs = readFileSync(backendEnumPath, "utf8");
  const enumBlockMatch = backendTs.match(
    /export\s+enum\s+ToolId\s*\{([^}]+)\}/s,
  );
  if (enumBlockMatch) {
    const enumValuePattern = /=\s*["']([A-Z_]+)["']/g;
    let em;
    while ((em = enumValuePattern.exec(enumBlockMatch[1])) !== null) {
      backendToolIds.add(em[1]);
    }
  }
  console.log(
    `Found ${backendToolIds.size} ToolId values in backend tool-enums.ts`,
  );
}

// ---------------------------------------------------------------------------
// 3. Parse extension tool names from extensions-merchant/*/src/tools.ts
// ---------------------------------------------------------------------------

/** @type {Array<{name: string, extension: string}>} */
const extensionTools = [];
const extDirs = ["extensions", "extensions-merchant"];

for (const extParent of extDirs) {
  const extDir = join(root, extParent);
  if (!existsSync(extDir)) continue;

  for (const entry of readdirSync(extDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const toolsPath = join(extDir, entry.name, "src/tools.ts");
    if (!existsSync(toolsPath)) continue;

    const toolsSrc = readFileSync(toolsPath, "utf8");

    // Match both hardcoded names: name: "xxx" and derived names: name: toolName(...)
    // For hardcoded names:
    const hardcodedPattern = /name:\s*["']([a-z_]+)["']/g;
    let tm;
    while ((tm = hardcodedPattern.exec(toolsSrc)) !== null) {
      extensionTools.push({ name: tm[1], extension: entry.name });
    }

    // For toolName(CoreGQL.ToolId.Xxx) or toolName(ToolId.Xxx):
    // These resolve to the ToolId value lowercased. Extract the PascalCase key
    // and look it up in the generated ToolId block.
    const derivedPattern =
      /name:\s*toolName\(\s*(?:CoreGQL|GQL)\.ToolId\.(\w+)\s*\)/g;
    let dm;
    while ((dm = derivedPattern.exec(toolsSrc)) !== null) {
      // Find the UPPER_CASE value for this PascalCase key in the generated block
      const pascalKey = dm[1];
      const keyValuePattern = new RegExp(
        `${pascalKey}:\\s*['"]([A-Z_]+)['"]`,
      );
      const kv = toolIdBlockMatch[1].match(keyValuePattern);
      if (kv) {
        extensionTools.push({
          name: kv[1].toLowerCase(),
          extension: entry.name,
        });
      } else {
        extensionTools.push({
          name: `UNRESOLVED:${pascalKey}`,
          extension: entry.name,
        });
      }
    }
  }
}

console.log(
  `Found ${extensionTools.length} tool definitions across extensions`,
);

// ---------------------------------------------------------------------------
// 4. Parse i18n files for tool name entries
// ---------------------------------------------------------------------------

const enPath = join(root, "apps/panel/src/i18n/en.ts");
const zhPath = join(root, "apps/panel/src/i18n/zh.ts");

function extractI18nToolNames(filePath) {
  const names = new Set();
  if (!existsSync(filePath)) return names;
  const src = readFileSync(filePath, "utf8");
  // Match keys like TIKTOK_SEND_MESSAGE: "..." or BROWSER_PROFILES_LIST: "..."
  const keyPattern = /^\s+([A-Z][A-Z_]+[A-Z]):/gm;
  let km;
  while ((km = keyPattern.exec(src)) !== null) {
    names.add(km[1]);
  }
  return names;
}

const enToolNames = extractI18nToolNames(enPath);
const zhToolNames = extractI18nToolNames(zhPath);

// ---------------------------------------------------------------------------
// 5. Run checks
// ---------------------------------------------------------------------------

let errors = 0;
let warnings = 0;

// Check A: Every extension tool has a matching ToolId
console.log("\n--- Check A: Extension tools vs ToolId ---");
for (const { name, extension } of extensionTools) {
  if (name.startsWith("UNRESOLVED:")) {
    console.error(
      `  ERROR: [${extension}] toolName reference '${name.replace("UNRESOLVED:", "")}' not found in generated ToolId`,
    );
    errors++;
    continue;
  }
  const uppercased = name.toUpperCase();
  if (!generatedToolIds.has(uppercased)) {
    console.error(
      `  ERROR: [${extension}] tool '${name}' has no matching ToolId '${uppercased}' in generated types`,
    );
    errors++;
  }
}
if (errors === 0) {
  console.log("  All extension tools have matching ToolIds.");
}

// Check B: ToolIds have i18n entries
console.log("\n--- Check B: ToolId i18n coverage ---");
for (const toolId of generatedToolIds) {
  if (!enToolNames.has(toolId)) {
    console.warn(`  WARN: ToolId '${toolId}' missing i18n entry in en.ts`);
    warnings++;
  }
  if (!zhToolNames.has(toolId)) {
    console.warn(`  WARN: ToolId '${toolId}' missing i18n entry in zh.ts`);
    warnings++;
  }
}
if (warnings === 0) {
  console.log("  All ToolIds have i18n entries in both en.ts and zh.ts.");
}

// Check C: Backend ToolId vs generated ToolId (codegen freshness)
console.log("\n--- Check C: Backend enum vs generated ToolId (codegen freshness) ---");
let codegenDrift = 0;
if (backendToolIds.size > 0) {
  for (const backendId of backendToolIds) {
    if (!generatedToolIds.has(backendId)) {
      console.error(
        `  ERROR: Backend ToolId '${backendId}' not in generated graphql.ts — run codegen`,
      );
      errors++;
      codegenDrift++;
    }
  }
  for (const genId of generatedToolIds) {
    if (!backendToolIds.has(genId)) {
      console.error(
        `  ERROR: Generated ToolId '${genId}' not in backend enum — stale or removed`,
      );
      errors++;
      codegenDrift++;
    }
  }
  if (codegenDrift === 0) {
    console.log("  Backend and generated ToolId enums are in sync.");
  }
} else {
  console.log("  Skipped (server/backend not available).");
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n=== Summary: ${errors} error(s), ${warnings} warning(s) ===`);
if (errors > 0) {
  process.exit(1);
}
