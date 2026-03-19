import type { TutorialStep } from "../types.js"

export const channelsSteps: TutorialStep[] = [
  // --- Overview ---
  {
    target: ".channel-header",
    titleKey: "tutorial.channels.welcomeTitle",
    bodyKey: "tutorial.channels.welcomeBody",
    placement: "bottom",
  },
  {
    target: ".channel-title-row .btn-secondary",
    titleKey: "tutorial.channels.refreshBtnTitle",
    bodyKey: "tutorial.channels.refreshBtnBody",
    placement: "left",
  },
  // --- Add Account Section ---
  {
    target: ".channel-add-section",
    titleKey: "tutorial.channels.addSectionTitle",
    bodyKey: "tutorial.channels.addSectionBody",
    placement: "bottom",
  },
  {
    target: ".channel-selector-row .select-min-w-200",
    titleKey: "tutorial.channels.channelDropdownTitle",
    bodyKey: "tutorial.channels.channelDropdownBody",
    placement: "bottom",
  },
  {
    target: ".channel-selector-row .btn-primary",
    titleKey: "tutorial.channels.connectBtnTitle",
    bodyKey: "tutorial.channels.connectBtnBody",
    placement: "bottom",
  },
  {
    target: ".channel-info-box",
    titleKey: "tutorial.channels.infoBoxTitle",
    bodyKey: "tutorial.channels.infoBoxBody",
    placement: "bottom",
  },
  // --- Accounts Table ---
  {
    target: ".channel-table",
    titleKey: "tutorial.channels.accountsTableTitle",
    bodyKey: "tutorial.channels.accountsTableBody",
    placement: "top",
  },
  {
    target: ".channel-table thead",
    titleKey: "tutorial.channels.tableColumnsTitle",
    bodyKey: "tutorial.channels.tableColumnsBody",
    placement: "bottom",
  },
  {
    target: ".channel-table .table-hover-row",
    titleKey: "tutorial.channels.accountRowTitle",
    bodyKey: "tutorial.channels.accountRowBody",
    placement: "bottom",
  },
  {
    target: ".channel-table .td-actions",
    titleKey: "tutorial.channels.rowActionsTitle",
    bodyKey: "tutorial.channels.rowActionsBody",
    placement: "left",
  },
  // --- Expanded Recipients Section ---
  {
    target: ".channel-expand-col",
    titleKey: "tutorial.channels.expandArrowTitle",
    bodyKey: "tutorial.channels.expandArrowBody",
    placement: "right",
  },
  {
    target: ".recipients-section",
    titleKey: "tutorial.channels.recipientsTitle",
    bodyKey: "tutorial.channels.recipientsBody",
    placement: "top",
  },
  // --- Modal: Edit Channel Account ---
  {
    target: ".channel-table .td-actions .btn-secondary",
    titleKey: "tutorial.channels.editBtnTitle",
    bodyKey: "tutorial.channels.editBtnBody",
    placement: "left",
    beforeAction: () => {
      // Click the Edit button on the first account to open the modal
      const btn = document.querySelector(".channel-table .td-actions .btn-secondary") as HTMLElement | null
      btn?.click()
    },
  },
  {
    target: ".modal-form-col",
    titleKey: "tutorial.channels.modalOverviewTitle",
    bodyKey: "tutorial.channels.modalOverviewBody",
    placement: "right",
  },
  {
    target: ".modal-form-col input[name='displayName']",
    titleKey: "tutorial.channels.modalNameFieldTitle",
    bodyKey: "tutorial.channels.modalNameFieldBody",
    placement: "bottom",
  },
  {
    target: ".modal-form-col input[type='password'], .modal-form-col input[type='text']:nth-of-type(2)",
    titleKey: "tutorial.channels.modalCredentialsTitle",
    bodyKey: "tutorial.channels.modalCredentialsBody",
    placement: "bottom",
  },
  {
    target: ".modal-form-col .form-checkbox-row",
    titleKey: "tutorial.channels.modalEnabledTitle",
    bodyKey: "tutorial.channels.modalEnabledBody",
    placement: "bottom",
  },
  {
    target: ".modal-actions",
    titleKey: "tutorial.channels.modalActionsTitle",
    bodyKey: "tutorial.channels.modalActionsBody",
    placement: "top",
    beforeAction: () => {
      // Close the modal
      const closeBtn = document.querySelector(".modal-close-btn") as HTMLElement | null
      closeBtn?.click()
    },
  },
  // --- Last Updated ---
  {
    target: ".channel-last-updated",
    titleKey: "tutorial.channels.lastUpdatedTitle",
    bodyKey: "tutorial.channels.lastUpdatedBody",
    placement: "top",
  },
]
