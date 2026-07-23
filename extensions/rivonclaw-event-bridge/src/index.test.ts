import { afterEach, describe, expect, it, vi } from "vitest";

import eventBridgePlugin, {
  createRunSessionTracker,
  parseCsEscalationResponseInteraction,
  shouldMirrorExternalSession,
} from "./index.js";

type InteractiveRegistration = {
  channel: string;
  namespace: string;
  handler: (context: unknown) => unknown | Promise<unknown>;
};

const gatewayStopHandlers: Array<() => void> = [];

function activateEventBridge() {
  let interactive: InteractiveRegistration | undefined;
  let initGateway: ((args: unknown) => void) | undefined;
  const api = {
    id: "rivonclaw-event-bridge",
    logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (event === "gateway_stop") gatewayStopHandlers.push(handler as () => void);
    }),
    registerGatewayMethod: vi.fn((name: string, handler: (args: unknown) => void) => {
      if (name === "event_bridge_init") initGateway = handler;
    }),
    registerInteractiveHandler: vi.fn((registration: InteractiveRegistration) => {
      interactive = registration;
    }),
    runtime: { events: { onAgentEvent: vi.fn(() => vi.fn()) } },
  };
  eventBridgePlugin.activate(api as never);
  return {
    interactive: () => interactive,
    captureBroadcast: (broadcast: (event: string, payload: unknown) => void) =>
      initGateway?.({ respond: vi.fn(), context: { broadcast } }),
  };
}

afterEach(() => {
  for (const handler of gatewayStopHandlers.splice(0)) handler();
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

describe("Feishu CS escalation form interactions", () => {
  const baseContext = {
    channel: "feishu",
    accountId: "main",
    callbackId: "callback-1",
    conversationId: "oc_chat",
    messageId: "om_card",
    senderId: "ou_operator",
    interaction: {
      payload: "respond",
      value: {
        escalationId: "M1DG8V",
        processingText: "Submitting now",
        failureText: "Please retry",
      },
      formValue: { decision: "Issue a refund", resolution: "resolved" },
    },
  };

  it("parses resolved and unresolved submissions without retaining raw callback data", () => {
    expect(parseCsEscalationResponseInteraction(baseContext, 123)).toEqual({
      schemaVersion: 1,
      callbackId: "callback-1",
      accountId: "main",
      operatorOpenId: "ou_operator",
      chatId: "oc_chat",
      messageId: "om_card",
      escalationId: "M1DG8V",
      decision: "Issue a refund",
      resolved: true,
      submittedAt: 123,
    });
    expect(
      parseCsEscalationResponseInteraction(
        {
          ...baseContext,
          interaction: {
            ...baseContext.interaction,
            formValue: { decision: "Need more information", resolution: "unresolved" },
          },
        },
        456,
      )?.resolved,
    ).toBe(false);

    expect(
      parseCsEscalationResponseInteraction(
        {
          ...baseContext,
          interaction: {
            ...baseContext.interaction,
            payload: "respond:0B67JE",
            value: { action: "rivonclaw.cs:respond:0B67JE" },
          },
        },
        789,
      ),
    ).toEqual(expect.objectContaining({ escalationId: "0B67JE", submittedAt: 789 }));
  });

  it("registers the namespace and broadcasts one typed event", async () => {
    const broadcast = vi.fn();
    const activated = activateEventBridge();
    activated.captureBroadcast(broadcast);
    const registration = activated.interactive();

    expect(registration).toMatchObject({ channel: "feishu", namespace: "rivonclaw.cs" });
    const result = await registration?.handler(baseContext);

    expect(result).toEqual({
      handled: true,
      response: { toast: { type: "info", content: "Submitting now" } },
    });
    expect(broadcast).toHaveBeenCalledTimes(1);
    expect(broadcast).toHaveBeenCalledWith(
      "plugin.rivonclaw.cs-escalation-response",
      expect.objectContaining({
        escalationId: "M1DG8V",
        decision: "Issue a refund",
        resolved: true,
      }),
    );
  });

  it("fails closed when the broadcast bridge is unavailable", async () => {
    const activated = activateEventBridge();
    const result = await activated.interactive()?.handler(baseContext);

    expect(result).toEqual({
      handled: true,
      response: { toast: { type: "error", content: "Please retry" } },
    });
  });

  it.each([
    [
      "missing escalation",
      { ...baseContext, interaction: { ...baseContext.interaction, value: {} } },
    ],
    [
      "empty decision",
      {
        ...baseContext,
        interaction: {
          ...baseContext.interaction,
          formValue: { decision: "", resolution: "resolved" },
        },
      },
    ],
    [
      "unknown resolution",
      {
        ...baseContext,
        interaction: {
          ...baseContext.interaction,
          formValue: { decision: "ok", resolution: "maybe" },
        },
      },
    ],
    ["missing message", { ...baseContext, messageId: undefined }],
  ])("rejects malformed callbacks: %s", async (_label, context) => {
    const broadcast = vi.fn();
    const activated = activateEventBridge();
    activated.captureBroadcast(broadcast);

    const result = await activated.interactive()?.handler(context);

    expect(result).toEqual(expect.objectContaining({ handled: true }));
    expect(broadcast).not.toHaveBeenCalled();
  });
});
