import { afterEach, describe, expect, it, vi, type Mock } from "vitest";

import eventBridgePlugin, {
  createRunSessionTracker,
  shouldMirrorExternalSession,
} from "./index.js";

const gatewayStopHandlers: Array<() => void> = [];

function activateEventBridge() {
  let initGateway: ((args: unknown) => void) | undefined;
  let agentEventHandler: ((event: unknown) => void) | undefined;
  const registeredHooks: string[] = [];
  const hookHandlers = new Map<string, Array<(...args: unknown[]) => void>>();
  const api = {
    id: "rivonclaw-event-bridge",
    logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      registeredHooks.push(event);
      const handlers = hookHandlers.get(event) ?? [];
      handlers.push(handler);
      hookHandlers.set(event, handlers);
      if (event === "gateway_stop") gatewayStopHandlers.push(handler as () => void);
    }),
    registerGatewayMethod: vi.fn((name: string, handler: (args: unknown) => void) => {
      if (name === "event_bridge_init") initGateway = handler;
    }),
    registerInteractiveHandler: vi.fn(),
    runtime: {
      events: {
        onAgentEvent: vi.fn((handler: (event: unknown) => void) => {
          agentEventHandler = handler;
          return vi.fn();
        }),
      },
    },
  };
  eventBridgePlugin.activate(api as never);
  return {
    registerInteractiveHandler: api.registerInteractiveHandler,
    logger: api.logger,
    registeredHooks,
    captureBroadcast: (broadcast: (event: string, payload: unknown) => void) =>
      initGateway?.({ respond: vi.fn(), context: { broadcast } }),
    emitHook: (event: string, ...args: unknown[]) => {
      for (const handler of hookHandlers.get(event) ?? []) handler(...args);
    },
    emitAgentEvent: (event: unknown) => agentEventHandler?.(event),
  };
}

afterEach(() => {
  for (const handler of gatewayStopHandlers.splice(0)) handler();
});

describe("OpenClaw lifecycle compatibility", () => {
  it("uses the current before_agent_run hook", () => {
    const activated = activateEventBridge();

    expect(activated.registeredHooks).toContain("before_agent_run");
    expect(activated.registeredHooks).not.toContain("before_agent_start");
  });

  it("does not register a Feishu business callback handler", () => {
    const activated = activateEventBridge();
    expect(activated.registerInteractiveHandler).not.toHaveBeenCalled();
  });
});

describe("createRunSessionTracker", () => {
  it("cleans up only the ended run instead of every run sharing a session", () => {
    vi.useFakeTimers();
    try {
      const tracker = createRunSessionTracker(1000);

      tracker.set("old-run", "agent:main:telegram:account:direct:user");
      tracker.set("new-run", "agent:main:telegram:account:direct:user");
      tracker.scheduleCleanup("old-run");

      vi.advanceTimersByTime(1000);

      expect(tracker.get("old-run")).toBeUndefined();
      expect(tracker.get("new-run")).toBe("agent:main:telegram:account:direct:user");
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels stale cleanup when the same run is remapped", () => {
    vi.useFakeTimers();
    try {
      const tracker = createRunSessionTracker(1000);

      tracker.set("run", "session-a");
      tracker.scheduleCleanup("run");
      vi.advanceTimersByTime(500);
      tracker.set("run", "session-b");
      vi.advanceTimersByTime(500);

      expect(tracker.get("run")).toBe("session-b");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("shouldMirrorExternalSession", () => {
  it("does not mirror background affiliate sessions into webchat", () => {
    expect(shouldMirrorExternalSession("agent:affiliate:affiliate:user-1:relationship-1")).toBe(
      false,
    );
  });

  it("still mirrors real external chat channels", () => {
    expect(shouldMirrorExternalSession("agent:main:telegram:account:direct:user")).toBe(true);
  });
});

describe("agent event mirroring", () => {
  it("quietly ignores unneeded streams before a run has a session mapping", () => {
    const broadcast = vi.fn();
    const activated = activateEventBridge();
    activated.captureBroadcast(broadcast);

    activated.emitAgentEvent({
      runId: "startup-run",
      seq: 1,
      stream: "run_status",
      ts: 1,
      data: { phase: "running" },
    });

    expect(broadcast).not.toHaveBeenCalled();
    expect(activated.logger.warn).not.toHaveBeenCalled();
    expect(activated.logger.debug).toHaveBeenCalledWith(
      "[event-bridge] skip: unneeded stream=run_status runId=startup-run",
    );
  });

  it("does not mirror a mapped main-session heartbeat run", () => {
    const broadcast = vi.fn();
    const activated = activateEventBridge();
    activated.captureBroadcast(broadcast);

    activated.emitHook("llm_input", { runId: "heartbeat-run" }, { sessionKey: "agent:main:main" });
    activated.emitAgentEvent({
      runId: "heartbeat-run",
      seq: 1,
      stream: "lifecycle",
      ts: 1,
      data: { phase: "start" },
    });

    expect(broadcast).not.toHaveBeenCalledWith("plugin.rivonclaw.chat-mirror", expect.anything());
  });

  it("still mirrors mapped external-channel runs", () => {
    const broadcast = vi.fn();
    const activated = activateEventBridge();
    activated.captureBroadcast(broadcast);
    const sessionKey = "agent:main:telegram:account:direct:user";

    activated.emitHook("llm_input", { runId: "external-run" }, { sessionKey });
    activated.emitAgentEvent({
      runId: "external-run",
      seq: 1,
      stream: "lifecycle",
      ts: 1,
      data: { phase: "start" },
    });

    expect(broadcast).toHaveBeenCalledWith(
      "plugin.rivonclaw.chat-mirror",
      expect.objectContaining({ runId: "external-run", sessionKey }),
    );
  });
});

// This branch runs inside the gateway process on the path every agent event
// takes, so its cost is part of its contract, not an implementation detail.
describe("office scene stream", () => {
  const CS_KEY = "agent:customer-service:cs:tiktok:shop-1:conv-1";

  /** Matches `captureBroadcast`'s parameter, which a bare `vi.fn()` does not. */
  type BroadcastMock = Mock<(event: string, payload: unknown) => void>;

  function sceneCalls(broadcast: BroadcastMock) {
    return broadcast.mock.calls.filter(([event]) => event === "plugin.rivonclaw.scene-event");
  }

  function startedRun(broadcast: BroadcastMock, runId: string, sessionKey: string) {
    const activated = activateEventBridge();
    activated.captureBroadcast(broadcast);
    activated.emitHook("llm_input", { runId }, { sessionKey });
    return activated;
  }

  it("forwards department runs that the Chat Page mirror deliberately drops", () => {
    const broadcast: BroadcastMock = vi.fn();
    const activated = startedRun(broadcast, "cs-run", CS_KEY);
    activated.emitAgentEvent({
      runId: "cs-run",
      seq: 1,
      stream: "lifecycle",
      ts: 1,
      data: { phase: "start" },
    });

    expect(sceneCalls(broadcast)).toHaveLength(1);
    expect(broadcast).not.toHaveBeenCalledWith("plugin.rivonclaw.chat-mirror", expect.anything());
  });

  it("ignores runs outside a department", () => {
    const broadcast: BroadcastMock = vi.fn();
    const activated = startedRun(broadcast, "other-run", "agent:some-other-agent:x:y");
    activated.emitAgentEvent({
      runId: "other-run",
      seq: 1,
      stream: "lifecycle",
      ts: 1,
      data: { phase: "start" },
    });

    expect(sceneCalls(broadcast)).toHaveLength(0);
  });

  // Shop operations is the default agent, whatever channel it speaks on. The
  // Chat Page also shows these runs; the two surfaces are allowed to overlap.
  it("forwards shop-operations runs on any channel", () => {
    for (const sessionKey of ["agent:main:main", "agent:main:telegram:acct:direct:u"]) {
      const broadcast: BroadcastMock = vi.fn();
      const activated = startedRun(broadcast, "ops-run", sessionKey);
      activated.emitAgentEvent({
        runId: "ops-run",
        seq: 1,
        stream: "lifecycle",
        ts: 1,
        data: { phase: "start" },
      });
      expect(sceneCalls(broadcast)).toHaveLength(1);
    }
  });

  // A reply arrives as one event per streamed token. The office needs to know
  // that a reply STARTED - the several seconds it takes were invisible before -
  // and nothing after that, so the burst collapses to a single marker.
  it("forwards one marker for a whole reply burst", () => {
    const broadcast: BroadcastMock = vi.fn();
    const activated = startedRun(broadcast, "burst-run", CS_KEY);
    for (let seq = 1; seq <= 20; seq++) {
      activated.emitAgentEvent({
        runId: "burst-run",
        seq,
        stream: "assistant",
        ts: seq,
        data: { text: "a".repeat(200) },
      });
    }

    expect(sceneCalls(broadcast)).toHaveLength(1);
    const [, payload] = sceneCalls(broadcast)[0] as [string, Record<string, unknown>];
    expect(payload).toMatchObject({ runId: "burst-run", seq: 1, stream: "assistant" });
  });

  // A run that replies, calls a tool and replies again did two visibly
  // different things, so the second burst has to re-arm and be drawn.
  it("forwards a second marker once another stream interrupts the burst", () => {
    const broadcast: BroadcastMock = vi.fn();
    const activated = startedRun(broadcast, "resume-run", CS_KEY);
    const emit = (seq: number, stream: string, data: Record<string, unknown>) =>
      activated.emitAgentEvent({ runId: "resume-run", seq, stream, ts: seq, data });

    emit(1, "assistant", { text: "first" });
    emit(2, "assistant", { text: "still first" });
    emit(3, "tool", { name: "reply_buyer" });
    emit(4, "assistant", { text: "second" });
    emit(5, "assistant", { text: "still second" });

    expect(sceneCalls(broadcast).map(([, p]) => (p as { seq: number }).seq)).toEqual([1, 3, 4]);
  });

  // The marker says a reply is being composed; the words are never part of it.
  // Recordings of this stream get rendered into public video.
  it("sends the reply marker with an empty payload", () => {
    const broadcast: BroadcastMock = vi.fn();
    const activated = startedRun(broadcast, "text-run", CS_KEY);
    activated.emitAgentEvent({
      runId: "text-run",
      seq: 1,
      stream: "assistant",
      ts: 1,
      data: { text: "the buyer's refund is approved", name: "ignored", phase: "delta" },
    });

    const [, payload] = sceneCalls(broadcast)[0] as [string, Record<string, unknown>];
    expect(payload.data).toEqual({});
  });

  it("ignores streams that carry no pose", () => {
    const broadcast: BroadcastMock = vi.fn();
    const activated = startedRun(broadcast, "cs-run", CS_KEY);
    for (const stream of ["usage", "item", "patch", "compaction", "command_output", "error"]) {
      activated.emitAgentEvent({ runId: "cs-run", seq: 1, stream, ts: 1, data: {} });
    }

    expect(sceneCalls(broadcast)).toHaveLength(0);
  });

  it("reduces the payload to the fields the office reads", () => {
    const broadcast: BroadcastMock = vi.fn();
    const activated = startedRun(broadcast, "cs-run", CS_KEY);
    activated.emitAgentEvent({
      runId: "cs-run",
      seq: 4,
      stream: "tool",
      ts: 1,
      data: { name: "reply_buyer", input: { body: "x".repeat(5000) }, extra: "dropped" },
    });

    const [, payload] = sceneCalls(broadcast)[0] as [string, Record<string, unknown>];
    expect(payload).toMatchObject({ runId: "cs-run", seq: 4, stream: "tool", sessionKey: CS_KEY });
    expect(payload.data).toEqual({ name: "reply_buyer" });
  });

  it("keeps the fields that distinguish how a run ended", () => {
    const broadcast: BroadcastMock = vi.fn();
    const activated = startedRun(broadcast, "cs-run", CS_KEY);
    activated.emitAgentEvent({
      runId: "cs-run",
      seq: 2,
      stream: "lifecycle",
      ts: 1,
      data: { phase: "end", aborted: true, stopReason: "user", endedAt: 5 },
    });

    const [, payload] = sceneCalls(broadcast)[0] as [string, Record<string, unknown>];
    expect(payload.data).toEqual({ phase: "end", aborted: true });
  });
});
