import type { ComponentType, ReactNode } from "react";
import {
  ChatIcon, ProvidersIcon, ChannelsIcon,
  ExtrasIcon, UsageIcon, SkillsIcon,
  CronsIcon, SettingsIcon, BillingIcon, AccountIcon,
  ShopIcon, EcommerceIcon,
  AdsIcon,
} from "./components/icons.js";
import { ChatPage } from "./pages/chat/ChatPage.js";
import { ProvidersPage } from "./pages/providers/ProvidersPage.js";
import { ChannelsPage } from "./pages/channels/ChannelsPage.js";
import { ExtrasPage } from "./pages/extras/ExtrasPage.js";
import { KeyUsagePage } from "./pages/usage/KeyUsagePage.js";
import { SkillsPage } from "./pages/skills/SkillsPage.js";
import { CronsPage } from "./pages/crons/CronsPage.js";
import { SettingsPage } from "./pages/settings/SettingsPage.js";
import { WelcomePage } from "./pages/welcome/WelcomePage.js";
import { AccountPage } from "./pages/account/AccountPage.js";
import { BillingPage } from "./pages/billing/BillingPage.js";
import { TikTokShopsPage } from "./pages/tiktok-shops/TikTokShopsPage.js";
import { EcommercePage } from "./pages/ecommerce/EcommercePage.js";
import { AffiliateManagementPage } from "./pages/ecommerce/AffiliateManagementPage.js";
import { CustomerServiceEscalationsPage } from "./pages/ecommerce/CustomerServiceEscalationsPage.js";
import { AdsManagementPage } from "./pages/ecommerce/AdsManagementPage.js";

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
  /** Optional sidebar group heading. Routes with no group render as primary items. */
  navGroupKey?: string;
  /** Navigation requires authentication */
  authRequired?: boolean;
  /** Always mounted, shown/hidden via CSS toggle (preserves component state) */
  keepMounted?: boolean;
  /** Temporarily hidden from sidebar nav (route still resolves) */
  navHidden?: boolean;
  /** Only show in nav after the user is signed in */
  navAuthOnly?: boolean;
  /** Internal route — not user-navigable via URL, falls back to "/" */
  internal?: boolean;
  /** Optional parent route for sidebar subitems */
  parentPath?: string;
}

/**
 * Central route registry — single source of truth for paths, nav items,
 * auth requirements, and mount behavior. Array order = sidebar nav order.
 */
export const ROUTES: RouteEntry[] = [
  { path: "/", pageKey: "chat", component: ChatPage, icon: <ChatIcon />, navLabelKey: "nav.chat", keepMounted: true },
  { path: "/commerce/tiktok-shops", pageKey: "tiktok-shops", component: TikTokShopsPage, icon: <ShopIcon />, navLabelKey: "nav.tiktokShops", authRequired: true, navHidden: true },
  { path: "/commerce/shops", pageKey: "ecommerce", component: EcommercePage, icon: <EcommerceIcon />, navLabelKey: "nav.ecommerce", navGroupKey: "nav.group.shopOperations", authRequired: true },
  { path: "/commerce/ads", pageKey: "tiktok-ads", component: AdsManagementPage, icon: <AdsIcon />, navLabelKey: "nav.adsManagement", navGroupKey: "nav.group.shopOperations", authRequired: true, parentPath: "/commerce/shops" },
  { path: "/commerce/customer-service", pageKey: "ecommerce-customer-service", component: CustomerServiceEscalationsPage, icon: <ChannelsIcon />, navLabelKey: "nav.customerService", navGroupKey: "nav.group.shopOperations", authRequired: true, parentPath: "/commerce/shops" },
  { path: "/commerce/affiliate", pageKey: "ecommerce-affiliate", component: AffiliateManagementPage, icon: <EcommerceIcon />, navLabelKey: "nav.affiliateManagement", navGroupKey: "nav.group.shopOperations", authRequired: true, parentPath: "/commerce/shops" },
  { path: "/automation/skills", pageKey: "skills", component: SkillsPage, icon: <SkillsIcon />, navLabelKey: "nav.skills", navGroupKey: "nav.group.automation" },
  { path: "/automation/crons", pageKey: "crons", component: CronsPage, icon: <CronsIcon />, navLabelKey: "nav.crons", navGroupKey: "nav.group.automation" },
  { path: "/connections/channels", pageKey: "channels", component: ChannelsPage, icon: <ChannelsIcon />, navLabelKey: "nav.channels", navGroupKey: "nav.group.connections", keepMounted: true },
  { path: "/connections/models", pageKey: "providers", component: ProvidersPage, icon: <ProvidersIcon />, navLabelKey: "nav.providers", navGroupKey: "nav.group.connections" },
  { path: "/connections/extensions", pageKey: "extras", component: ExtrasPage, icon: <ExtrasIcon />, navLabelKey: "nav.extras", navGroupKey: "nav.group.connections" },
  { path: "/account/usage", pageKey: "usage", component: KeyUsagePage, icon: <UsageIcon />, navLabelKey: "nav.usage", navGroupKey: "nav.group.accountSystem" },
  { path: "/account/billing", pageKey: "billing", component: BillingPage, icon: <BillingIcon />, navLabelKey: "nav.billing", navGroupKey: "nav.group.accountSystem", authRequired: true, navAuthOnly: true },
  { path: "/account/settings", pageKey: "settings", component: SettingsPage, icon: <SettingsIcon />, navLabelKey: "nav.settings", navGroupKey: "nav.group.accountSystem" },
  { path: "/account/profile", pageKey: "account", component: AccountPage, icon: <AccountIcon />, navLabelKey: "nav.account", navGroupKey: "nav.group.accountSystem", authRequired: true },
  { path: "/welcome", pageKey: "welcome", component: WelcomePage, internal: true },
];

/** Valid user-navigable paths for URL resolution */
export const VALID_PATHS = new Set(ROUTES.filter(r => !r.internal).map(r => r.path));

/** Lookup map: path → route entry */
export const ROUTE_MAP = new Map(ROUTES.map(r => [r.path, r]));
