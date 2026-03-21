import { test, expect } from "./electron-fixture.js";

/** Dismiss any modal(s) blocking the UI (e.g. "What's New", telemetry consent). */
async function dismissModals(window: import("@playwright/test").Page) {
  for (let i = 0; i < 3; i++) {
    const backdrop = window.locator(".modal-backdrop");
    if (!await backdrop.isVisible({ timeout: 3_000 }).catch(() => false)) break;
    await backdrop.click({ position: { x: 5, y: 5 }, force: true });
    await backdrop.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
  }
}

/** Navigate to the Channels (Messaging) page and wait for it to load. */
async function navigateToChannels(window: import("@playwright/test").Page) {
  const channelsBtn = window.locator(".nav-btn", { hasText: "Messaging" });
  await channelsBtn.click();
  await expect(channelsBtn).toHaveClass(/nav-active/);
  const channelTitle = window.locator(".channel-title");
  await expect(channelTitle).toBeVisible({ timeout: 15_000 });
}

/**
 * Open the AddChannelAccountModal for a given channel type.
 *
 * Uses the custom Select dropdown in the add-account section, picks the
 * channel option, then clicks the "Connect" button.
 */
async function openAddAccountModal(
  window: import("@playwright/test").Page,
  channelLabel: string,
) {
  const addSection = window.locator(".channel-add-section");
  await expect(addSection).toBeVisible();

  // Open the channel-type dropdown
  const trigger = addSection.locator(".custom-select-trigger");
  await trigger.click();

  // Select the channel from the dropdown options (rendered in a portal on document.body)
  const option = window.locator(".custom-select-option", { hasText: channelLabel });
  await expect(option).toBeVisible({ timeout: 5_000 });
  await option.click();

  // Click the Connect button
  const connectBtn = addSection.locator(".btn.btn-primary");
  await connectBtn.click();

  // Wait for the modal to appear
  const modal = window.locator(".modal-backdrop .modal-content");
  await expect(modal).toBeVisible({ timeout: 5_000 });
  return modal;
}

/**
 * Locate the Group Policy custom Select trigger inside the modal.
 *
 * Finds the label with text "Group Policy", goes to its parent div,
 * and returns the .custom-select-trigger within that div.
 */
function getGroupPolicyTrigger(modal: import("@playwright/test").Locator) {
  const label = modal.locator(".form-label-block", { hasText: /^Group Policy$/ });
  return label.locator("..").locator(".custom-select-trigger");
}

/**
 * Select a value from the Group Policy dropdown.
 *
 * Opens the dropdown portal, clicks the option matching the given text,
 * and waits for the trigger to reflect the new value.
 */
async function selectGroupPolicy(
  window: import("@playwright/test").Page,
  modal: import("@playwright/test").Locator,
  optionText: RegExp,
) {
  const trigger = getGroupPolicyTrigger(modal);
  await trigger.click();
  const dropdown = window.locator(".custom-select-dropdown");
  await expect(dropdown).toBeVisible({ timeout: 3_000 });
  await dropdown.locator(".custom-select-option").filter({ hasText: optionText }).click();
  await expect(trigger).toContainText(optionText, { timeout: 3_000 });
}

test.describe("Channels Page", () => {
  test("navigates to channels page and loads successfully", async ({ window }) => {
    await dismissModals(window);
    await navigateToChannels(window);

    // Verify the refresh button is present
    const refreshBtn = window.locator(".channel-header .btn.btn-secondary");
    await expect(refreshBtn).toBeVisible();

    // Verify the "Add Account" section renders with the channel dropdown
    const addSection = window.locator(".channel-add-section");
    await expect(addSection).toBeVisible();

    // Verify the accounts table is rendered (even if empty)
    const table = window.locator(".channel-table");
    await expect(table).toBeVisible();

    // Verify the table has expected column headers
    const headers = table.locator("thead th");
    await expect(headers).toHaveCount(7);
  });

  test("opens add account modal and shows form fields", async ({ window }) => {
    await dismissModals(window);
    await navigateToChannels(window);

    const modal = await openAddAccountModal(window, "Telegram");

    // Verify the modal title contains "Telegram"
    const modalTitle = modal.locator(".modal-title");
    await expect(modalTitle).toContainText("Telegram");

    // Verify expected Telegram form fields are present via their labels.
    const labels = modal.locator(".form-label-block");
    const labelTexts = await labels.allTextContents();

    // Telegram schema: Display Name, Bot Token, Webhook URL, DM Policy, Group Policy.
    // groupAllowFrom is hidden by default (groupPolicy defaults to "open").
    expect(labelTexts.some(t => /display name/i.test(t))).toBe(true);
    expect(labelTexts.some(t => /bot token/i.test(t))).toBe(true);
    expect(labelTexts.some(t => /webhook/i.test(t))).toBe(true);
    expect(labelTexts.some(t => /dm policy/i.test(t))).toBe(true);
    expect(labelTexts.some(t => /group policy/i.test(t))).toBe(true);

    // Verify the enabled checkbox is present and checked by default
    const enabledCheckbox = modal.locator("#enabled");
    await expect(enabledCheckbox).toBeChecked();

    // Verify the Create and Cancel buttons are present
    await expect(modal.locator(".btn.btn-primary")).toContainText(/Create/);
    await expect(modal.locator(".btn.btn-secondary")).toContainText(/Cancel/);

    // Close the modal
    await modal.locator(".modal-close-btn").click();
    await modal.waitFor({ state: "hidden", timeout: 3_000 });
  });

  test("shows groupAllowFrom field when groupPolicy is set to allowlist", async ({ window }) => {
    await dismissModals(window);
    await navigateToChannels(window);

    const modal = await openAddAccountModal(window, "Telegram");

    // groupAllowFrom (TagInput) should NOT be visible initially because
    // Telegram's default groupPolicy is "open", not "allowlist".
    const groupAllowFromWrap = modal.locator(".tag-input-wrap").last();
    await expect(groupAllowFromWrap).toBeHidden();

    // Verify Group Policy trigger shows the default "Open" value
    const groupPolicyTrigger = getGroupPolicyTrigger(modal);
    await expect(groupPolicyTrigger).toContainText(/Open/);

    // Change Group Policy to "Allowlist"
    await selectGroupPolicy(window, modal, /Allowlist/);

    // The groupAllowFrom tag input should now be visible
    await expect(groupAllowFromWrap).toBeVisible({ timeout: 5_000 });

    // Verify the "Allowed Senders in Groups" label appeared
    const allLabels = await modal.locator(".form-label-block").allTextContents();
    expect(allLabels.some(t => /allow.*from|allowed.*sender/i.test(t))).toBe(true);

    // Verify a hint is shown for the groupAllowFrom field
    // The hint appears after the TagInput as a .form-hint in the same parent div.
    const groupAllowFromLabel = modal.locator(".form-label-block", { hasText: /allow.*from|allowed.*sender/i });
    const groupAllowFromSection = groupAllowFromLabel.locator("..");
    await expect(groupAllowFromSection.locator(".form-hint")).toBeVisible();

    // Close the modal
    await modal.locator(".modal-close-btn").click();
    await modal.waitFor({ state: "hidden", timeout: 3_000 });
  });

  test("hides groupAllowFrom field when groupPolicy is changed from allowlist", async ({ window }) => {
    await dismissModals(window);
    await navigateToChannels(window);

    const modal = await openAddAccountModal(window, "Telegram");

    // Set groupPolicy to "allowlist" -- groupAllowFrom should appear
    const groupAllowFromWrap = modal.locator(".tag-input-wrap").last();
    await selectGroupPolicy(window, modal, /Allowlist/);
    await expect(groupAllowFromWrap).toBeVisible({ timeout: 5_000 });

    // Change groupPolicy to "Open" -- groupAllowFrom should disappear
    await selectGroupPolicy(window, modal, /^Open/);
    await expect(groupAllowFromWrap).toBeHidden({ timeout: 5_000 });

    // Change groupPolicy to "Disabled" -- groupAllowFrom should stay hidden
    await selectGroupPolicy(window, modal, /Disabled/);
    await expect(groupAllowFromWrap).toBeHidden();

    // Change back to "Allowlist" -- groupAllowFrom should reappear
    await selectGroupPolicy(window, modal, /Allowlist/);
    await expect(groupAllowFromWrap).toBeVisible({ timeout: 5_000 });

    // Close the modal
    await modal.locator(".modal-close-btn").click();
    await modal.waitFor({ state: "hidden", timeout: 3_000 });
  });
});
