import { describe, expect, it, vi } from "vitest";
import { createAdsEntityRefresher } from "./ads-entity-refresher.js";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("Ads entity invalidation refresh", () => {
  it("bounds a 100-event sync burst to one active snapshot and one trailing snapshot", async () => {
    const first = deferred();
    const last = deferred();
    const refresh = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(last.promise);
    const onRefreshed = vi.fn();
    const onError = vi.fn();
    const { enqueue } = createAdsEntityRefresher({ refresh, onRefreshed, onError });
    for (let i = 0; i < 100; i++) {
      enqueue({ platform: "TIKTOK_ADS", advertiserIds: [`ads-${i}`], advertiserCount: 1 });
    }
    expect(refresh).toHaveBeenCalledTimes(1);
    first.resolve();
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
    expect(onRefreshed).toHaveBeenCalledTimes(1);
    last.resolve();
    await vi.waitFor(() => expect(onRefreshed).toHaveBeenCalledTimes(2));
    expect(onRefreshed.mock.calls[1][0].advertiserIds).toHaveLength(99);
    const ids = onRefreshed.mock.calls.flatMap(([payload]) => payload.advertiserIds);
    expect(new Set(ids).size).toBe(100);
    expect(onError).not.toHaveBeenCalled();
  });

  it("re-reads an advertiser changed again during a fetch, including after a failed snapshot", async () => {
    const first = deferred();
    const refresh = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const onRefreshed = vi.fn();
    const onError = vi.fn();
    const { enqueue } = createAdsEntityRefresher({ refresh, onRefreshed, onError });
    const payload = { platform: "TIKTOK_ADS", advertiserIds: ["ads-1"], advertiserCount: 1 };
    enqueue(payload);
    enqueue(payload);
    enqueue(payload);
    first.reject(new Error("network unavailable"));
    await vi.waitFor(() => expect(onRefreshed).toHaveBeenCalledTimes(1));
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "network unavailable" }),
    );
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(onRefreshed).toHaveBeenCalledWith(payload, undefined);
    enqueue(payload);
    await vi.waitFor(() => expect(onRefreshed).toHaveBeenCalledTimes(2));
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("preserves a zero-advertiser OAuth result", async () => {
    const onRefreshed = vi.fn();
    const { enqueue } = createAdsEntityRefresher({
      refresh: async () => {},
      onRefreshed,
      onError: vi.fn(),
    });
    const payload = { platform: "TIKTOK_ADS", advertiserIds: [], advertiserCount: 0 };
    enqueue(payload);
    await vi.waitFor(() => expect(onRefreshed).toHaveBeenCalledWith(payload, undefined));
  });

  it("drops the previous account's queued work and ignores its response after a session change", async () => {
    const old = deferred();
    const refresh = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue(undefined);
    const onRefreshed = vi.fn();
    const queue = createAdsEntityRefresher({ refresh, onRefreshed, onError: vi.fn() });
    const payload = { platform: "TIKTOK_ADS", advertiserIds: ["old-account"], advertiserCount: 1 };
    queue.enqueue(payload);
    queue.enqueue(payload);
    queue.reset();
    const next = { ...payload, advertiserIds: ["new-account"] };
    queue.enqueue(next);
    await vi.waitFor(() => expect(onRefreshed).toHaveBeenCalledWith(next, undefined));
    old.resolve();
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(onRefreshed).toHaveBeenCalledTimes(1);
  });
});
