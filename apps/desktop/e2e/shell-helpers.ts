import { expect, type Page } from "@playwright/test";

export function getNavigationButton(window: Page, name: string | RegExp) {
  return window
    .getByRole("navigation", { name: "Primary navigation", exact: true })
    .getByRole("button", { name, exact: true });
}

export async function waitForSignedInShell(window: Page): Promise<void> {
  const avatar = getNavigationButton(window, "Account")
    .locator(".nav-account-avatar:not(.nav-account-avatar-loading)");
  await expect(avatar).toBeVisible({ timeout: 15_000 });
}

export async function navigateToExtensionPage(window: Page, name: "Skills" | "Plugins") {
  await getNavigationButton(window, "Extensions").click();
  await window
    .getByRole("navigation", { name: "Extensions submenu", exact: true })
    .getByRole("button", { name: new RegExp(`^${name}`) })
    .click();
  await expect(window.getByRole("heading", {
    name: name === "Skills" ? "Skills Marketplace" : "Plugins",
    exact: true,
  })).toBeVisible();
}
