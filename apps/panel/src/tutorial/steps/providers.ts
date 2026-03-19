import type { TutorialStep } from "../types.js"

export const providersSteps: TutorialStep[] = [
  // --- Section A: Add Provider ---
  {
    target: ".page-enter h1",
    titleKey: "tutorial.providers.welcomeTitle",
    bodyKey: "tutorial.providers.welcomeBody",
    placement: "bottom",
  },
  {
    target: ".tab-bar",
    titleKey: "tutorial.providers.tabBarTitle",
    bodyKey: "tutorial.providers.tabBarBody",
    placement: "bottom",
  },
  {
    target: ".provider-select-wrap",
    titleKey: "tutorial.providers.providerSelectTitle",
    bodyKey: "tutorial.providers.providerSelectBody",
    placement: "bottom",
  },
  {
    target: ".page-col-main .form-row.mb-sm .form-col-4",
    titleKey: "tutorial.providers.labelFieldTitle",
    bodyKey: "tutorial.providers.labelFieldBody",
    placement: "bottom",
  },
  {
    target: ".page-col-main .form-row.mb-sm .form-col-6",
    titleKey: "tutorial.providers.modelFieldTitle",
    bodyKey: "tutorial.providers.modelFieldBody",
    placement: "bottom",
  },
  {
    target: ".page-col-main input[type='password']",
    titleKey: "tutorial.providers.apiKeyFieldTitle",
    bodyKey: "tutorial.providers.apiKeyFieldBody",
    placement: "bottom",
  },
  {
    target: ".page-col-main .provider-links",
    titleKey: "tutorial.providers.providerLinksTitle",
    bodyKey: "tutorial.providers.providerLinksBody",
    placement: "top",
  },
  {
    target: ".page-col-main .advanced-toggle",
    titleKey: "tutorial.providers.advancedTitle",
    bodyKey: "tutorial.providers.advancedBody",
    placement: "bottom",
  },
  {
    target: ".page-col-main .form-actions",
    titleKey: "tutorial.providers.saveButtonTitle",
    bodyKey: "tutorial.providers.saveButtonBody",
    placement: "top",
  },
  {
    target: ".page-col-side",
    titleKey: "tutorial.providers.pricingPanelTitle",
    bodyKey: "tutorial.providers.pricingPanelBody",
    placement: "left",
  },
  // --- Section B: Configured Keys ---
  {
    target: ".page-enter > .section-card h3",
    titleKey: "tutorial.providers.configuredTitle",
    bodyKey: "tutorial.providers.configuredBody",
    placement: "bottom",
  },
  {
    target: ".key-card:first-child",
    titleKey: "tutorial.providers.keyCardTitle",
    bodyKey: "tutorial.providers.keyCardBody",
    placement: "bottom",
  },
  {
    target: ".key-card:first-child .key-details",
    titleKey: "tutorial.providers.keyModelTitle",
    bodyKey: "tutorial.providers.keyModelBody",
    placement: "bottom",
  },
  {
    target: ".key-card:first-child .td-actions",
    titleKey: "tutorial.providers.keyActionsTitle",
    bodyKey: "tutorial.providers.keyActionsBody",
    placement: "left",
  },
  {
    target: ".key-card:first-child .btn-secondary.btn-sm",
    titleKey: "tutorial.providers.updateBtnTitle",
    bodyKey: "tutorial.providers.updateBtnBody",
    placement: "bottom",
    beforeAction: () => {
      // Click the Update button on the first key card to expand it
      const btn = document.querySelector(".key-card:first-child .btn-secondary.btn-sm") as HTMLElement | null
      btn?.click()
    },
  },
  {
    target: ".key-card:first-child .key-expanded",
    titleKey: "tutorial.providers.updateFormTitle",
    bodyKey: "tutorial.providers.updateFormBody",
    placement: "top",
  },
  {
    target: ".key-card:first-child .btn-danger.btn-sm",
    titleKey: "tutorial.providers.removeBtnTitle",
    bodyKey: "tutorial.providers.removeBtnBody",
    placement: "left",
  },
]
