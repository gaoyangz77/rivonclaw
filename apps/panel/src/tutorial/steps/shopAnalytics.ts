import type { TutorialStep } from "../types.js";

export const shopAnalyticsSteps: TutorialStep[] = [
  {
    target: ".sps-hero",
    titleKey: "tutorial.shopAnalytics.welcomeTitle",
    bodyKey: "tutorial.shopAnalytics.welcomeBody",
    placement: "bottom",
  },
  {
    target: ".sps-metric-selector",
    titleKey: "tutorial.shopAnalytics.metricsTitle",
    bodyKey: "tutorial.shopAnalytics.metricsBody",
    placement: "bottom",
  },
  {
    target: ".sps-chart-card",
    titleKey: "tutorial.shopAnalytics.trendTitle",
    bodyKey: "tutorial.shopAnalytics.trendBody",
    placement: "top",
  },
];
