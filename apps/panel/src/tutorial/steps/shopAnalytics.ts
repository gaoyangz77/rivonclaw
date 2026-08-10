import type { TutorialStep } from "../types.js"
import { tutorialTarget } from "../targets.js"

function step(id: string, targetId: string, key: string, placement: TutorialStep["placement"]): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.shopAnalytics.${key}Title`,
    bodyKey: `tutorial.shopAnalytics.${key}Body`,
    placement,
  }
}

export const shopAnalyticsSteps: TutorialStep[] = [
  step("analytics-welcome", "analytics-header", "welcome", "bottom"),
  step("analytics-metrics", "analytics-metrics", "metrics", "bottom"),
  step("analytics-summary", "analytics-summary", "summary", "bottom"),
  step("analytics-timeline", "analytics-timeline", "timeline", "bottom"),
  step("analytics-market", "analytics-market", "trend", "top"),
  step("analytics-shops", "analytics-shops", "shopDiagnosis", "top"),
]
