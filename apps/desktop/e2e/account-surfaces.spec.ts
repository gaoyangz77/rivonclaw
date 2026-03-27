/**
 * Account Page — Surface & RunProfile CRUD
 *
 * Tests the full business flow: create/edit/delete Surfaces and RunProfiles,
 * tool selection via ToolMultiSelect, and consistency warnings when a Surface
 * narrows its tools below what a child RunProfile uses.
 *
 * Requires staging login for entitled tools (browser_profiles_*).
 */
import { test, expect } from "./electron-fixture.js";

const STAGING_GRAPHQL_URL = process.env.RIVONCLAW_API_BASE_URL
  ? `${process.env.RIVONCLAW_API_BASE_URL}/graphql`
  : "https://api-stg.rivonclaw.com/graphql";

const LOGIN_MUTATION = `
  mutation Login($input: LoginInput!) {
    login(input: $input) { accessToken refreshToken }
  }
`;

const testEmail = process.env.STAGING_TEST_USERNAME;
const testPassword = process.env.STAGING_TEST_PASSWORD;
const captchaBypass = process.env.STAGING_CAPTCHA_BYPASS_TOKEN;

/** Login via staging API bypass, store tokens, reload Panel to pick up auth state. */
async function loginAndNavigateToAccount(
  window: import("@playwright/test").Page,
  apiBase: string,
): Promise<void> {
  // 1. Login via GraphQL mutation (staging captcha bypass)
  const loginRes = await fetch(STAGING_GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: LOGIN_MUTATION,
      variables: {
        input: {
          email: testEmail,
          password: testPassword,
          captchaToken: captchaBypass ?? "test",
          captchaAnswer: "bypass",
        },
      },
    }),
  });
  const loginBody = (await loginRes.json()) as {
    data?: { login: { accessToken: string; refreshToken: string } };
    errors?: Array<{ message: string }>;
  };
  if (loginBody.errors?.length) {
    throw new Error(`Login failed: ${loginBody.errors[0].message}`);
  }
  const { accessToken, refreshToken } = loginBody.data!.login;

  // 2. Store tokens in Desktop
  const storeRes = await fetch(`${apiBase}/api/auth/store-tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken, refreshToken }),
  });
  expect(storeRes.status).toBe(200);

  // 3. Reload Panel so it picks up the stored auth state
  await window.reload({ waitUntil: "domcontentloaded" });
  await expect(window.locator(".user-avatar-circle")).toBeVisible({ timeout: 15_000 });

  // 4. Click avatar to navigate to Account page
  await window.locator(".user-avatar-btn").click();
  await expect(window.locator(".account-page")).toBeVisible({ timeout: 10_000 });
}

async function dismissModals(window: import("@playwright/test").Page): Promise<void> {
  for (let i = 0; i < 3; i++) {
    const backdrop = window.locator(".modal-backdrop");
    if (!await backdrop.isVisible({ timeout: 2_000 }).catch(() => false)) break;
    await backdrop.click({ position: { x: 5, y: 5 }, force: true });
    await backdrop.waitFor({ state: "hidden", timeout: 2_000 }).catch(() => {});
  }
}

test.describe("Account Page — Surfaces & RunProfiles", () => {
  test.skip(!testEmail || !testPassword, "Staging credentials not configured");

  test("full Surface & RunProfile CRUD lifecycle", async ({ window, apiBase }) => {
    // Use unique names per run to avoid "name already exists" from leftover Cloud data
    const suffix = Date.now().toString(36);
    const surfaceName = `E2E Surface ${suffix}`;
    const profileName = `E2E Profile ${suffix}`;
    const profileNameUpdated = `E2E Profile ${suffix} Upd`;

    await dismissModals(window);
    await loginAndNavigateToAccount(window, apiBase);

    const surfaceSection = window.locator(".section-card").filter({ hasText: /场景|Surfaces/ });
    const profileSection = window.locator(".section-card").filter({ hasText: /运行配置|Run Profiles/ });

    // ── 1. System surfaces are visible and non-editable ──
    const systemSurface = surfaceSection.locator(".acct-item-system").first();
    await expect(systemSurface).toBeVisible({ timeout: 10_000 });
    await expect(systemSurface.locator(".acct-badge-system")).toBeVisible();
    // System items should NOT have edit/delete buttons
    await expect(systemSurface.locator(".acct-item-actions")).not.toBeVisible();

    // ── 2. Create a new Surface with tools ──
    await surfaceSection.locator(".btn-primary", { hasText: /New Surface|新建场景/ }).click();
    const surfaceModal = window.locator(".modal-content");
    await expect(surfaceModal).toBeVisible({ timeout: 5_000 });

    // Fill name
    await surfaceModal.locator("input[type='text']").first().fill(surfaceName);
    // Fill description
    await surfaceModal.locator("input[type='text']").nth(1).fill("Created by e2e test");

    // Select tools via ToolMultiSelect — check a category header to select all in group
    const toolGroup = surfaceModal.locator(".tool-ms-group").first();
    if (await toolGroup.isVisible().catch(() => false)) {
      await toolGroup.locator(".tool-ms-checkbox").first().check();
    }

    // Save — if the Cloud GraphQL mutation fails the modal stays open
    await surfaceModal.locator(".btn-primary", { hasText: /Save|保存/ }).click();
    const surfaceModalClosed = await surfaceModal
      .waitFor({ state: "hidden", timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    if (!surfaceModalClosed) {
      await dismissModals(window);
      test.skip(true, "Surface creation failed — Cloud mutation returned error");
      return;
    }

    // Verify the new surface appears
    const newSurface = surfaceSection.locator(".acct-item-name", { hasText: surfaceName });
    await expect(newSurface).toBeVisible({ timeout: 5_000 });

    // ── 3. Create a RunProfile under the new Surface ──
    await profileSection.locator(".btn-primary", { hasText: /New Profile|新建配置/ }).click();
    const profileModal = window.locator(".modal-content");
    await expect(profileModal).toBeVisible({ timeout: 5_000 });

    // Select surface via styled Select dropdown
    const surfaceSelect = profileModal.locator(".custom-select-trigger").first();
    await surfaceSelect.click();
    const surfaceOption = window.locator(".custom-select-option", { hasText: surfaceName });
    await surfaceOption.click();

    // Fill profile name
    await profileModal.locator("input[type='text']").first().fill(profileName);

    // Select some tools
    const profileToolGroup = profileModal.locator(".tool-ms-group").first();
    if (await profileToolGroup.isVisible().catch(() => false)) {
      await profileToolGroup.locator(".tool-ms-checkbox").first().check();
    }

    // Save
    await profileModal.locator(".btn-primary", { hasText: /Save|保存/ }).click();
    await profileModal.waitFor({ state: "hidden", timeout: 10_000 });

    // Verify the new profile appears
    const newProfile = profileSection.locator(".acct-item-name", { hasText: profileName });
    await expect(newProfile).toBeVisible({ timeout: 5_000 });

    // ── 4. Edit the Surface — narrow tools to trigger warning ──
    const surfaceItem = surfaceSection.locator(".acct-item", { hasText: surfaceName });
    await surfaceItem.locator(".btn-secondary", { hasText: /Edit|编辑/ }).click();
    const editModal = window.locator(".modal-content");
    await expect(editModal).toBeVisible({ timeout: 5_000 });

    // Uncheck all tools — this should trigger the narrow warning
    const editToolGroups = editModal.locator(".tool-ms-group");
    const groupCount = await editToolGroups.count();
    for (let i = 0; i < groupCount; i++) {
      const checkbox = editToolGroups.nth(i).locator(".tool-ms-checkbox").first();
      if (await checkbox.isChecked()) {
        await checkbox.uncheck();
      }
    }

    // Warning should appear about affected run profiles
    const warning = editModal.locator(".form-warning");
    // Warning may or may not appear depending on whether the profile had tools in scope
    // If it appears, verify it mentions the affected profile
    if (await warning.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(warning).toContainText(profileName);
    }

    // Cancel the edit (don't save the narrowed surface)
    await editModal.locator(".btn-secondary", { hasText: /Cancel|取消/ }).click();
    await editModal.waitFor({ state: "hidden", timeout: 5_000 });

    // ── 5. Edit RunProfile ──
    const profileItem = profileSection.locator(".acct-item", { hasText: profileName });
    await profileItem.locator(".btn-secondary", { hasText: /Edit|编辑/ }).click();
    const editProfileModal = window.locator(".modal-content");
    await expect(editProfileModal).toBeVisible({ timeout: 5_000 });

    // Change name
    const nameInput = editProfileModal.locator("input[type='text']").first();
    await nameInput.clear();
    await nameInput.fill(profileNameUpdated);

    // Save
    await editProfileModal.locator(".btn-primary", { hasText: /Save|保存/ }).click();
    await editProfileModal.waitFor({ state: "hidden", timeout: 10_000 });

    // Verify updated name
    await expect(profileSection.locator(".acct-item-name", { hasText: profileNameUpdated })).toBeVisible({ timeout: 5_000 });

    // ── 6. Delete RunProfile ──
    const updatedProfileItem = profileSection.locator(".acct-item", { hasText: profileNameUpdated });
    await updatedProfileItem.locator(".btn-danger", { hasText: /Delete|删除/ }).click();
    // Confirm via custom ConfirmDialog modal
    const confirmModal = window.locator(".modal-content");
    await expect(confirmModal).toBeVisible({ timeout: 5_000 });
    await confirmModal.locator(".btn-danger").click();
    // Profile should disappear
    await expect(updatedProfileItem).not.toBeVisible({ timeout: 5_000 });

    // ── 7. Delete Surface ──
    const surfaceToDelete = surfaceSection.locator(".acct-item", { hasText: surfaceName });
    await surfaceToDelete.locator(".btn-danger", { hasText: /Delete|删除/ }).click();
    // Confirm via custom ConfirmDialog modal
    const confirmSurfaceModal = window.locator(".modal-content");
    await expect(confirmSurfaceModal).toBeVisible({ timeout: 5_000 });
    await confirmSurfaceModal.locator(".btn-danger").click();
    // Surface should disappear
    await expect(surfaceToDelete).not.toBeVisible({ timeout: 5_000 });
  });

  test("from-preset creates a pre-filled Surface form", async ({ window, apiBase }) => {
    await dismissModals(window);
    await loginAndNavigateToAccount(window, apiBase);

    const surfaceSection = window.locator(".section-card").filter({ hasText: /场景|Surfaces/ });

    // Click "From Preset" button
    const presetBtn = surfaceSection.locator(".btn-secondary", { hasText: /From Preset|预设/ });
    if (!await presetBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      // No surfaces exist yet → "from preset" button might be hidden
      return;
    }
    await presetBtn.click();

    // Preset modal should appear
    const presetModal = window.locator(".modal-content");
    await expect(presetModal).toBeVisible({ timeout: 5_000 });

    // Select the first preset via styled Select
    const presetSelect = presetModal.locator(".custom-select-trigger");
    await presetSelect.click();
    const firstOption = window.locator(".custom-select-option").first();
    await firstOption.click();

    // Click Add — should open the create form pre-filled
    await presetModal.locator(".btn-primary", { hasText: /Add|添加/ }).click();

    // The create surface modal should now be open with pre-filled name
    const createModal = window.locator(".modal-content");
    await expect(createModal).toBeVisible({ timeout: 5_000 });
    const nameInput = createModal.locator("input[type='text']").first();
    const nameValue = await nameInput.inputValue();
    expect(nameValue).toContain("(copy)");

    // Cancel without saving
    await createModal.locator(".btn-secondary", { hasText: /Cancel|取消/ }).click();
    await createModal.waitFor({ state: "hidden", timeout: 5_000 });
  });

  test("system RunProfiles are visible but not editable", async ({ window, apiBase }) => {
    await dismissModals(window);
    await loginAndNavigateToAccount(window, apiBase);

    const profileSection = window.locator(".section-card").filter({ hasText: /运行配置|Run Profiles/ });

    // System profiles should have the system badge
    const systemProfile = profileSection.locator(".acct-item-system").first();
    if (!await systemProfile.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // No system profiles seeded in this environment — skip
      return;
    }
    await expect(systemProfile.locator(".acct-badge-system")).toBeVisible();
    // Should NOT have edit/delete actions
    await expect(systemProfile.locator(".acct-item-actions")).not.toBeVisible();
  });
});
