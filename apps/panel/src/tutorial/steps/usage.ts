import type { TutorialStep } from "../types.js"

export const usageSteps: TutorialStep[] = [
  // --- Overview ---
  {
    target: ".page-header h1",
    titleKey: "tutorial.usage.welcomeTitle",
    bodyKey: "tutorial.usage.welcomeBody",
    placement: "bottom",
  },
  {
    target: ".page-header-actions .btn-secondary",
    titleKey: "tutorial.usage.refreshTitle",
    bodyKey: "tutorial.usage.refreshBody",
    placement: "left",
  },
  // --- Today's usage ---
  {
    target: ".usage-section-title",
    titleKey: "tutorial.usage.todayTitle",
    bodyKey: "tutorial.usage.todayBody",
    placement: "bottom",
  },
  {
    target: ".usage-blocks",
    titleKey: "tutorial.usage.blocksTitle",
    bodyKey: "tutorial.usage.blocksBody",
    placement: "bottom",
  },
  {
    target: ".usage-key-block:first-child .usage-key-header",
    titleKey: "tutorial.usage.keyHeaderTitle",
    bodyKey: "tutorial.usage.keyHeaderBody",
    placement: "bottom",
  },
  {
    target: ".usage-inner-table",
    titleKey: "tutorial.usage.innerTableTitle",
    bodyKey: "tutorial.usage.innerTableBody",
    placement: "bottom",
  },
  // --- Time range ---
  {
    target: ".usage-time-range-bar",
    titleKey: "tutorial.usage.timeRangeTitle",
    bodyKey: "tutorial.usage.timeRangeBody",
    placement: "bottom",
  },
  // --- Chart ---
  {
    target: ".usage-chart-wrap",
    titleKey: "tutorial.usage.chartTitle",
    bodyKey: "tutorial.usage.chartBody",
    placement: "top",
  },
  // --- Last updated ---
  {
    target: ".td-meta",
    titleKey: "tutorial.usage.lastUpdatedTitle",
    bodyKey: "tutorial.usage.lastUpdatedBody",
    placement: "top",
  },
]
