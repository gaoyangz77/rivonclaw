import type { TutorialStep } from "../types.js"
import { tutorialTarget } from "../targets.js"

function step(id: string, targetId: string, key: string, placement: TutorialStep["placement"]): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.extras.${key}Title`,
    bodyKey: `tutorial.extras.${key}Body`,
    placement,
  }
}

export const extrasSteps: TutorialStep[] = [
  step("extras-welcome", "extras-header", "welcome", "bottom"),
  step("extras-stt", "extras-stt", "sttHead", "bottom"),
  step("extras-search", "extras-search", "webSearchHead", "bottom"),
  step("extras-embedding", "extras-embedding", "embeddingHead", "top"),
]
