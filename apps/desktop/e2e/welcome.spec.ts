import { freshTest as test, expect } from "./electron-fixture.js";

test.describe("RivonClaw Welcome Flow", () => {
  test("fresh user sees account entry actions", async ({ window }) => {
    await expect(window.locator(".welcome-page")).toBeVisible();
    await expect(window.locator(".welcome-card")).toBeVisible();

    await expect(window.locator("h1", { hasText: /seller account/i })).toBeVisible();
    await expect(window.locator(".welcome-choice-button", { hasText: /New user registration/i })).toBeVisible();
    await expect(window.locator(".welcome-choice-button", { hasText: /Existing user login/i })).toBeVisible();
  });

  test("fresh user can open register and login auth flows", async ({ window }) => {
    await expect(window.locator(".welcome-page")).toBeVisible();

    await window.locator(".welcome-choice-button", { hasText: /New user registration/i }).click();
    await expect(window.locator(".modal-title")).toContainText(/Create Account/i);
    await expect(window.locator(".auth-tab-pill")).not.toBeVisible();
    await expect(window.locator(".auth-inline-switch")).toContainText(/Login/i);

    await window.locator(".modal-close-btn").click();
    await expect(window.locator(".modal-backdrop")).not.toBeVisible({ timeout: 5_000 });

    await window.locator(".welcome-choice-button", { hasText: /Existing user login/i }).click();
    await expect(window.locator(".modal-title")).toContainText(/Sign In/i);
    await expect(window.locator(".auth-tab-pill")).not.toBeVisible();
    await expect(window.locator(".auth-inline-switch")).toContainText(/Register/i);
  });

  test("fresh user can continue as guest", async ({ window }) => {
    await expect(window.locator(".welcome-page")).toBeVisible();

    await window.locator(".welcome-skip-guest").click();

    await expect(window.locator(".sidebar-brand")).toBeVisible({ timeout: 30_000 });
  });
});
