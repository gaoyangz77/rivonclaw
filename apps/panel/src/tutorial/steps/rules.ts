import type { TutorialStep } from "../types.js"

export const rulesSteps: TutorialStep[] = [
  // --- Overview ---
  {
    target: ".page-enter h1",
    titleKey: "tutorial.rules.welcomeTitle",
    bodyKey: "tutorial.rules.welcomeBody",
    placement: "bottom",
  },
  // --- Add Rule Section ---
  {
    target: ".page-enter > .section-card:first-of-type",
    titleKey: "tutorial.rules.addSectionTitle",
    bodyKey: "tutorial.rules.addSectionBody",
    placement: "bottom",
  },
  {
    target: ".rules-examples-col",
    titleKey: "tutorial.rules.examplesTitle",
    bodyKey: "tutorial.rules.examplesBody",
    placement: "right",
  },
  {
    target: ".rules-editor-textarea",
    titleKey: "tutorial.rules.editorTitle",
    bodyKey: "tutorial.rules.editorBody",
    placement: "left",
  },
  {
    target: ".page-enter > .section-card:first-of-type .form-actions .btn-primary",
    titleKey: "tutorial.rules.addBtnTitle",
    bodyKey: "tutorial.rules.addBtnBody",
    placement: "top",
  },
  // --- Rules Table ---
  {
    target: ".page-enter > .section-card:nth-of-type(2)",
    titleKey: "tutorial.rules.tableTitle",
    bodyKey: "tutorial.rules.tableBody",
    placement: "top",
  },
  {
    target: ".rules-table thead",
    titleKey: "tutorial.rules.columnsTitle",
    bodyKey: "tutorial.rules.columnsBody",
    placement: "bottom",
  },
  {
    target: ".rules-table .badge",
    titleKey: "tutorial.rules.statusBadgeTitle",
    bodyKey: "tutorial.rules.statusBadgeBody",
    placement: "bottom",
  },
  {
    target: ".rules-table .td-actions",
    titleKey: "tutorial.rules.actionsTitle",
    bodyKey: "tutorial.rules.actionsBody",
    placement: "left",
  },
  {
    target: ".rules-table .btn-secondary",
    titleKey: "tutorial.rules.editBtnTitle",
    bodyKey: "tutorial.rules.editBtnBody",
    placement: "bottom",
  },
  {
    target: ".rules-table .btn-outline",
    titleKey: "tutorial.rules.recompileBtnTitle",
    bodyKey: "tutorial.rules.recompileBtnBody",
    placement: "bottom",
  },
  {
    target: ".rules-table .btn-danger",
    titleKey: "tutorial.rules.deleteBtnTitle",
    bodyKey: "tutorial.rules.deleteBtnBody",
    placement: "bottom",
  },
]
