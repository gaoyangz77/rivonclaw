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
    titleKey: `tutorial.ecommerceBadReview.${key}Title`,
    bodyKey: `tutorial.ecommerceBadReview.${key}Body`,
    placement,
  };
}

export const ecommerceBadReviewSteps: TutorialStep[] = [
  step("bad-review-welcome", "bad-review-header", "welcome", "bottom"),
  step("bad-review-import", "bad-review-import", "import", "bottom"),
  step("bad-review-filters", "bad-review-filters", "filters", "bottom"),
  step("bad-review-table", "bad-review-table", "table", "top"),
];
