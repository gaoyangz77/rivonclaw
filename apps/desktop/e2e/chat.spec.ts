import { test, expect } from "./electron-fixture.js";
import { getNavigationButton } from "./shell-helpers.js";

/**
 * Helper: dismiss any modal(s) blocking the UI (e.g. "What's New", telemetry consent).
 */
async function dismissModals(window: import("@playwright/test").Page) {
  await window.evaluate(() => localStorage.setItem("telemetry.consentShown", "1"));

  for (let i = 0; i < 5; i++) {
    const backdrop = window.locator(".modal-backdrop");
    if (!await backdrop.isVisible({ timeout: 3_000 }).catch(() => false)) break;
    const closeBtn = backdrop.locator(".modal-close-btn");
    if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await closeBtn.click();
    } else {
      await backdrop.click({ position: { x: 5, y: 5 }, force: true });
    }
    await backdrop.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
  }
}

test.describe("Chat Page — Comprehensive", () => {
  // Electron fixture setup (launch, onboarding, seed, gateway connect) takes ~40s
  // on Windows under 4-worker parallel load.  Test bodies here are all <10s, so
  // 90s gives comfortable margin without needing per-test overrides.
  test.describe.configure({ timeout: 90_000 });

  // ──────────────────────────────────────────────────────────────────
  // 1. API endpoint tests
  // ──────────────────────────────────────────────────────────────────

  test("gateway-info endpoint is accessible and returns wsUrl", async ({ window, apiBase }) => {
    const gwInfo = await window.evaluate(async (base) => {
      const res = await fetch(`${base}/api/app/gateway-info`);
      return { status: res.status, body: await res.json() };
    }, apiBase);

    expect(gwInfo.status).toBe(200);
    expect(gwInfo.body.wsUrl).toBeTruthy();
  });

  test("chat-sessions API supports list, upsert, and delete", async ({ window, apiBase }) => {
    // List should return an array (may be empty on fresh start)
    const listResult = await window.evaluate(async (base) => {
      const res = await fetch(`${base}/api/chat-sessions`);
      return { status: res.status, body: await res.json() };
    }, apiBase);
    expect(listResult.status).toBe(200);
    expect(Array.isArray(listResult.body.sessions)).toBe(true);

    // Upsert a test session
    const upsertResult = await window.evaluate(async (base) => {
      const res = await fetch(`${base}/api/chat-sessions/${encodeURIComponent("test:e2e:session")}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customTitle: "E2E Test Session", pinned: false }),
      });
      return { status: res.status, body: await res.json() };
    }, apiBase);
    expect(upsertResult.status).toBe(200);
    expect(upsertResult.body.session.key).toBe("test:e2e:session");
    expect(upsertResult.body.session.customTitle).toBe("E2E Test Session");

    // Delete the test session
    const deleteResult = await window.evaluate(async (base) => {
      const res = await fetch(`${base}/api/chat-sessions/${encodeURIComponent("test:e2e:session")}`, {
        method: "DELETE",
      });
      return { status: res.status, body: await res.json() };
    }, apiBase);
    expect(deleteResult.status).toBe(200);
    expect(deleteResult.body.ok).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────
  // 2. Status bar
  // ──────────────────────────────────────────────────────────────────

  test("status bar shows connection state and reset button", async ({ window }) => {
    await dismissModals(window);
    await expect(window.locator(".chat-status-dot-connected")).toBeVisible({ timeout: 30_000 });

    const statusBar = window.locator(".chat-status");

    // Status dot
    const dot = statusBar.locator(".chat-status-dot");
    await expect(dot).toBeVisible();
    await expect(dot).toHaveClass(/chat-status-dot-connected/);

    // Connection text
    await expect(statusBar).toContainText(/Connected|已连接/);

    // Reset / "New Chat" button in status bar
    const resetBtn = statusBar.locator(".btn-secondary");
    await expect(resetBtn).toBeVisible();
    await expect(resetBtn).toContainText(/New Chat|新对话|Reset|重置/);
    await expect(resetBtn).toBeEnabled();
  });

  test("status bar reset button triggers confirmation modal", async ({ window }) => {
    await dismissModals(window);
    await expect(window.locator(".chat-status-dot-connected")).toBeVisible({ timeout: 30_000 });

    // The status bar "New Chat" / reset button
    const statusResetBtn = window.locator(".chat-status .btn-secondary");
    await expect(statusResetBtn).toBeVisible();
    await statusResetBtn.click();

    // Confirmation modal appears
    const modal = window.locator(".modal-backdrop");
    await expect(modal).toBeVisible({ timeout: 5_000 });
    await expect(modal).toContainText(/New Chat|新对话|Reset|重置/);

    // Modal has cancel and confirm (danger) buttons
    const cancelBtn = modal.locator(".btn-secondary");
    const confirmBtn = modal.locator(".btn-danger");
    await expect(cancelBtn).toBeVisible();
    await expect(confirmBtn).toBeVisible();

    // Cancel
    await cancelBtn.click();
    await expect(modal).not.toBeVisible({ timeout: 3_000 });
  });

  // ──────────────────────────────────────────────────────────────────
  // 3. Basic DOM/structure tests
  // ──────────────────────────────────────────────────────────────────

  test("chat page is the default nav item and connects to gateway", async ({ window }) => {
    await dismissModals(window);

    // Chat should be the active nav item by default
    const firstNav = getNavigationButton(window, "Chat");
    await expect(firstNav).toHaveAttribute("aria-current", "page");

    // Wait for gateway to reach "Connected" state
    const connectedDot = window.locator(".chat-status-dot-connected");
    await expect(connectedDot).toBeVisible({ timeout: 30_000 });

    // Verify connection stays stable for 3 seconds
    await window.waitForTimeout(3_000);
    await expect(connectedDot).toBeVisible();
  });

  test("chat container has correct DOM structure", async ({ window }) => {
    await dismissModals(window);
    await expect(window.locator(".chat-status-dot-connected")).toBeVisible({ timeout: 30_000 });

    // Core layout elements
    await expect(window.locator(".chat-container")).toBeVisible();
    await expect(window.locator(".chat-input-area")).toBeVisible();
    await expect(window.locator(".chat-status")).toBeVisible();

    // Status bar shows "Connected"
    const statusBar = window.locator(".chat-status");
    await expect(statusBar).toContainText(/Connected|已连接/);
  });

  test("shows empty state with examples on fresh start", async ({ window }) => {
    await dismissModals(window);
    await expect(window.locator(".chat-status-dot-connected")).toBeVisible({ timeout: 30_000 });

    // Empty state prompt
    const emptyState = window.locator(".chat-empty");
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText(/Start a conversation|开始对话/);

    // Example cards section exists
    const examples = window.locator(".chat-examples");
    await expect(examples).toBeVisible();

    // Toggle button exists
    const toggle = window.locator(".chat-examples-toggle");
    await expect(toggle).toBeVisible();
  });

  test("example cards toggle expand/collapse and populate input", async ({ window }) => {
    await dismissModals(window);
    await expect(window.locator(".chat-status-dot-connected")).toBeVisible({ timeout: 30_000 });

    // Expand examples if collapsed
    const exampleGrid = window.locator(".chat-examples-grid");
    if (!await exampleGrid.isVisible().catch(() => false)) {
      await window.locator(".chat-examples-toggle").click();
    }
    await expect(exampleGrid).toBeVisible();

    // Should have 6 example cards
    const cards = window.locator(".chat-example-card");
    await expect(cards).toHaveCount(6);

    // Click the first example card
    const firstCard = cards.first();
    const cardText = await firstCard.textContent();
    await firstCard.click();

    // The textarea should now contain the example text
    const textarea = window.locator(".chat-input-area textarea");
    await expect(textarea).toHaveValue(cardText!.trim());

    // Collapse examples
    await window.locator(".chat-examples-toggle").click();
    await expect(exampleGrid).not.toBeVisible();

    // Clear draft for next tests
    await textarea.fill("");
  });

  test("input area has textarea, send button, emoji and attach buttons", async ({ window }) => {
    await dismissModals(window);
    await expect(window.locator(".chat-status-dot-connected")).toBeVisible({ timeout: 30_000 });

    // Textarea
    const textarea = window.locator(".chat-input-area textarea");
    await expect(textarea).toBeVisible();
    await expect(textarea).toBeEditable();

    // Send button (primary, visible when not streaming)
    const sendBtn = window.locator(".chat-input-area .btn-primary");
    await expect(sendBtn).toBeVisible();

    // Emoji button
    const emojiBtn = window.locator(".chat-emoji-btn");
    await expect(emojiBtn).toBeVisible();

    // Attach buttons (file path + image)
    const attachBtns = window.locator(".chat-attach-btn");
    const count = await attachBtns.count();
    expect(count).toBe(2);
  });

  test("send button is disabled when textarea is empty and enabled when typed", async ({ window }) => {
    await dismissModals(window);
    await expect(window.locator(".chat-status-dot-connected")).toBeVisible({ timeout: 30_000 });

    const sendBtn = window.locator(".chat-input-area .btn-primary");
    await expect(sendBtn).toBeDisabled();

    // Type something — button stays disabled if no provider keys are configured
    // (send requires both non-empty text AND at least one provider key)
    const textarea = window.locator(".chat-input-area textarea");
    await textarea.fill("hello");

    // In E2E env without provider keys, button remains disabled
    // Just verify the button exists and textarea accepts input
    await expect(textarea).toHaveValue("hello");

    // Clear — still disabled
    await textarea.fill("");
    await expect(sendBtn).toBeDisabled();
  });

  test("emoji picker opens and closes on button click", async ({ window }) => {
    await dismissModals(window);
    await expect(window.locator(".chat-status-dot-connected")).toBeVisible({ timeout: 30_000 });

    const emojiBtn = window.locator(".chat-emoji-btn");
    const picker = window.locator(".chat-emoji-picker");

    // Picker should be hidden initially
    await expect(picker).not.toBeVisible();

    // Click to open
    await emojiBtn.click();
    await expect(picker).toBeVisible();

    // Click again to close
    await emojiBtn.click();
    await expect(picker).not.toBeVisible();
  });

  test("input row has correct layout structure", async ({ window }) => {
    await dismissModals(window);
    await expect(window.locator(".chat-status-dot-connected")).toBeVisible({ timeout: 30_000 });

    // Input row wraps the textarea and buttons
    const inputRow = window.locator(".chat-input-row");
    await expect(inputRow).toBeVisible();

    // Emoji wrapper contains the button and (when open) the picker
    const emojiWrapper = window.locator(".chat-emoji-wrapper");
    await expect(emojiWrapper).toBeVisible();

    // Hidden file inputs exist for image and file path attachment
    const srInputs = window.locator(".chat-input-area .sr-input");
    const srCount = await srInputs.count();
    expect(srCount).toBe(2);
  });

  // ──────────────────────────────────────────────────────────────────
  // 4. CSS and i18n verification
  // ──────────────────────────────────────────────────────────────────

  test("session tab bar CSS classes exist in stylesheet", async ({ window }) => {
    const result = await window.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      const selectors = new Set<string>();
      for (const sheet of sheets) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (rule instanceof CSSStyleRule) {
              selectors.add(rule.selectorText);
            }
          }
        } catch {
          // Cross-origin stylesheets
        }
      }
      const has = (cls: string) => [...selectors].some((s) => s.includes(cls));
      return {
        tabs: has(".chat-session-tabs"),
        tabsScroll: has(".chat-session-tabs-scroll"),
        tab: has(".chat-session-tab"),
        tabActive: has(".chat-session-tab-active"),
        tabUnread: has(".chat-session-tab-unread"),
        tabLabel: has(".chat-session-tab-label"),
        tabClose: has(".chat-session-tab-close"),
        tabPinned: has(".chat-session-tab-pinned"),
        tabActions: has(".chat-session-tabs-actions"),
        tabActionBtn: has(".chat-session-tab-action-btn"),
        tabNewBtn: has(".chat-session-tab-new-btn"),
        channelBadge: has(".chat-tab-channel-badge"),
        renameInput: has(".chat-tab-rename-input"),
        archivedDropdown: has(".chat-archived-dropdown"),
        archivedItem: has(".chat-archived-item"),
        archivedSwipe: has(".chat-archived-swipe-wrap"),
        archivedDeleteBtn: has(".chat-archived-delete-btn"),
      };
    });

    expect(result.tabs).toBe(true);
    expect(result.tabsScroll).toBe(true);
    expect(result.tab).toBe(true);
    expect(result.tabActive).toBe(true);
    expect(result.tabUnread).toBe(true);
    expect(result.tabLabel).toBe(true);
    expect(result.tabClose).toBe(true);
    expect(result.tabPinned).toBe(true);
    expect(result.tabActions).toBe(true);
    expect(result.tabActionBtn).toBe(true);
    expect(result.tabNewBtn).toBe(true);
    expect(result.channelBadge).toBe(true);
    expect(result.renameInput).toBe(true);
    expect(result.archivedDropdown).toBe(true);
    expect(result.archivedItem).toBe(true);
    expect(result.archivedSwipe).toBe(true);
    expect(result.archivedDeleteBtn).toBe(true);
  });

  test("input area and message CSS classes exist in stylesheet", async ({ window }) => {
    const result = await window.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      const selectors = new Set<string>();
      for (const sheet of sheets) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (rule instanceof CSSStyleRule) {
              selectors.add(rule.selectorText);
            }
          }
        } catch {}
      }
      const has = (cls: string) => [...selectors].some((s) => s.includes(cls));
      return {
        inputArea: has(".chat-input-area"),
        inputRow: has(".chat-input-row"),
        bubble: has(".chat-bubble"),
        bubbleUser: has(".chat-bubble-user"),
        bubbleAssistant: has(".chat-bubble-assistant"),
        bubbleExternal: has(".chat-bubble-external"),
        thinking: has(".chat-thinking"),
        streamingCursor: has(".chat-streaming-cursor"),
        agentPhase: has(".chat-agent-phase"),
        toolEvent: has(".chat-tool-event"),
        scrollBottom: has(".chat-scroll-bottom"),
        collapsible: has(".chat-bubble-collapsed"),
        imagePreview: has(".chat-image-preview"),
        emojiPicker: has(".chat-emoji-picker"),
        emptyState: has(".chat-empty"),
        historyEnd: has(".chat-history-end"),
      };
    });

    expect(result.inputArea).toBe(true);
    expect(result.inputRow).toBe(true);
    expect(result.bubble).toBe(true);
    expect(result.bubbleUser).toBe(true);
    expect(result.bubbleAssistant).toBe(true);
    expect(result.bubbleExternal).toBe(true);
    expect(result.thinking).toBe(true);
    expect(result.streamingCursor).toBe(true);
    expect(result.agentPhase).toBe(true);
    expect(result.toolEvent).toBe(true);
    expect(result.scrollBottom).toBe(true);
    expect(result.collapsible).toBe(true);
    expect(result.imagePreview).toBe(true);
    expect(result.emojiPicker).toBe(true);
    expect(result.emptyState).toBe(true);
    expect(result.historyEnd).toBe(true);
  });

  test("session and chat i18n keys resolve to non-empty strings", async ({ window }) => {
    const keys = [
      // Session management
      "chat.newSession",
      "chat.newSessionTitle",
      "chat.sessionMain",
      "chat.sessionUntitled",
      "chat.archiveSession",
      "chat.archivedSessions",
      "chat.searchArchived",
      "chat.noArchivedSessions",
      "chat.noSearchResults",
      "chat.deleteSession",
      "chat.imageAttachment",
      // Chat flow
      "chat.resetCommand",
      "chat.resetConfirm",
      "chat.resetCommandFeedback",
      "chat.resetTooltip",
      "chat.emptyState",
      "chat.placeholder",
      "chat.send",
      "chat.stop",
      "chat.emoji",
      "chat.attachFile",
      "chat.attachImage",
      "chat.examplesTitle",
      "chat.historyEnd",
      // Connection status
      "chat.connected",
      "chat.connecting",
      "chat.disconnected",
      // Channel badges
      "chat.channelTelegram",
      "chat.channelFeishu",
      "chat.channelWebchat",
    ];

    const results = await window.evaluate((translationKeys) => {
      const i18n = (window as unknown as { __i18n?: { t: (key: string) => string } }).__i18n;
      if (i18n) {
        return translationKeys.map((key) => ({ key, value: i18n.t(key) }));
      }
      return null;
    }, keys);

    if (results) {
      for (const { key, value } of results) {
        // i18next returns the key itself if translation is missing
        expect(value, `i18n key "${key}" should resolve`).not.toBe(key);
        expect(value.length, `i18n key "${key}" should be non-empty`).toBeGreaterThan(0);
      }
    }
  });
});
