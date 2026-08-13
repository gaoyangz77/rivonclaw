import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { withPnpmTargetArchitecture } = require("../scripts/pnpm-target-architecture.cjs") as {
  withPnpmTargetArchitecture: (options: {
    workspacePath: string;
    targetArch: "arm64" | "x64";
    yaml: { parse(source: string): unknown; stringify(value: unknown): string };
    run: () => unknown;
  }) => unknown;
};

const jsonAsYaml = {
  parse: JSON.parse,
  stringify: (value: unknown) => JSON.stringify(value),
};

describe("withPnpmTargetArchitecture", () => {
  it("adds the target architecture during install and then restores the workspace", () => {
    const workspacePath = join(mkdtempSync(join(tmpdir(), "pnpm-target-arch-")), "workspace.yaml");
    const original = '{"packages":["."]}\n';
    writeFileSync(workspacePath, original);

    const result = withPnpmTargetArchitecture({
      workspacePath,
      targetArch: "x64",
      yaml: jsonAsYaml,
      run: () => {
        const workspace = JSON.parse(readFileSync(workspacePath, "utf-8"));
        expect(workspace.supportedArchitectures).toEqual({
          os: ["current"],
          cpu: ["current", "x64"],
          libc: ["current"],
        });
        return "installed";
      },
    });

    expect(result).toBe("installed");
    expect(readFileSync(workspacePath, "utf-8")).toBe(original);
  });

  it("restores the workspace when installation fails", () => {
    const workspacePath = join(mkdtempSync(join(tmpdir(), "pnpm-target-arch-")), "workspace.yaml");
    const original = '{"packages":["."]}\n';
    writeFileSync(workspacePath, original);

    expect(() =>
      withPnpmTargetArchitecture({
        workspacePath,
        targetArch: "x64",
        yaml: jsonAsYaml,
        run: () => {
          throw new Error("install failed");
        },
      }),
    ).toThrow("install failed");
    expect(readFileSync(workspacePath, "utf-8")).toBe(original);
  });
});
