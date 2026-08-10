import type { TutorialStep } from "../types.js"
import { clickTutorialTarget, findTutorialTarget, tutorialTarget } from "../targets.js"

function ensureCronFormOpen() {
  if (!findTutorialTarget("crons-form")) clickTutorialTarget("crons-add")
}

function closeCronForm() {
  if (findTutorialTarget("crons-form")) clickTutorialTarget("crons-form-cancel")
}

function pageStep(
  id: string,
  targetId: string,
  key: string,
  placement: TutorialStep["placement"],
): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.crons.${key}Title`,
    bodyKey: `tutorial.crons.${key}Body`,
    placement,
  }
}

function formStep(id: string, targetId: string, key: string): TutorialStep {
  return {
    ...pageStep(id, targetId, key, "bottom"),
    prepare: ensureCronFormOpen,
    cleanup: closeCronForm,
    lifecycleGroup: "crons-form",
    targetTimeoutMs: 1800,
  }
}

export const cronsSteps: TutorialStep[] = [
  pageStep("crons-welcome", "crons-page", "welcome", "bottom"),
  pageStep("crons-status", "crons-status", "statusBar", "bottom"),
  pageStep("crons-toolbar", "crons-toolbar", "toolbar", "bottom"),
  pageStep("crons-table", "crons-table", "table", "top"),
  formStep("crons-form-overview", "crons-form", "formOverview"),
  formStep("crons-form-basics", "crons-form-basics", "formBasics"),
  formStep("crons-form-delivery", "crons-form-delivery", "formDelivery"),
  formStep("crons-form-payload", "crons-form-payload", "formPayload"),
  formStep("crons-form-schedule", "crons-form-schedule", "formSchedule"),
  formStep("crons-form-execution", "crons-form-execution", "formExecution"),
]
