import type { ComponentType, ReactNode } from "react";
import {
  ChatIcon, ProvidersIcon, ChannelsIcon,
  PermissionsIcon, ExtrasIcon, UsageIcon, SkillsIcon,
  BrowserProfilesIcon, CronsIcon, SettingsIcon, AccountIcon,
  ShopIcon, EcommerceIcon,
} from "./components/icons.js";
import { ChatPage } from "./pages/chat/ChatPage.js";
import { ProvidersPage } from "./pages/providers/ProvidersPage.js";
import { ChannelsPage } from "./pages/channels/ChannelsPage.js";
import { PermissionsPage } from "./pages/permissions/PermissionsPage.js";
import { ExtrasPage } from "./pages/extras/ExtrasPage.js";
import { KeyUsagePage } from "./pages/usage/KeyUsagePage.js";
import { SkillsPage } from "./pages/skills/SkillsPage.js";
import { CronsPage } from "./pages/crons/CronsPage.js";
import { SettingsPage } from "./pages/settings/SettingsPage.js";
import { OnboardingPage } from "./pages/onboarding/OnboardingPage.js";
import { AccountPage } from "./pages/account/AccountPage.js";
import { BrowserProfilesPage } from "./pages/browser-profiles/BrowserProfilesPage.js";
import { TikTokShopsPage } from "./pages/tiktok-shops/TikTokShopsPage.js";
import { EcommercePage } from "./pages/ecommerce/EcommercePage.js";

export interface RouteEntry {
  /** URL path */
  path: string;
  /** Analytics page name for trackEvent */
  pageKey: string;
  /** Page component */
  component: ComponentType<any>;
  /** Sidebar nav icon */
  icon?: ReactNode;
  /** i18n key for sidebar nav label; absent = not shown in sidebar */
  navLabelKey?: string;
  /** Navigation requires authentication */
  authRequired?: boolean;
  /** Always mounted, shown/hidden via CSS toggle (preserves component state) */
  keepMounted?: boolean;
  /** Only show in nav when entityStore.isModuleEnrolled(moduleGate) returns true */
  moduleGate?: string;
  /** Temporarily hidden from sidebar nav (route still resolves) */
  navHidden?: boolean;
  /** Internal route — not user-navigable via URL, falls back to "/" */
  internal?: boolean;
}

/**
 * Central route registry — single source of truth for paths, nav items,
 * auth requirements, and mount behavior. Array order = sidebar nav order.
 */
export const ROUTES: RouteEntry[] = [
  { path: "/", pageKey: "chat", component: ChatPage, icon: <ChatIcon />, navLabelKey: "nav.chat", keepMounted: true },
  { path: "/providers", pageKey: "providers", component: ProvidersPage, icon: <ProvidersIcon />, navLabelKey: "nav.providers" },
  { path: "/channels", pageKey: "channels", component: ChannelsPage, icon: <ChannelsIcon />, navLabelKey: "nav.channels", keepMounted: true },
  { path: "/permissions", pageKey: "permissions", component: PermissionsPage, icon: <PermissionsIcon />, navLabelKey: "nav.permissions" },
  { path: "/extras", pageKey: "extras", component: ExtrasPage, icon: <ExtrasIcon />, navLabelKey: "nav.extras" },
  { path: "/skills", pageKey: "skills", component: SkillsPage, icon: <SkillsIcon />, navLabelKey: "nav.skills" },
  { path: "/browser-profiles", pageKey: "browser-profiles", component: BrowserProfilesPage, icon: <BrowserProfilesIcon />, navLabelKey: "nav.browserProfiles", authRequired: true },
  { path: "/crons", pageKey: "crons", component: CronsPage, icon: <CronsIcon />, navLabelKey: "nav.crons" },
  { path: "/tiktok-shops", pageKey: "tiktok-shops", component: TikTokShopsPage, icon: <ShopIcon />, navLabelKey: "nav.tiktokShops", authRequired: true, navHidden: true },
  { path: "/ecommerce", pageKey: "ecommerce", component: EcommercePage, icon: <EcommerceIcon />, navLabelKey: "nav.ecommerce", authRequired: true, moduleGate: "GLOBAL_ECOMMERCE_SELLER" },
  { path: "/usage", pageKey: "usage", component: KeyUsagePage, icon: <UsageIcon />, navLabelKey: "nav.usage" },
  { path: "/settings", pageKey: "settings", component: SettingsPage, icon: <SettingsIcon />, navLabelKey: "nav.settings" },
  { path: "/account", pageKey: "account", component: AccountPage, icon: <AccountIcon /> },
  { path: "/onboarding", pageKey: "onboarding", component: OnboardingPage, internal: true },
];

/** Valid user-navigable paths for URL resolution */
export const VALID_PATHS = new Set(ROUTES.filter(r => !r.internal).map(r => r.path));

/** Lookup map: path → route entry */
export const ROUTE_MAP = new Map(ROUTES.map(r => [r.path, r]));
