import type { TutorialStep } from "../types.js"
import { clickTutorialTarget, findTutorialTarget, tutorialTarget } from "../targets.js"

function ensureCampaignWizardOpen() {
  if (!findTutorialTarget("affiliate-campaign-wizard")) {
    clickTutorialTarget("affiliate-campaign-create")
  }
}

function closeCampaignWizard() {
  if (findTutorialTarget("affiliate-campaign-wizard")) {
    clickTutorialTarget("affiliate-campaign-wizard-cancel")
  }
}

function step(
  id: string,
  targetId: string,
  key: string,
  placement: TutorialStep["placement"],
): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.ecommerceAffiliateCampaign.${key}Title`,
    bodyKey: `tutorial.ecommerceAffiliateCampaign.${key}Body`,
    placement,
  }
}

export const ecommerceAffiliateCampaignSteps: TutorialStep[] = [
  step("affiliate-campaign-welcome", "affiliate-campaign-header", "welcome", "bottom"),
  step("affiliate-campaign-summary", "affiliate-campaign-summary", "summary", "bottom"),
  step("affiliate-campaign-directory", "affiliate-campaign-directory", "directory", "top"),
  step("affiliate-campaign-create", "affiliate-campaign-create", "create", "bottom"),
  {
    ...step("affiliate-campaign-wizard", "affiliate-campaign-wizard", "wizard", "bottom"),
    prepare: ensureCampaignWizardOpen,
    cleanup: closeCampaignWizard,
    targetTimeoutMs: 1800,
  },
]
