import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGatewayEventDispatcher, type GatewayEventDispatcherDeps } from "../event-dispatcher.js";
import type { GatewayEventFrame } from "@rivonclaw/gateway";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("node:crypto", () => ({
  randomUUID: () => "test-uuid-1234",
}));

// ─── Test Helpers ───────────────────────────────────────────────────────────

function createDeps() {
  return {
    broadcastEvent: vi.fn(),
    chatSessions: {
      getByKey: vi.fn(),
      upsert: vi.fn(),
    },
    storage: {
      channelRecipients: {
        ensureExists: vi.fn().mockReturnValue(true),
      },
    },
    onOwnerAdded: vi.fn(),
  } as unknown as GatewayEventDispatcherDeps & {
    broadcastEvent: ReturnType<typeof vi.fn>;
    chatSessions: { getByKey: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> };
    storage: {
      channelRecipients: {
        ensureExists: ReturnType<typeof vi.fn>;
      };
    };
    onOwnerAdded: ReturnType<typeof vi.fn>;
  };
}

function makeEvent(event: string, payload?: unknown): GatewayEventFrame {
  return { type: "event", event, payload };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("createGatewayEventDispatcher", () => {
  let deps: ReturnType<typeof createDeps>;
  let dispatch: ReturnType<typeof createGatewayEventDispatcher>;

  beforeEach(() => {
    deps = createDeps();
    dispatch = createGatewayEventDispatcher(deps);
  });

  // ── mobile.session-reset ────────────────────────────────────────────────

  describe("mobile.session-reset", () => {
    it("pushes SSE when sessionKey is present", () => {
      dispatch(makeEvent("mobile.session-reset", { sessionKey: "sk-123" }));
      expect(deps.broadcastEvent).toHaveBeenCalledWith("session-reset", { sessionKey: "sk-123" });
    });

    it("does NOT push SSE when sessionKey is missing", () => {
      dispatch(makeEvent("mobile.session-reset", {}));
      expect(deps.broadcastEvent).not.toHaveBeenCalled();
    });

    it("does NOT push SSE when payload is undefined", () => {
      dispatch(makeEvent("mobile.session-reset"));
      expect(deps.broadcastEvent).not.toHaveBeenCalled();
    });
  });

  // ── rivonclaw.chat-mirror ───────────────────────────────────────────────

  describe("rivonclaw.chat-mirror", () => {
    it("forwards payload to SSE as chat-mirror", () => {
      const payload = {
        runId: "run-1",
        sessionKey: "sk-1",
        stream: "assistant",
        data: { text: "hello" },
        seq: 42,
      };
      dispatch(makeEvent("rivonclaw.chat-mirror", payload));
      expect(deps.broadcastEvent).toHaveBeenCalledWith("chat-mirror", payload);
    });
  });

  // ── rivonclaw.channel-inbound ───────────────────────────────────────────

  describe("rivonclaw.channel-inbound", () => {
    it("pushes SSE inbound with runId, sessionKey, channel, message, timestamp", () => {
      deps.chatSessions.getByKey.mockReturnValue({ archivedAt: null });

      dispatch(makeEvent("rivonclaw.channel-inbound", {
        sessionKey: "sk-abc",
        message: "Hi there",
        timestamp: 1700000000,
        channel: "whatsapp",
      }));

      expect(deps.broadcastEvent).toHaveBeenCalledWith("inbound", {
        runId: "test-uuid-1234",
        sessionKey: "sk-abc",
        channel: "whatsapp",
        message: "Hi there",
        timestamp: 1700000000,
      });
    });

    it("auto-unarchives session when archivedAt is set", () => {
      deps.chatSessions.getByKey.mockReturnValue({ archivedAt: 1699999999 });

      dispatch(makeEvent("rivonclaw.channel-inbound", {
        sessionKey: "sk-archived",
        message: "Wake up",
        channel: "telegram",
      }));

      expect(deps.chatSessions.upsert).toHaveBeenCalledWith("sk-archived", { archivedAt: null });
      expect(deps.broadcastEvent).toHaveBeenCalled();
    });

    it("does NOT unarchive when session is not archived", () => {
      deps.chatSessions.getByKey.mockReturnValue({ archivedAt: null });

      dispatch(makeEvent("rivonclaw.channel-inbound", {
        sessionKey: "sk-active",
        message: "Hello",
        channel: "web",
      }));

      expect(deps.chatSessions.upsert).not.toHaveBeenCalled();
    });

    it("defaults channel to 'unknown' when not provided", () => {
      deps.chatSessions.getByKey.mockReturnValue(undefined);

      dispatch(makeEvent("rivonclaw.channel-inbound", {
        sessionKey: "sk-1",
        message: "test",
      }));

      expect(deps.broadcastEvent).toHaveBeenCalledWith("inbound", expect.objectContaining({
        channel: "unknown",
      }));
    });

    it("does NOT push SSE when sessionKey is missing", () => {
      dispatch(makeEvent("rivonclaw.channel-inbound", { message: "orphan" }));
      expect(deps.broadcastEvent).not.toHaveBeenCalled();
    });

    it("does NOT push SSE when message is missing", () => {
      dispatch(makeEvent("rivonclaw.channel-inbound", { sessionKey: "sk-1" }));
      expect(deps.broadcastEvent).not.toHaveBeenCalled();
    });
  });

  // ── mobile.inbound ─────────────────────────────────────────────────────

  describe("mobile.inbound", () => {
    it("pushes SSE with converted media URLs", () => {
      deps.chatSessions.getByKey.mockReturnValue({ archivedAt: null });

      dispatch(makeEvent("mobile.inbound", {
        sessionKey: "sk-mob",
        message: "Photo",
        timestamp: 1700000000,
        channel: "mobile",
        mediaPaths: [
          "/home/user/.local/share/openclaw/media/images/photo.jpg",
          "/var/data/openclaw/media/voice/msg.ogg",
        ],
      }));

      expect(deps.broadcastEvent).toHaveBeenCalledWith("inbound", {
        runId: "test-uuid-1234",
        sessionKey: "sk-mob",
        channel: "mobile",
        message: "Photo",
        timestamp: 1700000000,
        mediaUrls: [
          "/api/media/images/photo.jpg",
          "/api/media/voice/msg.ogg",
        ],
      });
    });

    it("omits mediaUrls when no media paths provided", () => {
      deps.chatSessions.getByKey.mockReturnValue({ archivedAt: null });

      dispatch(makeEvent("mobile.inbound", {
        sessionKey: "sk-mob",
        message: "Text only",
        timestamp: 1700000000,
      }));

      const call = deps.broadcastEvent.mock.calls[0]!;
      expect(call[1]).not.toHaveProperty("mediaUrls");
    });

    it("omits mediaUrls when mediaPaths is empty array", () => {
      deps.chatSessions.getByKey.mockReturnValue({ archivedAt: null });

      dispatch(makeEvent("mobile.inbound", {
        sessionKey: "sk-mob",
        message: "Nothing",
        mediaPaths: [],
      }));

      const call = deps.broadcastEvent.mock.calls[0]!;
      expect(call[1]).not.toHaveProperty("mediaUrls");
    });

    it("auto-unarchives session when archivedAt is set", () => {
      deps.chatSessions.getByKey.mockReturnValue({ archivedAt: 1699999999 });

      dispatch(makeEvent("mobile.inbound", {
        sessionKey: "sk-archived-mob",
        message: "Back",
        channel: "mobile",
      }));

      expect(deps.chatSessions.upsert).toHaveBeenCalledWith("sk-archived-mob", { archivedAt: null });
    });

    it("defaults channel to 'mobile' when not provided", () => {
      deps.chatSessions.getByKey.mockReturnValue(undefined);

      dispatch(makeEvent("mobile.inbound", {
        sessionKey: "sk-mob",
        message: "test",
      }));

      expect(deps.broadcastEvent).toHaveBeenCalledWith("inbound", expect.objectContaining({
        channel: "mobile",
      }));
    });

    it("does NOT push SSE when sessionKey is missing", () => {
      dispatch(makeEvent("mobile.inbound", { message: "orphan" }));
      expect(deps.broadcastEvent).not.toHaveBeenCalled();
    });

    it("does NOT push SSE when message is missing", () => {
      dispatch(makeEvent("mobile.inbound", { sessionKey: "sk-1" }));
      expect(deps.broadcastEvent).not.toHaveBeenCalled();
    });

    it("skips media paths that do not contain the marker segment", () => {
      deps.chatSessions.getByKey.mockReturnValue({ archivedAt: null });

      dispatch(makeEvent("mobile.inbound", {
        sessionKey: "sk-mob",
        message: "Mixed",
        mediaPaths: [
          "/tmp/random/file.jpg",
          "/home/user/.local/share/openclaw/media/img.png",
        ],
      }));

      expect(deps.broadcastEvent).toHaveBeenCalledWith("inbound", expect.objectContaining({
        mediaUrls: ["/api/media/img.png"],
      }));
    });
  });

  // ── rivonclaw.recipient-seen ───────────────────────────────────────────

  describe("rivonclaw.recipient-seen", () => {
    it("persists a new recipient as owner, fires onOwnerAdded, and emits recipient-added SSE", () => {
      deps.storage.channelRecipients.ensureExists.mockReturnValue(true);

      dispatch(makeEvent("rivonclaw.recipient-seen", {
        channelId: "openclaw-weixin",
        recipientId: "wxid_abc",
      }));

      expect(deps.storage.channelRecipients.ensureExists).toHaveBeenCalledWith(
        "openclaw-weixin",
        "wxid_abc",
        true,
      );
      expect(deps.onOwnerAdded).toHaveBeenCalledWith("openclaw-weixin", "wxid_abc");
      expect(deps.broadcastEvent).toHaveBeenCalledWith("recipient-added", {
        channelId: "openclaw-weixin",
        recipientId: "wxid_abc",
      });
    });

    it("does NOT emit SSE or fire onOwnerAdded when the recipient already exists", () => {
      deps.storage.channelRecipients.ensureExists.mockReturnValue(false);

      dispatch(makeEvent("rivonclaw.recipient-seen", {
        channelId: "openclaw-weixin",
        recipientId: "wxid_abc",
      }));

      expect(deps.storage.channelRecipients.ensureExists).toHaveBeenCalled();
      expect(deps.onOwnerAdded).not.toHaveBeenCalled();
      expect(deps.broadcastEvent).not.toHaveBeenCalled();
    });

    it("always passes isOwner=true (every new recipient is provisioned as owner)", () => {
      deps.storage.channelRecipients.ensureExists.mockReturnValue(true);

      dispatch(makeEvent("rivonclaw.recipient-seen", {
        channelId: "telegram",
        recipientId: "123",
      }));

      expect(deps.storage.channelRecipients.ensureExists).toHaveBeenCalledWith(
        "telegram",
        "123",
        true,
      );
      expect(deps.onOwnerAdded).toHaveBeenCalledWith("telegram", "123");
    });

    it("does nothing when channelId is missing", () => {
      dispatch(makeEvent("rivonclaw.recipient-seen", { recipientId: "abc" }));
      expect(deps.storage.channelRecipients.ensureExists).not.toHaveBeenCalled();
      expect(deps.onOwnerAdded).not.toHaveBeenCalled();
      expect(deps.broadcastEvent).not.toHaveBeenCalled();
    });

    it("does nothing when recipientId is missing", () => {
      dispatch(makeEvent("rivonclaw.recipient-seen", { channelId: "telegram" }));
      expect(deps.storage.channelRecipients.ensureExists).not.toHaveBeenCalled();
      expect(deps.onOwnerAdded).not.toHaveBeenCalled();
      expect(deps.broadcastEvent).not.toHaveBeenCalled();
    });

    it("does nothing when payload is undefined", () => {
      dispatch(makeEvent("rivonclaw.recipient-seen"));
      expect(deps.storage.channelRecipients.ensureExists).not.toHaveBeenCalled();
      expect(deps.onOwnerAdded).not.toHaveBeenCalled();
      expect(deps.broadcastEvent).not.toHaveBeenCalled();
    });
  });

  // ── Unknown events ─────────────────────────────────────────────────────

  describe("unknown events", () => {
    it("does not call broadcastEvent for unrecognized event types", () => {
      dispatch(makeEvent("some.unknown.event", { data: "ignored" }));
      expect(deps.broadcastEvent).not.toHaveBeenCalled();
      expect(deps.chatSessions.getByKey).not.toHaveBeenCalled();
      expect(deps.chatSessions.upsert).not.toHaveBeenCalled();
    });
  });
});
