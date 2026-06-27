import { describe, expect, it } from "vitest";
import { toMstSnapshot } from "./provider-key-utils.js";
import type { ProviderKeyEntry } from "@rivonclaw/core";

function buildJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

function baseEntry(overrides: Partial<ProviderKeyEntry> = {}): ProviderKeyEntry {
  return {
    id: "key-1",
    provider: "openai-codex",
    label: "Codex",
    model: "gpt-5.5",
    isDefault: true,
    authType: "oauth",
    proxyBaseUrl: null,
    baseUrl: null,
    customProtocol: null,
    customModelsJson: null,
    source: "local",
    oauthExpiresAt: Date.parse("2026-05-15T21:39:45+00:00"),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("toMstSnapshot", () => {
  it("uses the Codex refresh token exp instead of a stale stored subscription date", async () => {
    const refreshExpiresAtSec = 1_900_000_000;
    const snapshot = await toMstSnapshot(baseEntry(), {
      get: async (key: string) => key === "oauth-cred-key-1"
        ? JSON.stringify({ refresh: buildJwt({ exp: refreshExpiresAtSec }) })
        : null,
      set: async () => {},
      delete: async () => {},
    } as any);

    expect(snapshot.oauthExpiresAt).toBe(refreshExpiresAtSec * 1000);
  });

  it("clears Codex OAuth expiry when the refresh token has no readable exp", async () => {
    const snapshot = await toMstSnapshot(baseEntry(), {
      get: async (key: string) => key === "oauth-cred-key-1"
        ? JSON.stringify({ refresh: "opaque-refresh-token" })
        : null,
      set: async () => {},
      delete: async () => {},
    } as any);

    expect(snapshot.oauthExpiresAt).toBeNull();
  });
});
