import type { TutorialStep } from "../types.js"
import { tutorialTarget } from "../targets.js"

function step(id: string, targetId: string, key: string, placement: TutorialStep["placement"]): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.adsManagement.${key}Title`,
    bodyKey: `tutorial.adsManagement.${key}Body`,
    placement,
  }
}

export const adsManagementSteps: TutorialStep[] = [
  step("ads-welcome", "ads-header", "welcome", "bottom"),
  step("ads-actions", "ads-actions", "actions", "left"),
  step("ads-summary", "ads-summary", "summary", "bottom"),
  step("ads-accounts", "ads-accounts", "advertisers", "bottom"),
  step("ads-account-filters", "ads-account-filters", "accountFilters", "bottom"),
  step("ads-coverage", "ads-coverage", "shopCoverage", "top"),
  step("ads-coverage-filters", "ads-coverage-filters", "coverageFilters", "top"),
]
