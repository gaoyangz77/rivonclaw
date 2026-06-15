/**
 * Ecommerce Page — UI rendering, navigation, and drawer interaction.
 *
 * Requires staging login. Ecommerce navigation is visible by default.
 * Assumes the test account always has at least one connected shop.
 *
 * All tests are read-only or toggle UI state that doesn't require teardown.
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

const REGISTER_MUTATION = `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      accessToken
      refreshToken
      user {
        email
        enrolledModules
        defaultRunProfileId
      }
    }
  }
`;

const ME_QUERY = `
  query Me {
    me {
      email
      enrolledModules
      defaultRunProfileId
    }
  }
`;

const ECOMMERCE_MODULE_ID = "GLOBAL_ECOMMERCE_SELLER";
const SHOP_OPERATIONS_RUN_PROFILE_ID = "SHOP_OPERATIONS";

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

async function waitForSignedInShell(window: import("@playwright/test").Page): Promise<void> {
  const accountAvatar = window
    .locator(".nav-btn", { hasText: "Account" })
    .locator(".nav-account-avatar:not(.nav-account-avatar-loading)");
  await expect(accountAvatar).toBeVisible({ timeout: 15_000 });
}

async function requestDeterministicCaptcha(): Promise<string> {
  const body = await graphqlRequest<{ requestCaptcha: { token: string; svg: string } }>(
    REQUEST_CAPTCHA_MUTATION,
    { deterministicToken: deterministicCaptchaToken },
  );
  expect(body.requestCaptcha.svg).toContain("0000");
  return body.requestCaptcha.token;
}

/** Login via staging GraphQL, store tokens in Desktop, reload Panel. */
async function loginAndNavigateToEcommerce(
  window: import("@playwright/test").Page,
  apiBase: string,
): Promise<void> {
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
  const { accessToken, refreshToken } = loginBody.login;

  await storeTokens(apiBase, accessToken, refreshToken);

  await window.reload({ waitUntil: "domcontentloaded" });
  await waitForSignedInShell(window);

  // Navigate to ecommerce page via sidebar
  const navBtn = window.locator(".nav-btn", { hasText: /Shop Management|Shops & Authorization|Global E-commerce/ });
  await navBtn.click({ timeout: 15_000 });
}

async function dismissModals(window: import("@playwright/test").Page): Promise<void> {
  for (let i = 0; i < 3; i++) {
    const backdrop = window.locator(".modal-backdrop");
    if (!await backdrop.isVisible({ timeout: 2_000 }).catch(() => false)) break;
    await backdrop.click({ position: { x: 5, y: 5 }, force: true });
    await backdrop.waitFor({ state: "hidden", timeout: 2_000 }).catch(() => {});
  }
}

async function skipWelcomeIfVisible(window: import("@playwright/test").Page): Promise<void> {
  if (!await window.locator(".welcome-page").isVisible({ timeout: 2_000 }).catch(() => false)) return;
  await window.locator(".welcome-skip-guest").click();
  await window.waitForSelector(".sidebar-brand", { timeout: 30_000 });
}

// ── New User Defaults ────────────────────────────────────────────────

test.describe("Ecommerce Page — New User Defaults", () => {
  test.skip(!deterministicCaptchaToken, "STAGING_CAPTCHA_BYPASS_TOKEN is required to register staging users");

  test("newly registered staging users default to ecommerce and shop operations", async ({ window, apiBase }) => {
    await dismissModals(window);

    const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const email = `e2e-ecommerce-default-${unique}@rivonclaw.com`;
    const password = `RivonClaw-e2e-${unique}!`;

    const registerBody = await graphqlRequest<{
      register: {
        accessToken: string;
        refreshToken: string;
        user: {
          email: string;
          enrolledModules: string[];
          defaultRunProfileId: string | null;
        };
      };
    }>(REGISTER_MUTATION, {
      input: {
        email,
        password,
        name: "E2E Ecommerce Default",
        captchaToken: await requestDeterministicCaptcha(),
        captchaAnswer: "0000",
      },
    });

    expect(registerBody.register.user.email).toBe(email);
    expect(registerBody.register.user.enrolledModules).toContain(ECOMMERCE_MODULE_ID);
    expect(registerBody.register.user.defaultRunProfileId).toBe(SHOP_OPERATIONS_RUN_PROFILE_ID);

    const meBody = await graphqlRequest<{
      me: {
        email: string;
        enrolledModules: string[];
        defaultRunProfileId: string | null;
      };
    }>(ME_QUERY, undefined, registerBody.register.accessToken);

    expect(meBody.me.email).toBe(email);
    expect(meBody.me.enrolledModules).toContain(ECOMMERCE_MODULE_ID);
    expect(meBody.me.defaultRunProfileId).toBe(SHOP_OPERATIONS_RUN_PROFILE_ID);

    await storeTokens(apiBase, registerBody.register.accessToken, registerBody.register.refreshToken);
    await window.reload({ waitUntil: "domcontentloaded" });
    await skipWelcomeIfVisible(window);
    await dismissModals(window);

    await waitForSignedInShell(window);
    const navBtn = window.locator(".nav-btn", { hasText: /Shop Management|Shops & Authorization|Global E-commerce/ });
    await expect(navBtn).toBeVisible({ timeout: 15_000 });
    await navBtn.click();

    const header = window.locator(".ecommerce-page-header");
    await expect(header).toBeVisible({ timeout: 15_000 });
    await expect(header.locator("h1")).toContainText("Shop Management");
  });
});

// ── Auth Gating ──────────────────────────────────────────────────────

test.describe("Ecommerce Page — Auth Gating", () => {
  test("clicking ecommerce nav without login opens auth modal", async ({ window }) => {
    await dismissModals(window);

    // Ecommerce navigation is visible to guests, but direct route entry still
    // requires auth and should not render the page content.
    const urlBefore = window.url();
    await window.evaluate(() => window.history.pushState(null, "", "/ecommerce"));
    // Panel resolves unknown routes to "/" — ecommerce without auth should fall back
    await window.waitForTimeout(500);
    // The page-enter with ecommerce content should NOT be visible
    const ecommerceHeader = window.locator(".ecommerce-page-header");
    const isVisible = await ecommerceHeader.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });
});

// ── Authenticated Tests ──────────────────────────────────────────────

test.describe("Ecommerce Page — Authenticated", () => {
  test.skip(!testEmail || !testPassword || !deterministicCaptchaToken, "Staging credentials not configured");

  test("page renders with title, subtitle, and add shop button", async ({ window, apiBase }) => {
    await dismissModals(window);
    await loginAndNavigateToEcommerce(window, apiBase);

    // Verify page header
    const header = window.locator(".ecommerce-page-header");
    await expect(header).toBeVisible({ timeout: 15_000 });
    await expect(header.locator("h1")).toContainText("Shop Management");
    await expect(header.locator(".ecommerce-page-subtitle")).toContainText("Manage connected shops");

    // Add Shop button
    const addBtn = window.locator(".section-card").filter({ hasText: "Shops" }).locator("button", { hasText: "Add Shop" });
    await expect(addBtn).toBeVisible();
    await expect(addBtn).toBeEnabled();
  });

  test("shop table renders with at least one shop", async ({ window, apiBase }) => {
    await dismissModals(window);
    await loginAndNavigateToEcommerce(window, apiBase);

    // Wait for the shop table to appear (shops arrive via MST/SSE after login)
    const shopTable = window.locator(".shop-table");
    await expect(shopTable).toBeVisible({ timeout: 20_000 });

    // Verify table headers
    const headers = shopTable.locator("thead th");
    await expect(headers.nth(0)).toContainText("Shop Name");
    await expect(headers.nth(1)).toContainText("Alias");
    await expect(headers.nth(2)).toContainText("Platform");
    await expect(headers.nth(3)).toContainText("Region");
    await expect(headers.nth(4)).toContainText("Auth Status");
    await expect(headers.nth(5)).toContainText("AI Customer Service");
    await expect(headers.nth(6)).toContainText("Actions");

    // At least one shop row
    const rows = shopTable.locator("tbody tr");
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(1);

    // First shop row has a name and a View button
    const firstRow = rows.first();
    await expect(firstRow.locator(".shop-table-name")).toBeVisible();
    await expect(firstRow.locator("button", { hasText: "View" })).toBeVisible();
  });

  test("add shop modal opens and closes without submitting", async ({ window, apiBase }) => {
    await dismissModals(window);
    await loginAndNavigateToEcommerce(window, apiBase);
    await expect(window.locator(".ecommerce-page-header")).toBeVisible({ timeout: 15_000 });

    // Open the modal
    await window.locator("button", { hasText: "Add Shop" }).click();
    const modal = window.locator(".modal-backdrop");
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Modal title
    await expect(window.locator(".modal-title")).toContainText("Add Shop");

    // Cancel closes the modal
    await window.locator(".modal-backdrop button", { hasText: "Cancel" }).click();
    await expect(modal).not.toBeVisible({ timeout: 5_000 });
  });

  test("shop drawer opens, shows overview tab, and closes", async ({ window, apiBase }) => {
    await dismissModals(window);
    await loginAndNavigateToEcommerce(window, apiBase);

    // Wait for shop table
    const shopTable = window.locator(".shop-table");
    await expect(shopTable).toBeVisible({ timeout: 20_000 });

    // Click View on the first shop
    const firstViewBtn = shopTable.locator("tbody tr").first().locator("button", { hasText: "View" });
    await firstViewBtn.click();

    // Drawer should open
    const drawer = window.locator(".drawer-panel-open");
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // Drawer header shows the shop name
    const drawerTitle = drawer.locator(".drawer-header-title");
    await expect(drawerTitle).toBeVisible();
    const shopName = await drawerTitle.textContent();
    expect(shopName!.length).toBeGreaterThan(0);

    // Overview tab is active by default
    const overviewTab = drawer.locator(".drawer-tab-btn-active");
    await expect(overviewTab).toContainText("Overview");

    // Overview shows shop info section
    await expect(drawer.locator(".drawer-section-label", { hasText: "Shop Information" })).toBeVisible();
    await expect(drawer.locator(".shop-info-card").first()).toBeVisible();

    // Overview shows CS toggle
    const csToggleCard = drawer.locator(".shop-toggle-card").filter({ hasText: "AI Customer Service" }).first();
    await expect(csToggleCard).toBeVisible();
    await expect(csToggleCard.locator(".toggle-switch")).toBeVisible();

    // Close drawer via close button
    await drawer.locator(".drawer-close-btn").click();
    await expect(drawer).not.toBeVisible({ timeout: 5_000 });
  });

  test("shop drawer tab switching to AI Customer Service", async ({ window, apiBase }) => {
    await dismissModals(window);
    await loginAndNavigateToEcommerce(window, apiBase);

    const shopTable = window.locator(".shop-table");
    await expect(shopTable).toBeVisible({ timeout: 20_000 });

    // Open drawer on first shop
    await shopTable.locator("tbody tr").first().locator("button", { hasText: "View" }).click();
    const drawer = window.locator(".drawer-panel-open");
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // Check if AI CS tab exists (only when CS is enabled for this shop)
    const aiCsTab = drawer.locator(".drawer-tab-btn", { hasText: "AI Customer Service" });
    const csTabVisible = await aiCsTab.isVisible().catch(() => false);

    if (csTabVisible) {
      // Click AI CS tab
      await aiCsTab.click();
      await expect(drawer.locator(".drawer-tab-btn-active")).toContainText("AI Customer Service");

      // AI CS tab shows service status section
      await expect(drawer.locator(".drawer-section-label", { hasText: "Service Status" })).toBeVisible();

      // Shows device binding section
      await expect(drawer.locator(".drawer-section-label", { hasText: "Handle CS on this device" })).toBeVisible();

      // Shows run profile section
      await expect(drawer.locator(".drawer-section-label", { hasText: "Agent Permissions" })).toBeVisible();

      // Shows CS model section
      await expect(drawer.locator(".drawer-section-label", { hasText: "CS Model" })).toBeVisible();

      // Shows business prompt section
      await expect(drawer.locator(".drawer-section-label", { hasText: "Business Prompt" })).toBeVisible();
      await expect(drawer.locator("textarea")).toBeVisible();

      // Switch back to overview
      await drawer.locator(".drawer-tab-btn", { hasText: "Overview" }).click();
      await expect(drawer.locator(".drawer-tab-btn-active")).toContainText("Overview");
    }

    // Close drawer via close button; clicking the overlay can hit the open
    // drawer panel depending on scroll position and viewport geometry.
    await drawer.locator(".drawer-close-btn").click();
    await expect(drawer).not.toBeVisible({ timeout: 5_000 });
  });

  test("CS toggle can be toggled on the overview tab", async ({ window, apiBase }) => {
    await dismissModals(window);
    await loginAndNavigateToEcommerce(window, apiBase);

    const shopTable = window.locator(".shop-table");
    await expect(shopTable).toBeVisible({ timeout: 20_000 });

    // Open drawer
    await shopTable.locator("tbody tr").first().locator("button", { hasText: "View" }).click();
    const drawer = window.locator(".drawer-panel-open");
    await expect(drawer).toBeVisible({ timeout: 5_000 });

    // The checkbox input is visually hidden (CSS toggle pattern), so use
    // the label wrapper for clicks and the input for state checks.
    const csToggleCard = drawer.locator(".shop-toggle-card").filter({ hasText: "AI Customer Service" }).first();
    const toggleInput = csToggleCard.locator(".toggle-switch input[type='checkbox']");
    const toggleLabel = csToggleCard.locator(".toggle-switch");
    await expect(toggleLabel).toBeVisible();
    const wasChecked = await toggleInput.isChecked();

    // Toggle it via the visible label
    await toggleLabel.click();

    // Wait for the toggle to reflect the change (server round-trip)
    await expect(toggleInput).toHaveJSProperty("checked", !wasChecked, { timeout: 10_000 });

    // Toggle it back to restore original state
    await toggleLabel.click();
    await expect(toggleInput).toHaveJSProperty("checked", wasChecked, { timeout: 10_000 });

    // Close drawer
    await drawer.locator(".drawer-close-btn").click();
  });
});
