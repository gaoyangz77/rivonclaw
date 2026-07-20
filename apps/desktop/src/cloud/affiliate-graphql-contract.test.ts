import { readFileSync } from "node:fs";
import { buildSchema, parse, validate } from "graphql";
import { describe, expect, it } from "vitest";
import { AFFILIATE_WORK_ITEMS_QUERY } from "./affiliate-queries.js";
import { AFFILIATE_WORK_ITEM_CHANGED_SUBSCRIPTION } from "./backend-subscription-client.js";

const backendSchema = buildSchema(
  readFileSync(new URL("../../../../server/backend/schema.graphql", import.meta.url), "utf8"),
);

describe("affiliate desktop GraphQL contracts", () => {
  it.each([
    ["affiliate work-items query", AFFILIATE_WORK_ITEMS_QUERY],
    ["affiliate work-item subscription", AFFILIATE_WORK_ITEM_CHANGED_SUBSCRIPTION],
  ])("validates the %s against the backend schema", (_name, source) => {
    const errors = validate(backendSchema, parse(source));

    expect(errors.map((error) => error.message)).toEqual([]);
  });

  it("keeps checkpoint cursor fields in the authoritative work-item refresh query", () => {
    const compactQuery = AFFILIATE_WORK_ITEMS_QUERY.replace(/\s+/g, " ");

    expect(compactQuery).toContain("committedCheckpointId");
    expect(compactQuery).toContain("committedEventCursor");
    expect(compactQuery).toContain("lifecycleEventSequence");
    expect(compactQuery).toContain("activeRunBaseEventCursor");
  });
});
