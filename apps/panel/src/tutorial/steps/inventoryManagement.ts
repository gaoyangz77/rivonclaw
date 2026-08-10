import type { TutorialStep } from "../types.js"
import { tutorialTarget } from "../targets.js"

function step(id: string, targetId: string, key: string, placement: TutorialStep["placement"]): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.inventoryManagement.${key}Title`,
    bodyKey: `tutorial.inventoryManagement.${key}Body`,
    placement,
  }
}

export const inventoryManagementSteps: TutorialStep[] = [
  step("inventory-welcome", "inventory-header", "welcome", "bottom"),
  step("inventory-wms", "shops-wms", "wms", "bottom"),
  step("inventory-goods", "inventory-goods", "goods", "top"),
  step("inventory-actions", "inventory-goods-actions", "actions", "left"),
  step("inventory-filters", "inventory-goods-filters", "filters", "bottom"),
  step("inventory-table", "inventory-goods-table", "table", "top"),
  step("inventory-pagination", "inventory-pagination", "pagination", "top"),
]
