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

function openFirstCampaignDetail() {
  if (!findTutorialTarget("affiliate-campaign-detail-overview")) {
    clickTutorialTarget("affiliate-campaign-item")
  }
}

function closeCampaignDetail() {
  if (findTutorialTarget("affiliate-campaign-detail-overview")) {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
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
  {
    ...step(
      "affiliate-campaign-detail-overview",
      "affiliate-campaign-detail-overview",
      "detailOverview",
      "bottom",
    ),
    prepare: openFirstCampaignDetail,
    cleanup: closeCampaignDetail,
    lifecycleGroup: "affiliate-campaign-detail",
    targetTimeoutMs: 1200,
  },
  {
    ...step(
      "affiliate-campaign-detail-operations",
      "affiliate-campaign-detail-operations",
      "detailOperations",
      "top",
    ),
    lifecycleGroup: "affiliate-campaign-detail",
    targetTimeoutMs: 1200,
  },
  step("affiliate-campaign-create", "affiliate-campaign-create", "create", "bottom"),
  {
    ...step(
      "affiliate-campaign-wizard-stages",
      "affiliate-campaign-wizard-stages",
      "wizardStages",
      "bottom",
    ),
    prepare: ensureCampaignWizardOpen,
    cleanup: closeCampaignWizard,
    lifecycleGroup: "affiliate-campaign-wizard",
    targetTimeoutMs: 1800,
  },
  {
    ...step("affiliate-campaign-wizard", "affiliate-campaign-wizard", "wizard", "bottom"),
    lifecycleGroup: "affiliate-campaign-wizard",
    targetTimeoutMs: 1800,
  },
]
