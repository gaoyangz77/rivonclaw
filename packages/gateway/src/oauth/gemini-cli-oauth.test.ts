import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCredentialsCache,
  exchangeCodeForTokens,
  setGeminiCliSettingsFsForTest,
} from "./gemini-cli-oauth.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v1/userinfo?alt=json";
const LOAD_CODE_ASSIST_URL = "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist";

const ENV_KEYS = [
  "OPENCLAW_GEMINI_OAUTH_CLIENT_ID",
  "OPENCLAW_GEMINI_OAUTH_CLIENT_SECRET",
  "GEMINI_CLI_OAUTH_CLIENT_ID",
  "GEMINI_CLI_OAUTH_CLIENT_SECRET",
  "GOOGLE_CLOUD_PROJECT",
  "GOOGLE_CLOUD_PROJECT_ID",
  "GOOGLE_GENAI_USE_GCA",
] as const;

function responseJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("exchangeCodeForTokens", () => {
  const originalFetch = globalThis.fetch;
  let envSnapshot: Partial<Record<(typeof ENV_KEYS)[number], string>>;

  beforeEach(() => {
    envSnapshot = {};
    for (const key of ENV_KEYS) {
      envSnapshot[key] = process.env[key];
      delete process.env[key];
    }
    process.env.OPENCLAW_GEMINI_OAUTH_CLIENT_ID = "gemini-client-id";
    process.env.OPENCLAW_GEMINI_OAUTH_CLIENT_SECRET = "gemini-client-secret";
    setGeminiCliSettingsFsForTest({
      existsSync: () => false,
      readFileSync: () => "{}",
      homedir: () => "/mock/home",
    });
    clearCredentialsCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const key of ENV_KEYS) {
      const value = envSnapshot[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    setGeminiCliSettingsFsForTest();
    clearCredentialsCache();
    vi.restoreAllMocks();
  });

  it("skips Code Assist project discovery for the default Desktop personal OAuth flow", async () => {
    const requests: string[] = [];
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
      const urlString = String(url);
      requests.push(urlString);
      if (urlString === TOKEN_URL) {
        return responseJson({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
        });
      }
      if (urlString === USERINFO_URL) {
        return responseJson({ email: "user@example.com" });
      }
      throw new Error(`Unexpected request: ${urlString}`);
    }) as typeof fetch;

    const result = await exchangeCodeForTokens(
      "oauth-code",
      "pkce-verifier",
      undefined,
      "http://127.0.0.1:8085/oauth2callback",
    );

    expect(result.email).toBe("user@example.com");
    expect(result.projectId).toBeUndefined();
    expect(requests).toEqual([TOKEN_URL, USERINFO_URL]);
  });

  it("still performs Code Assist discovery when a Cloud project is explicitly configured", async () => {
    process.env.GOOGLE_CLOUD_PROJECT = "env-project";
    const requests: string[] = [];
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
      const urlString = String(url);
      requests.push(urlString);
      if (urlString === TOKEN_URL) {
        return responseJson({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
        });
      }
      if (urlString === USERINFO_URL) {
        return responseJson({ email: "user@example.com" });
      }
      if (urlString === LOAD_CODE_ASSIST_URL) {
        return responseJson({
          currentTier: { id: "standard-tier" },
          cloudaicompanionProject: "env-project",
        });
      }
      throw new Error(`Unexpected request: ${urlString}`);
    }) as typeof fetch;

    const result = await exchangeCodeForTokens(
      "oauth-code",
      "pkce-verifier",
      undefined,
      "http://127.0.0.1:8085/oauth2callback",
    );

    expect(result.projectId).toBe("env-project");
    expect(requests).toEqual([TOKEN_URL, USERINFO_URL, LOAD_CODE_ASSIST_URL]);
  });

  it("honors Gemini CLI oauth-personal settings over Cloud project environment variables", async () => {
    process.env.GOOGLE_CLOUD_PROJECT = "env-project";
    setGeminiCliSettingsFsForTest({
      existsSync: () => true,
      readFileSync: () => JSON.stringify({ security: { auth: { selectedType: "oauth-personal" } } }),
      homedir: () => "/mock/home",
    });

    const requests: string[] = [];
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
      const urlString = String(url);
      requests.push(urlString);
      if (urlString === TOKEN_URL) {
        return responseJson({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
        });
      }
      if (urlString === USERINFO_URL) {
        return responseJson({ email: "user@example.com" });
      }
      throw new Error(`Unexpected request: ${urlString}`);
    }) as typeof fetch;

    const result = await exchangeCodeForTokens(
      "oauth-code",
      "pkce-verifier",
      undefined,
      "http://127.0.0.1:8085/oauth2callback",
    );

    expect(result.projectId).toBeUndefined();
    expect(requests).toEqual([TOKEN_URL, USERINFO_URL]);
  });
});
