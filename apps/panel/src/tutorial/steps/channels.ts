import type { TutorialStep } from "../types.js"
import { tutorialTarget } from "../targets.js"

function step(
  id: string,
  targetId: string,
  key: string,
  placement: TutorialStep["placement"],
): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.channels.${key}Title`,
    bodyKey: `tutorial.channels.${key}Body`,
    placement,
  }
}

export const channelsSteps: TutorialStep[] = [
  step("channels-welcome", "channels-header", "welcome", "bottom"),
  step("channels-add", "channels-add-account", "addSection", "bottom"),
  step("channels-selector", "channels-selector", "channelDropdown", "bottom"),
  step("channels-guidance", "channels-guidance", "infoBox", "bottom"),
  step("channels-accounts", "channels-accounts", "accountsTable", "top"),
  step("channels-health", "channels-accounts", "healthStatus", "top"),
  step("channels-recipients", "channels-recipients", "recipients", "top"),
  step("channels-updated", "channels-last-updated", "lastUpdated", "top"),
]
