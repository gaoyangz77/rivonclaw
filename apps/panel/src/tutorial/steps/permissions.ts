import type { TutorialStep } from "../types.js"

export const permissionsSteps: TutorialStep[] = [
  // --- Overview ---
  {
    target: ".page-enter h1",
    titleKey: "tutorial.permissions.welcomeTitle",
    bodyKey: "tutorial.permissions.welcomeBody",
    placement: "bottom",
  },
  // --- Full Access Toggle ---
  {
    target: ".perm-full-access-row",
    titleKey: "tutorial.permissions.fullAccessTitle",
    bodyKey: "tutorial.permissions.fullAccessBody",
    placement: "bottom",
  },
  {
    target: ".toggle-switch",
    titleKey: "tutorial.permissions.fullAccessToggleTitle",
    bodyKey: "tutorial.permissions.fullAccessToggleBody",
    placement: "left",
  },
  // --- Add Path Area ---
  {
    target: ".perm-add-path-row",
    titleKey: "tutorial.permissions.addPathTitle",
    bodyKey: "tutorial.permissions.addPathBody",
    placement: "bottom",
  },
  {
    target: ".perm-add-path-row .btn-outline",
    titleKey: "tutorial.permissions.browseBtnTitle",
    bodyKey: "tutorial.permissions.browseBtnBody",
    placement: "bottom",
  },
  {
    target: ".perm-add-path-row .perm-switcher",
    titleKey: "tutorial.permissions.permSwitcherTitle",
    bodyKey: "tutorial.permissions.permSwitcherBody",
    placement: "bottom",
  },
  {
    target: ".perm-add-path-row .btn-primary",
    titleKey: "tutorial.permissions.addBtnTitle",
    bodyKey: "tutorial.permissions.addBtnBody",
    placement: "bottom",
  },
  // --- Permissions Table ---
  {
    target: ".table-scroll-wrap.table-rounded",
    titleKey: "tutorial.permissions.tableTitle",
    bodyKey: "tutorial.permissions.tableBody",
    placement: "top",
  },
  {
    target: ".perm-workspace-row",
    titleKey: "tutorial.permissions.workspaceRowTitle",
    bodyKey: "tutorial.permissions.workspaceRowBody",
    placement: "bottom",
  },
  {
    target: ".table-hover-row .perm-switcher",
    titleKey: "tutorial.permissions.rowPermSwitcherTitle",
    bodyKey: "tutorial.permissions.rowPermSwitcherBody",
    placement: "left",
  },
  {
    target: ".table-hover-row .btn-danger",
    titleKey: "tutorial.permissions.removeBtnTitle",
    bodyKey: "tutorial.permissions.removeBtnBody",
    placement: "left",
  },
]
