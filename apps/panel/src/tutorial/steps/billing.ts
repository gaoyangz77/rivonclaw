import type { TutorialStep } from "../types.js"
import { tutorialTarget } from "../targets.js"

function step(id: string, targetId: string, key: string, placement: TutorialStep["placement"]): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.billing.${key}Title`,
    bodyKey: `tutorial.billing.${key}Body`,
    placement,
  }
}

export const billingSteps: TutorialStep[] = [
  step("billing-welcome", "billing-page", "welcome", "bottom"),
  step("billing-overview", "billing-overview", "overview", "bottom"),
  step("billing-account-plan", "billing-account-plan", "accountPlan", "bottom"),
  step("billing-shop-services", "billing-shop-services", "shopServices", "bottom"),
  step("billing-subscribe", "billing-subscribe-flow", "subscribeFlow", "bottom"),
  step("billing-shop-list", "billing-shop-list", "shopList", "bottom"),
  step("billing-payments", "billing-payments", "payments", "top"),
]
