import type { TutorialStep } from "../types.js"
import { tutorialTarget } from "../targets.js"

function step(
  id: string,
  targetId: string,
  key: string,
  placement: TutorialStep["placement"],
  targetTimeoutMs?: number,
): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.ecommerceAffiliateCreators.${key}Title`,
    bodyKey: `tutorial.ecommerceAffiliateCreators.${key}Body`,
    placement,
    targetTimeoutMs,
  }
}

export const ecommerceAffiliateCreatorsSteps: TutorialStep[] = [
  step("affiliate-creators-welcome", "affiliate-creators-header", "welcome", "bottom"),
  step("affiliate-creators-controls", "affiliate-creators-controls", "controls", "bottom"),
  step("affiliate-creators-filters", "affiliate-creators-filters", "filters", "top"),
  step("affiliate-creators-results", "affiliate-creators-results", "results", "top", 5000),
]
