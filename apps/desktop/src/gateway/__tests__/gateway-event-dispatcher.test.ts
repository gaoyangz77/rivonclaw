import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGatewayEventDispatcher, type GatewayEventDispatcherDeps } from "../gateway-event-dispatcher.js";
import type { GatewayEventFrame } from "@rivonclaw/gateway";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("node:crypto", () => ({
  randomUUID: () => "test-uuid-1234",
}));

// ─── Test Helpers ───────────────────────────────────────────────────────────

function createDeps() {
  return {
    pushChatSSE: vi.fn(),
    chatSessions: {
      getByKey: vi.fn(),
      upsert: vi.fn(),
    },
  } as unknown as GatewayEventDispatcherDeps & {
    pushChatSSE: ReturnType<typeof vi.fn>;
    chatSessions: { getByKey: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> };
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
      expect(deps.pushChatSSE).toHaveBeenCalledWith("session-reset", { sessionKey: "sk-123" });
    });

    it("does NOT push SSE when sessionKey is missing", () => {
      dispatch(makeEvent("mobile.session-reset", {}));
      expect(deps.pushChatSSE).not.toHaveBeenCalled();
    });

    it("does NOT push SSE when payload is undefined", () => {
      dispatch(makeEvent("mobile.session-reset"));
      expect(deps.pushChatSSE).not.toHaveBeenCalled();
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
      expect(deps.pushChatSSE).toHaveBeenCalledWith("chat-mirror", payload);
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

      expect(deps.pushChatSSE).toHaveBeenCalledWith("inbound", {
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
      expect(deps.pushChatSSE).toHaveBeenCalled();
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

      expect(deps.pushChatSSE).toHaveBeenCalledWith("inbound", expect.objectContaining({
        channel: "unknown",
      }));
    });

    it("does NOT push SSE when sessionKey is missing", () => {
      dispatch(makeEvent("rivonclaw.channel-inbound", { message: "orphan" }));
      expect(deps.pushChatSSE).not.toHaveBeenCalled();
    });

    it("does NOT push SSE when message is missing", () => {
      dispatch(makeEvent("rivonclaw.channel-inbound", { sessionKey: "sk-1" }));
      expect(deps.pushChatSSE).not.toHaveBeenCalled();
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

      expect(deps.pushChatSSE).toHaveBeenCalledWith("inbound", {
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

      const call = deps.pushChatSSE.mock.calls[0]!;
      expect(call[1]).not.toHaveProperty("mediaUrls");
    });

    it("omits mediaUrls when mediaPaths is empty array", () => {
      deps.chatSessions.getByKey.mockReturnValue({ archivedAt: null });

      dispatch(makeEvent("mobile.inbound", {
        sessionKey: "sk-mob",
        message: "Nothing",
        mediaPaths: [],
      }));

      const call = deps.pushChatSSE.mock.calls[0]!;
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

      expect(deps.pushChatSSE).toHaveBeenCalledWith("inbound", expect.objectContaining({
        channel: "mobile",
      }));
    });

    it("does NOT push SSE when sessionKey is missing", () => {
      dispatch(makeEvent("mobile.inbound", { message: "orphan" }));
      expect(deps.pushChatSSE).not.toHaveBeenCalled();
    });

    it("does NOT push SSE when message is missing", () => {
      dispatch(makeEvent("mobile.inbound", { sessionKey: "sk-1" }));
      expect(deps.pushChatSSE).not.toHaveBeenCalled();
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

      expect(deps.pushChatSSE).toHaveBeenCalledWith("inbound", expect.objectContaining({
        mediaUrls: ["/api/media/img.png"],
      }));
    });
  });

  // ── Unknown events ─────────────────────────────────────────────────────

  describe("unknown events", () => {
    it("does not call pushChatSSE for unrecognized event types", () => {
      dispatch(makeEvent("some.unknown.event", { data: "ignored" }));
      expect(deps.pushChatSSE).not.toHaveBeenCalled();
      expect(deps.chatSessions.getByKey).not.toHaveBeenCalled();
      expect(deps.chatSessions.upsert).not.toHaveBeenCalled();
    });
  });
});
