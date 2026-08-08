import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { removeTempDirBestEffort } = require("../scripts/verify-vendor-runtime-contract.cjs") as {
  removeTempDirBestEffort: (
    tempDir: string,
    remove?: (path: string, options: Record<string, unknown>) => void,
  ) => boolean;
};

describe("removeTempDirBestEffort", () => {
  it.each(["EBUSY", "ENOTEMPTY", "EPERM"])(
    "does not fail a successful runtime check on transient %s cleanup errors",
    (code) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const remove = vi.fn(() => {
        throw Object.assign(new Error("locked"), { code });
      });

      expect(removeTempDirBestEffort("temporary-state", remove)).toBe(false);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(code));
      warn.mockRestore();
    },
  );

  it("still surfaces non-transient cleanup errors", () => {
    const remove = () => {
      throw Object.assign(new Error("invalid path"), { code: "EINVAL" });
    };

    expect(() => removeTempDirBestEffort("temporary-state", remove)).toThrow("invalid path");
  });

  it("removes temporary directories with bounded retries", () => {
    const remove = vi.fn();

    expect(removeTempDirBestEffort("temporary-state", remove)).toBe(true);
    expect(remove).toHaveBeenCalledWith("temporary-state", {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
  });
});
