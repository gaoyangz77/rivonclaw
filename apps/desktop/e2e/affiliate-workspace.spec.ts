/**
 * Affiliate workspace — entity entry points.
 *
 * This covers the intended UI shape:
 * - creator relationships
 * - action proposals
 * - collaboration records
 * - staff handling items
 * - affiliate intelligence/settings-adjacent surface
 *
 * The test is read-only. It only logs in, renders pages, and opens a detail
 * modal if staging data happens to contain a card on that page.
 */
import { test, expect } from "./electron-fixture.js";
import { DEFAULTS } from "@rivonclaw/core/defaults";

const STAGING_GRAPHQL_URL = `https://${DEFAULTS.domains.apiStaging}/graphql`;

const LOGIN_MUTATION = `
  mutation Login($input: LoginInput!) {
    login(input: $input) { accessToken refreshToken }
  }
`;

const REQUEST_CAPTCHA_MUTATION = `
  mutation RequestCaptcha($deterministicToken: String) {
    requestCaptcha(deterministicToken: $deterministicToken) { token svg }
  }
`;

const testEmail = process.env.STAGING_TEST_USERNAME;
const testPassword = process.env.STAGING_TEST_PASSWORD;
const deterministicCaptchaToken = process.env.STAGING_CAPTCHA_BYPASS_TOKEN;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function graphqlRequest<TData>(
  query: string,
  variables?: Record<string, unknown>,
  accessToken?: string,
): Promise<TData> {
  const res = await fetch(STAGING_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await res.json()) as {
    data?: TData;
    errors?: Array<{ message: string }>;
  };
  if (!res.ok || body.errors?.length || !body.data) {
    throw new Error(`GraphQL request failed: ${body.errors?.[0]?.message ?? res.statusText}`);
  }
  return body.data;
}

async function storeTokens(apiBase: string, accessToken: string, refreshToken: string): Promise<void> {
  let lastStatus = 0;
  let lastBody = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const storeRes = await fetch(`${apiBase}/api/auth/store-tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken, refreshToken }),
    });
    lastStatus = storeRes.status;
    lastBody = await storeRes.text().catch(() => "");
    if (storeRes.status === 200) return;
    await wait(750);
  }
  throw new Error(`/api/auth/store-tokens failed with ${lastStatus}: ${lastBody}`);
}

async function requestDeterministicCaptcha(): Promise<string> {
  const body = await graphqlRequest<{ requestCaptcha: { token: string; svg: string } }>(
    REQUEST_CAPTCHA_MUTATION,
    { deterministicToken: deterministicCaptchaToken },
  );
  expect(body.requestCaptcha.svg).toContain("0000");
  return body.requestCaptcha.token;
}

async function login(window: import("@playwright/test").Page, apiBase: string): Promise<void> {
  const loginBody = await graphqlRequest<{
    login: { accessToken: string; refreshToken: string };
  }>(LOGIN_MUTATION, {
    input: {
      email: testEmail,
      password: testPassword,
      captchaToken: await requestDeterministicCaptcha(),
      captchaAnswer: "0000",
    },
  });

  await storeTokens(apiBase, loginBody.login.accessToken, loginBody.login.refreshToken);
  await window.reload({ waitUntil: "domcontentloaded" });
  await expect(window.locator(".nav-btn", { hasText: "Account" })
    .locator(".nav-account-avatar:not(.nav-account-avatar-loading)")).toBeVisible({ timeout: 15_000 });
}

async function dismissModals(window: import("@playwright/test").Page): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    const backdrop = window.locator(".modal-backdrop");
    if (!await backdrop.isVisible({ timeout: 2_000 }).catch(() => false)) break;
    await backdrop.click({ position: { x: 5, y: 5 }, force: true });
    await backdrop.waitFor({ state: "hidden", timeout: 2_000 }).catch(() => {});
  }
}

async function navigateTo(window: import("@playwright/test").Page, path: string): Promise<void> {
  await window.evaluate((targetPath) => {
    window.history.pushState(null, "", targetPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

async function expectAffiliatePage(
  window: import("@playwright/test").Page,
  path: string,
  title: string,
  optionalCardSelector?: string,
): Promise<void> {
  await navigateTo(window, path);
  await expect(window.locator(".affiliate-workbench").first()).toBeVisible({ timeout: 20_000 });
  await expect(window.locator("h1", { hasText: title }).first()).toBeVisible({ timeout: 20_000 });

  if (!optionalCardSelector) return;
  const firstCard = window.locator(optionalCardSelector).first();
  if (!await firstCard.isVisible({ timeout: 5_000 }).catch(() => false)) return;
  await firstCard.click();
  await expect(window.locator(".modal-backdrop")).toBeVisible({ timeout: 10_000 });
  await window.locator(".modal-backdrop .modal-close").first().click();
  await expect(window.locator(".modal-backdrop")).not.toBeVisible({ timeout: 10_000 });
}

test.describe("Affiliate workspace entity pages", () => {
  test.skip(!testEmail || !testPassword || !deterministicCaptchaToken, "Staging credentials not configured");

  test("renders the five affiliate entry points and opens relationship context when data exists", async ({ window, apiBase }) => {
    await dismissModals(window);
    await login(window, apiBase);

    await expectAffiliatePage(
      window,
      "/commerce/affiliate/creators",
      "Cooperation creators",
      ".affiliate-creator-row",
    );
    await expectAffiliatePage(
      window,
      "/commerce/affiliate/attention",
      "Action proposals",
      ".affiliate-action-proposal-card-row",
    );
    await expectAffiliatePage(
      window,
      "/commerce/affiliate/history",
      "Collaboration records",
      ".affiliate-collaboration-record-card",
    );
    await expectAffiliatePage(
      window,
      "/commerce/affiliate/staff",
      "Collaborations needing staff handling",
      ".affiliate-creator-relationship-work-card",
    );
    await expectAffiliatePage(
      window,
      "/commerce/affiliate/intelligence",
      "Affiliate Intelligence",
    );
  });
});
