import { test, expect } from "./electron-fixture.js";

test.describe("Custom Providers", () => {
  test("add custom provider via UI form", async ({ window }) => {
    const zhipuKey = process.env.E2E_ZHIPU_API_KEY;
    test.skip(!zhipuKey, "E2E_ZHIPU_API_KEY required");

    // Dismiss any modal(s) blocking the UI
    for (let i = 0; i < 3; i++) {
      const backdrop = window.locator(".modal-backdrop");
      if (!await backdrop.isVisible({ timeout: 3_000 }).catch(() => false)) break;
      await backdrop.click({ position: { x: 5, y: 5 }, force: true });
      await backdrop.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
    }

    // Navigate to Models page
    const providersBtn = window.locator(".nav-btn", { hasText: "Models" });
    await providersBtn.click();
    await expect(providersBtn).toHaveClass(/nav-active/);

    // No pre-seeded keys — start from zero
    const keyCards = window.locator(".key-card");
    await expect(keyCards).toHaveCount(0);

    // -- Switch to Custom tab --
    const form = window.locator(".page-two-col");
    const customTab = form.locator(".tab-btn", { hasText: /Custom/i });
    await customTab.click();
    await expect(customTab).toHaveClass(/tab-btn-active/);

    // Info box should be visible on the right side
    const infoBox = form.locator(".provider-info-card");
    await expect(infoBox).toBeVisible();

    // -- Fill in the custom provider form --
    // Name
    const nameInput = form.locator("input[type='text']").first();
    await nameInput.fill("Zhipu Custom");

    // Protocol: OpenAI Compatible (default, verify label shown)
    const protocolTrigger = form.locator(".custom-select-trigger").first();
    await expect(protocolTrigger).toContainText(/OpenAI/i);

    // Endpoint URL
    const endpointInput = form.locator("input[type='text']").nth(1);
    await endpointInput.fill("https://open.bigmodel.cn/api/paas/v4");

    // API Key
    const apiKeyInput = form.locator("input[type='password']");
    await apiKeyInput.fill(zhipuKey!);

    // Models — add via tag input (type model name + Enter)
    const tagInput = form.locator(".tag-input-field");
    await tagInput.fill("glm-4-flash");
    await tagInput.press("Enter");
    // Verify tag pill appeared
    await expect(form.locator(".tag-pill")).toHaveCount(1);
    await expect(form.locator(".tag-pill").first()).toContainText("glm-4-flash");

    // Add a second model
    await tagInput.fill("glm-4.7-flash");
    await tagInput.press("Enter");
    await expect(form.locator(".tag-pill")).toHaveCount(2);

    // -- Save --
    const saveBtn = form.locator(".form-actions .btn.btn-primary");
    const errorAlert = form.locator(".error-alert");

    for (let attempt = 0; attempt < 3; attempt++) {
      await saveBtn.click();
      // Wait for either success (1 key card) or error
      const result = await Promise.race([
        keyCards.first().waitFor({ state: "visible", timeout: 30_000 }).then(() => "ok" as const),
        errorAlert.waitFor({ state: "visible", timeout: 30_000 }).then(() => "error" as const),
      ]).catch(() => "timeout" as const);
      if (result === "ok") break;
      // Validation timed out or failed transiently — retry
      if (attempt < 2) {
        await apiKeyInput.fill(zhipuKey!);
      }
    }

    // Verify the custom key card appeared
    await expect(keyCards).toHaveCount(1, { timeout: 10_000 });

    // -- Verify the custom provider key card --
    const customCard = window.locator(".key-card", { hasText: /Zhipu Custom/i });
    await expect(customCard).toBeVisible();

    // Should show "Custom" badge
    const customBadge = customCard.locator(".badge-muted", { hasText: /Custom/i });
    await expect(customBadge).toBeVisible();

    // Should show the base URL
    await expect(customCard).toContainText("https://open.bigmodel.cn/api/paas/v4");

    // Should have a model dropdown with our custom models
    const modelSelect = customCard.locator("select.input-mono");
    await expect(modelSelect).toBeVisible();
    // First model should be selected by default
    await expect(modelSelect).toHaveValue("glm-4-flash");

    // Verify the model dropdown has both models
    const options = modelSelect.locator("option");
    await expect(options).toHaveCount(2);
    await expect(options.nth(0)).toHaveText("glm-4-flash");
    await expect(options.nth(1)).toHaveText("glm-4.7-flash");
  });

  test("activate and delete custom provider", async ({ window, apiBase }) => {
    const zhipuKey = process.env.E2E_ZHIPU_API_KEY;
    test.skip(!zhipuKey, "E2E_ZHIPU_API_KEY required");

    // Dismiss modals
    for (let i = 0; i < 3; i++) {
      const backdrop = window.locator(".modal-backdrop");
      if (!await backdrop.isVisible({ timeout: 3_000 }).catch(() => false)) break;
      await backdrop.click({ position: { x: 5, y: 5 }, force: true });
      await backdrop.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
    }

    // -- Seed two custom providers via API BEFORE navigating to Models page --
    // This ensures the ProvidersPage will fetch both keys on initial mount.
    const baseRes = await fetch(`${apiBase}/api/provider-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "custom-e2ebase",
        label: "E2E Base Provider",
        model: "glm-4-flash",
        apiKey: zhipuKey,
        authType: "custom",
        baseUrl: "https://open.bigmodel.cn/api/paas/v4",
        customProtocol: "openai",
        customModelsJson: JSON.stringify(["glm-4-flash"]),
      }),
    });
    expect(baseRes.ok).toBe(true);

    // Activate the base provider
    const activateRes = await fetch(`${apiBase}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "llm-provider": "custom-e2ebase" }),
    });
    expect(activateRes.ok).toBe(true);

    const createRes = await fetch(`${apiBase}/api/provider-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "custom-e2etest1",
        label: "E2E Custom Provider",
        model: "glm-4-flash",
        apiKey: zhipuKey,
        authType: "custom",
        baseUrl: "https://open.bigmodel.cn/api/paas/v4",
        customProtocol: "openai",
        customModelsJson: JSON.stringify(["glm-4-flash", "glm-4.7-flash"]),
      }),
    });
    expect(createRes.ok).toBe(true);

    // Navigate to Models page — data fetches on mount will include both keys
    const providersBtn = window.locator(".nav-btn", { hasText: "Models" });
    await providersBtn.click();
    await expect(providersBtn).toHaveClass(/nav-active/);

    // Switch to Custom tab where custom provider key cards are displayed
    const form = window.locator(".page-two-col");
    const customTab = form.locator(".tab-btn", { hasText: /Custom/i });
    await customTab.click();
    await expect(customTab).toHaveClass(/tab-btn-active/);

    // Wait for key cards to load
    const keyCards = window.locator(".key-card");
    await expect(keyCards).toHaveCount(2, { timeout: 15_000 });

    const baseCard = window.locator(".key-card", { hasText: /E2E Base Provider/i });
    const customCard = window.locator(".key-card", { hasText: /E2E Custom Provider/i });
    await expect(baseCard).toBeVisible();
    await expect(customCard).toBeVisible();

    // Base should be active, custom should be inactive
    await expect(baseCard).toHaveClass(/key-card-active/);
    await expect(customCard).toHaveClass(/key-card-inactive/);

    // -- Activate the custom provider --
    await customCard.locator(".btn", { hasText: /Activate/i }).click();

    // Verify custom provider is now active
    await expect(customCard).toHaveClass(/key-card-active/, { timeout: 10_000 });
    await expect(baseCard).toHaveClass(/key-card-inactive/);
    await expect(customCard.locator(".badge-active")).toBeVisible();

    // -- Switch model within the custom provider --
    const modelSelect = customCard.locator("select.input-mono");
    await expect(modelSelect).toHaveValue("glm-4-flash");
    await modelSelect.selectOption("glm-4.7-flash");
    await expect(modelSelect).toHaveValue("glm-4.7-flash");

    // -- Delete the custom provider --
    await customCard.locator(".btn", { hasText: /Remove/i }).click();

    // Should only have 1 key card left (base)
    await expect(keyCards).toHaveCount(1, { timeout: 10_000 });
    // Base should auto-activate after custom was deleted
    await expect(baseCard).toHaveClass(/key-card-active/);
  });
});
