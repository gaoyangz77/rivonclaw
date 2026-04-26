import type { TutorialStep } from "../types.js"
import { chatSteps } from "./chat.js"
import { channelsSteps } from "./channels.js"
import { permissionsSteps } from "./permissions.js"
import { providersSteps } from "./providers.js"
import { skillsSteps } from "./skills.js"
import { cronsSteps } from "./crons.js"
import { extrasSteps } from "./extras.js"
import { usageSteps } from "./usage.js"
import { settingsSteps } from "./settings.js"
import { browserProfilesSteps } from "./browser-profiles.js"
import { accountSteps } from "./account.js"

const stepRegistry: Record<string, TutorialStep[]> = {
  "/": chatSteps,
  "/channels": channelsSteps,
  "/permissions": permissionsSteps,
  "/providers": providersSteps,
  "/skills": skillsSteps,
  "/crons": cronsSteps,
  "/extras": extrasSteps,
  "/usage": usageSteps,
  "/settings": settingsSteps,
  "/browser-profiles": browserProfilesSteps,
  "/account": accountSteps,
}

export function getStepsForRoute(route: string): TutorialStep[] {
  return stepRegistry[route] ?? []
}
