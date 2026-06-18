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
import { ecommerceCustomerServiceSteps } from "./ecommerceCustomerService.js"
import { ecommerceAffiliateSteps } from "./ecommerceAffiliate.js"
import { inventoryManagementSteps } from "./inventoryManagement.js"

const stepRegistry: Record<string, TutorialStep[]> = {
  "/": chatSteps,
  "/commerce/shops": ecommerceSteps,
  "/commerce/customer-service": ecommerceCustomerServiceSteps,
  "/commerce/customer-service/conversations": ecommerceCustomerServiceSteps,
  "/commerce/customer-service/escalations": ecommerceCustomerServiceSteps,
  "/commerce/affiliate": ecommerceAffiliateSteps,
  "/commerce/affiliate/attention": ecommerceAffiliateSteps,
  "/commerce/affiliate/history": ecommerceAffiliateSteps,
  "/commerce/affiliate/intelligence": ecommerceAffiliateSteps,
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
