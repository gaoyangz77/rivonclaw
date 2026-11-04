import type { TutorialStep } from "../types.js";
import { tutorialTarget } from "../targets.js";

function step(
  id: string,
  targetId: string,
  key: string,
  placement: TutorialStep["placement"],
): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.ecommerceAfterSale.${key}Title`,
    bodyKey: `tutorial.ecommerceAfterSale.${key}Body`,
    placement,
  };
}

export const ecommerceAfterSaleSteps: TutorialStep[] = [
  step("after-sale-welcome", "after-sale-header", "welcome", "bottom"),
  step("after-sale-filters", "after-sale-filters", "filters", "bottom"),
  step("after-sale-table", "after-sale-table", "table", "top"),
];
