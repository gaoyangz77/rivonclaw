import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CsAgentDispatchRequest } from "./cs-agent-dispatch-resolver.js";
import {
  clearPendingCsDispatches,
  flushCsDispatchesAfterBridgeReady,
  getPendingCsDispatchCount,
  queueCsDispatchUntilBridgeReady,
} from "./cs-conversation-signal-buffer.js";

function makeDispatch(
  conversationId: string,
  messageId: string,
): CsAgentDispatchRequest {
  return {
    type: "UNREAD_DETECTED",
    dispatchReason: "PENDING_BUYER_MESSAGE",
    useMessageDelta: true,
    source: "AIRFLOW",
    shopId: "shop-1",
    platformShopId: "platform-shop-1",
    conversationId,
    messageId,
    aiEnabled: true,
    eventTime: new Date().toISOString(),
  };
}

describe("CS conversation signal startup buffer", () => {
  beforeEach(() => {
    clearPendingCsDispatches();
  });

  it("replays dispatches after the bridge becomes ready", async () => {
    const handle = vi.fn().mockResolvedValue(undefined);
    queueCsDispatchUntilBridgeReady(makeDispatch("conv-1", "msg-1"));
    queueCsDispatchUntilBridgeReady(makeDispatch("conv-2", "msg-2"));

    const result = await flushCsDispatchesAfterBridgeReady(handle);

    expect(result.flushed).toBe(2);
    expect(handle).toHaveBeenCalledTimes(2);
    expect(handle.mock.calls.map(([dispatch]) => dispatch.conversationId)).toEqual([
      "conv-1",
      "conv-2",
    ]);
    expect(getPendingCsDispatchCount()).toBe(0);
  });

  it("keeps only the newest pending dispatch for each conversation", async () => {
    const handle = vi.fn().mockResolvedValue(undefined);
    queueCsDispatchUntilBridgeReady(makeDispatch("conv-1", "msg-1"));
    const queued = queueCsDispatchUntilBridgeReady(makeDispatch("conv-1", "msg-2"));

    expect(queued).toEqual({ queued: 1, replaced: true });

    await flushCsDispatchesAfterBridgeReady(handle);

    expect(handle).toHaveBeenCalledTimes(1);
    expect(handle).toHaveBeenCalledWith(expect.objectContaining({ messageId: "msg-2" }));
  });
});
