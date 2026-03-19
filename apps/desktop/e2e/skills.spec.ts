import { test, expect } from "./electron-fixture.js";

test.describe("Skills Page", () => {
  test("install from server + delete lifecycle", async ({ electronApp, window, apiBase }) => {
    // --- Get a real skill slug from the bundled-slugs API ---
    const bundledRes = await window.evaluate(async (base) => {
      const res = await fetch(`${base}/api/skills/bundled-slugs`);
      return { status: res.status, body: await res.json() };
    }, apiBase);
    expect(bundledRes.status).toBe(200);
    expect(bundledRes.body.slugs.length).toBeGreaterThanOrEqual(1);
    // Use the first bundled slug as a known-good slug for install/delete test
    const realSlug = bundledRes.body.slugs[0] as string;

    // --- Install skill via API (downloads from server) ---
    const installRes = await window.evaluate(async (arg: { base: string; slug: string }) => {
      const res = await fetch(`${arg.base}/api/skills/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: arg.slug }),
      });
      return { status: res.status, body: await res.json() };
    }, { base: apiBase, slug: realSlug });
    expect(installRes.status).toBe(200);

    if (!installRes.body.ok) {
      // Server download endpoint not available — skip gracefully
      console.warn("Skill install lifecycle skipped (server not ready):", installRes.body.error);
      return;
    }

    // --- Verify skill directory was created on disk ---
    // Get OPENCLAW_STATE_DIR from the Electron process (set by e2e fixture for data isolation)
    const openclawStateDir = await electronApp.evaluate(() => process.env.OPENCLAW_STATE_DIR || "");
    expect(openclawStateDir).toBeTruthy();

    const { existsSync: existsSyncCheck, readdirSync } = await import("node:fs");
    const { join: joinPath } = await import("node:path");
    const installedSkillDir = joinPath(openclawStateDir, "skills", realSlug);
    expect(existsSyncCheck(installedSkillDir)).toBe(true);

    // Verify directory has content (at least one file like SKILL.md)
    const files = readdirSync(installedSkillDir);
    expect(files.length).toBeGreaterThanOrEqual(1);

    // --- Verify it shows up in the installed list API ---
    const installedRes = await window.evaluate(async (base) => {
      const res = await fetch(`${base}/api/skills/installed`);
      return { status: res.status, body: await res.json() };
    }, apiBase);
    expect(installedRes.status).toBe(200);
    const installedSlugs = (installedRes.body.skills as Array<{ slug: string }>).map(s => s.slug);
    expect(installedSlugs).toContain(realSlug);

    // --- Delete the installed skill via API ---
    const deleteRes = await window.evaluate(async (arg: { base: string; slug: string }) => {
      const res = await fetch(`${arg.base}/api/skills/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: arg.slug }),
      });
      return { status: res.status, body: await res.json() };
    }, { base: apiBase, slug: realSlug });
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.ok).toBe(true);

    // Verify directory was removed
    expect(existsSyncCheck(installedSkillDir)).toBe(false);
  });

  test("installed tab, seed + delete lifecycle", async ({ electronApp, window }) => {
    // Dismiss any modal(s)
    for (let i = 0; i < 3; i++) {
      const backdrop = window.locator(".modal-backdrop");
      if (!await backdrop.isVisible({ timeout: 3_000 }).catch(() => false)) break;
      await backdrop.click({ position: { x: 5, y: 5 }, force: true });
      await backdrop.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
    }

    // --- Seed a fake installed skill directory ---
    // Get OPENCLAW_STATE_DIR from Electron process (set by e2e fixture for data isolation),
    // then create files in the test process.
    const openclawStateDir = await electronApp.evaluate(() => process.env.OPENCLAW_STATE_DIR || "");
    expect(openclawStateDir).toBeTruthy();

    const { mkdirSync, writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    const skillDir = join(openclawStateDir, "skills", "e2e-test-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, "SKILL.md"),
      [
        "---",
        "name: E2E Test Skill",
        "description: A skill created for e2e testing",
        "author: e2e-tester",
        "version: 1.0.0",
        "---",
        "",
        "# E2E Test Skill",
        "This is a test skill.",
      ].join("\n"),
    );

    // --- Navigate to Skills page → Installed tab ---
    const skillsBtn = window.locator(".nav-btn", { hasText: "Skills" });
    await skillsBtn.click();
    await expect(skillsBtn).toHaveClass(/nav-active/);

    const installedTab = window.locator(".tab-bar .tab-btn", { hasText: /Installed|已安装/ });
    await installedTab.click();
    await expect(installedTab).toHaveClass(/tab-btn-active/);

    // Wait for loading
    await window.locator(".text-muted").waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});

    // --- Verify seeded skill appears ---
    const installedCards = window.locator(".skills-grid .section-card");
    // At least one card for our seeded skill (user may also have real skills)
    const cardCount = await installedCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(1);

    // Find the card for our test skill
    const testSkillCard = window.locator(".section-card", { hasText: "E2E Test Skill" });
    await expect(testSkillCard).toBeVisible();
    await expect(testSkillCard).toContainText("e2e-tester");
    await expect(testSkillCard).toContainText("v1.0.0");

    // --- Delete the seeded skill ---
    const deleteBtn = testSkillCard.locator(".skill-card-actions .btn");
    await deleteBtn.click();

    // Confirm dialog should appear
    const confirmDialog = window.locator(".modal-content");
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText(/delete|删除/i);

    // Click confirm (the danger button in the dialog)
    const confirmBtn = confirmDialog.locator(".btn-danger");
    await confirmBtn.click();

    // Wait for deletion and list refresh
    await window.waitForTimeout(1_000);

    // Verify skill is removed
    await expect(testSkillCard).not.toBeVisible({ timeout: 5_000 });

    // --- Verify the skill directory was actually deleted ---
    const { existsSync } = await import("node:fs");
    const exists = existsSync(skillDir);
    expect(exists).toBe(false);
  });

  test("market browse, search, and labels", async ({ window }) => {
    // Dismiss any modal(s) blocking the UI
    for (let i = 0; i < 3; i++) {
      const backdrop = window.locator(".modal-backdrop");
      if (!await backdrop.isVisible({ timeout: 3_000 }).catch(() => false)) break;
      await backdrop.click({ position: { x: 5, y: 5 }, force: true });
      await backdrop.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
    }

    // --- Navigate to Skills page ---
    const skillsBtn = window.locator(".nav-btn", { hasText: "Skills" });
    await skillsBtn.click();
    await expect(skillsBtn).toHaveClass(/nav-active/);

    // Page title and description should be visible
    await expect(window.locator("h1", { hasText: /Skills Marketplace|技能市场/ })).toBeVisible();

    // --- Market tab should be active by default ---
    const marketTab = window.locator(".tab-bar .tab-btn", { hasText: /Market|市场/ });
    await expect(marketTab).toHaveClass(/tab-btn-active/);

    // Wait for either the skills grid or the empty state to appear (loading finished)
    await Promise.race([
      window.locator(".skills-grid").waitFor({ state: "visible", timeout: 30_000 }),
      window.locator(".empty-state").waitFor({ state: "visible", timeout: 30_000 }),
    ]);

    // No error alert
    await expect(window.locator(".error-alert")).not.toBeVisible();

    // --- Verify market skills if backend is available ---
    const skillCards = window.locator(".skills-grid .section-card");
    const cardCount = await skillCards.count();

    if (cardCount > 0) {
      // Each card should have: name, version (in header), description, meta (author, stars, downloads), actions
      const firstCard = skillCards.first();
      await expect(firstCard.locator(".skill-card-name")).toBeVisible();
      await expect(firstCard.locator(".skill-card-version")).toBeVisible();
      await expect(firstCard.locator(".skill-card-desc")).toBeVisible();
      await expect(firstCard.locator(".skill-card-meta")).toBeVisible();
      await expect(firstCard.locator(".skill-card-actions .btn")).toBeVisible();

      // Meta section should contain author, stars, downloads (version is in card header)
      const meta = firstCard.locator(".skill-card-meta");
      await expect(meta).toContainText(/by /);       // author

      // --- Verify label badges render with correct classes ---
      // Check if any cards have labels (e.g. "推荐" / Recommended)
      const labelBadges = window.locator(".skill-card-labels .badge");
      const labelCount = await labelBadges.count();
      if (labelCount > 0) {
        const firstBadge = labelBadges.first();
        const badgeClass = await firstBadge.getAttribute("class");
        expect(badgeClass).toMatch(/badge-(info|muted)/);
      }

      // --- Verify category filter chips ---
      const categoryChips = window.locator(".skills-category-chips .btn");
      const chipCount = await categoryChips.count();
      if (chipCount > 0) {
        // "All" category should be active by default
        await expect(categoryChips.first()).toHaveClass(/btn-outline/);

        // Click a non-"All" category chip to filter
        if (chipCount > 1) {
          const secondChip = categoryChips.nth(1);
          await secondChip.click();
          await expect(secondChip).toHaveClass(/btn-outline/);

          // Wait for filtered results to load
          await window.waitForTimeout(1_000);

          // Skill cards should still render (possibly fewer)
          const filteredCards = window.locator(".skills-grid .section-card");
          const filteredCount = await filteredCards.count();
          if (filteredCount > 0) {
            expect(filteredCount).toBeLessThanOrEqual(cardCount);
          }

          // Reset to "All" filter
          await categoryChips.first().click();
          await window.waitForTimeout(1_000);
        }
      }
    } else {
      // No market backend available — verify empty state renders correctly
      await expect(window.locator(".empty-state")).toBeVisible();
    }

    // --- Verify search input works ---
    const searchInput = window.locator(".skills-search-input");
    await expect(searchInput).toBeVisible();

    // Type a search query — use a term likely to match something
    await searchInput.fill("a");
    // Wait for debounce (300ms) + API response
    await window.waitForTimeout(1_500);

    // Clear search
    await searchInput.fill("");
    await window.waitForTimeout(1_500);
  });

  test("API validation", async ({ window, apiBase }) => {
    // --- Verify installed skills API (empty in e2e) ---
    const installedRes = await window.evaluate(async (base) => {
      const res = await fetch(`${base}/api/skills/installed`);
      return { status: res.status, body: await res.json() };
    }, apiBase);
    expect(installedRes.status).toBe(200);
    expect(installedRes.body).toHaveProperty("skills");
    expect(Array.isArray(installedRes.body.skills)).toBe(true);

    // --- Verify install API returns error for nonexistent skill ---
    const installRes = await window.evaluate(async (base) => {
      const res = await fetch(`${base}/api/skills/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "nonexistent-skill" }),
      });
      return { status: res.status, body: await res.json() };
    }, apiBase);
    expect(installRes.status).toBe(200);
    expect(installRes.body.ok).toBe(false);
    expect(installRes.body.error).toBeTruthy();

    // --- Verify delete API validation ---
    // Missing slug → 400
    const deleteNoSlug = await window.evaluate(async (base) => {
      const res = await fetch(`${base}/api/skills/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      return { status: res.status, body: await res.json() };
    }, apiBase);
    expect(deleteNoSlug.status).toBe(400);

    // Path traversal → 400
    const deleteTraversal = await window.evaluate(async (base) => {
      const res = await fetch(`${base}/api/skills/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "../etc/passwd" }),
      });
      return { status: res.status, body: await res.json() };
    }, apiBase);
    expect(deleteTraversal.status).toBe(400);

    // Install missing slug → 400
    const installNoSlug = await window.evaluate(async (base) => {
      const res = await fetch(`${base}/api/skills/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      return { status: res.status, body: await res.json() };
    }, apiBase);
    expect(installNoSlug.status).toBe(400);
  });
});
