import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0014-vendor-openclaw-route-remote-media-through-rivonclaw-cache.patch",
);

describe("vendor patch 0014: route remote media through RivonClaw cache", () => {
  const patch = readFileSync(PATCH_FILE, "utf-8");

  it("resolves remote media through the local authenticated Desktop bridge", () => {
    expect(patch).toContain("resolveRivonClawDesktopMediaCacheUrl");
    expect(patch).toContain("RIVONCLAW_PANEL_PORT");
    expect(patch).toContain("RIVONCLAW_DESKTOP_API_TOKEN");
    expect(patch).toContain("/api/media-cache/resolve");
    expect(patch).toContain("X-RivonClaw-Desktop-Token");
  });

  it("keeps the CN relay decision centralized in Desktop while preserving global fallback", () => {
    expect(patch).toContain("RIVONCLAW_FIRST_PARTY_DOMAIN_ROUTE");
    expect(patch).toContain("RIVONCLAW_CN_RELAY");
    expect(patch).toContain("shouldFailHardOnRivonClawMediaCacheError");
    expect(patch).toContain(
      "keeps upstream fetch behavior when RivonClaw media cache is unavailable outside the CN relay route",
    );
  });

  it("routes the guarded fetch to the resolved proxy URL", () => {
    expect(patch).toContain("const requestUrl = await resolveRivonClawDesktopMediaCacheUrl(url)");
    expect(patch).toContain("url: requestUrl");
    expect(patch).toContain("https://media-cache.example.com/image.jpeg");
  });
});
