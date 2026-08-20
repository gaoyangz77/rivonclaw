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
    titleKey: `tutorial.ecommerceAffiliateAttention.${key}Title`,
    bodyKey: `tutorial.ecommerceAffiliateAttention.${key}Body`,
    placement,
    targetTimeoutMs,
  }
}

export const ecommerceAffiliateAttentionSteps: TutorialStep[] = [
  step("affiliate-attention-welcome", "affiliate-attention-header", "welcome", "bottom"),
  step("affiliate-attention-controls", "affiliate-attention-controls", "controls", "bottom"),
  step("affiliate-attention-scope", "affiliate-attention-scope", "scope", "bottom"),
  step("affiliate-attention-filters", "affiliate-attention-filters", "filters", "top"),
  step("affiliate-attention-queue", "affiliate-attention-queue", "queue", "top", 5000),
]
