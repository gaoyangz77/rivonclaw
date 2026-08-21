import type { CsAgentDispatchRequest } from "./cs-agent-dispatch-resolver.js";

const MAX_PENDING_DISPATCHES = 1_000;

interface PendingDispatch {
  dispatch: CsAgentDispatchRequest;
  queuedAt: number;
}

const pendingDispatches = new Map<string, PendingDispatch>();

function dispatchKey(dispatch: CsAgentDispatchRequest): string {
  return `${dispatch.shopId || dispatch.platformShopId}:${dispatch.conversationId}`;
}

export function queueCsDispatchUntilBridgeReady(dispatch: CsAgentDispatchRequest): {
  queued: number;
  replaced: boolean;
} {
  const key = dispatchKey(dispatch);
  const replaced = pendingDispatches.delete(key);
  pendingDispatches.set(key, { dispatch, queuedAt: Date.now() });

  while (pendingDispatches.size > MAX_PENDING_DISPATCHES) {
    const oldestKey = pendingDispatches.keys().next().value;
    if (oldestKey === undefined) break;
    pendingDispatches.delete(oldestKey);
  }

  return { queued: pendingDispatches.size, replaced };
}

export async function flushCsDispatchesAfterBridgeReady(
  handle: (dispatch: CsAgentDispatchRequest) => Promise<void>,
): Promise<{ flushed: number; maxWaitMs: number }> {
  const entries = Array.from(pendingDispatches.values());
  pendingDispatches.clear();

  let maxWaitMs = 0;
  for (const entry of entries) {
    maxWaitMs = Math.max(maxWaitMs, Date.now() - entry.queuedAt);
    await handle(entry.dispatch);
  }

  return { flushed: entries.length, maxWaitMs };
}

export function clearPendingCsDispatches(): void {
  pendingDispatches.clear();
}

export function getPendingCsDispatchCount(): number {
  return pendingDispatches.size;
}
