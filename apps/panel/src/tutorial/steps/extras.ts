import type { TutorialStep } from "../types.js"

export const extrasSteps: TutorialStep[] = [
  // --- Overview ---
  {
    target: ".extras-header h1",
    titleKey: "tutorial.extras.welcomeTitle",
    bodyKey: "tutorial.extras.welcomeBody",
    placement: "bottom",
  },
  // --- STT card ---
  {
    target: ".extras-card:nth-child(1) .extras-card-head",
    titleKey: "tutorial.extras.sttHeadTitle",
    bodyKey: "tutorial.extras.sttHeadBody",
    placement: "bottom",
  },
  {
    target: ".extras-card:nth-child(1) .extras-toggle",
    titleKey: "tutorial.extras.sttToggleTitle",
    bodyKey: "tutorial.extras.sttToggleBody",
    placement: "left",
    beforeAction: () => {
      // Enable STT so inner fields become visible
      const checkbox = document.querySelector(".extras-card:nth-child(1) .extras-toggle input") as HTMLInputElement | null
      if (checkbox && !checkbox.checked) {
        checkbox.click()
      }
    },
  },
  {
    target: ".extras-card:nth-child(1) .extras-card-body .form-group:first-child",
    titleKey: "tutorial.extras.sttProviderTitle",
    bodyKey: "tutorial.extras.sttProviderBody",
    placement: "bottom",
  },
  {
    target: ".extras-card:nth-child(1) .extras-card-body .form-group:nth-child(2)",
    titleKey: "tutorial.extras.sttApiKeyTitle",
    bodyKey: "tutorial.extras.sttApiKeyBody",
    placement: "bottom",
  },
  {
    target: ".extras-card:nth-child(1) .extras-card-foot",
    titleKey: "tutorial.extras.sttSaveTitle",
    bodyKey: "tutorial.extras.sttSaveBody",
    placement: "top",
  },
  // --- Web Search card ---
  {
    target: ".extras-card:nth-child(2) .extras-card-head",
    titleKey: "tutorial.extras.webSearchHeadTitle",
    bodyKey: "tutorial.extras.webSearchHeadBody",
    placement: "bottom",
  },
  {
    target: ".extras-card:nth-child(2) .extras-toggle",
    titleKey: "tutorial.extras.webSearchToggleTitle",
    bodyKey: "tutorial.extras.webSearchToggleBody",
    placement: "left",
    beforeAction: () => {
      const checkbox = document.querySelector(".extras-card:nth-child(2) .extras-toggle input") as HTMLInputElement | null
      if (checkbox && !checkbox.checked) {
        checkbox.click()
      }
    },
  },
  {
    target: ".extras-card:nth-child(2) .extras-card-body .form-group:first-child",
    titleKey: "tutorial.extras.webSearchProviderTitle",
    bodyKey: "tutorial.extras.webSearchProviderBody",
    placement: "bottom",
  },
  {
    target: ".extras-card:nth-child(2) .extras-card-body .form-group:nth-child(2)",
    titleKey: "tutorial.extras.webSearchApiKeyTitle",
    bodyKey: "tutorial.extras.webSearchApiKeyBody",
    placement: "bottom",
  },
  {
    target: ".extras-card:nth-child(2) .extras-card-foot",
    titleKey: "tutorial.extras.webSearchSaveTitle",
    bodyKey: "tutorial.extras.webSearchSaveBody",
    placement: "top",
  },
  // --- Embedding card ---
  {
    target: ".extras-card:nth-child(3) .extras-card-head",
    titleKey: "tutorial.extras.embeddingHeadTitle",
    bodyKey: "tutorial.extras.embeddingHeadBody",
    placement: "bottom",
  },
  {
    target: ".extras-card:nth-child(3) .extras-toggle",
    titleKey: "tutorial.extras.embeddingToggleTitle",
    bodyKey: "tutorial.extras.embeddingToggleBody",
    placement: "left",
    beforeAction: () => {
      const checkbox = document.querySelector(".extras-card:nth-child(3) .extras-toggle input") as HTMLInputElement | null
      if (checkbox && !checkbox.checked) {
        checkbox.click()
      }
    },
  },
  {
    target: ".extras-card:nth-child(3) .extras-card-body .form-group:first-child",
    titleKey: "tutorial.extras.embeddingProviderTitle",
    bodyKey: "tutorial.extras.embeddingProviderBody",
    placement: "bottom",
  },
  {
    target: ".extras-card:nth-child(3) .extras-card-body .form-group:nth-child(2)",
    titleKey: "tutorial.extras.embeddingApiKeyTitle",
    bodyKey: "tutorial.extras.embeddingApiKeyBody",
    placement: "bottom",
  },
  {
    target: ".extras-card:nth-child(3) .extras-card-foot",
    titleKey: "tutorial.extras.embeddingSaveTitle",
    bodyKey: "tutorial.extras.embeddingSaveBody",
    placement: "top",
  },
]
