import type { TutorialStep } from "../types.js"
import { tutorialTarget } from "../targets.js"

function step(id: string, targetId: string, key: string, placement: TutorialStep["placement"]): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.settings.${key}Title`,
    bodyKey: `tutorial.settings.${key}Body`,
    placement,
  }
}

export const settingsSteps: TutorialStep[] = [
  step("settings-welcome", "settings-page", "welcome", "bottom"),
  step("settings-agent", "settings-agent", "agentSection", "bottom"),
  step("settings-chat", "settings-chat", "chatSection", "bottom"),
  step("settings-app", "settings-app", "appSection", "bottom"),
  step("settings-tutorial", "settings-tutorial", "tutorialToggle", "bottom"),
  step("settings-auto-launch", "settings-auto-launch", "autoLaunch", "bottom"),
  step("settings-data", "settings-data", "dataAndLogs", "bottom"),
  step("settings-telemetry", "settings-telemetry", "telemetryToggle", "bottom"),
  step("settings-dependencies", "settings-dependencies", "installDeps", "bottom"),
  step("settings-diagnostics", "settings-diagnostics", "diagnostics", "top"),
]
