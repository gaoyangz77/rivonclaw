import type { TutorialStep } from "../types.js"
import { chatSteps } from "./chat.js"
import { channelsSteps } from "./channels.js"
import { providersSteps } from "./providers.js"
import { skillsSteps } from "./skills.js"
import { cronsSteps } from "./crons.js"
import { extrasSteps } from "./extras.js"
import { usageSteps } from "./usage.js"
import { settingsSteps } from "./settings.js"
import { accountSteps } from "./account.js"
import { billingSteps } from "./billing.js"
import { ecommerceSteps } from "./ecommerce.js"
import { adsManagementSteps } from "./adsManagement.js"
import {
  customerServiceWorkspaceSteps,
  customerServiceConversationsSteps,
  customerServiceEscalationsSteps,
  customerServicePerformanceSteps,
  customerServiceExperimentsSteps,
} from "./ecommerceCustomerService.js"
import { ecommerceAffiliateSteps } from "./ecommerceAffiliate.js"
import { ecommerceAffiliateCampaignSteps } from "./ecommerceAffiliateCampaign.js"
import { ecommerceAffiliateIntelligenceSteps } from "./ecommerceAffiliateIntelligence.js"
import { ecommerceAffiliateTeamSteps } from "./ecommerceAffiliateTeam.js"
import { inventoryManagementSteps } from "./inventoryManagement.js"
import { shopAnalyticsSteps } from "./shopAnalytics.js"
import { productKnowledgeSteps } from "./productKnowledge.js"

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
  "/commerce/affiliate": ecommerceAffiliateSteps,
  "/commerce/affiliate/attention": ecommerceAffiliateSteps,
  "/commerce/affiliate/history": ecommerceAffiliateSteps,
  "/commerce/affiliate/creators": ecommerceAffiliateSteps,
  "/commerce/affiliate/intelligence": ecommerceAffiliateIntelligenceSteps,
  "/commerce/affiliate/team": ecommerceAffiliateTeamSteps,
  "/commerce/affiliate/campaigns": ecommerceAffiliateCampaignSteps,
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
}

export function getStepsForRoute(route: string): TutorialStep[] {
  return stepRegistry[route] ?? []
}
