import type { TutorialStep } from "../types.js"

export const browserProfilesSteps: TutorialStep[] = [
  // --- Welcome ---
  {
    target: ".bp-header h1",
    titleKey: "tutorial.browserProfiles.welcomeTitle",
    bodyKey: "tutorial.browserProfiles.welcomeBody",
    placement: "bottom",
  },
  // --- Create Button ---
  {
    target: ".bp-title-actions .btn-primary",
    titleKey: "tutorial.browserProfiles.createButtonTitle",
    bodyKey: "tutorial.browserProfiles.createButtonBody",
    placement: "left",
  },
  // --- Filter Bar ---
  {
    target: ".bp-filter-bar",
    titleKey: "tutorial.browserProfiles.filterBarTitle",
    bodyKey: "tutorial.browserProfiles.filterBarBody",
    placement: "bottom",
  },
  // --- Search Input ---
  {
    target: ".bp-search-input",
    titleKey: "tutorial.browserProfiles.searchTitle",
    bodyKey: "tutorial.browserProfiles.searchBody",
    placement: "bottom",
  },
  // --- Status Chips ---
  {
    target: ".bp-status-chips",
    titleKey: "tutorial.browserProfiles.statusChipsTitle",
    bodyKey: "tutorial.browserProfiles.statusChipsBody",
    placement: "bottom",
  },
  // --- Profile Table ---
  {
    target: ".bp-table",
    titleKey: "tutorial.browserProfiles.tableTitle",
    bodyKey: "tutorial.browserProfiles.tableBody",
    placement: "bottom",
  },
  // --- Batch Actions (select-all checkbox) ---
  {
    target: ".bp-col-checkbox",
    titleKey: "tutorial.browserProfiles.batchSelectTitle",
    bodyKey: "tutorial.browserProfiles.batchSelectBody",
    placement: "right",
  },
  // --- Row Actions ---
  {
    target: ".bp-table tbody tr:first-child .td-actions",
    titleKey: "tutorial.browserProfiles.rowActionsTitle",
    bodyKey: "tutorial.browserProfiles.rowActionsBody",
    placement: "left",
  },
  // --- Pagination ---
  {
    target: ".bp-pagination",
    titleKey: "tutorial.browserProfiles.paginationTitle",
    bodyKey: "tutorial.browserProfiles.paginationBody",
    placement: "top",
  },
  // --- Create Modal (beforeAction opens it) ---
  {
    target: ".modal-content",
    titleKey: "tutorial.browserProfiles.createFormTitle",
    bodyKey: "tutorial.browserProfiles.createFormBody",
    placement: "right",
    beforeAction: () => {
      const btn = document.querySelector(".bp-title-actions .btn-primary") as HTMLElement | null
      btn?.click()
    },
  },
  // --- Name field ---
  {
    target: ".modal-content .form-group:nth-of-type(1)",
    titleKey: "tutorial.browserProfiles.fieldNameTitle",
    bodyKey: "tutorial.browserProfiles.fieldNameBody",
    placement: "bottom",
  },
  // --- Proxy checkbox ---
  {
    target: ".modal-content .bp-checkbox-label",
    titleKey: "tutorial.browserProfiles.proxyToggleTitle",
    bodyKey: "tutorial.browserProfiles.proxyToggleBody",
    placement: "bottom",
  },
  // --- Session State Policy ---
  {
    target: ".modal-content h4",
    titleKey: "tutorial.browserProfiles.sessionPolicyTitle",
    bodyKey: "tutorial.browserProfiles.sessionPolicyBody",
    placement: "bottom",
  },
  // --- Modal Save/Cancel ---
  {
    target: ".modal-actions",
    titleKey: "tutorial.browserProfiles.modalActionsTitle",
    bodyKey: "tutorial.browserProfiles.modalActionsBody",
    placement: "top",
    beforeAction: () => {
      // Close the modal
      const closeBtn = document.querySelector(".modal-close-btn") as HTMLElement | null
      closeBtn?.click()
    },
  },
]
