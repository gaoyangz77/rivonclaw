import type { TutorialStep } from "../types.js"

export const settingsSteps: TutorialStep[] = [
  // --- Welcome ---
  {
    target: ".page-enter h1",
    titleKey: "tutorial.settings.welcomeTitle",
    bodyKey: "tutorial.settings.welcomeBody",
    placement: "bottom",
  },
  // --- Agent Settings Section ---
  {
    target: ".settings-section-agent h3",
    titleKey: "tutorial.settings.agentSectionTitle",
    bodyKey: "tutorial.settings.agentSectionBody",
    placement: "bottom",
  },
  {
    target: ".settings-section-agent .custom-select:nth-of-type(1)",
    titleKey: "tutorial.settings.dmScopeTitle",
    bodyKey: "tutorial.settings.dmScopeBody",
    placement: "bottom",
  },
  {
    target: ".settings-section-agent > div:nth-of-type(2) .custom-select",
    titleKey: "tutorial.settings.browserModeTitle",
    bodyKey: "tutorial.settings.browserModeBody",
    placement: "bottom",
  },
  // --- Chat Settings Section ---
  {
    target: ".settings-section-chat h3",
    titleKey: "tutorial.settings.chatSectionTitle",
    bodyKey: "tutorial.settings.chatSectionBody",
    placement: "bottom",
  },
  {
    target: ".settings-section-chat .settings-toggle-card:nth-of-type(1)",
    titleKey: "tutorial.settings.showAgentEventsTitle",
    bodyKey: "tutorial.settings.showAgentEventsBody",
    placement: "bottom",
  },
  {
    target: ".settings-section-chat .settings-toggle-card:nth-of-type(2)",
    titleKey: "tutorial.settings.preserveToolEventsTitle",
    bodyKey: "tutorial.settings.preserveToolEventsBody",
    placement: "bottom",
  },
  {
    target: ".settings-section-chat .settings-toggle-card:nth-of-type(3)",
    titleKey: "tutorial.settings.collapseMessagesTitle",
    bodyKey: "tutorial.settings.collapseMessagesBody",
    placement: "bottom",
  },
  // --- App Settings Section ---
  {
    target: ".accent-color-picker",
    titleKey: "tutorial.settings.accentColorTitle",
    bodyKey: "tutorial.settings.accentColorBody",
    placement: "bottom",
  },
  {
    target: ".settings-section-app .settings-toggle-card:nth-of-type(1)",
    titleKey: "tutorial.settings.privacyModeTitle",
    bodyKey: "tutorial.settings.privacyModeBody",
    placement: "bottom",
  },
  {
    target: ".settings-section-app .settings-toggle-card:nth-of-type(2)",
    titleKey: "tutorial.settings.showAgentNameTitle",
    bodyKey: "tutorial.settings.showAgentNameBody",
    placement: "bottom",
  },
  // --- Tutorial Section ---
  {
    target: ".settings-section-tutorial .settings-toggle-card",
    titleKey: "tutorial.settings.tutorialToggleTitle",
    bodyKey: "tutorial.settings.tutorialToggleBody",
    placement: "bottom",
  },
  // --- Auto-Launch Section ---
  {
    target: ".settings-section-auto-launch .settings-toggle-card",
    titleKey: "tutorial.settings.autoLaunchTitle",
    bodyKey: "tutorial.settings.autoLaunchBody",
    placement: "bottom",
  },
  // --- Data Directory Section ---
  {
    target: ".data-dir-display",
    titleKey: "tutorial.settings.dataDirTitle",
    bodyKey: "tutorial.settings.dataDirBody",
    placement: "bottom",
  },
  {
    target: ".data-dir-actions",
    titleKey: "tutorial.settings.dataDirActionsTitle",
    bodyKey: "tutorial.settings.dataDirActionsBody",
    placement: "top",
  },
  // --- Telemetry Section ---
  {
    target: ".settings-section-telemetry .settings-toggle-card",
    titleKey: "tutorial.settings.telemetryToggleTitle",
    bodyKey: "tutorial.settings.telemetryToggleBody",
    placement: "bottom",
  },
  {
    target: ".telemetry-details",
    titleKey: "tutorial.settings.telemetryDetailsTitle",
    bodyKey: "tutorial.settings.telemetryDetailsBody",
    placement: "bottom",
  },
  // --- System Dependencies Section ---
  {
    target: ".settings-section-deps .btn-primary",
    titleKey: "tutorial.settings.installDepsTitle",
    bodyKey: "tutorial.settings.installDepsBody",
    placement: "bottom",
  },
  // --- Diagnostics Section ---
  {
    target: ".settings-section-diagnostics .doctor-actions",
    titleKey: "tutorial.settings.diagnosticsTitle",
    bodyKey: "tutorial.settings.diagnosticsBody",
    placement: "top",
  },
]
