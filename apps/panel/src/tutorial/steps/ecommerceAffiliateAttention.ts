import type { TutorialStep } from "../types.js"
import { clickTutorialTarget, tutorialTarget } from "../targets.js"

type WorkbenchTab = "pending-agent" | "escalations" | "samples" | "messages"

async function selectWorkbenchTab(tab: WorkbenchTab) {
  clickTutorialTarget(`affiliate-workbench-tab-${tab}`)
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
}

function workbenchStep(
  id: string,
  targetId: string,
  key: string,
  placement: TutorialStep["placement"],
  tab: Exclude<WorkbenchTab, "pending-agent">,
): TutorialStep {
  return {
    ...step(id, targetId, key, placement, 5000),
    prepare: () => selectWorkbenchTab(tab),
    cleanup: () => selectWorkbenchTab("pending-agent"),
  }
}

function step(
  id: string,
  targetId: string,
  key: string,
  placement: TutorialStep["placement"],
  targetTimeoutMs?: number,
): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.ecommerceAffiliateAttention.${key}Title`,
    bodyKey: `tutorial.ecommerceAffiliateAttention.${key}Body`,
    placement,
    targetTimeoutMs,
  }
}

export const ecommerceAffiliateAttentionSteps: TutorialStep[] = [
  step("affiliate-attention-welcome", "affiliate-attention-header", "welcome", "bottom"),
  step("affiliate-attention-scope", "affiliate-attention-scope", "scope", "bottom"),
  step("affiliate-attention-filters", "affiliate-attention-filters", "filters", "top"),
  step("affiliate-attention-queue", "affiliate-attention-queue", "queue", "top", 5000),
  workbenchStep(
    "affiliate-workbench-escalations",
    "affiliate-workbench-escalations",
    "escalations",
    "top",
    "escalations",
  ),
  workbenchStep(
    "affiliate-workbench-samples",
    "affiliate-workbench-samples",
    "samples",
    "top",
    "samples",
  ),
  workbenchStep(
    "affiliate-workbench-messages",
    "affiliate-workbench-messages",
    "messages",
    "top",
    "messages",
  ),
]
