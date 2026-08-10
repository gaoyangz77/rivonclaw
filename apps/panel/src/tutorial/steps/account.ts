import type { TutorialStep } from "../types.js"
import { tutorialTarget } from "../targets.js"

function step(id: string, targetId: string, key: string, placement: TutorialStep["placement"]): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.account.${key}Title`,
    bodyKey: `tutorial.account.${key}Body`,
    placement,
  }
}

export const accountSteps: TutorialStep[] = [
  step("account-welcome", "account-page", "welcome", "bottom"),
  step("account-profile", "account-profile", "profileCard", "bottom"),
  step("account-invite", "account-invite-code", "inviteCode", "bottom"),
  step("account-quota", "account-quota", "quotaFiveHour", "bottom"),
  step("account-surfaces", "account-surfaces", "surfacesSection", "bottom"),
  step("account-surface-actions", "account-surface-actions", "surfaceActions", "left"),
  step("account-profiles", "account-profiles", "profilesSection", "bottom"),
  step("account-default-profile", "account-default-profile", "defaultProfile", "bottom"),
]
