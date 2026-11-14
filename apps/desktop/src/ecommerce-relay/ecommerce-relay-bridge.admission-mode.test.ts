// ADR-104: a MANUAL_START carrying a batchId queues through the automatic run
// limit; without one it keeps bypassing it.
import { describe, expect, it, vi } from "vitest";

vi.mock("../openclaw/index.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../openclaw/index.js")>()),
  openClawConnector: { request: vi.fn() } as never,
}));

vi.mock("../app/store/runtime-status-store.js", () => ({
  runtimeStatusStore: {
    setCsBridgeConnected: vi.fn(),
    setCsBridgeDisconnected: vi.fn(),
  },
}));

import { csSignalAdmissionMode } from "./ecommerce-relay-bridge.js";
import {
  resolveCsConversationDispatch,
  resolveCsSignalDispatch,
} from "../cs-bridge/cs-agent-dispatch-resolver.js";

function manualStart(extra: Record<string, unknown> = {}) {
  const dispatch = resolveCsSignalDispatch({
    type: "MANUAL_START",
    source: "MANUAL",
    shopId: "shop-1",
    platformShopId: "p-1",
    conversationId: "conv-1",
    ...extra,
  } as never);
  if (!dispatch) throw new Error("MANUAL_START must resolve");
  return dispatch;
}

describe("csSignalAdmissionMode", () => {
  it("bypasses the run limit for a MANUAL_START without a batch id", () => {
    expect(csSignalAdmissionMode(manualStart())).toBe("bypass");
    expect(csSignalAdmissionMode(manualStart({ batchId: null }))).toBe("bypass");
    expect(csSignalAdmissionMode(manualStart({ batchId: "" }))).toBe("bypass");
  });

  it("queues a MANUAL_START with a batch id through automatic admission", () => {
    expect(csSignalAdmissionMode(manualStart({ batchId: "batch-1" }))).toBe("automatic");
  });

  it("keeps buyer-message dispatches automatic", () => {
    const dispatch = resolveCsSignalDispatch({
      type: "MESSAGE_RECEIVED",
      source: "WEBHOOK",
      shopId: "shop-1",
      platformShopId: "p-1",
      conversationId: "conv-1",
    } as never);
    expect(dispatch && csSignalAdmissionMode(dispatch)).toBe("automatic");
  });

  // Production dispatches arrive on csConversationChanged; the batch id rides on its dispatch hint.
  it("queues a batch dispatch that arrives on a conversation change", () => {
    const changed = (batchId?: string) =>
      resolveCsConversationDispatch(
        {
          shopId: "shop-1",
          platformShopId: "p-1",
          conversationId: "conv-1",
          dispatchHint: { reason: "MANUAL_START", source: "MANUAL", ...(batchId ? { batchId } : {}) },
        } as never,
        { id: "shop-1", platformShopId: "p-1" },
      );
    const batched = changed("batch-1");
    expect(batched).toMatchObject({ dispatchReason: "MANUAL_START", batchId: "batch-1" });
    expect(batched && csSignalAdmissionMode(batched)).toBe("automatic");
    const single = changed();
    expect(single?.batchId).toBeUndefined();
    expect(single && csSignalAdmissionMode(single)).toBe("bypass");
  });
});
