import type { TutorialStep } from "../types.js"

export const inventoryManagementSteps: TutorialStep[] = [
  {
    target: ".inventory-page .ecommerce-page-header",
    titleKey: "tutorial.inventoryManagement.welcomeTitle",
    bodyKey: "tutorial.inventoryManagement.welcomeBody",
    placement: "bottom",
  },
  {
    target: ".wms-account-table, .empty-cell",
    titleKey: "tutorial.inventoryManagement.wmsTitle",
    bodyKey: "tutorial.inventoryManagement.wmsBody",
    placement: "bottom",
  },
  {
    target: ".inventory-goods-section",
    titleKey: "tutorial.inventoryManagement.goodsTitle",
    bodyKey: "tutorial.inventoryManagement.goodsBody",
    placement: "top",
  },
]
