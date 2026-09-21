import type { TutorialStep } from "../types.js";
import { clickTutorialTarget, findTutorialTarget, tutorialTarget } from "../targets.js";

// Only close a detail opened by this tour; never discard an existing editor.
let openedDetail = false;

function openKnowledgeDetail() {
  openedDetail = false;
  if (findTutorialTarget("product-knowledge-editor")) return;
  if (!findTutorialTarget("product-knowledge-item")) return;
  openedDetail = true;
  clickTutorialTarget("product-knowledge-item");
}

function closeKnowledgeDetail() {
  if (openedDetail && findTutorialTarget("product-knowledge-editor")) {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  }
  openedDetail = false;
}

function step(
  id: string,
  targetId: string,
  key: string,
  placement: TutorialStep["placement"],
): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.productKnowledge.${key}Title`,
    bodyKey: `tutorial.productKnowledge.${key}Body`,
    placement,
  };
}

export const productKnowledgeSteps: TutorialStep[] = [
  step("product-knowledge-welcome", "product-knowledge-header", "welcome", "bottom"),
  step("product-knowledge-create", "product-knowledge-create", "create", "bottom"),
  step("product-knowledge-library", "product-knowledge-library", "library", "top"),
  ...(["content", "bindings"] as const).map(
    (key): TutorialStep => ({
      ...step(`product-knowledge-${key}`, `product-knowledge-${key}`, key, "top"),
      prepare: openKnowledgeDetail,
      cleanup: closeKnowledgeDetail,
      lifecycleGroup: "product-knowledge-detail",
      targetTimeoutMs: 5000,
    }),
  ),
];
