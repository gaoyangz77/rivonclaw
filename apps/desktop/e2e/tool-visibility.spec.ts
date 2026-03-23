/**
 * Tool Visibility — Capability Resolver
 *
 * Tests the ToolCapabilityResolver → effective-tools endpoint path to verify
 * that tool selection controls which tools are visible to the agent.
 *
 * Requires staging login so entitled tools (browser_profiles_*) are available.
 */
import { test, expect } from "./electron-fixture.js";

const STAGING_GRAPHQL_URL = process.env.RIVONCLAW_API_BASE_URL
  ? `${process.env.RIVONCLAW_API_BASE_URL}/graphql`
  : "https://api-stg.rivonclaw.com/graphql";

const LOGIN_MUTATION = `
  mutation Login($input: LoginInput!) {
    login(input: $input) { accessToken refreshToken }
  }
`;

const testEmail = process.env.STAGING_TEST_USERNAME;
const testPassword = process.env.STAGING_TEST_PASSWORD;
const captchaBypass = process.env.STAGING_CAPTCHA_BYPASS_TOKEN;

async function loginAndStoreTokens(apiBase: string): Promise<void> {
  const loginRes = await fetch(STAGING_GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: LOGIN_MUTATION,
      variables: {
        input: {
          email: testEmail,
          password: testPassword,
          captchaToken: captchaBypass ?? "test",
          captchaAnswer: "bypass",
        },
      },
    }),
  });
  const loginBody = (await loginRes.json()) as {
    data?: { login: { accessToken: string; refreshToken: string } };
    errors?: Array<{ message: string }>;
  };
  if (loginBody.errors?.length) {
    throw new Error(`Login failed: ${loginBody.errors[0].message}`);
  }
  const { accessToken, refreshToken } = loginBody.data!.login;

  // Push tokens to Desktop — triggers entitlement fetch + resolver init
  const storeRes = await fetch(`${apiBase}/api/auth/store-tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken, refreshToken }),
  });
  expect(storeRes.status).toBe(200);

  // Wait for async entitlement sync + resolver init, then poll until entitled tools appear.
  // We check /api/tools/available for source==="entitled" rather than effective-tools,
  // because system tools load immediately on gateway connect (before login), so
  // effectiveToolIds.length > 0 would pass before entitled tools are actually ready.
  await new Promise((r) => setTimeout(r, 2000));
  for (let i = 0; i < 15; i++) {
    const check = await fetch(`${apiBase}/api/tools/available`);
    const checkBody = (await check.json()) as { tools: Array<{ id: string; source: string }> };
    const hasEntitled = checkBody.tools.some((t: { source: string }) => t.source === "entitled");
    if (hasEntitled) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

test.describe("Tool Visibility — Capability Resolver", () => {
  test.skip(!testEmail || !testPassword, "Staging credentials not configured");

  test("no tool selection → browser profile tools not in effective tools", async ({
    window: _window,
    apiBase,
  }) => {
    await loginAndStoreTokens(apiBase);

    const res = await fetch(
      `${apiBase}/api/tools/effective-tools?sessionKey=test-no-selection`,
    );
    expect(res.ok).toBe(true);

    const body = (await res.json()) as { effectiveToolIds: string[] };
    const ids = body.effectiveToolIds;

    // Entitled tools (browser profiles) should NOT appear without explicit selection.
    // Even after login, without a RunProfile selecting them, they stay hidden.
    expect(ids).not.toContain("BROWSER_PROFILES_MANAGE");
    expect(ids).not.toContain("BROWSER_PROFILES_LIST");
    const browserProfileTools = ids.filter((id) => id.startsWith("BROWSER_PROFILES_"));
    expect(browserProfileTools).toHaveLength(0);
  });

  test("only read tools selected → manage not in effective tools", async ({
    window: _window,
    apiBase,
  }) => {
    await loginAndStoreTokens(apiBase);

    const putRes = await fetch(`${apiBase}/api/tools/run-profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scopeType: "chat_session",
        scopeKey: "test-read-only",
        runProfile: {
          id: "test-read-only-profile",
          name: "Read Only",
          selectedToolIds: [
            "BROWSER_PROFILES_LIST",
            "BROWSER_PROFILES_GET",
            "BROWSER_PROFILES_FIND",
            "BROWSER_PROFILES_TEST_PROXY",
          ],
          surfaceId: "",
        },
      }),
    });
    expect(putRes.ok).toBe(true);

    const res = await fetch(
      `${apiBase}/api/tools/effective-tools?sessionKey=test-read-only`,
    );
    expect(res.ok).toBe(true);

    const body = (await res.json()) as { effectiveToolIds: string[] };
    const ids = body.effectiveToolIds;

    expect(ids).toContain("BROWSER_PROFILES_LIST");
    expect(ids).not.toContain("BROWSER_PROFILES_MANAGE");
  });

  test("read + write selected → manage in effective tools", async ({
    window: _window,
    apiBase,
  }) => {
    await loginAndStoreTokens(apiBase);

    const putRes = await fetch(`${apiBase}/api/tools/run-profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scopeType: "chat_session",
        scopeKey: "test-read-write",
        runProfile: {
          id: "test-read-write-profile",
          name: "Read + Write",
          selectedToolIds: [
            "BROWSER_PROFILES_LIST",
            "BROWSER_PROFILES_GET",
            "BROWSER_PROFILES_FIND",
            "BROWSER_PROFILES_MANAGE",
            "BROWSER_PROFILES_TEST_PROXY",
          ],
          surfaceId: "",
        },
      }),
    });
    expect(putRes.ok).toBe(true);

    const res = await fetch(
      `${apiBase}/api/tools/effective-tools?sessionKey=test-read-write`,
    );
    expect(res.ok).toBe(true);

    const body = (await res.json()) as { effectiveToolIds: string[] };
    const ids = body.effectiveToolIds;

    expect(ids).toContain("BROWSER_PROFILES_LIST");
    expect(ids).toContain("BROWSER_PROFILES_MANAGE");
  });
});
