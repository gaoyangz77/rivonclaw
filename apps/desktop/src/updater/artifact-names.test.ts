import { describe, expect, it } from "vitest";
import { resolveMacUpdateZipAssetName, resolveReleaseAssetNameFor } from "./artifact-names.js";

describe("release artifact brand compatibility", () => {
  it("keeps historical names for the last RivonClaw release", () => {
    expect(resolveMacUpdateZipAssetName("1.8.79", "arm64")).toBe("RivonClaw-1.8.79-arm64.zip");
    expect(resolveReleaseAssetNameFor("1.8.79", "win32", "x64")).toBe("RivonClaw.Setup.1.8.79.exe");
  });

  it("uses TK Copilot artifact names after the rebrand", () => {
    expect(resolveMacUpdateZipAssetName("1.8.80", "x64")).toBe("TK-Copilot-1.8.80-x64.zip");
    expect(resolveReleaseAssetNameFor("2.0.0", "darwin", "arm64")).toBe(
      "TK-Copilot-2.0.0-arm64.dmg",
    );
    expect(resolveReleaseAssetNameFor("2.0.0", "win32", "x64")).toBe("TK-Copilot.Setup.2.0.0.exe");
    expect(resolveReleaseAssetNameFor("2.0.0", "linux", "x64")).toBe(
      "TK-Copilot-2.0.0-x86_64.AppImage",
    );
  });
});
