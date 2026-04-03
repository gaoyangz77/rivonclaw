import { test, expect } from "./electron-fixture.js";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

test.describe("Telegram Pairing Flow", () => {
  test("add account, simulate pairing request, and approve", async ({ window, electronApp }) => {
    test.slow();
    test.skip(!process.env.E2E_TELEGRAM_BOT_TOKEN, "E2E_TELEGRAM_BOT_TOKEN required");

    // --- Step 1: Dismiss any blocking modals ---
    for (let i = 0; i < 3; i++) {
      const backdrop = window.locator(".modal-backdrop");
      if (!await backdrop.isVisible({ timeout: 3_000 }).catch(() => false)) break;
      await backdrop.click({ position: { x: 5, y: 5 }, force: true });
      await backdrop.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
    }

    // --- Step 2: Navigate to Channels page ---
    const channelsBtn = window.locator(".nav-btn", { hasText: "Messaging" });
    await channelsBtn.click();
    await expect(channelsBtn).toHaveClass(/nav-active/);

    const channelTitle = window.locator(".channel-title");
    await expect(channelTitle).toBeVisible({ timeout: 15_000 });

    const telegramRows = window
      .locator(".channel-table tbody tr.table-hover-row")
      .filter({ hasText: "Telegram" });
    const initialTelegramRowCount = await telegramRows.count();

    // --- Step 3: Select Telegram from the channel dropdown ---
    const addSection = window.locator(".channel-add-section");
    await expect(addSection).toBeVisible();

    // Open the custom Select dropdown (portal-rendered)
    const selectTrigger = addSection.locator(".custom-select-trigger");
    await selectTrigger.click();

    // The dropdown is rendered via portal to document.body
    const telegramOption = window.locator(".custom-select-dropdown .custom-select-option", {
      hasText: "Telegram",
    });
    await expect(telegramOption).toBeVisible({ timeout: 5_000 });
    await telegramOption.click();

    // --- Step 4: Click Connect to open the add-account modal ---
    const connectBtn = addSection.locator(".btn.btn-primary");
    await connectBtn.click();

    // --- Step 5: Fill in the bot token in the modal ---
    const modal = window.locator(".modal-backdrop");
    await expect(modal).toBeVisible({ timeout: 5_000 });

    const botTokenInput = window.locator("input[name='botToken']");
    await expect(botTokenInput).toBeVisible();
    await botTokenInput.fill(process.env.E2E_TELEGRAM_BOT_TOKEN!);

    // --- Step 6: Click Save/Create ---
    const createBtn = window.locator(".modal-actions .btn.btn-primary");
    await createBtn.click();

    // Wait for modal to close (gateway restart happens behind the scenes)
    await expect(modal).toBeHidden({ timeout: 60_000 });

    // --- Step 7: Wait for Telegram to appear in the channel table ---
    await expect(telegramRows).toHaveCount(initialTelegramRowCount + 1, { timeout: 30_000 });
    const telegramRow = telegramRows.nth(initialTelegramRowCount);
    await expect(telegramRow).toBeVisible({ timeout: 30_000 });

    // --- Step 8: Expand the Telegram row FIRST (should show empty allowlist) ---
    // This reproduces the original bug: user expands a channel row, then a
    // pairing request arrives, but the UI never updates until app restart.
    await telegramRow.click();

    // Wait for the expanded row to load (allowlist section should appear)
    const allowlistHeading = window
      .locator(".recipients-section h4")
      .filter({ hasText: "Allowlist" })
      .last();
    await expect(allowlistHeading).toBeVisible({ timeout: 15_000 });

    // --- Step 9: NOW simulate a pairing request while the row is already expanded ---
    const stateDir = await electronApp.evaluate(async () => {
      return process.env.OPENCLAW_STATE_DIR;
    });
    expect(stateDir).toBeTruthy();

    const credentialsDir = path.join(stateDir!, "credentials");
    mkdirSync(credentialsDir, { recursive: true });

    const now = new Date().toISOString();
    const pairingData = {
      version: 1,
      requests: [
        {
          id: "e2e_test_user_12345",
          code: "TESTCODE",
          createdAt: now,
          lastSeenAt: now,
          meta: {
            username: "e2e_test_user",
            firstName: "E2E",
            lastName: "TestUser",
            accountId: "default",
          },
        },
      ],
    };

    writeFileSync(
      path.join(credentialsDir, "telegram-pairing.json"),
      JSON.stringify(pairingData, null, 2),
    );

    // Wait for the 5s polling to pick up the new pairing request
    const pendingSection = window
      .locator(".recipients-section h4")
      .filter({ hasText: "Pending" })
      .last();
    await expect(pendingSection).toBeVisible({ timeout: 20_000 });

    // Verify the pairing code is displayed
    const pairingCode = window
      .locator(".recipients-table .td-code")
      .filter({ hasText: "TESTCODE" })
      .last();
    await expect(pairingCode).toBeVisible();

    // Verify the user ID is displayed
    const userId = window
      .locator(".recipients-table td")
      .filter({ hasText: "e2e_test_user_12345" })
      .last();
    await expect(userId).toBeVisible();

    // --- Step 10: Approve the pairing request ---
    const approveBtn = window
      .locator(".recipients-table .btn.btn-primary.btn-sm")
      .filter({ hasText: "Approve" })
      .last();
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // Wait for the pending request to disappear
    await expect(pairingCode).toBeHidden({ timeout: 10_000 });

    // --- Step 11: Verify the user appears in the allowlist ---
    const allowlistSection = window
      .locator(".recipients-section h4")
      .filter({ hasText: "Allowlist" })
      .last();
    await expect(allowlistSection).toBeVisible();

    // The allowlist renders TruncatedId which shows "...345" (last 3 chars)
    // and puts the full ID in the copy button's title attribute
    const allowlistCopyBtn = window.locator(".recipients-section .id-copy-btn[title='e2e_test_user_12345']").last();
    await expect(allowlistCopyBtn).toBeVisible({ timeout: 10_000 });
  });
});
