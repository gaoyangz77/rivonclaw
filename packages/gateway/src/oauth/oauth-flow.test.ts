import { afterEach, describe, expect, it, vi } from "vitest";
import { validateGeminiAccessToken } from "./oauth-flow.js";

const USERINFO_URL = "https://www.googleapis.com/oauth2/v1/userinfo?alt=json";
type FetchInput = Parameters<typeof fetch>[0];

describe("validateGeminiAccessToken", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("validates personal Gemini OAuth tokens without requiring a Cloud project", async () => {
    const requests: string[] = [];
    globalThis.fetch = vi.fn(async (url: FetchInput) => {
      requests.push(String(url));
      return new Response(JSON.stringify({ email: "user@example.com" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const result = await validateGeminiAccessToken("access-token");

    expect(result).toEqual({ valid: true });
    expect(requests).toEqual([USERINFO_URL]);
  });

  it("still rejects invalid or expired Gemini OAuth tokens", async () => {
    globalThis.fetch = vi.fn(async () => new Response("", { status: 401 })) as typeof fetch;

    const result = await validateGeminiAccessToken("expired-token");

    expect(result).toEqual({ valid: false, error: "Invalid or expired OAuth token" });
  });
});
