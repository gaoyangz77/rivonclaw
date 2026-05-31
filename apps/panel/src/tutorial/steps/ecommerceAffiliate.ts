import type { TutorialStep } from "../types.js"

export const ecommerceAffiliateSteps: TutorialStep[] = [
  {
    target: ".ecommerce-page-header",
    titleKey: "tutorial.ecommerceAffiliate.welcomeTitle",
    bodyKey: "tutorial.ecommerceAffiliate.welcomeBody",
    placement: "bottom",
  },
  {
    target: ".affiliate-proposal-panel",
    titleKey: "tutorial.ecommerceAffiliate.panelTitle",
    bodyKey: "tutorial.ecommerceAffiliate.panelBody",
    placement: "bottom",
  },
  {
    target: ".affiliate-proposal-toolbar",
    titleKey: "tutorial.ecommerceAffiliate.toolbarTitle",
    bodyKey: "tutorial.ecommerceAffiliate.toolbarBody",
    placement: "bottom",
  },
  {
    target: ".affiliate-workspace-shop-select",
    titleKey: "tutorial.ecommerceAffiliate.shopFilterTitle",
    bodyKey: "tutorial.ecommerceAffiliate.shopFilterBody",
    placement: "bottom",
  },
  {
    target: ".affiliate-proposal-group-list, .affiliate-proposal-empty",
    titleKey: "tutorial.ecommerceAffiliate.queueTitle",
    bodyKey: "tutorial.ecommerceAffiliate.queueBody",
    placement: "top",
  },
  {
    target: ".affiliate-proposal-card",
    titleKey: "tutorial.ecommerceAffiliate.proposalCardTitle",
    bodyKey: "tutorial.ecommerceAffiliate.proposalCardBody",
    placement: "bottom",
  },
  {
    target: ".affiliate-proposal-actions",
    titleKey: "tutorial.ecommerceAffiliate.actionsTitle",
    bodyKey: "tutorial.ecommerceAffiliate.actionsBody",
    placement: "top",
  },
]
