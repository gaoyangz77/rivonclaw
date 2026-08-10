import type { TutorialStep } from "../types.js"
import { tutorialTarget } from "../targets.js"

export const customerServiceWorkspaceSteps: TutorialStep[] = [
  step("workspace-welcome", "cs-header", "welcome", "bottom"),
  step("workspace-tabs", "cs-workspace-tabs", "tabs", "bottom"),
  step("workspace-conversations", "cs-conversation-workspace", "conversationShell", "top"),
]

export const customerServiceConversationsSteps: TutorialStep[] = [
  step("conversations-welcome", "cs-header", "conversationsWelcome", "bottom"),
  step("conversations-filters", "cs-conversation-filters", "filters", "bottom"),
  step("conversations-workspace", "cs-conversation-workspace", "conversationShell", "top"),
  step("conversations-list", "cs-conversation-list", "conversationList", "right"),
  step("conversations-detail", "cs-conversation-detail", "conversationDetail", "left"),
  step("conversations-order", "cs-order-context", "orderContext", "bottom"),
  step("conversations-ai", "cs-ai-control", "aiControl", "left"),
  step("conversations-reply", "cs-manual-reply", "manualReply", "top"),
]

export const customerServiceEscalationsSteps: TutorialStep[] = [
  step("escalations-welcome", "cs-header", "escalationsWelcome", "bottom"),
  step("escalations-toolbar", "cs-escalation-toolbar", "escalationToolbar", "bottom"),
  step("escalations-filters", "cs-escalation-filters", "escalationFilters", "bottom"),
  step("escalations-table", "cs-escalation-table", "escalationQueue", "top"),
  step("escalations-detail", "cs-escalation-detail", "escalationDetail", "left"),
]

export const customerServicePerformanceSteps: TutorialStep[] = [
  performanceStep("performance-welcome", "cs-performance-header", "welcome", "bottom"),
  performanceStep("performance-tabs", "cs-performance-tabs", "tabs", "bottom"),
  performanceStep("performance-filters", "cs-performance-filters", "filters", "bottom"),
  performanceStep("performance-kpis", "cs-performance-kpis", "kpis", "bottom"),
  performanceStep("performance-funnel", "cs-performance-unpaid-funnel", "unpaidFunnel", "bottom"),
  performanceStep("performance-charts", "cs-performance-charts", "charts", "top"),
  performanceStep("performance-table", "cs-performance-daily-table", "dailyTable", "top"),
]

export const customerServiceExperimentsSteps: TutorialStep[] = [
  experimentsStep("experiments-welcome", "cs-experiments-header", "welcome", "bottom"),
  experimentsStep("experiments-tabs", "cs-experiments-tabs", "tabs", "bottom"),
  experimentsStep("experiments-filters", "cs-experiments-filters", "filters", "bottom"),
  experimentsStep("experiments-picker", "cs-experiment-picker", "picker", "bottom"),
  experimentsStep("experiments-variants", "cs-experiment-variants", "variants", "bottom"),
  experimentsStep("experiments-analysis", "cs-experiment-analysis", "analysis", "top"),
  experimentsStep("experiments-comparisons", "cs-experiment-comparisons", "comparisons", "top"),
]

function step(
  id: string,
  targetId: string,
  key: string,
  placement: TutorialStep["placement"],
): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.ecommerceCustomerService.${key}Title`,
    bodyKey: `tutorial.ecommerceCustomerService.${key}Body`,
    placement,
  }
}

function performanceStep(
  id: string,
  targetId: string,
  key: string,
  placement: TutorialStep["placement"],
): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.ecommerceCustomerServicePerformance.${key}Title`,
    bodyKey: `tutorial.ecommerceCustomerServicePerformance.${key}Body`,
    placement,
  }
}

function experimentsStep(
  id: string,
  targetId: string,
  key: string,
  placement: TutorialStep["placement"],
): TutorialStep {
  return {
    id,
    target: tutorialTarget(targetId),
    titleKey: `tutorial.ecommerceCustomerServiceExperiments.${key}Title`,
    bodyKey: `tutorial.ecommerceCustomerServiceExperiments.${key}Body`,
    placement,
  }
}
