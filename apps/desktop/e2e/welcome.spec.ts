import { freshTest as test, expect } from "./electron-fixture.js";

const testEmail = process.env.STAGING_TEST_USERNAME;
const testPassword = process.env.STAGING_TEST_PASSWORD;
const captchaToken = process.env.STAGING_CAPTCHA_BYPASS_TOKEN;

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

  test("fresh user can login through deterministic captcha UI", async ({ window }) => {
    test.skip(!testEmail || !testPassword || !captchaToken, "Staging credentials and captcha token are required");

    await expect(window.locator(".welcome-page")).toBeVisible();
    await window.locator(".welcome-choice-button", { hasText: /Existing user login/i }).click();

    const modal = window.locator(".modal-backdrop .modal-content").first();
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await expect(modal.locator(".captcha-svg")).toContainText("0000", { timeout: 10_000 });

    await modal.locator('input[type="email"]').fill(testEmail!);
    await modal.locator('input[type="password"]').fill(testPassword!);
    await modal.locator(".captcha-row-input input").fill("0000");
    await modal.locator("button[type='submit']").click();

    await expect(window.locator(".user-avatar-circle")).toBeVisible({ timeout: 30_000 });
  });
});
