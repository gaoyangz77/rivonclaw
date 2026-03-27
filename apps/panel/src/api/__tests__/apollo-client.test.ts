// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// Reset module state between tests so _client is null each time
let mod: typeof import("../apollo-client.js");

beforeEach(async () => {
  vi.resetModules();
  mod = await import("../apollo-client.js");
});

describe("createApolloClient", () => {
  it("creates an ApolloClient instance", () => {
    const client = mod.createApolloClient();
    expect(client).toBeDefined();
    expect(typeof client.query).toBe("function");
    expect(typeof client.mutate).toBe("function");
  });
});

describe("getClient", () => {
  it("throws before createApolloClient is called", () => {
    expect(() => mod.getClient()).toThrow(
      "Apollo client not initialised",
    );
  });

  it("returns the client after createApolloClient is called", () => {
    const created = mod.createApolloClient();
    const got = mod.getClient();
    expect(got).toBe(created);
  });
});

describe("trackedQuery", () => {
  it("calls start and stop callbacks around the query", async () => {
    const start = vi.fn();
    const stop = vi.fn();
    mod.registerLoadingCallbacks(start, stop);

    const result = await mod.trackedQuery(async () => "done");

    expect(start).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
    expect(result).toBe("done");
  });

  it("calls stop even when the query throws", async () => {
    const start = vi.fn();
    const stop = vi.fn();
    mod.registerLoadingCallbacks(start, stop);

    await expect(
      mod.trackedQuery(async () => {
        throw new Error("fail");
      }),
    ).rejects.toThrow("fail");

    expect(start).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
  });

  it("works without registered callbacks", async () => {
    // No callbacks registered — should not throw
    const result = await mod.trackedQuery(async () => 42);
    expect(result).toBe(42);
  });
});
