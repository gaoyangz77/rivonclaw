import type { TutorialStep } from "../types.js"

export const appsSteps: TutorialStep[] = [
  // --- Welcome ---
  {
    target: ".page-enter h1",
    titleKey: "tutorial.apps.welcomeTitle",
    bodyKey: "tutorial.apps.welcomeBody",
    placement: "bottom",
  },
  // --- WeCom Card ---
  {
    target: ".cs-card",
    titleKey: "tutorial.apps.wecomCardTitle",
    bodyKey: "tutorial.apps.wecomCardBody",
    placement: "bottom",
  },
  // --- Credential Row ---
  {
    target: ".cs-card-rows .cs-card-row:nth-of-type(1)",
    titleKey: "tutorial.apps.credentialRowTitle",
    bodyKey: "tutorial.apps.credentialRowBody",
    placement: "bottom",
  },
  // --- Configure button opens credential dialog ---
  {
    target: ".cs-card-rows .cs-card-row:nth-of-type(1) .btn-secondary",
    titleKey: "tutorial.apps.configureButtonTitle",
    bodyKey: "tutorial.apps.configureButtonBody",
    placement: "left",
    beforeAction: () => {
      const btn = document.querySelector(".cs-card-rows .cs-card-row:nth-of-type(1) .btn-secondary") as HTMLElement | null
      btn?.click()
    },
  },
  // --- Credential Dialog: Invitation Code ---
  {
    target: ".modal-content .form-group:nth-of-type(1)",
    titleKey: "tutorial.apps.invitationCodeTitle",
    bodyKey: "tutorial.apps.invitationCodeBody",
    placement: "bottom",
  },
  // --- Credential Dialog: WeCom Fields ---
  {
    target: ".cs-credential-group",
    titleKey: "tutorial.apps.wecomFieldsTitle",
    bodyKey: "tutorial.apps.wecomFieldsBody",
    placement: "bottom",
  },
  // --- Credential Dialog: KF Link ID ---
  {
    target: ".modal-content > .form-group:last-of-type",
    titleKey: "tutorial.apps.kfLinkIdTitle",
    bodyKey: "tutorial.apps.kfLinkIdBody",
    placement: "bottom",
  },
  // --- Credential Dialog: Save/Delete Actions ---
  {
    target: ".modal-actions",
    titleKey: "tutorial.apps.credentialActionsTitle",
    bodyKey: "tutorial.apps.credentialActionsBody",
    placement: "top",
    beforeAction: () => {
      // Close the credential dialog
      const closeBtn = document.querySelector(".modal-close-btn") as HTMLElement | null
      closeBtn?.click()
    },
  },
  // --- Business Prompt Row ---
  {
    target: ".cs-card-rows .cs-card-row:nth-of-type(2)",
    titleKey: "tutorial.apps.promptRowTitle",
    bodyKey: "tutorial.apps.promptRowBody",
    placement: "bottom",
  },
  // --- Connection Toggle ---
  {
    target: ".cs-card-footer",
    titleKey: "tutorial.apps.connectionToggleTitle",
    bodyKey: "tutorial.apps.connectionToggleBody",
    placement: "top",
  },
  // --- Connection Status ---
  {
    target: ".cs-card-footer .badge",
    titleKey: "tutorial.apps.connectionStatusTitle",
    bodyKey: "tutorial.apps.connectionStatusBody",
    placement: "top",
  },
]
