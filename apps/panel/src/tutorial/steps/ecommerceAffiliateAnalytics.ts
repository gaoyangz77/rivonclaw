import type { TutorialStep } from "../types.js";
import { clickTutorialTarget, tutorialTarget } from "../targets.js";

function step(
  id: string,
  targetId: string,
  key: string,
  placement: TutorialStep["placement"],
): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.ecommerceAffiliateAnalytics.${key}Title`,
    bodyKey: `tutorial.ecommerceAffiliateAnalytics.${key}Body`,
    placement,
  };
}

function openExplore() {
  clickTutorialTarget("affiliate-analytics-explore-tab");
}

function restoreOverview() {
  clickTutorialTarget("affiliate-analytics-overview-tab");
}

function openDetails() {
  clickTutorialTarget("affiliate-analytics-details-tab");
}

function detailSteps(detailsOnly = false): TutorialStep[] {
  return [
    ["query", "detailsQuery", "bottom"],
    ["filters", "detailsFilters", "bottom"],
    ["results", "detailsResults", "top"],
  ].map(([target, key, placement]) => ({
    ...step(
      `affiliate-analytics-details-${target}`,
      `affiliate-analytics-details-${target}`,
      key,
      placement as TutorialStep["placement"],
    ),
    prepare: openDetails,
    cleanup: detailsOnly ? openDetails : restoreOverview,
    lifecycleGroup: "affiliate-analytics-details",
    targetTimeoutMs: 5000,
  }));
}

export const ecommerceAffiliateAnalyticsBdSteps: TutorialStep[] = [
  {
    ...step("affiliate-analytics-welcome", "affiliate-analytics-header", "bdWelcome", "bottom"),
    prepare: openDetails,
  },
  ...detailSteps(true),
];

export const ecommerceAffiliateAnalyticsSteps: TutorialStep[] = [
  {
    ...step("affiliate-analytics-welcome", "affiliate-analytics-header", "welcome", "bottom"),
    prepare: restoreOverview,
  },
  step("affiliate-analytics-tabs", "affiliate-analytics-tabs", "tabs", "bottom"),
  step("affiliate-analytics-scope", "affiliate-analytics-controls", "scope", "bottom"),
  step("affiliate-analytics-reachout", "affiliate-analytics-reachout", "reachout", "bottom"),
  step("affiliate-analytics-approval", "affiliate-analytics-approval", "approval", "top"),
  step(
    "affiliate-analytics-post-approval",
    "affiliate-analytics-post-approval",
    "postApproval",
    "top",
  ),
  {
    ...step("affiliate-analytics-explore", "affiliate-analytics-query", "explore", "bottom"),
    prepare: openExplore,
    cleanup: restoreOverview,
    lifecycleGroup: "affiliate-analytics-explore",
    targetTimeoutMs: 1200,
  },
  {
    ...step("affiliate-analytics-results", "affiliate-analytics-explore", "results", "top"),
    prepare: openExplore,
    cleanup: restoreOverview,
    lifecycleGroup: "affiliate-analytics-explore",
    targetTimeoutMs: 1200,
  },
  ...detailSteps(),
];
