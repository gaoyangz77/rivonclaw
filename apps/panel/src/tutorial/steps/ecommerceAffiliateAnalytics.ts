import type { TutorialStep } from "../types.js"
import { clickTutorialTarget, tutorialTarget } from "../targets.js"

function step(
  id: string,
  targetId: string,
  key: string,
  placement: TutorialStep["placement"],
): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.ecommerceAffiliateAnalytics.${key}Title`,
    bodyKey: `tutorial.ecommerceAffiliateAnalytics.${key}Body`,
    placement,
  }
}

function openExplore() {
  clickTutorialTarget("affiliate-analytics-explore-tab")
}

function restoreOverview() {
  clickTutorialTarget("affiliate-analytics-overview-tab")
}

export const ecommerceAffiliateAnalyticsSteps: TutorialStep[] = [
  step("affiliate-analytics-welcome", "affiliate-analytics-header", "welcome", "bottom"),
  step("affiliate-analytics-scope", "affiliate-analytics-controls", "scope", "bottom"),
  step("affiliate-analytics-reachout", "affiliate-analytics-reachout", "reachout", "bottom"),
  step("affiliate-analytics-approval", "affiliate-analytics-approval", "approval", "top"),
  step("affiliate-analytics-post-approval", "affiliate-analytics-post-approval", "postApproval", "top"),
  {
    ...step("affiliate-analytics-explore", "affiliate-analytics-query", "explore", "bottom"),
    prepare: openExplore,
    cleanup: restoreOverview,
    lifecycleGroup: "affiliate-analytics-explore",
    targetTimeoutMs: 1200,
  },
  {
    ...step("affiliate-analytics-results", "affiliate-analytics-explore", "results", "top"),
    lifecycleGroup: "affiliate-analytics-explore",
    targetTimeoutMs: 1200,
  },
]
