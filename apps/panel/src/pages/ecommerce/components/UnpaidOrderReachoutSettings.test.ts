import { describe, expect, it } from "vitest";
import {
  rebalanceUnpaidExperimentVariants,
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
  it.each([2, 3, 6, 20])("accepts %i distinct variants after rebalancing", (count) => {
    const drafts = Array.from({ length: count }, (_, index) =>
      variant(`V${index + 1}`, "1", String(index + 1)),
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
});
