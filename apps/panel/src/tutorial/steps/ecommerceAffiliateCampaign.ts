import type { TutorialStep } from "../types.js";
import { clickTutorialTarget, findTutorialTarget, tutorialTarget } from "../targets.js";

let openedWizard = false;
let openedDetail = false;

function ensureCampaignWizardOpen() {
  openedWizard = false;
  if (!findTutorialTarget("affiliate-campaign-wizard")) {
    openedWizard = clickTutorialTarget("affiliate-campaign-create");
  }
}

function closeCampaignWizard() {
  if (openedWizard && findTutorialTarget("affiliate-campaign-wizard")) {
    clickTutorialTarget("affiliate-campaign-wizard-cancel");
  }
  openedWizard = false;
}

function openFirstCampaignDetail() {
  openedDetail = false;
  if (!findTutorialTarget("affiliate-campaign-detail-overview")) {
    openedDetail = clickTutorialTarget("affiliate-campaign-item");
  }
}

function closeCampaignDetail() {
  if (openedDetail && findTutorialTarget("affiliate-campaign-detail-overview")) {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  }
  openedDetail = false;
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
  };
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
    prepare: openFirstCampaignDetail,
    cleanup: closeCampaignDetail,
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
    prepare: ensureCampaignWizardOpen,
    cleanup: closeCampaignWizard,
    lifecycleGroup: "affiliate-campaign-wizard",
    targetTimeoutMs: 1800,
  },
];
