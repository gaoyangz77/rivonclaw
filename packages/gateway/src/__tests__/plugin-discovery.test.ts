/**
 * Validates that every extension plugin is discoverable by OpenClaw's plugin system.
 *
 * OpenClaw discovers plugins in two ways:
 * 1. Auto-discovery: root-level index.{ts,js,mjs,cjs} in the extension directory
 * 2. Explicit declaration: package.json → "openclaw": { "extensions": ["./dist/entry.mjs"] }
 *
 * Every extension must satisfy at least one of these. Additionally, every extension
 * must have an openclaw.plugin.json manifest with a valid "id" field.
 *
 * If this test fails, the gateway will log "plugin not found" at startup.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const EXTENSIONS_DIRS = [
  join(import.meta.dirname, "../../../../extensions"),
  join(import.meta.dirname, "../../../../extensions-merchant"),
];
const AUTO_DISCOVERY_ENTRIES = ["index.ts", "index.js", "index.mjs", "index.cjs"];

type ExtensionDir = {
  name: string;
  path: string;
};

function getExtensionDirs(): ExtensionDir[] {
  return EXTENSIONS_DIRS.flatMap((extensionsDir) => {
    if (!existsSync(extensionsDir)) return [];
    return readdirSync(extensionsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .filter(d => existsSync(join(extensionsDir, d.name, "openclaw.plugin.json")))
      .map(d => ({
        name: d.name,
        path: join(extensionsDir, d.name),
      }));
  });
}

describe("extension plugin discovery", () => {
  const extensionDirs = getExtensionDirs();

  it("found at least one extension", () => {
    expect(extensionDirs.length).toBeGreaterThan(0);
  });

  for (const dir of extensionDirs) {
    describe(dir.name, () => {
      const extPath = dir.path;

      it("has openclaw.plugin.json with a valid id", () => {
        const manifestPath = join(extPath, "openclaw.plugin.json");
        const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
        expect(manifest.id).toBeTruthy();
        expect(typeof manifest.id).toBe("string");
      });

      it("is discoverable (auto-discovery entry OR openclaw.extensions in package.json)", () => {
        // Check auto-discovery: root-level index.{ts,js,mjs,cjs}
        const hasAutoEntry = AUTO_DISCOVERY_ENTRIES.some(entry =>
          existsSync(join(extPath, entry)),
        );

        // Check explicit declaration: package.json → openclaw.extensions
        let hasExplicitDeclaration = false;
        const pkgPath = join(extPath, "package.json");
        if (existsSync(pkgPath)) {
          const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
          const extensions = pkg.openclaw?.extensions;
          hasExplicitDeclaration = Array.isArray(extensions) && extensions.length > 0;
        }

        expect(
          hasAutoEntry || hasExplicitDeclaration,
          `${dir}: must have either a root-level index.{ts,js,mjs,cjs} or "openclaw.extensions" in package.json. ` +
          `Without this, OpenClaw cannot discover the plugin and will log "plugin not found".`,
        ).toBe(true);
      });
    });
  }
});
