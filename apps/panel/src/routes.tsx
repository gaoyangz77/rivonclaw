import type { ComponentType, ReactNode } from "react";
import {
  ChatIcon, ProvidersIcon, ChannelsIcon,
  ExtrasIcon, UsageIcon, SkillsIcon,
  CronsIcon, SettingsIcon, BillingIcon, AccountIcon,
  ShopIcon, EcommerceIcon,
  AdsIcon, ModuleIcon,
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
import {
  AffiliateIntelligencePage,
  AffiliateHistoryPage,
  AffiliateManagementPage,
  AffiliateNeedsAttentionPage,
} from "./pages/ecommerce/AffiliateManagementPage.js";
import {
  CustomerServiceConversationsPage,
  CustomerServiceEscalationQueuePage,
} from "./pages/ecommerce/CustomerServiceEscalationsPage.js";
import { AdsManagementPage } from "./pages/ecommerce/AdsManagementPage.js";
import { InventoryManagementPage } from "./pages/ecommerce/InventoryManagementPage.js";

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
  /** Render in sidebar as a non-clickable parent label for child routes. */
  navGroupOnly?: boolean;
}

/**
 * Central route registry — single source of truth for paths, nav items,
 * auth requirements, and mount behavior. Array order = sidebar nav order.
 */
export const ROUTES: RouteEntry[] = [
  { path: "/", pageKey: "chat", component: ChatPage, icon: <ChatIcon />, navLabelKey: "nav.chat", keepMounted: true },
  { path: "/commerce/tiktok-shops", pageKey: "tiktok-shops", component: TikTokShopsPage, icon: <ShopIcon />, navLabelKey: "nav.tiktokShops", authRequired: true, navHidden: true },
  { path: "/commerce/shops", pageKey: "ecommerce-shops", component: EcommercePage, icon: <ShopIcon />, navLabelKey: "nav.shopManagement", authRequired: true },
  { path: "/commerce/customer-service", pageKey: "ecommerce-customer-service", component: CustomerServiceConversationsPage, icon: <ChannelsIcon />, navLabelKey: "nav.customerService", authRequired: true, navGroupOnly: true },
  { path: "/commerce/customer-service/conversations", pageKey: "ecommerce-customer-service-conversations", component: CustomerServiceConversationsPage, icon: <ChannelsIcon />, navLabelKey: "nav.customerServiceConversations", authRequired: true, parentPath: "/commerce/customer-service" },
  { path: "/commerce/customer-service/escalations", pageKey: "ecommerce-customer-service-escalations", component: CustomerServiceEscalationQueuePage, icon: <ChannelsIcon />, navLabelKey: "nav.customerServiceEscalations", authRequired: true, parentPath: "/commerce/customer-service" },
  { path: "/commerce/affiliate", pageKey: "ecommerce-affiliate", component: AffiliateManagementPage, icon: <EcommerceIcon />, navLabelKey: "nav.affiliateManagement", authRequired: true, navGroupOnly: true },
  { path: "/commerce/affiliate/attention", pageKey: "ecommerce-affiliate-attention", component: AffiliateNeedsAttentionPage, icon: <EcommerceIcon />, navLabelKey: "nav.affiliateNeedsAttention", authRequired: true, parentPath: "/commerce/affiliate" },
  { path: "/commerce/affiliate/history", pageKey: "ecommerce-affiliate-history", component: AffiliateHistoryPage, icon: <EcommerceIcon />, navLabelKey: "nav.affiliateHistory", authRequired: true, parentPath: "/commerce/affiliate" },
  { path: "/commerce/affiliate/intelligence", pageKey: "ecommerce-affiliate-intelligence", component: AffiliateIntelligencePage, icon: <EcommerceIcon />, navLabelKey: "nav.affiliateIntelligence", authRequired: true, parentPath: "/commerce/affiliate" },
  { path: "/commerce/ads", pageKey: "tiktok-ads", component: AdsManagementPage, icon: <AdsIcon />, navLabelKey: "nav.adsManagement", authRequired: true },
  { path: "/commerce/inventory", pageKey: "ecommerce-inventory", component: InventoryManagementPage, icon: <ModuleIcon />, navLabelKey: "nav.inventoryManagement", authRequired: true },
  { path: "/automation/skills", pageKey: "skills", component: SkillsPage, icon: <SkillsIcon />, navLabelKey: "nav.skills", navGroupKey: "nav.group.automation" },
  { path: "/automation/crons", pageKey: "crons", component: CronsPage, icon: <CronsIcon />, navLabelKey: "nav.crons", navGroupKey: "nav.group.automation" },
  { path: "/connections/channels", pageKey: "channels", component: ChannelsPage, icon: <ChannelsIcon />, navLabelKey: "nav.channels", navGroupKey: "nav.group.connections" },
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
