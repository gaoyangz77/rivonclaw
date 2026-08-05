import { readFileSync } from "node:fs";
import { buildSchema, isInputObjectType, parse, validate } from "graphql";
import { describe, expect, it } from "vitest";
import { AFFILIATE_WORK_ITEMS_QUERY } from "./affiliate-queries.js";
import {
  AFFILIATE_ACTION_PROPOSAL_CHANGED_SUBSCRIPTION,
  AFFILIATE_WORK_ITEM_CHANGED_SUBSCRIPTION,
} from "./backend-subscription-client.js";

const backendSchema = buildSchema(
  readFileSync(new URL("../../../../server/backend/schema.graphql", import.meta.url), "utf8"),
);

describe("affiliate desktop GraphQL contracts", () => {
  it.each([
    ["affiliate work-items query", AFFILIATE_WORK_ITEMS_QUERY],
    ["affiliate work-item subscription", AFFILIATE_WORK_ITEM_CHANGED_SUBSCRIPTION],
    ["affiliate action-proposal subscription", AFFILIATE_ACTION_PROPOSAL_CHANGED_SUBSCRIPTION],
  ])("validates the %s against the backend schema", (_name, source) => {
    const errors = validate(backendSchema, parse(source));

    expect(errors.map((error) => error.message)).toEqual([]);
  });

  it("keeps the realtime proposal payload review-complete", () => {
    const compactSubscription = AFFILIATE_ACTION_PROPOSAL_CHANGED_SUBSCRIPTION.replace(/\s+/g, " ");

    for (const field of [
      "sampleApplicationRecordId",
      "productId",
      "username",
      "nickname",
      "avatarUrl",
      "affiliateCollaboration",
      "sampleApplicationRecord",
      "productSummary",
      "predictionCacheIds",
      "predictionSnapshots",
      "resolvedContext",
    ]) {
      expect(compactSubscription).toContain(field);
    }
  });

  it("keeps checkpoint cursor fields in the authoritative work-item refresh query", () => {
    const compactQuery = AFFILIATE_WORK_ITEMS_QUERY.replace(/\s+/g, " ");

    expect(compactQuery).toContain("committedCheckpointId");
    expect(compactQuery).toContain("committedEventCursor");
    expect(compactQuery).toContain("lifecycleEventSequence");
    expect(compactQuery).toContain("activeRunBaseEventCursor");
  });

  it("keeps prediction lineage scaffold-owned instead of Agent-authored", () => {
    const actionInput = backendSchema.getType("ResolveAffiliateWorkItemActionInput");

    expect(isInputObjectType(actionInput)).toBe(true);
    if (!isInputObjectType(actionInput)) return;
    expect(actionInput.getFields()).not.toHaveProperty("predictionCacheIds");
    const resolveInput = backendSchema.getType("ResolveAffiliateWorkItemInput");
    expect(isInputObjectType(resolveInput)).toBe(true);
    if (isInputObjectType(resolveInput)) {
      expect(resolveInput.getFields()).toHaveProperty("predictionCacheIds");
    }
    expect(AFFILIATE_WORK_ITEMS_QUERY).toContain("predictionEvidence");
    expect(AFFILIATE_WORK_ITEM_CHANGED_SUBSCRIPTION).toContain("predictionEvidence");
  });

  it("does not query the removed relationship agenda status field", () => {
    const compactSubscription = AFFILIATE_WORK_ITEM_CHANGED_SUBSCRIPTION.replace(/\s+/g, " ");

    expect(compactSubscription).not.toMatch(/agendaItems \{[^}]*\bstatus\b/);
  });

  it.each([
    ["affiliate work-items query", AFFILIATE_WORK_ITEMS_QUERY],
    ["affiliate work-item subscription", AFFILIATE_WORK_ITEM_CHANGED_SUBSCRIPTION],
  ])("keeps %s Creator data limited to trusted identity constants", (_name, source) => {
    const selections = [...source.matchAll(/creatorProfile\s*\{([^}]*)\}/g)]
      .map((match) => match[1]);

    expect(selections.length).toBeGreaterThan(0);
    for (const selection of selections) {
      expect(selection).not.toMatch(/\b(username|nickname|avatarUrl|currentPerformance)\b/);
    }
  });
});
