// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

describe("ChatGatewayController run profile selection", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("waits for a pending runProfile write before dispatching chat.send", async () => {
    let resolveRunProfile!: () => void;
    const setRunProfileForScope = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        resolveRunProfile = resolve;
      }),
    );
    const trackEvent = vi.fn();

    vi.doMock("../../src/api/tool-registry.js", () => ({
      setRunProfileForScope,
    }));
    vi.doMock("../../src/api/index.js", () => ({
      fetchGatewayInfo: vi.fn(),
      trackEvent,
    }));

    const [{ ChatGatewayController }, { createChatStore }] = await Promise.all([
      import("../../src/pages/chat/controllers/ChatGatewayController.js"),
      import("../../src/pages/chat/store/chat-store.js"),
    ]);

    const store = createChatStore();
    store.setConnectionState("connected");
    const controller = new ChatGatewayController(store);
    const request = vi.fn().mockResolvedValue({});
    (controller as any).client = { request };

    const sessionKey = store.activeSessionKey;
    void controller.pushRunProfileToScope("profile-alt", sessionKey, [{ id: "profile-alt" }]);
    controller.sendMessage("hello", "", { providerKeys: [{ id: "key-1" }] });

    await Promise.resolve();
    expect(setRunProfileForScope).toHaveBeenCalledWith(sessionKey, "profile-alt");
    expect(request).not.toHaveBeenCalledWith(
      "chat.send",
      expect.objectContaining({ sessionKey }),
      300_000,
    );

    resolveRunProfile();

    await vi.waitFor(() => {
      expect(request).toHaveBeenCalledWith(
        "chat.send",
        expect.objectContaining({ sessionKey, message: "hello" }),
        300_000,
      );
    });
  });
});
