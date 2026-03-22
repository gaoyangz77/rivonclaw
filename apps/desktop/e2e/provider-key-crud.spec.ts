import { test, expect } from "./electron-fixture.js";

/**
 * Provider Key CRUD — UI rendering tests.
 *
 * Seeds data via the REST API, then verifies the Panel UI reflects
 * changes correctly (store → UI reactivity).
 *
 * Requires E2E_ZHIPU_API_KEY in the environment.
 */

async function dismissModals(window: import("@playwright/test").Page) {
  for (let i = 0; i < 3; i++) {
    const backdrop = window.locator(".modal-backdrop");
    if (!await backdrop.isVisible({ timeout: 3_000 }).catch(() => false)) break;
    await backdrop.click({ position: { x: 5, y: 5 }, force: true });
    await backdrop.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
  }
}

async function navigateToModels(window: import("@playwright/test").Page) {
  const btn = window.locator(".nav-btn", { hasText: "Models" });
  await btn.click();
  await expect(btn).toHaveClass(/nav-active/);
  // After seeding via API, the store cache is stale. Reload the page to trigger initSession → fetchProviderKeys.
  await window.reload();
  await btn.click();
  await expect(btn).toHaveClass(/nav-active/);
}

async function seedKey(apiBase: string, opts: {
  provider: string; label: string; models: string[]; apiKey: string;
}) {
  const res = await fetch(`${apiBase}/api/provider-keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: opts.provider,
      label: opts.label,
      model: opts.models[0],
      apiKey: opts.apiKey,
      authType: "custom",
      baseUrl: "https://open.bigmodel.cn/api/paas/v4",
      customProtocol: "openai",
      customModelsJson: JSON.stringify(opts.models),
    }),
  });
  expect(res.ok).toBe(true);
  return res.json() as Promise<{ id: string }>;
}

async function deleteKey(apiBase: string, id: string) {
  await fetch(`${apiBase}/api/provider-keys/${id}`, { method: "DELETE" });
}

test.describe("Provider Key CRUD — UI rendering", () => {

  test("create via API → key card appears on page load", async ({ window, apiBase }) => {
    const zhipuKey = process.env.E2E_ZHIPU_API_KEY;
    test.skip(!zhipuKey, "E2E_ZHIPU_API_KEY required");

    await dismissModals(window);

    const entry = await seedKey(apiBase, {
      provider: "custom-crud-create",
      label: "CRUD Create Test",
      models: ["glm-4-flash"],
      apiKey: zhipuKey!,
    });

    try {
      await navigateToModels(window);

      const card = window.locator(".key-card", { hasText: /CRUD Create Test/i });
      await expect(card).toBeVisible({ timeout: 15_000 });
      await expect(card.locator(".custom-select-trigger")).toContainText("glm-4-flash");
    } finally {
      await deleteKey(apiBase, entry.id);
    }
  });

  test("activate key → Active badge swaps", async ({ window, apiBase }) => {
    const zhipuKey = process.env.E2E_ZHIPU_API_KEY;
    test.skip(!zhipuKey, "E2E_ZHIPU_API_KEY required");

    await dismissModals(window);

    const key1 = await seedKey(apiBase, {
      provider: "custom-crud-act1",
      label: "CRUD Activate A",
      models: ["glm-4-flash"],
      apiKey: zhipuKey!,
    });
    const key2 = await seedKey(apiBase, {
      provider: "custom-crud-act2",
      label: "CRUD Activate B",
      models: ["glm-4-flash"],
      apiKey: zhipuKey!,
    });

    try {
      await navigateToModels(window);

      const cardA = window.locator(".key-card", { hasText: /CRUD Activate A/i });
      const cardB = window.locator(".key-card", { hasText: /CRUD Activate B/i });
      await expect(cardA).toBeVisible({ timeout: 15_000 });
      await expect(cardB).toBeVisible({ timeout: 15_000 });

      // Click Activate on card B
      await cardB.locator(".btn", { hasText: /Activate/i }).click();

      // B should become active
      await expect(cardB.locator(".badge-active")).toBeVisible({ timeout: 10_000 });
      // A should no longer be active
      await expect(cardA.locator(".badge-active")).toHaveCount(0);
    } finally {
      await deleteKey(apiBase, key1.id);
      await deleteKey(apiBase, key2.id);
    }
  });

  test("switch model → dropdown updates", async ({ window, apiBase }) => {
    const zhipuKey = process.env.E2E_ZHIPU_API_KEY;
    test.skip(!zhipuKey, "E2E_ZHIPU_API_KEY required");

    await dismissModals(window);

    const entry = await seedKey(apiBase, {
      provider: "custom-crud-model",
      label: "CRUD Model Switch",
      models: ["glm-4-flash", "glm-4.7-flash"],
      apiKey: zhipuKey!,
    });

    try {
      await navigateToModels(window);

      const card = window.locator(".key-card", { hasText: /CRUD Model Switch/i });
      await expect(card).toBeVisible({ timeout: 15_000 });

      const modelTrigger = card.locator(".custom-select-trigger");
      await expect(modelTrigger).toContainText("glm-4-flash");

      // Open dropdown and select second model
      await modelTrigger.click();
      await window.locator(".custom-select-option", { hasText: "glm-4.7-flash" }).click();

      await expect(modelTrigger).toContainText("glm-4.7-flash");
    } finally {
      await deleteKey(apiBase, entry.id);
    }
  });

  test("delete key → key card disappears", async ({ window, apiBase }) => {
    const zhipuKey = process.env.E2E_ZHIPU_API_KEY;
    test.skip(!zhipuKey, "E2E_ZHIPU_API_KEY required");

    await dismissModals(window);

    const entry = await seedKey(apiBase, {
      provider: "custom-crud-delete",
      label: "CRUD Delete Test",
      models: ["glm-4-flash"],
      apiKey: zhipuKey!,
    });

    try {
      await navigateToModels(window);

      const card = window.locator(".key-card", { hasText: /CRUD Delete Test/i });
      await expect(card).toBeVisible({ timeout: 15_000 });

      // Accept the confirmation dialog
      window.on("dialog", (dialog) => dialog.accept());

      // Click Remove
      await card.locator(".btn", { hasText: /Remove/i }).click();

      // Card should disappear
      await expect(card).toHaveCount(0, { timeout: 10_000 });
    } finally {
      // Cleanup in case delete didn't work
      await deleteKey(apiBase, entry.id);
    }
  });
});
