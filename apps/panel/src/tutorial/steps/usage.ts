import type { TutorialStep } from "../types.js"
import { tutorialTarget } from "../targets.js"

function step(id: string, targetId: string, key: string, placement: TutorialStep["placement"]): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.usage.${key}Title`,
    bodyKey: `tutorial.usage.${key}Body`,
    placement,
  }
}

export const usageSteps: TutorialStep[] = [
  step("usage-welcome", "usage-header", "welcome", "bottom"),
  step("usage-today", "usage-today", "today", "bottom"),
  step("usage-range", "usage-range", "timeRange", "bottom"),
  step("usage-history", "usage-history", "blocks", "bottom"),
  step("usage-chart", "usage-chart", "chart", "top"),
  step("usage-updated", "usage-updated", "lastUpdated", "top"),
]
