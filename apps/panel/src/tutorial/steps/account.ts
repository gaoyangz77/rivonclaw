import type { TutorialStep } from "../types.js"

export const accountSteps: TutorialStep[] = [
  // --- Welcome ---
  {
    target: ".account-page h1",
    titleKey: "tutorial.account.welcomeTitle",
    bodyKey: "tutorial.account.welcomeBody",
    placement: "bottom",
  },
  // --- Profile Card ---
  {
    target: ".account-profile-card",
    titleKey: "tutorial.account.profileCardTitle",
    bodyKey: "tutorial.account.profileCardBody",
    placement: "bottom",
  },
  // --- Avatar and Identity ---
  {
    target: ".account-profile-identity",
    titleKey: "tutorial.account.identityTitle",
    bodyKey: "tutorial.account.identityBody",
    placement: "bottom",
  },
  // --- Logout Button ---
  {
    target: ".account-profile-header .btn-danger",
    titleKey: "tutorial.account.logoutTitle",
    bodyKey: "tutorial.account.logoutBody",
    placement: "left",
  },
  // --- Plan Badge ---
  {
    target: ".account-profile-details .account-info-item:nth-of-type(1)",
    titleKey: "tutorial.account.planTitle",
    bodyKey: "tutorial.account.planBody",
    placement: "bottom",
  },
  // --- Member Since ---
  {
    target: ".account-profile-details .account-info-item:nth-of-type(2)",
    titleKey: "tutorial.account.memberSinceTitle",
    bodyKey: "tutorial.account.memberSinceBody",
    placement: "bottom",
  },
  // --- Subscription Section ---
  {
    target: ".account-page > .section-card:nth-of-type(2)",
    titleKey: "tutorial.account.subscriptionTitle",
    bodyKey: "tutorial.account.subscriptionBody",
    placement: "bottom",
  },
  // --- Subscription Info Grid ---
  {
    target: ".account-info-grid",
    titleKey: "tutorial.account.subscriptionDetailsTitle",
    bodyKey: "tutorial.account.subscriptionDetailsBody",
    placement: "bottom",
  },
]
