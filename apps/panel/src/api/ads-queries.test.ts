import { print } from "graphql";
import { describe, expect, it } from "vitest";
import { ADS_STORE_ACCESS_FIELDS_FRAGMENT, ADS_STORE_ACCESSES_QUERY } from "./ads-queries.js";

function expectNoUnsupportedAdsStoreAccessFields(query: string) {
  expect(query).not.toMatch(/AdsStoreAccess[^{]*\{[^}]*\bshopId\b/s);
}

describe("ads queries", () => {
  it("does not request removed AdsStoreAccess shopId field", () => {
    expectNoUnsupportedAdsStoreAccessFields(print(ADS_STORE_ACCESS_FIELDS_FRAGMENT));
    expectNoUnsupportedAdsStoreAccessFields(print(ADS_STORE_ACCESSES_QUERY));
  });

  it("only loads active store access rows for the current coverage UI", () => {
    expect(print(ADS_STORE_ACCESSES_QUERY)).toContain("adsStoreAccesses(status: ACTIVE)");
  });
});
