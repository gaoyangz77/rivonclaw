import { test, expect } from "./electron-fixture.js";

async function navigateToModels(window: import("@playwright/test").Page) {
  const connectionsGroup = window.locator(".nav-group-toggle", { hasText: "Connections & Models" });
  if (await connectionsGroup.isVisible().catch(() => false)) {
    const expanded = await connectionsGroup.getAttribute("aria-expanded");
    if (expanded !== "true") {
      await connectionsGroup.click();
    }
  }

  const providersBtn = window.locator(".nav-btn", { hasText: "Models" });
  await providersBtn.click();
  await expect(providersBtn).toHaveClass(/nav-active/);
}

test.describe("LLM Providers", () => {
  test("dropdowns and pricing tables", async ({ window }) => {
    // Dismiss any modal(s) blocking the UI (e.g. "What's New", telemetry consent).
    // Prod builds may show modals that dev builds skip. Try up to 3 times.
    for (let i = 0; i < 3; i++) {
      const backdrop = window.locator(".modal-backdrop");
      if (!await backdrop.isVisible({ timeout: 3_000 }).catch(() => false)) break;
      // Click the top-left corner of the backdrop (outside modal-content) to trigger onClose
      await backdrop.click({ position: { x: 5, y: 5 }, force: true });
      await backdrop.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
    }

    // Navigate to Models page
    await navigateToModels(window);

    // -- Subscription tab (default) --
    const subTab = window.locator(".tab-btn", { hasText: /Subscription/i });
    await expect(subTab).toHaveClass(/tab-btn-active/);

    // Subscription dropdown: subscription plans (claude, gemini, zhipu-coding,
    // moonshot-coding, minimax-coding, volcengine-coding, qwen-coding,
    // modelscope, nvidia-nim). ProviderSelect filters by model catalog.
    await window.locator(".provider-select-trigger").click();
    const subOptions = window.locator(".provider-select-option");
    const subCount = await subOptions.count();
    expect(subCount).toBeGreaterThanOrEqual(5);
    expect(subCount).toBeLessThanOrEqual(12);
    // Close dropdown
    await window.locator(".provider-select-trigger").click();

    // Subscription pricing card should be visible (content depends on server availability)
    const subPricing = window.locator(".pricing-card");
    await expect(subPricing).toBeVisible();
    // Either pricing data loaded (table/plan blocks) or "unavailable" message is shown
    const subPricingLoaded = subPricing.locator(".pricing-plan-block, .pricing-inner-table, .pricing-status-compact");
    await expect(subPricingLoaded.first()).toBeVisible({ timeout: 10_000 });

    // -- Switch to API Key tab --
    const apiTab = window.locator(".tab-btn", { hasText: /API/i });
    await apiTab.click();
    await expect(apiTab).toHaveClass(/tab-btn-active/);

    // API Key dropdown: 17 root providers minus subscription, filtered by catalog.
    // At least 10 should always be present.
    await window.locator(".provider-select-trigger").click();
    const apiOptions = window.locator(".provider-select-option");
    const apiCount = await apiOptions.count();
    expect(apiCount).toBeGreaterThanOrEqual(10);
    expect(apiCount).toBeLessThanOrEqual(20);
    // Close dropdown
    await window.locator(".provider-select-trigger").click();

    // API pricing card should be visible (content depends on server availability)
    const apiPricing = window.locator(".pricing-card");
    await expect(apiPricing).toBeVisible();
    const apiPricingLoaded = apiPricing.locator(".pricing-inner-table, .pricing-status-compact");
    await expect(apiPricingLoaded.first()).toBeVisible({ timeout: 10_000 });
  });

  test("Gemini OAuth (subscription) has enough models", async ({ window }) => {
    // Dismiss modals
    for (let i = 0; i < 3; i++) {
      const backdrop = window.locator(".modal-backdrop");
      if (!await backdrop.isVisible({ timeout: 3_000 }).catch(() => false)) break;
      await backdrop.click({ position: { x: 5, y: 5 }, force: true });
      await backdrop.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
    }

    // Navigate to Models page
    await navigateToModels(window);

    // Subscription tab is the default, and Gemini (OAuth) is the default provider
    // (highest priority in EN_PRIORITY_PROVIDERS). No need to re-select.
    const subTab = window.locator(".tab-btn", { hasText: /Subscription/i });
    await expect(subTab).toHaveClass(/tab-btn-active/);

    // Verify Gemini (OAuth) is the selected provider
    const form = window.locator(".page-two-col");
    await expect(form.locator(".provider-select-trigger")).toContainText(/Gemini.*OAuth/i);

    // Open the model dropdown and count options.
    // Gemini OAuth uses catalogProvider: "google-gemini-cli" which has fewer models
    // than the full Google catalog (Cloud Code Assist models only).
    const modelTrigger = form.locator(".custom-select-trigger");
    await expect(modelTrigger).toBeVisible({ timeout: 10_000 });
    await modelTrigger.click();
    const modelOptions = window.locator(".custom-select-option");
    await expect(modelOptions.first()).toBeVisible({ timeout: 10_000 });

    const count = await modelOptions.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test("Google Gemini (API key) has enough models", async ({ window }) => {
    // Dismiss modals
    for (let i = 0; i < 3; i++) {
      const backdrop = window.locator(".modal-backdrop");
      if (!await backdrop.isVisible({ timeout: 3_000 }).catch(() => false)) break;
      await backdrop.click({ position: { x: 5, y: 5 }, force: true });
      await backdrop.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
    }

    // Navigate to Models page
    await navigateToModels(window);

    // Switch to API Key tab
    const apiTab = window.locator(".tab-btn", { hasText: /API/i });
    await apiTab.click();
    await expect(apiTab).toHaveClass(/tab-btn-active/);

    // Select "Google (Gemini)" from the provider dropdown
    const form = window.locator(".page-two-col");
    await form.locator(".provider-select-trigger").click();
    await form.locator(".provider-select-option", { hasText: /Google \(Gemini\)/i }).click();

    // Open the model dropdown and count options.
    // The full Google catalog has 20+ models from the vendor registry.
    const modelTrigger = form.locator(".custom-select-trigger");
    await expect(modelTrigger).toBeVisible({ timeout: 10_000 });
    await modelTrigger.click();
    const modelOptions = window.locator(".custom-select-option");
    await expect(modelOptions.first()).toBeVisible({ timeout: 10_000 });

    const count = await modelOptions.count();
    expect(count).toBeGreaterThanOrEqual(10);
  });
});
