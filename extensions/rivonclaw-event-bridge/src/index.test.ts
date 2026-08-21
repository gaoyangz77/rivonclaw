import { afterEach, describe, expect, it, vi } from "vitest";

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
