import { test, expect } from "./electron-fixture.js";

test.describe("Extra Features Page", () => {
  /** Dismiss any modal(s) blocking the UI and navigate to the Extra Features page. */
  async function goToExtras(window: import("@playwright/test").Page) {
    for (let i = 0; i < 3; i++) {
      const backdrop = window.locator(".modal-backdrop");
      if (!await backdrop.isVisible({ timeout: 3_000 }).catch(() => false)) break;
      await backdrop.click({ position: { x: 5, y: 5 }, force: true });
      await backdrop.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
    }

    const extrasBtn = window.locator(".nav-btn", { hasText: /Extra Features|扩展功能/ });
    await extrasBtn.click();
    await expect(extrasBtn).toHaveClass(/nav-active/);
  }

  test("navigates to extras page and shows three sections", async ({ window }) => {
    await goToExtras(window);

    const sections = window.locator(".extras-page .section-card");
    await expect(sections).toHaveCount(3);

    // Each section should have a heading and a save button
    for (let i = 0; i < 3; i++) {
      const section = sections.nth(i);
      await expect(section.locator("h3")).toBeVisible();
      await expect(section.locator(".btn-primary")).toBeVisible();
    }

    // Verify section headings match expected order
    const sttSection = sections.nth(0);
    await expect(sttSection.locator("h3")).toContainText(/Speech-to-Text|语音转文字/);

    const webSearchSection = sections.nth(1);
    await expect(webSearchSection.locator("h3")).toContainText(/Web Search|网页搜索/);

    const embeddingSection = sections.nth(2);
    await expect(embeddingSection.locator("h3")).toContainText(/Embedding|嵌入/);
  });

  test("STT: saves Groq API key successfully", async ({ window }) => {
    const groqKey = process.env.GROQ_KEY;
    test.skip(!groqKey, "GROQ_KEY env var not set");

    await goToExtras(window);

    const section = window.locator(".extras-page .section-card").nth(0);

    // Enable STT
    const checkbox = section.locator("input[type='checkbox']");
    if (!await checkbox.isChecked()) {
      await section.locator(".extras-toggle").click();
    }

    // Groq should be the default provider for en locale; verify it is selected
    await expect(section.locator(".custom-select-trigger")).toContainText(/Groq/);

    // Enter API key
    const keyInput = section.locator("input[type='password']");
    await expect(keyInput).toBeVisible({ timeout: 5_000 });
    await keyInput.fill(groqKey!);

    // Click Save
    await section.locator(".btn-primary").click();

    // Verify toast success message appears
    await expect(window.locator(".toast-success")).toBeVisible({ timeout: 10_000 });
  });

  test("Web Search: saves Brave Search API key successfully", async ({ window }) => {
    const braveKey = process.env.BRAVE_SEARCH_KEY;
    test.skip(!braveKey, "BRAVE_SEARCH_KEY env var not set");

    await goToExtras(window);

    const section = window.locator(".extras-page .section-card").nth(1);

    // Enable web search
    const checkbox = section.locator("input[type='checkbox']");
    if (!await checkbox.isChecked()) {
      await section.locator(".extras-toggle").click();
    }

    // Brave should be the default provider
    await expect(section.locator(".custom-select-trigger")).toContainText(/Brave/);

    // Enter API key
    const keyInput = section.locator("input[type='password']");
    await expect(keyInput).toBeVisible({ timeout: 5_000 });
    await keyInput.fill(braveKey!);

    // Click Save
    await section.locator(".btn-primary").click();

    // Verify toast success message appears
    await expect(window.locator(".toast-success")).toBeVisible({ timeout: 10_000 });
  });

  test("Embedding: saves Gemini API key successfully", async ({ window }) => {
    const geminiKey = process.env.EMBEDDING_GEMINI_KEY;
    test.skip(!geminiKey, "EMBEDDING_GEMINI_KEY env var not set");

    await goToExtras(window);

    const section = window.locator(".extras-page .section-card").nth(2);

    // Enable embedding
    const checkbox = section.locator("input[type='checkbox']");
    if (!await checkbox.isChecked()) {
      await section.locator(".extras-toggle").click();
    }

    // Select Gemini provider from dropdown
    await section.locator(".custom-select-trigger").click();
    await window.locator(".custom-select-option", { hasText: "Gemini" }).click();

    // Enter API key
    const keyInput = section.locator("input[type='password']");
    await expect(keyInput).toBeVisible({ timeout: 5_000 });
    await keyInput.fill(geminiKey!);

    // Click Save
    await section.locator(".btn-primary").click();

    // Verify toast success message appears
    await expect(window.locator(".toast-success")).toBeVisible({ timeout: 10_000 });
  });

  test("API: extras credentials CRUD", async ({ window, apiBase }) => {
    // GET /api/extras/credentials — should return provider status
    const getRes = await window.evaluate(async (base) => {
      const res = await fetch(`${base}/api/extras/credentials`);
      return { status: res.status, body: await res.json() };
    }, apiBase);
    expect(getRes.status).toBe(200);
    expect(getRes.body.webSearch).toBeTruthy();
    expect(getRes.body.embedding).toBeTruthy();
    // All should be false initially (clean test environment)
    expect(getRes.body.webSearch.brave).toBe(false);
    expect(getRes.body.embedding.openai).toBe(false);

    // PUT /api/extras/credentials — missing fields -> 400
    const putBadRes = await window.evaluate(async (base) => {
      const res = await fetch(`${base}/api/extras/credentials`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      return { status: res.status };
    }, apiBase);
    expect(putBadRes.status).toBe(400);

    // PUT /api/extras/credentials — unknown type -> 400
    const putUnknownRes = await window.evaluate(async (base) => {
      const res = await fetch(`${base}/api/extras/credentials`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "unknown", provider: "test", apiKey: "test" }),
      });
      return { status: res.status };
    }, apiBase);
    expect(putUnknownRes.status).toBe(400);

    // PUT /api/extras/credentials — unknown provider -> 400
    const putBadProvider = await window.evaluate(async (base) => {
      const res = await fetch(`${base}/api/extras/credentials`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "webSearch", provider: "nonexistent", apiKey: "test" }),
      });
      return { status: res.status };
    }, apiBase);
    expect(putBadProvider.status).toBe(400);

    // PUT valid credentials -> 200 (only if env var is available)
    const braveKey = process.env.BRAVE_SEARCH_KEY;
    if (braveKey) {
      const putOk = await window.evaluate(async (arg: { base: string; key: string }) => {
        const res = await fetch(`${arg.base}/api/extras/credentials`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "webSearch", provider: "brave", apiKey: arg.key }),
        });
        return { status: res.status, body: await res.json() };
      }, { base: apiBase, key: braveKey });
      expect(putOk.status).toBe(200);
      expect(putOk.body.ok).toBe(true);

      // Verify GET now returns true for brave
      const getAfter = await window.evaluate(async (base) => {
        const res = await fetch(`${base}/api/extras/credentials`);
        return { status: res.status, body: await res.json() };
      }, apiBase);
      expect(getAfter.body.webSearch.brave).toBe(true);
    }
  });

  test("provider switching behavior", async ({ window }) => {
    await goToExtras(window);

    const section = window.locator(".extras-page .section-card").nth(1);

    // Enable web search
    const checkbox = section.locator("input[type='checkbox']");
    if (!await checkbox.isChecked()) {
      await section.locator(".extras-toggle").click();
    }

    // Type something in the key input
    const keyInput = section.locator("input[type='password']");
    await expect(keyInput).toBeVisible({ timeout: 5_000 });
    await keyInput.fill("test-key-value");

    // Switch provider from Brave to Perplexity
    await section.locator(".custom-select-trigger").click();
    await window.locator(".custom-select-option", { hasText: "Perplexity" }).click();

    // The key input value is preserved (same state variable across providers)
    await expect(keyInput).toHaveValue("test-key-value");

    // Switch back to Brave
    await section.locator(".custom-select-trigger").click();
    await window.locator(".custom-select-option", { hasText: "Brave" }).click();

    // Value should still be preserved
    await expect(keyInput).toHaveValue("test-key-value");
  });

  test("Ollama embedding shows no-key-needed message", async ({ window }) => {
    await goToExtras(window);

    const section = window.locator(".extras-page .section-card").nth(2);

    // Enable embedding
    const checkbox = section.locator("input[type='checkbox']");
    if (!await checkbox.isChecked()) {
      await section.locator(".extras-toggle").click();
    }

    // Select Ollama provider
    await section.locator(".custom-select-trigger").click();
    await window.locator(".custom-select-option", { hasText: "Ollama" }).click();

    // Verify the API key help text indicates the key is optional for Ollama
    await expect(section.locator(".form-help").last()).toContainText(/optional/i, { timeout: 5_000 });

    // Ollama key is optional — the password input is still shown but not required
    await expect(section.locator("input[type='password']")).toBeVisible();
  });

  test("disable feature and save", async ({ window, apiBase }) => {
    await goToExtras(window);

    const section = window.locator(".extras-page .section-card").nth(1);
    const checkbox = section.locator("input[type='checkbox']");

    // Ensure web search is unchecked (disabled)
    if (await checkbox.isChecked()) {
      await section.locator(".extras-toggle").click();
    }

    // Save with feature disabled — no API key validation needed
    await section.locator(".btn-primary").click();
    await expect(window.locator(".toast-success")).toBeVisible({ timeout: 10_000 });

    // Verify settings API reflects disabled
    const settingsDisabled = await window.evaluate(async (base) => {
      const res = await fetch(`${base}/api/settings`);
      const data = await res.json() as { settings: Record<string, string> };
      return data.settings;
    }, apiBase);
    expect(settingsDisabled["webSearch.enabled"]).toBe("false");
  });
});
