import type { TutorialStep } from "../types.js"
import { tutorialTarget } from "../targets.js"

function step(id: string, targetId: string, key: string, placement: TutorialStep["placement"]): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.chat.${key}Title`,
    bodyKey: `tutorial.chat.${key}Body`,
    placement,
  }
}

export const chatSteps: TutorialStep[] = [
  step("chat-welcome", "chat-page", "welcome", "bottom"),
  step("chat-sessions", "chat-sessions", "sessionTabs", "right"),
  step("chat-new-session", "chat-new-session", "newSessionBtn", "bottom"),
  step("chat-archived", "chat-archived", "archivedBtn", "top"),
  step("chat-messages", "chat-messages", "messageArea", "bottom"),
  step("chat-examples", "chat-examples", "examples", "top"),
  step("chat-controls", "chat-controls", "statusBar", "top"),
  step("chat-input", "chat-input", "inputArea", "top"),
]
