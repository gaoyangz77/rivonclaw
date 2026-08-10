import type { TutorialStep } from "../types.js"
import { clickTutorialTarget, findTutorialTarget, tutorialTarget } from "../targets.js"

function step(id: string, targetId: string, key: string, placement: TutorialStep["placement"]): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.ecommerce.${key}Title`,
    bodyKey: `tutorial.ecommerce.${key}Body`,
    placement,
  }
}

function ensureConnectForm() {
  if (!findTutorialTarget("shops-connect-form")) clickTutorialTarget("shops-add")
}

function closeConnectForm() {
  if (findTutorialTarget("shops-connect-form")) clickTutorialTarget("shops-connect-cancel")
}

function ensureShopDrawer() {
  if (findTutorialTarget("shops-drawer")?.classList.contains("drawer-panel-open")) return
  document.querySelector<HTMLElement>(".shop-table-actions .btn-secondary")?.click()
}

function closeShopDrawer() {
  if (findTutorialTarget("shops-drawer")?.classList.contains("drawer-panel-open")) {
    clickTutorialTarget("shops-drawer-close")
  }
}

export const ecommerceSteps: TutorialStep[] = [
  step("shops-welcome", "shops-header", "welcome", "bottom"),
  step("shops-list", "shops-list", "shops", "bottom"),
  step("shops-actions", "shops-actions", "shopActions", "left"),
  step("shops-table", "shops-table", "shopTable", "top"),
  step("shops-collections", "shops-table", "shopCollections", "top"),
  {
    ...step("shops-connect", "shops-connect-form", "connectFlow", "right"),
    prepare: ensureConnectForm,
    cleanup: closeConnectForm,
    targetTimeoutMs: 1800,
  },
  {
    ...step("shops-drawer", "shops-drawer-navigation", "drawer", "left"),
    prepare: ensureShopDrawer,
    cleanup: closeShopDrawer,
    targetTimeoutMs: 1800,
  },
]
