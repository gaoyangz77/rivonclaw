import { createServer } from "node:http";
import { describe, it, expect } from "vitest";
import {
  extractCodexSubscriptionActiveUntilMs,
  extractJwtExpiresAtMs,
  refreshCodexOAuthCredentials,
  startHybridCodexOAuthFlow,
} from "./openai-codex-oauth.js";

/**
 * Build a fake 3-segment JWT whose payload is the given object, base64url-encoded.
 * Header/signature are placeholders — the extractor only reads the middle segment.
 */
function buildIdToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

describe("extractCodexSubscriptionActiveUntilMs", () => {
  it("returns ms since epoch for a valid ISO-8601 chatgpt_subscription_active_until claim", () => {
    const token = buildIdToken({
      exp: 1_776_318_706,
      email: "u@example.com",
      "https://api.openai.com/auth": {
        chatgpt_plan_type: "prolite",
        chatgpt_subscription_active_until: "2026-05-15T21:39:45+00:00",
      },
    });

    const result = extractCodexSubscriptionActiveUntilMs(token);

    expect(result).toBe(Date.parse("2026-05-15T21:39:45+00:00"));
  });

  it("returns undefined when the auth namespace is missing", () => {
    const token = buildIdToken({ exp: 1_776_318_706, email: "u@example.com" });
    expect(extractCodexSubscriptionActiveUntilMs(token)).toBeUndefined();
  });

  it("returns undefined when chatgpt_subscription_active_until is missing", () => {
    const token = buildIdToken({
      "https://api.openai.com/auth": {
        chatgpt_plan_type: "prolite",
        // no chatgpt_subscription_active_until
      },
    });
    expect(extractCodexSubscriptionActiveUntilMs(token)).toBeUndefined();
  });

  it("returns undefined when chatgpt_subscription_active_until is not a string", () => {
    const token = buildIdToken({
      "https://api.openai.com/auth": { chatgpt_subscription_active_until: 1_776_318_706 },
    });
    expect(extractCodexSubscriptionActiveUntilMs(token)).toBeUndefined();
  });

  it("returns undefined when chatgpt_subscription_active_until is unparseable", () => {
    const token = buildIdToken({
      "https://api.openai.com/auth": { chatgpt_subscription_active_until: "not-a-date" },
    });
    expect(extractCodexSubscriptionActiveUntilMs(token)).toBeUndefined();
  });

  it("returns undefined for a malformed token", () => {
    expect(extractCodexSubscriptionActiveUntilMs("not-a-jwt")).toBeUndefined();
  });

  it("returns undefined for an empty token", () => {
    expect(extractCodexSubscriptionActiveUntilMs("")).toBeUndefined();
  });

  it("returns undefined for an invalid base64/JSON payload", () => {
    expect(extractCodexSubscriptionActiveUntilMs("aaa.###.zzz")).toBeUndefined();
  });
});

describe("extractJwtExpiresAtMs", () => {
  it("returns ms since epoch for a standard exp claim", () => {
    const token = buildIdToken({ exp: 1_776_318_706 });

    expect(extractJwtExpiresAtMs(token)).toBe(1_776_318_706_000);
  });

  it("returns undefined when exp is missing", () => {
    const token = buildIdToken({ email: "u@example.com" });

    expect(extractJwtExpiresAtMs(token)).toBeUndefined();
  });

  it("returns undefined when exp is not a positive number", () => {
    expect(extractJwtExpiresAtMs(buildIdToken({ exp: "1776318706" }))).toBeUndefined();
    expect(extractJwtExpiresAtMs(buildIdToken({ exp: 0 }))).toBeUndefined();
  });

  it("returns undefined for malformed tokens", () => {
    expect(extractJwtExpiresAtMs("not-a-jwt")).toBeUndefined();
    expect(extractJwtExpiresAtMs("")).toBeUndefined();
  });
});

describe("refreshCodexOAuthCredentials", () => {
  it("persists the refresh token exp instead of the ChatGPT subscription expiry", async () => {
    const refreshExpiresAtSec = 1_900_000_000;
    const subscriptionExpiresAt = "2026-05-15T21:39:45+00:00";
    const stored = new Map<string, string>();
    const result = await refreshCodexOAuthCredentials(
      "key-1",
      {
        access: buildIdToken({ exp: 1_800_000_000 }),
        refresh: buildIdToken({ exp: 1_700_000_000 }),
        expires: 1_800_000_000_000,
        accountId: "account-1",
      },
      {
        set: async (key, value) => {
          stored.set(key, value);
        },
      },
      async () => new Response(JSON.stringify({
        access_token: buildIdToken({ exp: 1_800_000_000 }),
        refresh_token: buildIdToken({ exp: refreshExpiresAtSec }),
        expires_in: 3600,
        id_token: buildIdToken({
          "https://api.openai.com/auth": {
            chatgpt_subscription_active_until: subscriptionExpiresAt,
          },
        }),
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    expect(result.oauthExpiresAt).toBe(refreshExpiresAtSec * 1000);
    expect(result.oauthExpiresAt).not.toBe(Date.parse(subscriptionExpiresAt));
    expect(stored.get("oauth-cred-key-1")).toContain(`"accountId":"account-1"`);
  });
});

describe("startHybridCodexOAuthFlow", () => {
  it("uses the registered fallback redirect URI when 1455 is unavailable", async () => {
    const blocker = createServer((_req, res) => res.end("busy"));
    let blockerListening = false;
    await new Promise<void>((resolve, reject) => {
      blocker.once("listening", () => {
        blockerListening = true;
        resolve();
      });
      blocker.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE" || err.code === "EACCES") {
          resolve();
          return;
        }
        reject(err);
      });
      blocker.listen(1455, "127.0.0.1");
    });

    let openedUrl = "";
    const flow = await startHybridCodexOAuthFlow({
      openUrl: async (url) => {
        openedUrl = url;
      },
    });

    const redirectUri = new URL(openedUrl).searchParams.get("redirect_uri");
    expect(redirectUri).toBeTruthy();
    const redirect = new URL(redirectUri!);
    expect(redirect.hostname).toBe("localhost");
    expect(redirect.port).toBe("1457");
    expect(redirect.pathname).toBe("/auth/callback");

    flow.rejectManualInput(new Error("test cleanup"));
    await expect(flow.completionPromise).rejects.toThrow("test cleanup");

    if (blockerListening) {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }
  });
});
