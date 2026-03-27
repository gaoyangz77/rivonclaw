import { test, expect } from "./electron-fixture.js";

// ---------------------------------------------------------------------------
// Helper: send a GraphQL request to the cloud proxy endpoint
// ---------------------------------------------------------------------------

async function cloudGraphql(
  apiBase: string,
  query: string,
  variables?: Record<string, unknown>,
) {
  return fetch(`${apiBase}/api/cloud/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
}

// ---------------------------------------------------------------------------
// Suite 1: Auth Gating (UI)
// ---------------------------------------------------------------------------

test.describe("Browser Profiles — Auth Gating", () => {
  test("clicking Browsers nav opens auth modal instead of navigating", async ({ window }) => {
    // Dismiss any modal(s) blocking the UI before interacting
    for (let i = 0; i < 3; i++) {
      const backdrop = window.locator(".modal-backdrop");
      if (!await backdrop.isVisible({ timeout: 3_000 }).catch(() => false)) break;
      await backdrop.click({ position: { x: 5, y: 5 }, force: true });
      await backdrop.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
    }

    // Record current URL before clicking
    const urlBefore = window.url();

    // Click the Browsers nav button
    const navBtn = window.locator(".nav-btn", { hasText: "Multi Browser" });
    await navBtn.click({ timeout: 15_000 });

    // Auth modal should appear (contains login/register form)
    const authForm = window.locator(".auth-modal-form");
    await expect(authForm).toBeVisible({ timeout: 10_000 });

    // The modal should contain login and register tab buttons
    const loginTab = authForm.locator("button", { hasText: "Login" });
    await expect(loginTab).toBeVisible();
    const registerTab = authForm.locator("button", { hasText: "Register" });
    await expect(registerTab).toBeVisible();

    // URL should NOT have changed to /browser-profiles
    const urlAfter = window.url();
    expect(urlAfter).toBe(urlBefore);

    // The main browser profiles page content should NOT be visible
    const createBtn = window.locator('button:has-text("Create"), button:has-text("New Profile")');
    await expect(createBtn).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Suite 2: Cloud Proxy — Unauthenticated
// ---------------------------------------------------------------------------

test.describe("Browser Profiles — Cloud Proxy Unauthenticated", () => {
  test("browserProfiles query is forwarded to Cloud and returns errors", async ({ window: _window, apiBase }) => {
    const res = await cloudGraphql(apiBase, `query { browserProfiles { id name } }`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.errors).toBeDefined();
    expect(body.errors.length).toBeGreaterThan(0);
  });

  test("createBrowserProfile mutation is forwarded to Cloud and returns errors", async ({ window: _window, apiBase }) => {
    const res = await cloudGraphql(
      apiBase,
      `mutation ($input: CreateBrowserProfileInput!) { createBrowserProfile(input: $input) { id name status } }`,
      { input: { name: "Test Profile" } },
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.errors).toBeDefined();
    expect(body.errors.length).toBeGreaterThan(0);
  });

  test("request without query body returns 200 with errors", async ({ window: _window, apiBase }) => {
    const res = await fetch(`${apiBase}/api/cloud/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.errors).toBeDefined();
    expect(body.errors[0].message).toBe("Missing query");
  });
});

// ---------------------------------------------------------------------------
// Suite 3: Local REST — Data Cleanup
// ---------------------------------------------------------------------------

test.describe("Browser Profiles — Local Data Cleanup", () => {
  test("DELETE /api/browser-profiles/:id/data returns ok for non-existent profile", async ({ window: _window, apiBase }) => {
    const res = await fetch(`${apiBase}/api/browser-profiles/some-id/data`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("DELETE /api/browser-profiles/:id/data is idempotent", async ({ window: _window, apiBase }) => {
    const profileId = "another-id";

    // First delete
    const res1 = await fetch(`${apiBase}/api/browser-profiles/${profileId}/data`, {
      method: "DELETE",
    });
    expect(res1.status).toBe(200);
    expect((await res1.json()).ok).toBe(true);

    // Second delete of the same id should also succeed
    const res2 = await fetch(`${apiBase}/api/browser-profiles/${profileId}/data`, {
      method: "DELETE",
    });
    expect(res2.status).toBe(200);
    expect((await res2.json()).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite 4: Cloud Proxy — Input Validation (missing query caught before forwarding)
// ---------------------------------------------------------------------------

test.describe("Browser Profiles — Cloud Proxy Input Validation", () => {
  test("empty body returns 200 with missing query error", async ({ window: _window, apiBase }) => {
    const res = await fetch(`${apiBase}/api/cloud/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.errors[0].message).toBe("Missing query");
  });

  test("empty query string returns 200 with missing query error", async ({ window: _window, apiBase }) => {
    const res = await fetch(`${apiBase}/api/cloud/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "" }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.errors[0].message).toBe("Missing query");
  });
});
