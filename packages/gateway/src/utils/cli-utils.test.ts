import { describe, expect, it } from "vitest";
import { buildEffectivePath, normalizePathEnvironment } from "./cli-utils.js";

const noFallbacks = { platform: "win32" as const, extraPaths: [] };

describe("Windows executable path normalization", () => {
  it("preserves an inherited custom-drive Path", () => {
    const env = normalizePathEnvironment(
      { Path: "D:\\Program Files\\nodejs;C:\\Windows\\System32" },
      noFallbacks,
    );

    expect(env.Path).toBe("D:\\Program Files\\nodejs;C:\\Windows\\System32");
    expect(Object.keys(env).filter((key) => key.toLowerCase() === "path")).toEqual(["Path"]);
  });

  it("does not let an empty PATH shadow a valid Path", () => {
    const env = normalizePathEnvironment(
      { Path: "D:\\Program Files\\nodejs", PATH: "" },
      noFallbacks,
    );

    expect(env.Path).toBe("D:\\Program Files\\nodejs");
    expect(env.PATH).toBeUndefined();
  });

  it("deduplicates Windows entries case-insensitively", () => {
    expect(
      buildEffectivePath(
        {
          Path: "D:\\Program Files\\nodejs;C:\\Windows",
          PATH: "d:\\program files\\NODEJS;E:\\Tools",
        },
        noFallbacks,
      ),
    ).toBe("d:\\program files\\NODEJS;E:\\Tools;C:\\Windows");
  });
});

describe("POSIX executable path normalization", () => {
  it("keeps PATH semantics and removes empty entries", () => {
    const env = normalizePathEnvironment(
      { PATH: "/custom/bin::/usr/bin" },
      { platform: "darwin", extraPaths: ["/usr/bin", "/opt/homebrew/bin"] },
    );

    expect(env.PATH).toBe("/custom/bin:/usr/bin:/opt/homebrew/bin");
  });
});
