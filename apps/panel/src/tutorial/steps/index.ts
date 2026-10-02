import type { TutorialStep } from "../types.js";
import { chatSteps } from "./chat.js";
import { channelsSteps } from "./channels.js";
import { providersSteps } from "./providers.js";
import { skillsSteps } from "./skills.js";
import { cronsSteps } from "./crons.js";
import { extrasSteps } from "./extras.js";
import { usageSteps } from "./usage.js";
import { settingsSteps } from "./settings.js";
import { accountSteps } from "./account.js";
import { billingSteps } from "./billing.js";
import { ecommerceSteps } from "./ecommerce.js";
import { adsManagementSteps } from "./adsManagement.js";
import {
  customerServiceWorkspaceSteps,
  customerServiceConversationsSteps,
  customerServiceEscalationsSteps,
  customerServicePerformanceSteps,
  customerServiceExperimentsSteps,
} from "./ecommerceCustomerService.js";
import {
  ecommerceAffiliateAttentionSteps,
  ecommerceAffiliateManualWorkbenchSteps,
} from "./ecommerceAffiliateAttention.js";
import { ecommerceAffiliateCampaignSteps } from "./ecommerceAffiliateCampaign.js";
import {
  ecommerceAffiliateAnalyticsSteps,
  ecommerceAffiliateAnalyticsBdSteps,
} from "./ecommerceAffiliateAnalytics.js";
import { ecommerceAffiliateCreatorsSteps } from "./ecommerceAffiliateCreators.js";
import { ecommerceAffiliateHistorySteps } from "./ecommerceAffiliateHistory.js";
import { ecommerceAffiliateIntelligenceSteps } from "./ecommerceAffiliateIntelligence.js";
import { ecommerceAffiliateTeamSteps } from "./ecommerceAffiliateTeam.js";
import { inventoryManagementSteps } from "./inventoryManagement.js";
import { shopAnalyticsSteps } from "./shopAnalytics.js";
import { productKnowledgeSteps } from "./productKnowledge.js";
import { tutorialTarget } from "../targets.js";

const stepRegistry: Record<string, TutorialStep[]> = {
  "/": chatSteps,
  "/commerce/shops": ecommerceSteps,
  "/commerce/shop-analytics": shopAnalyticsSteps,
  "/commerce/product-knowledge": productKnowledgeSteps,
  "/commerce/customer-service": customerServiceWorkspaceSteps,
  "/commerce/customer-service/conversations": customerServiceConversationsSteps,
  "/commerce/customer-service/escalations": customerServiceEscalationsSteps,
  "/commerce/customer-service/performance": customerServicePerformanceSteps,
  "/commerce/customer-service/experiments": customerServiceExperimentsSteps,
  "/commerce/affiliate": ecommerceAffiliateCreatorsSteps,
  "/commerce/affiliate/attention": ecommerceAffiliateAttentionSteps,
  "/commerce/affiliate/manual-workbench": ecommerceAffiliateManualWorkbenchSteps,
  "/commerce/affiliate/history": ecommerceAffiliateHistorySteps,
  "/commerce/affiliate/creators": ecommerceAffiliateCreatorsSteps,
  "/commerce/affiliate/intelligence": ecommerceAffiliateIntelligenceSteps,
  "/commerce/affiliate/team": ecommerceAffiliateTeamSteps,
  "/commerce/affiliate/campaigns": ecommerceAffiliateCampaignSteps,
  "/commerce/affiliate/analytics": ecommerceAffiliateAnalyticsSteps,
  "/commerce/ads": adsManagementSteps,
  "/commerce/inventory": inventoryManagementSteps,
  "/automation/skills": skillsSteps,
  "/automation/crons": cronsSteps,
  "/connections/channels": channelsSteps,
  "/connections/models": providersSteps,
  "/connections/extensions": extrasSteps,
  "/account/usage": usageSteps,
  "/account/billing": billingSteps,
  "/account/profile": accountSteps,
  "/account/settings": settingsSteps,
};

export function getStepsForRoute(
  route: string,
  {
    businessDeveloperOnly = false,
    workspaceTabsEnabled = false,
    isOwner = true,
  }: {
    businessDeveloperOnly?: boolean;
    workspaceTabsEnabled?: boolean;
    isOwner?: boolean;
  } = {},
): TutorialStep[] {
  let steps = stepRegistry[route] ?? [];
  if (!isOwner && route === "/account/profile") {
    steps = steps.filter((step) => !["account-members", "account-roles"].includes(step.id ?? ""));
  }
  if (businessDeveloperOnly && route === "/commerce/affiliate/analytics") {
    steps = ecommerceAffiliateAnalyticsBdSteps;
  }
  if (businessDeveloperOnly && route === "/commerce/product-knowledge") {
    steps = productKnowledgeSteps
      .filter((step) => step.id !== "product-knowledge-create")
      .map((step) =>
        step.id === "product-knowledge-welcome"
          ? { ...step, bodyKey: "tutorial.productKnowledge.readOnlyBody" }
          : step.id === "product-knowledge-library"
            ? { ...step, bodyKey: "tutorial.productKnowledge.readOnlyLibraryBody" }
            : step.id === "product-knowledge-content"
              ? { ...step, bodyKey: "tutorial.productKnowledge.readOnlyContentBody" }
              : step.id === "product-knowledge-bindings"
                ? { ...step, bodyKey: "tutorial.productKnowledge.readOnlyBindingsBody" }
                : step,
      );
  }
  if (!workspaceTabsEnabled || steps.length === 0) return steps;
  return [
    {
      id: "workspace-page-tabs",
      target: tutorialTarget("workspace-tabs"),
      titleKey: "tutorial.workspace.tabsTitle",
      bodyKey: "tutorial.workspace.tabsBody",
      placement: "bottom",
    },
    ...steps,
  ];
}
