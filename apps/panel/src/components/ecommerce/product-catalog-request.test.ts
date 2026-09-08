import { ApolloClient, ApolloLink, InMemoryCache, Observable } from "@apollo/client";
import { afterEach, expect, it, vi } from "vitest";
import { requestProductCatalog, requestProductCatalogs } from "./product-catalog-request.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("starts all shops within the jitter window without waiting for any response", async () => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  const finish = new Map<string, () => void>();
  const ids = Array.from({ length: 8 }, (_, i) => `shop-${i}`);
  const settled = vi.fn();
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink((operation) => {
      const id = operation.variables.shopIds[0];
      return new Observable((subscriber) => {
        finish.set(id, () => {
          if (id === "shop-0") subscriber.error(new Error("One shop unavailable"));
          else
            subscriber.next({
              data: { ecommerceSearchProducts: [{ shopId: id, productId: id, title: id }] },
            });
        });
      });
    }),
  });
  const pending = requestProductCatalogs(client, ids, new AbortController().signal, settled);
  expect(finish.size).toBe(0);
  await vi.advanceTimersByTimeAsync(150);
  expect([...finish.keys()].sort()).toEqual(ids);
  expect(settled).not.toHaveBeenCalled();
  finish.get("shop-0")!();
  await vi.advanceTimersByTimeAsync(0);
  expect(settled).toHaveBeenCalledWith(
    expect.objectContaining({ shopId: "shop-0", status: "rejected" }),
  );
  finish.get("shop-7")!();
  await vi.advanceTimersByTimeAsync(0);
  expect(settled).toHaveBeenCalledWith(
    expect.objectContaining({ shopId: "shop-7", status: "fulfilled" }),
  );
  for (const id of ids.slice(1, 7)) finish.get(id)!();
  await pending;
  expect(settled).toHaveBeenCalledTimes(8);
  client.stop();
});

it.each([0, 150])("cancels both jitter timers and active requests after %i ms", async (elapsed) => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  const signals: AbortSignal[] = [];
  const settled = vi.fn();
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink((operation) => {
      signals.push(operation.getContext().fetchOptions.signal);
      return new Observable(() => {});
    }),
  });
  const controller = new AbortController();
  const pending = requestProductCatalogs(client, ["a", "b", "c"], controller.signal, settled);
  await vi.advanceTimersByTimeAsync(elapsed);
  controller.abort();
  await pending;
  await vi.advanceTimersByTimeAsync(30_000);
  expect(signals).toHaveLength(elapsed ? 3 : 0);
  expect(signals.every((signal) => signal.aborted)).toBe(true);
  expect(settled).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
  client.stop();
});
it("times out a stalled request, aborts transport and allows a fresh retry", async () => {
  vi.useFakeTimers();
  const signals: AbortSignal[] = [];
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink((operation) => {
      signals.push(operation.getContext().fetchOptions.signal);
      return new Observable((subscriber) => {
        if (signals.length === 2) subscriber.next({ data: { ecommerceSearchProducts: [] } });
      });
    }),
  });
  const promise = requestProductCatalog(client, "shop-a", new AbortController().signal);
  const assertion = expect(promise).rejects.toThrow("timed out");
  await vi.advanceTimersByTimeAsync(30_000);
  await assertion;
  expect(signals[0].aborted).toBe(true);
  await expect(
    requestProductCatalog(client, "shop-a", new AbortController().signal),
  ).resolves.toEqual([]);
  expect(signals).toHaveLength(2);
  client.stop();
});

it("does not start a request with an already cancelled signal", async () => {
  const link = vi.fn();
  const client = new ApolloClient({ cache: new InMemoryCache(), link: new ApolloLink(link) });
  const controller = new AbortController();
  controller.abort();
  await expect(requestProductCatalog(client, "shop-a", controller.signal)).rejects.toThrow(
    "cancelled",
  );
  expect(link).not.toHaveBeenCalled();
  client.stop();
});
