import type { TutorialStep } from "../types.js"

export const adsManagementSteps: TutorialStep[] = [
  {
    target: ".ecommerce-page-header",
    titleKey: "tutorial.adsManagement.welcomeTitle",
    bodyKey: "tutorial.adsManagement.welcomeBody",
    placement: "bottom",
  },
  {
    target: ".ecommerce-header-actions",
    titleKey: "tutorial.adsManagement.actionsTitle",
    bodyKey: "tutorial.adsManagement.actionsBody",
    placement: "left",
  },
  {
    target: ".ads-summary-strip",
    titleKey: "tutorial.adsManagement.summaryTitle",
    bodyKey: "tutorial.adsManagement.summaryBody",
    placement: "bottom",
  },
  {
    target: ".ads-advertiser-section:first-of-type",
    titleKey: "tutorial.adsManagement.advertisersTitle",
    bodyKey: "tutorial.adsManagement.advertisersBody",
    placement: "bottom",
  },
  {
    target: ".ads-shop-readiness-section",
    titleKey: "tutorial.adsManagement.shopCoverageTitle",
    bodyKey: "tutorial.adsManagement.shopCoverageBody",
    placement: "top",
  },
]
