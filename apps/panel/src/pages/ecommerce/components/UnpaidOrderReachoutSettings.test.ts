import { describe, expect, it } from "vitest";
import {
  bindProductionVariant,
  rebalanceUnpaidExperimentVariants,
  isUnpaidSettingsVersionConflict,
  serializeUnpaidReachoutStages,
  toUnpaidReachoutStageInput,
  validateUnpaidExperimentVariants,
  type UnpaidExperimentVariantDraft,
} from "./UnpaidOrderReachoutSettings.js";

function variant(key: string, percentage: string, delay: string): UnpaidExperimentVariantDraft {
  return {
    variantKey: key,
    label: `Plan ${key}`,
    percentage,
    stages: [{ enabled: true, delayMinutes: delay, messageTemplate: `Message ${key}` }],
  };
}

describe("unpaid reachout experiment validation", () => {
  it("serializes GraphQL stages into strict mutation inputs", () => {
    const graphqlStage = {
      __typename: "UnpaidOrderReachoutStage",
      id: "stage-a",
      enabled: true,
      delayMinutes: "3",
      messageTemplate: "Need help?",
    };

    expect(toUnpaidReachoutStageInput(graphqlStage)).toEqual({
      id: "stage-a",
      enabled: true,
      delayMinutes: 3,
      messageTemplate: "Need help?",
    });
    expect(toUnpaidReachoutStageInput(graphqlStage)).not.toHaveProperty("__typename");
  });

  it("treats equivalent stage drafts and server stages as unchanged", () => {
    const draft = [
      { id: "stage-a", enabled: true, delayMinutes: "3", messageTemplate: "Need help?" },
    ];
    const server = [
      { id: "stage-a", enabled: true, delayMinutes: 3, messageTemplate: "Need help?" },
    ];

    expect(serializeUnpaidReachoutStages(draft)).toBe(serializeUnpaidReachoutStages(server));
  });

  it("detects a real stage configuration change", () => {
    const original = [
      { id: "stage-a", enabled: true, delayMinutes: 3, messageTemplate: "Need help?" },
    ];
    const changed = [
      { id: "stage-a", enabled: true, delayMinutes: "10", messageTemplate: "Need help?" },
    ];

    expect(serializeUnpaidReachoutStages(original)).not.toBe(
      serializeUnpaidReachoutStages(changed),
    );
  });

  it("recognizes both holdout and configuration optimistic concurrency conflicts", () => {
    expect(
      isUnpaidSettingsVersionConflict(
        new Error("The holdout experiment changed; refresh before saving"),
      ),
    ).toBe(true);
    expect(
      isUnpaidSettingsVersionConflict(
        new Error("The configuration experiment changed; refresh before saving"),
      ),
    ).toBe(true);
    expect(isUnpaidSettingsVersionConflict(new Error("Network request failed"))).toBe(false);
  });

  it.each([2, 3, 6, 20])("accepts %i distinct variants after rebalancing", (count) => {
    const drafts = Array.from({ length: count }, (_, index) =>
      variant(index === 0 ? "A" : `V${index + 1}`, "1", String(index + 1)),
    );
    const balanced = rebalanceUnpaidExperimentVariants(drafts);
    expect(balanced.reduce((sum, item) => sum + Number(item.percentage), 0)).toBeCloseTo(100, 5);
    expect([...validateUnpaidExperimentVariants(balanced).values()].flat()).toEqual([]);
  });

  it("rejects duplicate configurations and invalid allocation", () => {
    const drafts = [variant("A", "70", "3"), variant("B", "20", "3")];
    drafts[1].stages[0].messageTemplate = drafts[0].stages[0].messageTemplate;
    const errors = validateUnpaidExperimentVariants(drafts);
    expect(errors.get("A")).toContain("duplicate");
    expect(errors.get("B")).toContain("duplicate");
    expect(errors.get("$weights")).toContain("weightTotal");
  });

  it("rejects duplicate enabled delays and an empty plan", () => {
    const a = variant("A", "50", "3");
    a.stages.push({ enabled: true, delayMinutes: "3", messageTemplate: "Follow up" });
    const b = variant("B", "50", "10");
    b.stages = [];
    const errors = validateUnpaidExperimentVariants([a, b]);
    expect(errors.get("A")).toContain("delay");
    expect(errors.get("B")).toEqual(expect.arrayContaining(["stages", "enabledStage"]));
  });

  it("binds Variant A to production stages without changing its allocation", () => {
    const result = bindProductionVariant(
      [variant("A", "35", "10"), variant("B", "65", "60")],
      [{ id: "production", enabled: true, delayMinutes: 3, messageTemplate: "Production" }],
    );
    expect(result[0]).toMatchObject({
      variantKey: "A",
      percentage: "35",
      stages: [{ id: "production", delayMinutes: "3", messageTemplate: "Production" }],
    });
    expect(result[1].stages[0].delayMinutes).toBe("60");
  });

  it("requires Variant A to be the unique first production option", () => {
    const errors = validateUnpaidExperimentVariants([
      variant("B", "50", "3"),
      variant("A", "50", "10"),
    ]);
    expect(errors.get("$production")).toContain("productionVariant");
  });
});
