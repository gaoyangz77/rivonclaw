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
    titleKey: `tutorial.ecommerceAffiliateIntelligence.${key}Title`,
    bodyKey: `tutorial.ecommerceAffiliateIntelligence.${key}Body`,
    placement,
    targetTimeoutMs,
  }
}

export const ecommerceAffiliateIntelligenceSteps: TutorialStep[] = [
  step("affiliate-intelligence-welcome", "affiliate-intelligence-header", "welcome", "bottom"),
  step("affiliate-intelligence-refresh", "affiliate-intelligence-refresh", "refresh", "bottom"),
  step("affiliate-intelligence-scopes", "affiliate-intelligence-scopes", "scopes", "right", 5000),
  step("affiliate-intelligence-analysis", "affiliate-intelligence-analysis", "analysis", "left", 5000),
]
