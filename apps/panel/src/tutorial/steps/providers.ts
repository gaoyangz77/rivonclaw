import type { TutorialStep } from "../types.js"
import { tutorialTarget } from "../targets.js"

function step(id: string, targetId: string, key: string, placement: TutorialStep["placement"]): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.providers.${key}Title`,
    bodyKey: `tutorial.providers.${key}Body`,
    placement,
  }
}

export const providersSteps: TutorialStep[] = [
  step("providers-welcome", "providers-page", "welcome", "bottom"),
  step("providers-types", "providers-tabs", "tabBar", "bottom"),
  step("providers-select", "providers-selector", "providerSelect", "bottom"),
  step("providers-setup", "providers-setup", "setupFlow", "bottom"),
  step("providers-info", "providers-info", "pricingPanel", "left"),
  step("providers-configured", "providers-configured", "configured", "bottom"),
  step("providers-actions", "providers-keys", "currentActions", "top"),
]
