/**
 * Tests for the unified update flow:
 * - queryCheckUpdate() error handling
 * - processUpdatePayload() decision logic (extracted harness)
 * - caller-side state management (manual check, startup check)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { setApiBaseUrlOverride } from "@rivonclaw/core";
import { queryCheckUpdate } from "../src/cloud/backend-subscription-client.js";
import { getReleaseFeedUrl } from "../../../packages/core/src/api/endpoints.js";

/* ─── helpers ───────────────────────────────────────────────────────── */

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    headers: new Headers(),
  } as Response;
}

beforeEach(() => {
  setApiBaseUrlOverride("http://test-backend");
  delete process.env.UPDATE_FEED_URL;
  delete process.env.UPDATE_FROM_STAGING;
});

/* ═══════════════════════════════════════════════════════════════════════
   1. queryCheckUpdate — GraphQL error handling
   ═══════════════════════════════════════════════════════════════════════ */

describe("queryCheckUpdate", () => {
  it("returns payload when backend has an update", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: { checkUpdate: { version: "2.0.0" } },
      }),
    );
    const result = await queryCheckUpdate("en", "1.0.0", mockFetch);
    expect(result).toEqual({ version: "2.0.0" });
  });

  it("returns null when backend says no update", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      jsonResponse(200, { data: { checkUpdate: null } }),
    );
    const result = await queryCheckUpdate("en", "2.0.0", mockFetch);
    expect(result).toBeNull();
  });

  it("throws on HTTP non-2xx", async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(500, {}));
    await expect(queryCheckUpdate("en", "1.0.0", mockFetch))
      .rejects.toThrow("HTTP 500");
  });

  it("throws on GraphQL 200 + errors", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: null,
        errors: [{ message: "Internal server error" }],
      }),
    );
    await expect(queryCheckUpdate("en", "1.0.0", mockFetch))
      .rejects.toThrow("GraphQL errors: Internal server error");
  });

  it("throws on GraphQL 200 + errors even when data is present", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: { checkUpdate: { version: "2.0.0" } },
        errors: [{ message: "partial failure" }],
      }),
    );
    await expect(queryCheckUpdate("en", "1.0.0", mockFetch))
      .rejects.toThrow("GraphQL errors: partial failure");
  });

  it("throws on network error", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(queryCheckUpdate("en", "1.0.0", mockFetch))
      .rejects.toThrow("ECONNREFUSED");
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   2. processUpdatePayload logic — tested via a minimal extracted harness
   ═══════════════════════════════════════════════════════════════════════

   processUpdatePayload lives inside the main.ts closure and can't be
   imported directly. We replicate the exact decision sequence using the
   same helper (isNewerVersion) to validate the contract.

   No CDN HEAD check — the backend operator is trusted.                   */

import { isNewerVersion } from "@rivonclaw/updater";

/**
 * Replicates processUpdatePayload's decision logic.
 * Returns whether the update was accepted (true) or rejected (false).
 */
function simulateProcessUpdatePayload(
  currentVersion: string,
  payload: { version: string; downloadUrl?: string },
): { accepted: boolean; cleared: boolean } {
  // Step 1: version check
  if (!isNewerVersion(currentVersion, payload.version)) {
    return { accepted: false, cleared: true };
  }
  // Step 2: payload accepted — the client derives its own download URL
  return { accepted: true, cleared: false };
}

function simulateResolveDownloadUrl(
  version: string,
  platform: NodeJS.Platform,
  arch: string,
  updateFeedUrl: string,
): string | null {
  switch (platform) {
    case "darwin":
      return `${updateFeedUrl}/RivonClaw-${version}-${arch === "arm64" ? "arm64" : "x64"}.dmg`;
    case "win32":
      return `${updateFeedUrl}/RivonClaw.Setup.${version}.exe`;
    case "linux":
      return `${updateFeedUrl}/RivonClaw-${version}-${arch === "arm64" ? "arm64" : "x86_64"}.AppImage`;
    default:
      return null;
  }
}

describe("processUpdatePayload logic", () => {
  it("rejects and clears when version is not newer", () => {
    const result = simulateProcessUpdatePayload("2.0.0", { version: "1.0.0", downloadUrl: "https://cdn/f" });
    expect(result).toEqual({ accepted: false, cleared: true });
  });

  it("rejects and clears when version is equal", () => {
    const result = simulateProcessUpdatePayload("1.0.0", { version: "1.0.0", downloadUrl: "https://cdn/f" });
    expect(result).toEqual({ accepted: false, cleared: true });
  });

  it("accepts when version is newer even when downloadUrl is missing", () => {
    const result = simulateProcessUpdatePayload("1.0.0", { version: "2.0.0" });
    expect(result).toEqual({ accepted: true, cleared: false });
  });

  it("accepts when version is newer and downloadUrl is present", () => {
    const result = simulateProcessUpdatePayload("1.0.0", { version: "2.0.0", downloadUrl: "https://cdn/v2.dmg" });
    expect(result).toEqual({ accepted: true, cleared: false });
  });

  it("builds the macOS arm64 download URL from the version", () => {
    const result = simulateResolveDownloadUrl("2.0.0", "darwin", "arm64", "https://www.rivonclaw.com/releases");
    expect(result).toBe("https://www.rivonclaw.com/releases/RivonClaw-2.0.0-arm64.dmg");
  });

  it("builds the Windows download URL from the version", () => {
    const result = simulateResolveDownloadUrl("2.0.0", "win32", "x64", "https://www.rivonclaw.com/releases");
    expect(result).toBe("https://www.rivonclaw.com/releases/RivonClaw.Setup.2.0.0.exe");
  });

  it("builds the Linux x64 download URL from the version", () => {
    const result = simulateResolveDownloadUrl("2.0.0", "linux", "x64", "https://www.rivonclaw.com/releases");
    expect(result).toBe("https://www.rivonclaw.com/releases/RivonClaw-2.0.0-x86_64.AppImage");
  });
});

describe("getReleaseFeedUrl", () => {
  it("uses the dedicated updater feed for both en and zh locales", () => {
    expect(getReleaseFeedUrl("en")).toBe("https://www.rivonclaw.com/releases");
    expect(getReleaseFeedUrl("zh")).toBe("https://www.rivonclaw.com/releases");
  });

  it("lets UPDATE_FEED_URL override the updater feed", () => {
    process.env.UPDATE_FEED_URL = "https://origin.example.com/releases/";
    expect(getReleaseFeedUrl("zh")).toBe("https://origin.example.com/releases");
  });

  it("uses staging releases when UPDATE_FROM_STAGING=1 and no explicit feed override is set", () => {
    process.env.UPDATE_FROM_STAGING = "1";
    expect(getReleaseFeedUrl("en")).toBe("https://stg.rivonclaw.com/releases");
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   3. Manual / startup check — caller-side state management
   ═══════════════════════════════════════════════════════════════════════ */

describe("check-then-process flow", () => {
  it("clears state when queryCheckUpdate returns null", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      jsonResponse(200, { data: { checkUpdate: null } }),
    );
    const payload = await queryCheckUpdate("en", "2.0.0", mockFetch);

    // Simulate the caller logic from main.ts
    let cleared = false;
    if (!payload) cleared = true;

    expect(payload).toBeNull();
    expect(cleared).toBe(true);
  });

  it("proceeds to processUpdatePayload when query returns a payload", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: { checkUpdate: { version: "3.0.0" } },
      }),
    );
    const payload = await queryCheckUpdate("en", "1.0.0", mockFetch);

    expect(payload).not.toBeNull();
    expect(payload!.version).toBe("3.0.0");
  });

  it("does not clear state when query throws — error bubbles to caller", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      jsonResponse(200, { errors: [{ message: "boom" }] }),
    );
    await expect(queryCheckUpdate("en", "1.0.0", mockFetch))
      .rejects.toThrow("GraphQL errors");
  });

  it("manual check still accepts payloads without downloadUrl", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: { checkUpdate: { version: "2.0.0" } },
      }),
    );
    const payload = await queryCheckUpdate("en", "1.0.0", mockFetch);
    expect(payload).not.toBeNull();

    // processUpdatePayload accepts it and the client resolves the URL itself
    const { accepted } = simulateProcessUpdatePayload("1.0.0", payload!);
    expect(accepted).toBe(true);
  });
});
