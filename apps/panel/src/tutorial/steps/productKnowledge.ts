import type { TutorialStep } from "../types.js";
import { tutorialTarget } from "../targets.js";

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
];
