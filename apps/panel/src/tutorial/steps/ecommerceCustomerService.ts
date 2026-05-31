import type { TutorialStep } from "../types.js"

export const ecommerceCustomerServiceSteps: TutorialStep[] = [
  {
    target: ".cs-workspace-page .ecommerce-page-header",
    titleKey: "tutorial.ecommerceCustomerService.welcomeTitle",
    bodyKey: "tutorial.ecommerceCustomerService.welcomeBody",
    placement: "bottom",
  },
  {
    target: ".cs-workspace-tabs",
    titleKey: "tutorial.ecommerceCustomerService.tabsTitle",
    bodyKey: "tutorial.ecommerceCustomerService.tabsBody",
    placement: "bottom",
  },
  {
    target: ".cs-workspace-filter-grid",
    titleKey: "tutorial.ecommerceCustomerService.filtersTitle",
    bodyKey: "tutorial.ecommerceCustomerService.filtersBody",
    placement: "bottom",
  },
  {
    target: ".cs-workspace-search",
    titleKey: "tutorial.ecommerceCustomerService.searchTitle",
    bodyKey: "tutorial.ecommerceCustomerService.searchBody",
    placement: "bottom",
  },
  {
    target: ".cs-conversation-shell",
    titleKey: "tutorial.ecommerceCustomerService.conversationShellTitle",
    bodyKey: "tutorial.ecommerceCustomerService.conversationShellBody",
    placement: "top",
  },
  {
    target: ".cs-conversation-list",
    titleKey: "tutorial.ecommerceCustomerService.conversationListTitle",
    bodyKey: "tutorial.ecommerceCustomerService.conversationListBody",
    placement: "right",
  },
  {
    target: ".cs-conversation-detail",
    titleKey: "tutorial.ecommerceCustomerService.conversationDetailTitle",
    bodyKey: "tutorial.ecommerceCustomerService.conversationDetailBody",
    placement: "left",
  },
  {
    target: ".cs-manual-reply-form",
    titleKey: "tutorial.ecommerceCustomerService.manualReplyTitle",
    bodyKey: "tutorial.ecommerceCustomerService.manualReplyBody",
    placement: "top",
  },
  {
    target: ".cs-escalation-table, .affiliate-proposal-empty",
    titleKey: "tutorial.ecommerceCustomerService.escalationQueueTitle",
    bodyKey: "tutorial.ecommerceCustomerService.escalationQueueBody",
    placement: "top",
    beforeAction: () => {
      const tab = document.querySelector(".cs-workspace-tab:nth-child(2)") as HTMLElement | null
      tab?.click()
    },
  },
]
