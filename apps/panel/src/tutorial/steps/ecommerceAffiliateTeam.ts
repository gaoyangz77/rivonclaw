import type { TutorialStep } from "../types.js";
import {
  clickTutorialTarget,
  findTutorialTarget,
  tutorialTarget,
  waitForTutorialTarget,
} from "../targets.js";

let openedLoginDetail = false;

async function openDeveloperLogin() {
  openedLoginDetail = false;
  // Keep any pre-existing detail and unsaved settings untouched.
  if (findTutorialTarget("affiliate-bd-detail")) return;
  if (!clickTutorialTarget("affiliate-team-developer")) return;
  openedLoginDetail = true;
  const tab = await waitForTutorialTarget(tutorialTarget("affiliate-bd-login-tab"), 5000);
  if (tab instanceof HTMLElement) tab.click();
}

function closeDeveloperLogin() {
  if (openedLoginDetail && findTutorialTarget("affiliate-bd-detail")) {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  }
  openedLoginDetail = false;
}

async function selectTeamTab(tab: "team" | "assignments" | "safety") {
  clickTutorialTarget(`affiliate-team-tab-${tab}`);
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

function step(
  id: string,
  targetId: string,
  key: string,
  placement: TutorialStep["placement"],
  tab?: "assignments" | "safety",
): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.ecommerceAffiliateTeam.${key}Title`,
    bodyKey: `tutorial.ecommerceAffiliateTeam.${key}Body`,
    placement,
    ...(tab
      ? {
          prepare: () => selectTeamTab(tab),
          cleanup: () => selectTeamTab("team"),
          targetTimeoutMs: 1800,
        }
      : {}),
  };
}

export const ecommerceAffiliateTeamSteps: TutorialStep[] = [
  {
    ...step("affiliate-team-welcome", "affiliate-team-header", "welcome", "bottom"),
    prepare: () => selectTeamTab("team"),
  },
  step("affiliate-team-tabs", "affiliate-team-tabs", "tabs", "bottom"),
  step(
    "affiliate-team-responsibilities",
    "affiliate-team-responsibilities",
    "responsibilities",
    "top",
  ),
  ...(["login", "loginScope"] as const).map(
    (key): TutorialStep => ({
      ...step(`affiliate-team-${key}`, `affiliate-bd-${key}`, key, "top"),
      prepare: openDeveloperLogin,
      cleanup: closeDeveloperLogin,
      lifecycleGroup: "affiliate-bd-login-detail",
      targetTimeoutMs: 5000,
    }),
  ),
  step(
    "affiliate-team-assignments",
    "affiliate-team-assignments",
    "assignments",
    "top",
    "assignments",
  ),
  step("affiliate-team-safety", "affiliate-team-safety", "safety", "top", "safety"),
];
