import type { TutorialStep } from "../types.js"

export const billingSteps: TutorialStep[] = [
  {
    target: ".billing-page",
    titleKey: "tutorial.billing.welcomeTitle",
    bodyKey: "tutorial.billing.welcomeBody",
    placement: "bottom",
  },
  {
    target: ".account-billing-section .account-section-header",
    titleKey: "tutorial.billing.overviewTitle",
    bodyKey: "tutorial.billing.overviewBody",
    placement: "bottom",
  },
  {
    target: ".billing-dashboard-grid",
    titleKey: "tutorial.billing.accountPlanTitle",
    bodyKey: "tutorial.billing.accountPlanBody",
    placement: "bottom",
  },
  {
    target: ".billing-usage-list, .billing-meta-grid",
    titleKey: "tutorial.billing.usageTitle",
    bodyKey: "tutorial.billing.usageBody",
    placement: "bottom",
  },
  {
    target: ".billing-account-actions, .billing-action-zone",
    titleKey: "tutorial.billing.accountActionsTitle",
    bodyKey: "tutorial.billing.accountActionsBody",
    placement: "top",
  },
  {
    target: ".billing-subsection",
    titleKey: "tutorial.billing.shopServicesTitle",
    bodyKey: "tutorial.billing.shopServicesBody",
    placement: "bottom",
  },
  {
    target: ".billing-shop-subscribe-flow",
    titleKey: "tutorial.billing.subscribeFlowTitle",
    bodyKey: "tutorial.billing.subscribeFlowBody",
    placement: "bottom",
  },
  {
    target: ".billing-shop-list",
    titleKey: "tutorial.billing.shopListTitle",
    bodyKey: "tutorial.billing.shopListBody",
    placement: "bottom",
  },
  {
    target: ".billing-table-wrap, .billing-subsection:last-child",
    titleKey: "tutorial.billing.paymentsTitle",
    bodyKey: "tutorial.billing.paymentsBody",
    placement: "top",
  },
]
