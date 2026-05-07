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
    onRecipientSeen: vi.fn().mockReturnValue({ inserted: true, membershipChanged: false }),
  } as unknown as GatewayEventDispatcherDeps & {
    broadcastEvent: ReturnType<typeof vi.fn>;
    chatSessions: { getByKey: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> };
    onRecipientSeen: ReturnType<typeof vi.fn>;
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

  // ── plugin.rivonclaw.chat-mirror ────────────────────────────────────────

  describe("plugin.rivonclaw.chat-mirror", () => {
    it("forwards payload to SSE as chat-mirror", () => {
      const payload = {
        runId: "run-1",
        sessionKey: "sk-1",
        stream: "assistant",
        data: { text: "hello" },
        seq: 42,
      };
      dispatch(makeEvent("plugin.rivonclaw.chat-mirror", payload));
      expect(deps.broadcastEvent).toHaveBeenCalledWith("chat-mirror", payload);
    });

    it("keeps legacy rivonclaw.chat-mirror compatible", () => {
      const payload = {
        runId: "run-legacy",
        sessionKey: "sk-legacy",
        stream: "assistant",
        data: { text: "legacy" },
      };
      dispatch(makeEvent("rivonclaw.chat-mirror", payload));
      expect(deps.broadcastEvent).toHaveBeenCalledWith("chat-mirror", payload);
    });
  });

  // ── plugin.rivonclaw.channel-inbound ────────────────────────────────────

  describe("plugin.rivonclaw.channel-inbound", () => {
    it("pushes SSE inbound with runId, sessionKey, channel, message, timestamp", () => {
      deps.chatSessions.getByKey.mockReturnValue({ archivedAt: null });

      dispatch(makeEvent("plugin.rivonclaw.channel-inbound", {
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

    it("keeps legacy rivonclaw.channel-inbound compatible", () => {
      deps.chatSessions.getByKey.mockReturnValue(undefined);

      dispatch(makeEvent("rivonclaw.channel-inbound", {
        sessionKey: "sk-legacy",
        message: "Legacy",
        channel: "telegram",
      }));

      expect(deps.chatSessions.upsert).toHaveBeenCalledWith("sk-legacy", { archivedAt: null });
      expect(deps.broadcastEvent).toHaveBeenCalledWith("inbound", expect.objectContaining({
        sessionKey: "sk-legacy",
        channel: "telegram",
      }));
    });

    it("does NOT write when session is already active", () => {
      deps.chatSessions.getByKey.mockReturnValue({ archivedAt: null });

      dispatch(makeEvent("plugin.rivonclaw.channel-inbound", {
        sessionKey: "sk-active",
        message: "Hello",
        channel: "web",
      }));

      expect(deps.chatSessions.upsert).not.toHaveBeenCalled();
    });

    it("creates local chat session metadata when session is new", () => {
      deps.chatSessions.getByKey.mockReturnValue(undefined);

      dispatch(makeEvent("plugin.rivonclaw.channel-inbound", {
        sessionKey: "sk-new",
        message: "Hello",
        channel: "telegram",
      }));

      expect(deps.chatSessions.upsert).toHaveBeenCalledWith("sk-new", { archivedAt: null });
      expect(deps.broadcastEvent).toHaveBeenCalledWith("inbound", expect.objectContaining({
        sessionKey: "sk-new",
        channel: "telegram",
      }));
    });

    it("defaults channel to 'unknown' when not provided", () => {
      deps.chatSessions.getByKey.mockReturnValue(undefined);

      dispatch(makeEvent("plugin.rivonclaw.channel-inbound", {
        sessionKey: "sk-1",
        message: "test",
      }));

      expect(deps.broadcastEvent).toHaveBeenCalledWith("inbound", expect.objectContaining({
        channel: "unknown",
      }));
      expect(deps.chatSessions.upsert).toHaveBeenCalledWith("sk-1", { archivedAt: null });
    });

    it("does NOT push SSE when sessionKey is missing", () => {
      dispatch(makeEvent("plugin.rivonclaw.channel-inbound", { message: "orphan" }));
      expect(deps.broadcastEvent).not.toHaveBeenCalled();
    });

    it("does NOT push SSE when message is missing", () => {
      dispatch(makeEvent("plugin.rivonclaw.channel-inbound", { sessionKey: "sk-1" }));
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

  // ── plugin.rivonclaw.recipient-seen ───────────────────────────────────

  describe("plugin.rivonclaw.recipient-seen", () => {
    it("delegates a new recipient to the domain action and emits recipient-added SSE", () => {
      deps.onRecipientSeen.mockReturnValue({ inserted: true, membershipChanged: false });

      dispatch(makeEvent("plugin.rivonclaw.recipient-seen", {
        channelId: "openclaw-weixin",
        accountId: "acct-1",
        recipientId: "wxid_abc",
      }));

      expect(deps.onRecipientSeen).toHaveBeenCalledWith({
        channelId: "openclaw-weixin",
        accountId: "acct-1",
        recipientId: "wxid_abc",
      });
      expect(deps.broadcastEvent).toHaveBeenCalledWith("recipient-added", {
        channelId: "openclaw-weixin",
        accountId: "acct-1",
        recipientId: "wxid_abc",
      });
    });

    it("does NOT emit SSE when the recipient already exists and membership did not change", () => {
      deps.onRecipientSeen.mockReturnValue({ inserted: false, membershipChanged: false });

      dispatch(makeEvent("plugin.rivonclaw.recipient-seen", {
        channelId: "openclaw-weixin",
        recipientId: "wxid_abc",
      }));

      expect(deps.onRecipientSeen).toHaveBeenCalled();
      expect(deps.broadcastEvent).not.toHaveBeenCalled();
    });

    it("emits SSE when account-scoped membership is newly persisted", () => {
      deps.onRecipientSeen.mockReturnValue({ inserted: false, membershipChanged: true });

      dispatch(makeEvent("plugin.rivonclaw.recipient-seen", {
        channelId: "openclaw-weixin",
        accountId: "acct-2",
        recipientId: "wxid_abc",
      }));

      expect(deps.broadcastEvent).toHaveBeenCalledWith("recipient-added", {
        channelId: "openclaw-weixin",
        accountId: "acct-2",
        recipientId: "wxid_abc",
      });
    });

    it("passes non-WeChat recipient events to the domain action", () => {
      dispatch(makeEvent("plugin.rivonclaw.recipient-seen", {
        channelId: "telegram",
        recipientId: "123",
      }));

      expect(deps.onRecipientSeen).toHaveBeenCalledWith({
        channelId: "telegram",
        accountId: undefined,
        recipientId: "123",
      });
    });

    it("accepts the legacy non-plugin event name", () => {
      deps.onRecipientSeen.mockReturnValue({ inserted: true, membershipChanged: false });

      dispatch(makeEvent("rivonclaw.recipient-seen", {
        channelId: "openclaw-weixin",
        accountId: "acct-legacy",
        recipientId: "wxid_legacy",
      }));

      expect(deps.onRecipientSeen).toHaveBeenCalledWith({
        channelId: "openclaw-weixin",
        accountId: "acct-legacy",
        recipientId: "wxid_legacy",
      });
    });

    it("does nothing when channelId is missing", () => {
      dispatch(makeEvent("plugin.rivonclaw.recipient-seen", { recipientId: "abc" }));
      expect(deps.onRecipientSeen).not.toHaveBeenCalled();
      expect(deps.broadcastEvent).not.toHaveBeenCalled();
    });

    it("does nothing when recipientId is missing", () => {
      dispatch(makeEvent("plugin.rivonclaw.recipient-seen", { channelId: "telegram" }));
      expect(deps.onRecipientSeen).not.toHaveBeenCalled();
      expect(deps.broadcastEvent).not.toHaveBeenCalled();
    });

    it("does nothing when payload is undefined", () => {
      dispatch(makeEvent("plugin.rivonclaw.recipient-seen"));
      expect(deps.onRecipientSeen).not.toHaveBeenCalled();
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
