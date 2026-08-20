import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SYSTEM_TOOL_CATALOG } from "./system-tool-catalog.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const VENDOR_TOOL_CATALOG = resolve(
  __dirname,
  "../../../../vendor/openclaw/src/agents/tool-catalog.ts",
);
const VENDOR_AUTOMATIONS_TOOL_NAME = resolve(
  __dirname,
  "../../../../vendor/openclaw/src/agents/tools/automations-tool-name.ts",
);

function readVendorCoreToolIds(): string[] {
  const source = readFileSync(VENDOR_TOOL_CATALOG, "utf-8");
  const start = source.indexOf("const CORE_TOOL_DEFINITIONS");
  const end = source.indexOf("const CORE_TOOL_BY_ID", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  const automationsSource = readFileSync(VENDOR_AUTOMATIONS_TOOL_NAME, "utf-8");
  const automationsName = automationsSource.match(
    /AUTOMATIONS_TOOL_NAME\s*=\s*["']([^"']+)["']/,
  )?.[1];
  expect(automationsName).toBeTruthy();

  return [...source.slice(start, end).matchAll(/\bid:\s*(?:"([^"]+)"|AUTOMATIONS_TOOL_NAME)/g)].map(
    (match) => match[1] ?? automationsName!,
  );
}

describe("system tool catalog vendor boundary", () => {
  it("matches the pinned OpenClaw core tool IDs exactly", () => {
    expect(SYSTEM_TOOL_CATALOG.map((tool) => tool.id)).toEqual(readVendorCoreToolIds());
  });

  it("uses the canonical automations ID rather than the legacy cron ID", () => {
    expect(SYSTEM_TOOL_CATALOG.some((tool) => tool.id === "automations")).toBe(true);
    expect(SYSTEM_TOOL_CATALOG.some((tool) => tool.id === "cron")).toBe(false);
  });
});
