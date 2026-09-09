import { ApolloClient, ApolloLink, InMemoryCache, Observable } from "@apollo/client";
import { afterEach, expect, it, vi } from "vitest";
import { print } from "graphql";
import { requestUserProducts } from "./product-catalog-request.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("sends exactly one keyword-only operation for an 80-shop search", async () => {
  const response = {
    products: [{ shopId: "shop-a", productId: "1", title: "Match" }],
    totalShops: 80,
    failedShopIds: ["shop-b"],
  };
  const link = vi.fn<ApolloLink.RequestHandler>((operation) => {
    expect(operation.variables).toEqual({ keywordOrId: "Match" });
    expect(print(operation.query)).toContain("searchProductsForUser(keywordOrId: $keywordOrId)");
    return new Observable((subscriber) =>
      subscriber.next({ data: { searchProductsForUser: response } }),
    );
  });
  const client = new ApolloClient({ cache: new InMemoryCache(), link: new ApolloLink(link) });
  await expect(requestUserProducts(client, "Match", new AbortController().signal)).resolves.toEqual(
    response,
  );
  expect(link).toHaveBeenCalledOnce();
  client.stop();
});

it("times out once, aborts transport and does not retry automatically", async () => {
  vi.useFakeTimers();
  const signals: AbortSignal[] = [];
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink((operation) => {
      signals.push(operation.getContext().fetchOptions.signal);
      return new Observable(() => {});
    }),
  });
  const pending = requestUserProducts(client, "name", new AbortController().signal);
  const assertion = expect(pending).rejects.toThrow("timed out");
  await vi.advanceTimersByTimeAsync(45_000);
  await assertion;
  expect(signals).toHaveLength(1);
  expect(signals[0].aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
  client.stop();
});

it.each([false, true])("cancels a search (already aborted: %s)", async (alreadyAborted) => {
  const signals: AbortSignal[] = [];
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink((operation) => {
      signals.push(operation.getContext().fetchOptions.signal);
      return new Observable(() => {});
    }),
  });
  const controller = new AbortController();
  if (alreadyAborted) controller.abort();
  const pending = requestUserProducts(client, "name", controller.signal);
  controller.abort();
  await expect(pending).rejects.toThrow("cancelled");
  expect(signals).toHaveLength(alreadyAborted ? 0 : 1);
  expect(signals.every((signal) => signal.aborted)).toBe(true);
  client.stop();
});
