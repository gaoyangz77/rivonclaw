import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildSchema, parse, validate } from "graphql";
import { fetchAdsEntityDelta } from "./ads-entity-delta.js";
import { ADS_ENTITY_DELTA_QUERY, INIT_ADS_ADVERTISERS_QUERY } from "./init-queries.js";

describe("scoped Ads fetching", () => {
  it("keeps startup full and validates both operations against the backend schema", () => {
    const schema = buildSchema(
      readFileSync(resolve(process.cwd(), "../../server/backend/schema.graphql"), "utf8"),
    );
    expect(validate(schema, parse(ADS_ENTITY_DELTA_QUERY))).toEqual([]);
    expect(validate(schema, parse(INIT_ADS_ADVERTISERS_QUERY))).toEqual([]);
    expect(INIT_ADS_ADVERTISERS_QUERY).not.toContain("ids:");
    expect(INIT_ADS_ADVERTISERS_QUERY).not.toContain("adsAdvertiserIds:");
  });

  it("deduplicates and fetches 205 accounts in sequential chunks, without intermediate ingestion", async () => {
    let active = 0;
    let maxActive = 0;
    const graphql = vi.fn(async (_query, { ids }) => {
      maxActive = Math.max(maxActive, ++active);
      await Promise.resolve();
      active--;
      return { adsAdvertisers: ids.map((id: string) => ({ id })), adsStoreAccesses: [] };
    });
    const ids = Array.from({ length: 205 }, (_, i) => `ads-${i}`);
    const data = await fetchAdsEntityDelta({ graphql } as any, [...ids, ...ids]);
    expect(graphql.mock.calls.map(([, vars]) => vars.ids.length)).toEqual([100, 100, 5]);
    expect(maxActive).toBe(1);
    expect(data.adsAdvertisers).toHaveLength(205);
  });

  it("does not turn zero-account OAuth into a full fetch", async () => {
    const graphql = vi.fn();
    expect(await fetchAdsEntityDelta({ graphql }, [])).toEqual({
      adsAdvertisers: [],
      adsStoreAccesses: [],
    });
    expect(graphql).not.toHaveBeenCalled();
  });

  it("rejects a failed later chunk instead of exposing a partial snapshot", async () => {
    const graphql = vi
      .fn()
      .mockResolvedValueOnce({ adsAdvertisers: [{ id: "ads-0" }], adsStoreAccesses: [] })
      .mockRejectedValueOnce(new Error("offline"));
    await expect(
      fetchAdsEntityDelta(
        { graphql },
        Array.from({ length: 101 }, (_, i) => `ads-${i}`),
      ),
    ).rejects.toThrow("offline");
  });

  it("stops requesting chunks when the account session changes", async () => {
    const controller = new AbortController();
    const graphql = vi.fn(async () => {
      controller.abort();
      return { adsAdvertisers: [], adsStoreAccesses: [] };
    });
    await expect(
      fetchAdsEntityDelta(
        { graphql } as any,
        Array.from({ length: 101 }, (_, i) => `ads-${i}`),
        controller.signal,
      ),
    ).rejects.toThrow();
    expect(graphql).toHaveBeenCalledTimes(1);
  });

  it.each([
    {},
    { adsAdvertisers: [], adsStoreAccesses: null },
    { adsAdvertisers: [{ id: "other" }], adsStoreAccesses: [] },
    { adsAdvertisers: [], adsStoreAccesses: [{ id: "access", adsAdvertiserId: "other" }] },
  ])("rejects incomplete or out-of-scope responses %#", async (data) => {
    const graphql = vi.fn().mockResolvedValue(data);
    await expect(fetchAdsEntityDelta({ graphql }, ["ads-1"])).rejects.toThrow();
  });
});
