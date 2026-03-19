import type { TutorialStep } from "../types.js"

export const cronsSteps: TutorialStep[] = [
  // --- Overview ---
  {
    target: ".page-enter h1",
    titleKey: "tutorial.crons.welcomeTitle",
    bodyKey: "tutorial.crons.welcomeBody",
    placement: "bottom",
  },
  {
    target: ".crons-status-bar",
    titleKey: "tutorial.crons.statusBarTitle",
    bodyKey: "tutorial.crons.statusBarBody",
    placement: "bottom",
  },
  // --- Toolbar ---
  {
    target: ".crons-toolbar",
    titleKey: "tutorial.crons.toolbarTitle",
    bodyKey: "tutorial.crons.toolbarBody",
    placement: "bottom",
  },
  {
    target: ".crons-search-input",
    titleKey: "tutorial.crons.searchTitle",
    bodyKey: "tutorial.crons.searchBody",
    placement: "bottom",
  },
  {
    target: ".crons-filter-select:first-of-type",
    titleKey: "tutorial.crons.enabledFilterTitle",
    bodyKey: "tutorial.crons.enabledFilterBody",
    placement: "bottom",
  },
  {
    target: ".crons-filter-select:nth-of-type(2)",
    titleKey: "tutorial.crons.sortTitle",
    bodyKey: "tutorial.crons.sortBody",
    placement: "bottom",
  },
  {
    target: ".crons-toolbar .btn-primary",
    titleKey: "tutorial.crons.addBtnTitle",
    bodyKey: "tutorial.crons.addBtnBody",
    placement: "bottom",
  },
  // --- Job table ---
  {
    target: ".crons-table",
    titleKey: "tutorial.crons.tableTitle",
    bodyKey: "tutorial.crons.tableBody",
    placement: "top",
  },
  {
    target: ".crons-table tbody tr:first-child .crons-job-name",
    titleKey: "tutorial.crons.jobNameTitle",
    bodyKey: "tutorial.crons.jobNameBody",
    placement: "bottom",
  },
  {
    target: ".crons-table tbody tr:first-child .crons-schedule-text",
    titleKey: "tutorial.crons.scheduleColTitle",
    bodyKey: "tutorial.crons.scheduleColBody",
    placement: "bottom",
  },
  {
    target: ".crons-table tbody tr:first-child .toggle-switch",
    titleKey: "tutorial.crons.toggleTitle",
    bodyKey: "tutorial.crons.toggleBody",
    placement: "bottom",
  },
  {
    target: ".crons-table tbody tr:first-child .td-actions",
    titleKey: "tutorial.crons.actionsTitle",
    bodyKey: "tutorial.crons.actionsBody",
    placement: "left",
  },
  // --- Create form (open the modal) ---
  {
    target: ".crons-toolbar .btn-primary",
    titleKey: "tutorial.crons.createFormTitle",
    bodyKey: "tutorial.crons.createFormBody",
    placement: "bottom",
    beforeAction: () => {
      const btn = document.querySelector(".crons-toolbar .btn-primary") as HTMLElement | null
      btn?.click()
    },
  },
  {
    target: ".modal-form-col",
    titleKey: "tutorial.crons.formOverviewTitle",
    bodyKey: "tutorial.crons.formOverviewBody",
    placement: "right",
  },
  {
    target: ".modal-form-col .form-group:first-child",
    titleKey: "tutorial.crons.formNameTitle",
    bodyKey: "tutorial.crons.formNameBody",
    placement: "bottom",
  },
  {
    target: ".crons-schedule-type-row",
    titleKey: "tutorial.crons.scheduleTypeTitle",
    bodyKey: "tutorial.crons.scheduleTypeBody",
    placement: "bottom",
  },
  {
    target: ".modal-actions",
    titleKey: "tutorial.crons.formActionsTitle",
    bodyKey: "tutorial.crons.formActionsBody",
    placement: "top",
    beforeAction: () => {
      // Close the modal so it doesn't stay open
      const cancelBtn = document.querySelector(".modal-actions .btn-secondary") as HTMLElement | null
      cancelBtn?.click()
    },
  },
]
