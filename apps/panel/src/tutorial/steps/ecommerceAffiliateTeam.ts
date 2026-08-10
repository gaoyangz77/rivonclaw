import type { TutorialStep } from "../types.js"
import { clickTutorialTarget, tutorialTarget } from "../targets.js"

async function selectTeamTab(tab: "team" | "assignments" | "safety") {
  clickTutorialTarget(`affiliate-team-tab-${tab}`)
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
}

function step(
  id: string,
  targetId: string,
  key: string,
  placement: TutorialStep["placement"],
  tab?: "assignments" | "safety",
): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.ecommerceAffiliateTeam.${key}Title`,
    bodyKey: `tutorial.ecommerceAffiliateTeam.${key}Body`,
    placement,
    ...(tab ? {
      prepare: () => selectTeamTab(tab),
      cleanup: () => selectTeamTab("team"),
      targetTimeoutMs: 1800,
    } : {}),
  }
}

export const ecommerceAffiliateTeamSteps: TutorialStep[] = [
  step("affiliate-team-welcome", "affiliate-team-header", "welcome", "bottom"),
  step("affiliate-team-tabs", "affiliate-team-tabs", "tabs", "bottom"),
  step("affiliate-team-responsibilities", "affiliate-team-responsibilities", "responsibilities", "top"),
  step("affiliate-team-assignments", "affiliate-team-assignments", "assignments", "top", "assignments"),
  step("affiliate-team-safety", "affiliate-team-safety", "safety", "top", "safety"),
]
