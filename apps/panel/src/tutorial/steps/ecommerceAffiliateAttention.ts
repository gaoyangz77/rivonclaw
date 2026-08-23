import type { TutorialStep } from "../types.js"
import { clickTutorialTarget, findTutorialTarget, tutorialTarget } from "../targets.js"

function openFirstAgentWorkBundle() {
  if (!findTutorialTarget("affiliate-attention-detail")) {
    clickTutorialTarget("affiliate-attention-bundle")
  }
}

function closeAgentWorkBundle() {
  if (findTutorialTarget("affiliate-attention-detail")) {
    clickTutorialTarget("affiliate-attention-detail-close")
  }
}

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
  {
    ...step(
      "affiliate-attention-detail-context",
      "affiliate-attention-detail-context",
      "detailContext",
      "right",
      1200,
    ),
    prepare: openFirstAgentWorkBundle,
    cleanup: closeAgentWorkBundle,
    lifecycleGroup: "affiliate-attention-detail",
  },
  {
    ...step(
      "affiliate-attention-detail-decision",
      "affiliate-attention-detail-decision",
      "detailDecision",
      "left",
      1200,
    ),
    lifecycleGroup: "affiliate-attention-detail",
  },
]
