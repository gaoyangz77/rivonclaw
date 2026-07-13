// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { gql } from "@apollo/client";

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

  it("keeps copied unpaid-order stages scoped to their experiment variants", () => {
    const client = mod.createApolloClient();
    const query = gql`
      query ExperimentVariants {
        experiment {
          id
          variants {
            variantKey
            stages { id delayMinutes }
          }
        }
      }
    `;
    client.cache.writeQuery({
      query,
      data: {
        experiment: {
          __typename: "CsUnpaidOrderConfigExperimentView",
          id: "experiment-1",
          variants: [
            {
              __typename: "CsUnpaidOrderConfigVariantView",
              variantKey: "A",
              stages: [{
                __typename: "UnpaidOrderReachoutStage",
                id: "shared-stage-id",
                delayMinutes: 3,
              }],
            },
            {
              __typename: "CsUnpaidOrderConfigVariantView",
              variantKey: "B",
              stages: [{
                __typename: "UnpaidOrderReachoutStage",
                id: "shared-stage-id",
                delayMinutes: 720,
              }],
            },
          ],
        },
      },
    });

    const result = client.cache.readQuery<{
      experiment: { variants: Array<{ stages: Array<{ delayMinutes: number }> }> };
    }>({ query });
    expect(result?.experiment.variants.map((variant) => variant.stages[0]?.delayMinutes)).toEqual([
      3,
      720,
    ]);
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
