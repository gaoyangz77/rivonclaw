import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHARED_FORMATTER = resolve(SOURCE_ROOT, "lib/format-datetime.ts");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

describe("panel date/time formatting contract", () => {
  it("routes user-visible date formatting through the locale-aware helper", () => {
    const forbiddenPatterns = [
      /\.toLocaleDateString\s*\(/u,
      /\.toLocaleTimeString\s*\(/u,
      /new\s+Intl\.DateTimeFormat\s*\(/u,
      /new\s+Date\([^\n]*\)\.toLocaleString\s*\(/u,
    ];
    const violations = sourceFiles(SOURCE_ROOT)
      .filter((path) => path !== SHARED_FORMATTER && !path.endsWith(".test.ts"))
      .flatMap((path) => {
        const source = readFileSync(path, "utf8");
        return forbiddenPatterns.some((pattern) => pattern.test(source))
          ? [relative(SOURCE_ROOT, path)]
          : [];
      });

    expect(violations).toEqual([]);
  });
});
