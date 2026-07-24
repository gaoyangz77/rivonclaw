import { describe, expect, it, vi } from "vitest";
import { join } from "node:path";

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(),
    setPath: vi.fn(),
    setName: vi.fn(),
  },
}));

import { resolveCompatibleUserDataPath } from "./brand-migration.js";

describe("resolveCompatibleUserDataPath", () => {
  it("keeps the RivonClaw Electron profile when it exists", () => {
    const appData = join("Users", "seller", "Library", "Application Support");
    const legacyPath = join(appData, "RivonClaw");

    expect(resolveCompatibleUserDataPath(appData, "darwin", (path) => path === legacyPath)).toBe(
      legacyPath,
    );
  });

  it("uses the oldest Windows package profile when that is the only existing profile", () => {
    const appData = join("C:", "Users", "seller", "AppData", "Roaming");
    const packagePath = join(appData, "@easyclaw", "desktop");

    expect(resolveCompatibleUserDataPath(appData, "win32", (path) => path === packagePath)).toBe(
      packagePath,
    );
  });

  it("uses the stable legacy product path for a new install", () => {
    const appData = join("home", "seller", ".config");

    expect(resolveCompatibleUserDataPath(appData, "linux", () => false)).toBe(
      join(appData, "RivonClaw"),
    );
  });
});
