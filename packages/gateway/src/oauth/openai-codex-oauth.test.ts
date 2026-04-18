import { describe, it, expect } from "vitest";
import { extractCodexSubscriptionActiveUntilMs } from "./openai-codex-oauth.js";

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
