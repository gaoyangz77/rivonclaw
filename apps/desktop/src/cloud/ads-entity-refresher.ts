import type { AdsOAuthCompletePayload } from "./backend-subscription-client.js";

/** Coalesce background invalidations while an Ads delta is in flight.
 * Pending notifications are plain network DTOs, never MST nodes. The startup
 * snapshot has its own query and is not routed through this queue.
 */
export function createAdsEntityRefresher<T>(deps: {
  refresh(advertiserIds: string[], signal: AbortSignal): Promise<T>;
  onRefreshed(payload: AdsOAuthCompletePayload, data: T): void;
  onError(error: unknown): void;
}) {
  const newBatch = () => ({
    running: false,
    pending: null as AdsOAuthCompletePayload | null,
    controller: new AbortController(),
  });
  let current = newBatch();

  async function drain(batch: ReturnType<typeof newBatch>): Promise<void> {
    batch.running = true;
    try {
      while (batch === current && batch.pending) {
        const payload = batch.pending;
        batch.pending = null;
        try {
          const data = await deps.refresh(payload.advertiserIds, batch.controller.signal);
          if (batch === current) deps.onRefreshed(payload, data);
        } catch (error) {
          if (batch === current) deps.onError(error);
        }
      }
    } finally {
      batch.running = false;
    }
  }

  return {
    enqueue(payload: AdsOAuthCompletePayload) {
      if (
        !Array.isArray(payload.advertiserIds) ||
        payload.advertiserIds.some((id) => typeof id !== "string" || !id.trim()) ||
        (payload.advertiserCount > 0 && payload.advertiserIds.length === 0)
      ) {
        deps.onError(new Error("Ads refresh notification is missing advertiser IDs"));
        return;
      }
      const ids = [
        ...new Set([...(current.pending?.advertiserIds ?? []), ...payload.advertiserIds]),
      ];
      current.pending = { ...payload, advertiserIds: ids, advertiserCount: ids.length };
      if (!current.running) void drain(current);
    },
    reset() {
      current.controller.abort();
      current.pending = null;
      current = newBatch();
    },
  };
}
