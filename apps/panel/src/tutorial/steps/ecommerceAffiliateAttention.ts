import type { TutorialStep } from "../types.js";
import { clickTutorialTarget, tutorialTarget } from "../targets.js";

type WorkbenchTab = "pending-agent" | "all-agent" | "escalations" | "samples" | "messages";

async function selectWorkbenchTab(tab: WorkbenchTab) {
  clickTutorialTarget(`affiliate-workbench-tab-${tab}`);
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

function workbenchStep(
  id: string,
  targetId: string,
  key: string,
  placement: TutorialStep["placement"],
  tab: Exclude<WorkbenchTab, "pending-agent">,
  returnTab: WorkbenchTab = "pending-agent",
): TutorialStep {
  return {
    ...step(id, targetId, key, placement, 5000),
    prepare: () => selectWorkbenchTab(tab),
    cleanup: () => selectWorkbenchTab(returnTab),
  };
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
  };
}

export const ecommerceAffiliateAttentionSteps: TutorialStep[] = [
  {
    ...step("affiliate-attention-welcome", "affiliate-attention-header", "welcome", "bottom"),
    prepare: () => selectWorkbenchTab("pending-agent"),
  },
  step("affiliate-attention-scope", "affiliate-attention-scope", "scope", "bottom"),
  step("affiliate-attention-filters", "affiliate-attention-filters", "filters", "top"),
  step("affiliate-attention-time", "affiliate-workbench-time", "agentTime", "bottom"),
  step("affiliate-attention-queue", "affiliate-attention-queue", "queue", "top", 5000),
  workbenchStep(
    "affiliate-workbench-all-agent",
    "affiliate-attention-queue",
    "allAgent",
    "top",
    "all-agent",
  ),
  workbenchStep(
    "affiliate-workbench-escalations",
    "affiliate-workbench-escalations",
    "escalations",
    "top",
    "escalations",
  ),
];

export const ecommerceAffiliateManualWorkbenchSteps: TutorialStep[] = [
  {
    ...step(
      "affiliate-manual-welcome",
      "affiliate-manual-workbench-header",
      "manualWelcome",
      "bottom",
    ),
    prepare: () => selectWorkbenchTab("samples"),
  },
  step("affiliate-manual-scope", "affiliate-attention-scope", "manualScope", "bottom"),
  workbenchStep(
    "affiliate-workbench-samples",
    "affiliate-workbench-sample-controls",
    "samples",
    "top",
    "samples",
    "samples",
  ),
  workbenchStep(
    "affiliate-samples-time",
    "affiliate-workbench-time",
    "sampleTime",
    "bottom",
    "samples",
    "samples",
  ),
  workbenchStep(
    "affiliate-workbench-messages",
    "affiliate-workbench-message-controls",
    "messages",
    "top",
    "messages",
    "samples",
  ),
  workbenchStep(
    "affiliate-messages-time",
    "affiliate-workbench-time",
    "messageTime",
    "bottom",
    "messages",
    "samples",
  ),
];
