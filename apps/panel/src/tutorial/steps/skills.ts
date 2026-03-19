import type { TutorialStep } from "../types.js"

export const skillsSteps: TutorialStep[] = [
  // --- Overview ---
  {
    target: ".skills-page-header h1",
    titleKey: "tutorial.skills.welcomeTitle",
    bodyKey: "tutorial.skills.welcomeBody",
    placement: "bottom",
  },
  {
    target: ".tab-bar",
    titleKey: "tutorial.skills.tabBarTitle",
    bodyKey: "tutorial.skills.tabBarBody",
    placement: "bottom",
  },
  // --- Market tab ---
  {
    target: ".skills-search-bar",
    titleKey: "tutorial.skills.searchTitle",
    bodyKey: "tutorial.skills.searchBody",
    placement: "bottom",
  },
  {
    target: ".skills-category-chips",
    titleKey: "tutorial.skills.categoriesTitle",
    bodyKey: "tutorial.skills.categoriesBody",
    placement: "bottom",
  },
  {
    target: ".skills-grid",
    titleKey: "tutorial.skills.gridTitle",
    bodyKey: "tutorial.skills.gridBody",
    placement: "bottom",
  },
  {
    target: ".skill-market-card:first-child .skill-card-header",
    titleKey: "tutorial.skills.cardHeaderTitle",
    bodyKey: "tutorial.skills.cardHeaderBody",
    placement: "bottom",
  },
  {
    target: ".skill-market-card:first-child .skill-card-slug",
    titleKey: "tutorial.skills.cardSlugTitle",
    bodyKey: "tutorial.skills.cardSlugBody",
    placement: "bottom",
  },
  {
    target: ".skill-market-card:first-child .skill-card-desc",
    titleKey: "tutorial.skills.cardDescTitle",
    bodyKey: "tutorial.skills.cardDescBody",
    placement: "bottom",
  },
  {
    target: ".skill-market-card:first-child .skill-card-meta",
    titleKey: "tutorial.skills.cardMetaTitle",
    bodyKey: "tutorial.skills.cardMetaBody",
    placement: "bottom",
  },
  {
    target: ".skill-market-card:first-child .skill-card-actions",
    titleKey: "tutorial.skills.cardActionsTitle",
    bodyKey: "tutorial.skills.cardActionsBody",
    placement: "top",
  },
  {
    target: ".skills-pagination",
    titleKey: "tutorial.skills.paginationTitle",
    bodyKey: "tutorial.skills.paginationBody",
    placement: "top",
  },
  // --- Installed tab ---
  {
    target: ".tab-btn:nth-child(2)",
    titleKey: "tutorial.skills.installedTabTitle",
    bodyKey: "tutorial.skills.installedTabBody",
    placement: "bottom",
    beforeAction: () => {
      const btn = document.querySelector(".tab-btn:nth-child(2)") as HTMLElement | null
      btn?.click()
    },
  },
  {
    target: ".skills-installed-header",
    titleKey: "tutorial.skills.openFolderTitle",
    bodyKey: "tutorial.skills.openFolderBody",
    placement: "bottom",
  },
  {
    target: ".skills-grid .skill-market-card:first-child .btn-primary",
    titleKey: "tutorial.skills.deleteBtnTitle",
    bodyKey: "tutorial.skills.deleteBtnBody",
    placement: "top",
  },
]
