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
    titleKey: `tutorial.ecommerceAffiliateHistory.${key}Title`,
    bodyKey: `tutorial.ecommerceAffiliateHistory.${key}Body`,
    placement,
    targetTimeoutMs,
  }
}

export const ecommerceAffiliateHistorySteps: TutorialStep[] = [
  step("affiliate-history-welcome", "affiliate-history-header", "welcome", "bottom"),
  step("affiliate-history-controls", "affiliate-history-controls", "controls", "bottom"),
  step("affiliate-history-filters", "affiliate-history-filters", "filters", "top"),
  step("affiliate-history-results", "affiliate-history-results", "results", "top", 5000),
]
