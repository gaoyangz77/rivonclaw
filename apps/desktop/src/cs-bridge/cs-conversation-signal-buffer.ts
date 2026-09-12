import type { CsAgentDispatchRequest } from "./cs-agent-dispatch-resolver.js";

const MAX_PENDING_DISPATCHES = 1_000;

/**
 * Minimum gap between two replayed entries *starting* their pre-admission work
 * after a Gateway restart. Override with `RIVONCLAW_CS_REPLAY_START_SPACING_MS`;
 * `0` disables the spacing.
 *
 * Ten seconds ramps the four admission slots up over ~30 s instead of filling
 * them in the first second of a fresh Gateway's life, and sustains six starts
 * a minute, above the ~4/min the 2026-09-09 log shows the Gateway completing
 * (28 automatic runs: p50 79 s, p90 281 s). The gap exists to remove the
 * start-up burst, not to throttle steady-state throughput.
 */
export const CS_REPLAY_START_SPACING_ENV = "RIVONCLAW_CS_REPLAY_START_SPACING_MS";
export const DEFAULT_CS_REPLAY_START_SPACING_MS = 10_000;

export function resolveCsReplayStartSpacingMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env[CS_REPLAY_START_SPACING_ENV];
  if (raw === undefined) return DEFAULT_CS_REPLAY_START_SPACING_MS;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_CS_REPLAY_START_SPACING_MS;
}

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

/**
 * Replays the buffered dispatches, at most `concurrency` at a time.
 *
 * This used to be a plain `for ... await` loop, which was harmless while the
 * buffer only ever held the handful of signals that arrived during a restart.
 * Once cancelled admissions started landing here too, every Gateway restart
 * replayed 40-90 entries through that loop -- and because `handle` waits for a
 * run admission slot *and* the run itself, the whole replay ran one-at-a-time
 * while three of the four CS slots sat idle. On 2026-09-08 that left the bridge
 * at `active=1/4 queued=0` for one to four minutes after every restart.
 *
 * The admission controller is the real concurrency limit; this bound only
 * exists because each entry does real work *before* it reaches admission
 * (shop context, backend session, conversation delta), and firing ninety of
 * those at a Gateway that is already under memory pressure is what we are
 * trying to stop doing. Keep it near the admission limit: enough to hide
 * that pre-admission latency, not enough to flood.
 *
 * `startSpacingMs` is the second half of that: the workers bound how many
 * entries are in flight, the spacing bounds how quickly they *begin*. The
 * spacing is global across workers and counted from each entry's start, so
 * with concurrency 6 and spacing 10 s the first six entries begin at 0, 10,
 * 20, ... 50 s rather than all at once. Entries keep their queue order.
 */
export async function flushCsDispatchesAfterBridgeReady(
  handle: (dispatch: CsAgentDispatchRequest) => Promise<void>,
  options?: {
    concurrency?: number;
    /** Minimum gap between two entries starting. `0` (default) starts them back to back. */
    startSpacingMs?: number;
    /** Called for an entry whose handler threw. The batch continues either way. */
    onError?: (dispatch: CsAgentDispatchRequest, error: unknown) => void;
  },
): Promise<{ flushed: number; failed: number; maxWaitMs: number }> {
  const entries = Array.from(pendingDispatches.values());
  pendingDispatches.clear();

  const startedAt = Date.now();
  let maxWaitMs = 0;
  for (const entry of entries) {
    maxWaitMs = Math.max(maxWaitMs, startedAt - entry.queuedAt);
  }

  const concurrency = Math.max(1, Math.trunc(options?.concurrency ?? 1));
  const startSpacingMs = Math.max(0, options?.startSpacingMs ?? 0);
  let nextIndex = 0;
  let nextStartAt = 0;
  let failed = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      // Claim the entry and its start slot in the same synchronous step, so
      // the start times ascend in queue order regardless of which worker wakes
      // first.
      const index = nextIndex;
      nextIndex += 1;
      const entry = entries[index];
      if (!entry) return;
      const now = Date.now();
      const startAt = Math.max(now, nextStartAt);
      nextStartAt = startAt + startSpacingMs;
      if (startAt > now) {
        await new Promise((resolve) => setTimeout(resolve, startAt - now));
      }
      try {
        await handle(entry.dispatch);
      } catch (error) {
        // The buffer was drained before the replay began, so letting this
        // escape would abandon every entry the workers had not reached yet and
        // leave the other workers running detached. One conversation failing
        // must not cost the rest of the backlog; the caller logs it.
        failed += 1;
        options?.onError?.(entry.dispatch, error);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, entries.length) }, () => worker()),
  );

  return { flushed: entries.length, failed, maxWaitMs };
}

export function clearPendingCsDispatches(): void {
  pendingDispatches.clear();
}

export function getPendingCsDispatchCount(): number {
  return pendingDispatches.size;
}
