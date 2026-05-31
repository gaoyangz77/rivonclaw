import type { TutorialStep } from "../types.js"

export const ecommerceSteps: TutorialStep[] = [
  {
    target: ".ecommerce-page-header",
    titleKey: "tutorial.ecommerce.welcomeTitle",
    bodyKey: "tutorial.ecommerce.welcomeBody",
    placement: "bottom",
  },
  {
    target: ".ecommerce-section-header:first-child",
    titleKey: "tutorial.ecommerce.shopsTitle",
    bodyKey: "tutorial.ecommerce.shopsBody",
    placement: "bottom",
  },
  {
    target: ".ecommerce-section-header:first-child .ecommerce-section-actions",
    titleKey: "tutorial.ecommerce.shopActionsTitle",
    bodyKey: "tutorial.ecommerce.shopActionsBody",
    placement: "left",
  },
  {
    target: ".shop-table-wrap, .section-card:first-of-type .empty-cell",
    titleKey: "tutorial.ecommerce.shopTableTitle",
    bodyKey: "tutorial.ecommerce.shopTableBody",
    placement: "top",
  },
  {
    target: ".shop-alias-input",
    titleKey: "tutorial.ecommerce.shopAliasTitle",
    bodyKey: "tutorial.ecommerce.shopAliasBody",
    placement: "bottom",
  },
  {
    target: ".shop-table-actions",
    titleKey: "tutorial.ecommerce.shopRowActionsTitle",
    bodyKey: "tutorial.ecommerce.shopRowActionsBody",
    placement: "left",
  },
  {
    target: ".ecommerce-inventory-section",
    titleKey: "tutorial.ecommerce.wmsTitle",
    bodyKey: "tutorial.ecommerce.wmsBody",
    placement: "bottom",
  },
  {
    target: ".ecommerce-inventory-section .ecommerce-section-actions",
    titleKey: "tutorial.ecommerce.wmsActionsTitle",
    bodyKey: "tutorial.ecommerce.wmsActionsBody",
    placement: "left",
  },
  {
    target: ".wms-table-wrap, .ecommerce-inventory-section .empty-cell",
    titleKey: "tutorial.ecommerce.wmsTableTitle",
    bodyKey: "tutorial.ecommerce.wmsTableBody",
    placement: "top",
  },
  {
    target: ".drawer-panel-open",
    titleKey: "tutorial.ecommerce.drawerTitle",
    bodyKey: "tutorial.ecommerce.drawerBody",
    placement: "left",
    beforeAction: () => {
      const btn = document.querySelector(".shop-table-actions .btn-secondary") as HTMLElement | null
      btn?.click()
    },
  },
]
