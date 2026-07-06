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

test.describe("Dropdown positioning", () => {
  test("model select dropdown appears adjacent to its trigger", async ({ window }) => {
    // Dismiss any modal(s) blocking the UI
    for (let i = 0; i < 3; i++) {
      const backdrop = window.locator(".modal-backdrop");
      if (!await backdrop.isVisible({ timeout: 3_000 }).catch(() => false)) break;
      await backdrop.click({ position: { x: 5, y: 5 }, force: true });
      await backdrop.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
    }

    // Navigate to Models page
    await navigateToModels(window);

    // Switch to API Key tab where the model dropdown lives
    const apiTab = window.locator(".tab-btn", { hasText: /API/i });
    await apiTab.click();
    await expect(apiTab).toHaveClass(/tab-btn-active/);

    // Select a provider that has models (e.g. Anthropic/Claude)
    await window.locator(".provider-select-trigger").click();
    const claudeOption = window.locator(".provider-select-option", { hasText: /Claude/i });
    if (await claudeOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await claudeOption.click();
    } else {
      // Close provider dropdown and pick whatever is already selected
      await window.locator(".provider-select-trigger").click();
    }

    // Wait for the model dropdown to be ready
    const trigger = window.locator(".page-two-col .custom-select-trigger").first();
    await expect(trigger).toBeVisible({ timeout: 10_000 });

    // Click the model dropdown trigger
    await trigger.click();

    // The dropdown position is set asynchronously via useEffect after the portal
    // renders. On slower machines, getBoundingClientRect can return stale values
    // if layout hasn't settled, leaving the dropdown at x=0. If misaligned, close
    // and reopen to force a fresh position calculation.
    const dropdown = window.locator(".custom-select-dropdown");
    await expect(async () => {
      if (!await dropdown.isVisible().catch(() => false)) {
        await trigger.click();
        await expect(dropdown).toBeVisible({ timeout: 3_000 });
      }

      const triggerBox = await trigger.boundingBox();
      const dropdownBox = await dropdown.boundingBox();
      expect(triggerBox).toBeTruthy();
      expect(dropdownBox).toBeTruthy();

      const horizontalOffset = Math.abs(dropdownBox!.x - triggerBox!.x);
      if (horizontalOffset >= 20) {
        // Close and let toPass retry with a fresh open
        await trigger.click();
        await dropdown.waitFor({ state: "hidden", timeout: 2_000 }).catch(() => {});
      }
      expect(
        horizontalOffset,
        `Dropdown left edge (${dropdownBox!.x}) is ${horizontalOffset}px away from trigger left edge (${triggerBox!.x}). ` +
        `This likely means a CSS transform/filter on an ancestor is breaking position:fixed.`,
      ).toBeLessThan(20);

      const gap = 8;
      const isBelow = dropdownBox!.y >= triggerBox!.y + triggerBox!.height - gap;
      const isAbove = dropdownBox!.y + dropdownBox!.height <= triggerBox!.y + gap;
      expect(
        isBelow || isAbove,
        `Dropdown (y=${dropdownBox!.y}, h=${dropdownBox!.height}) is not adjacent to trigger ` +
        `(y=${triggerBox!.y}, h=${triggerBox!.height}). Expected dropdown directly above or below.`,
      ).toBe(true);
    }).toPass({ timeout: 10_000 });

    // Close dropdown
    await trigger.click();
  });

});
