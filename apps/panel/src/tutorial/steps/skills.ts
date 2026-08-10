import type { TutorialStep } from "../types.js"
import { clickTutorialTarget, tutorialTarget } from "../targets.js"

function step(id: string, targetId: string, key: string, placement: TutorialStep["placement"]): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.skills.${key}Title`,
    bodyKey: `tutorial.skills.${key}Body`,
    placement,
  }
}

export const skillsSteps: TutorialStep[] = [
  step("skills-welcome", "skills-header", "welcome", "bottom"),
  step("skills-tabs", "skills-tabs", "tabBar", "bottom"),
  step("skills-search", "skills-search", "search", "bottom"),
  step("skills-categories", "skills-categories", "categories", "bottom"),
  step("skills-market", "skills-market-grid", "grid", "bottom"),
  step("skills-pagination", "skills-pagination", "pagination", "top"),
  {
    ...step("skills-installed", "skills-installed-header", "installedTab", "bottom"),
    prepare: () => { clickTutorialTarget("skills-installed-tab") },
    cleanup: () => { clickTutorialTarget("skills-market-tab") },
    targetTimeoutMs: 1200,
  },
]
