import type { ComponentType, ReactNode } from "react";
import { GQL } from "@rivonclaw/core";
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
  AffiliateCreatorsPage,
  AffiliateIntelligencePage,
  AffiliateHistoryPage,
  AffiliateManagementPage,
  AffiliateWorkbenchPage,
} from "./pages/ecommerce/AffiliateManagementPage.js";
import { AffiliateTeamPage } from "./pages/ecommerce/AffiliateTeamPage.js";
import { AffiliateCampaignPage } from "./pages/ecommerce/AffiliateCampaignPage.js";
import { AffiliateAnalyticsPage } from "./pages/ecommerce/AffiliateAnalyticsPage.js";
import {
  CustomerServiceConversationsPage,
  CustomerServiceEscalationQueuePage,
} from "./pages/ecommerce/CustomerServiceEscalationsPage.js";
import { CustomerServicePerformancePage } from "./pages/ecommerce/CustomerServicePerformancePage.js";
import { CustomerServiceExperimentsPage } from "./pages/ecommerce/CustomerServiceExperimentsPage.js";
import { AdsManagementPage } from "./pages/ecommerce/AdsManagementPage.js";
import { InventoryManagementPage } from "./pages/ecommerce/InventoryManagementPage.js";
import { ShopAnalyticsPage } from "./pages/ecommerce/ShopAnalyticsPage.js";
import { ProductKnowledgePage } from "./pages/ecommerce/ProductKnowledgePage.js";
import { DesignSystemPage } from "./pages/design-system/DesignSystemPage.js";

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
  /** Optional icon promoted from this route to its generated first-level group. */
  navGroupIcon?: ReactNode;
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
  /** Optional first-level route whose flyout contains this route. */
  parentPath?: string;
  /** Render as a first-level disclosure instead of a direct navigation leaf. */
  navGroupOnly?: boolean;
  /**
   * Permission scope the signed-in user must hold for this route to appear in
   * the sidebar. Absent = a base page every account may see.
   *
   * This is job separation, not a security boundary: it only masks nav items.
   */
  scope?: GQL.PermissionScope;
}

/**
 * Central route registry — single source of truth for paths, nav items,
 * auth requirements, and mount behavior. Array order = sidebar nav order.
 */
export const ROUTES: RouteEntry[] = [
  { path: "/", pageKey: "chat", component: ChatPage, icon: <ChatIcon />, navLabelKey: "nav.chat", keepMounted: true, scope: GQL.PermissionScope.Chat },
  { path: "/commerce/tiktok-shops", pageKey: "tiktok-shops", component: TikTokShopsPage, icon: <ShopIcon />, navLabelKey: "nav.tiktokShops", authRequired: true, navHidden: true, scope: GQL.PermissionScope.ShopManagement },
  { path: "/commerce/shops", pageKey: "ecommerce-shops", component: EcommercePage, icon: <ShopIcon />, navLabelKey: "nav.shopManagement", authRequired: true, scope: GQL.PermissionScope.ShopManagement },
  { path: "/commerce/shop-analytics", pageKey: "ecommerce-shop-analytics", component: ShopAnalyticsPage, icon: <EcommerceIcon />, navLabelKey: "nav.shopAnalytics", authRequired: true, scope: GQL.PermissionScope.ShopAnalytics },
  { path: "/commerce/customer-service", pageKey: "ecommerce-customer-service", component: CustomerServiceConversationsPage, icon: <ChannelsIcon />, navLabelKey: "nav.customerService", authRequired: true, navGroupOnly: true, scope: GQL.PermissionScope.CustomerService },
  { path: "/commerce/customer-service/conversations", pageKey: "ecommerce-customer-service-conversations", component: CustomerServiceConversationsPage, icon: <ChannelsIcon />, navLabelKey: "nav.customerServiceConversations", authRequired: true, parentPath: "/commerce/customer-service", scope: GQL.PermissionScope.CustomerService },
  { path: "/commerce/customer-service/escalations", pageKey: "ecommerce-customer-service-escalations", component: CustomerServiceEscalationQueuePage, icon: <ChannelsIcon />, navLabelKey: "nav.customerServiceEscalations", authRequired: true, parentPath: "/commerce/customer-service", scope: GQL.PermissionScope.CustomerService },
  { path: "/commerce/customer-service/performance", pageKey: "ecommerce-customer-service-performance", component: CustomerServicePerformancePage, icon: <ChannelsIcon />, navLabelKey: "nav.customerServicePerformance", authRequired: true, parentPath: "/commerce/customer-service", scope: GQL.PermissionScope.CustomerService },
  { path: "/commerce/customer-service/experiments", pageKey: "ecommerce-customer-service-experiments", component: CustomerServiceExperimentsPage, icon: <ChannelsIcon />, navLabelKey: "nav.customerServiceExperiments", authRequired: true, parentPath: "/commerce/customer-service", scope: GQL.PermissionScope.CustomerService },
  { path: "/commerce/affiliate", pageKey: "ecommerce-affiliate", component: AffiliateManagementPage, icon: <EcommerceIcon />, navLabelKey: "nav.affiliateManagement", authRequired: true, navGroupOnly: true, scope: GQL.PermissionScope.Affiliate },
  { path: "/commerce/affiliate/campaigns", pageKey: "ecommerce-affiliate-campaigns", component: AffiliateCampaignPage, icon: <AdsIcon />, navLabelKey: "nav.affiliateCampaigns", authRequired: true, parentPath: "/commerce/affiliate", scope: GQL.PermissionScope.Affiliate },
  { path: "/commerce/affiliate/attention", pageKey: "ecommerce-affiliate-attention", component: AffiliateWorkbenchPage, icon: <EcommerceIcon />, navLabelKey: "nav.affiliateNeedsAttention", authRequired: true, parentPath: "/commerce/affiliate", scope: GQL.PermissionScope.Affiliate },
  { path: "/commerce/affiliate/team", pageKey: "ecommerce-affiliate-team", component: AffiliateTeamPage, icon: <ChannelsIcon />, navLabelKey: "nav.affiliateTeam", authRequired: true, parentPath: "/commerce/affiliate", scope: GQL.PermissionScope.Affiliate },
  { path: "/commerce/product-knowledge", pageKey: "ecommerce-product-knowledge", component: ProductKnowledgePage, icon: <EcommerceIcon />, navLabelKey: "nav.productKnowledge", authRequired: true, parentPath: "/commerce/affiliate", scope: GQL.PermissionScope.Affiliate },
  { path: "/commerce/affiliate/creators", pageKey: "ecommerce-affiliate-creators", component: AffiliateCreatorsPage, icon: <EcommerceIcon />, navLabelKey: "nav.affiliateCreators", authRequired: true, parentPath: "/commerce/affiliate", scope: GQL.PermissionScope.Affiliate },
  { path: "/commerce/affiliate/history", pageKey: "ecommerce-affiliate-history", component: AffiliateHistoryPage, icon: <EcommerceIcon />, navLabelKey: "nav.affiliateHistory", authRequired: true, parentPath: "/commerce/affiliate", scope: GQL.PermissionScope.Affiliate },
  { path: "/commerce/affiliate/analytics", pageKey: "ecommerce-affiliate-analytics", component: AffiliateAnalyticsPage, icon: <EcommerceIcon />, navLabelKey: "nav.affiliateAnalytics", authRequired: true, parentPath: "/commerce/affiliate", scope: GQL.PermissionScope.Affiliate },
  { path: "/commerce/affiliate/intelligence", pageKey: "ecommerce-affiliate-intelligence", component: AffiliateIntelligencePage, icon: <EcommerceIcon />, navLabelKey: "nav.affiliateIntelligence", authRequired: true, parentPath: "/commerce/affiliate", scope: GQL.PermissionScope.Affiliate },
  { path: "/commerce/ads", pageKey: "tiktok-ads", component: AdsManagementPage, icon: <AdsIcon />, navLabelKey: "nav.adsManagement", authRequired: true, scope: GQL.PermissionScope.Ads },
  { path: "/commerce/inventory", pageKey: "ecommerce-inventory", component: InventoryManagementPage, icon: <ModuleIcon />, navLabelKey: "nav.inventoryManagement", authRequired: true, scope: GQL.PermissionScope.Inventory },
  { path: "/automation/crons", pageKey: "crons", component: CronsPage, icon: <CronsIcon />, navLabelKey: "nav.crons" },
  { path: "/connections/channels", pageKey: "channels", component: ChannelsPage, icon: <ChannelsIcon />, navLabelKey: "nav.channels" },
  { path: "/connections/models", pageKey: "providers", component: ProvidersPage, icon: <ProvidersIcon />, navLabelKey: "nav.providers" },
  { path: "/automation/skills", pageKey: "skills", component: SkillsPage, icon: <SkillsIcon />, navLabelKey: "nav.skills", navGroupKey: "nav.extras", navGroupIcon: <ExtrasIcon /> },
  { path: "/connections/extensions", pageKey: "extras", component: ExtrasPage, icon: <ExtrasIcon />, navLabelKey: "nav.plugins", navGroupKey: "nav.extras" },
  { path: "/account/usage", pageKey: "usage", component: KeyUsagePage, icon: <UsageIcon />, navLabelKey: "nav.usage", navGroupKey: "nav.group.accountSystem" },
  { path: "/account/billing", pageKey: "billing", component: BillingPage, icon: <BillingIcon />, navLabelKey: "nav.billing", navGroupKey: "nav.group.accountSystem", authRequired: true, navAuthOnly: true, scope: GQL.PermissionScope.Billing },
  { path: "/account/settings", pageKey: "settings", component: SettingsPage, icon: <SettingsIcon />, navLabelKey: "nav.settings", navGroupKey: "nav.group.accountSystem" },
  { path: "/account/profile", pageKey: "account", component: AccountPage, icon: <AccountIcon />, navLabelKey: "nav.account", navGroupKey: "nav.group.accountSystem", authRequired: true },
  { path: "/design-system", pageKey: "design-system", component: DesignSystemPage, navHidden: true },
  { path: "/welcome", pageKey: "welcome", component: WelcomePage, internal: true },
];

/** Valid user-navigable paths for URL resolution */
export const VALID_PATHS = new Set(ROUTES.filter(r => !r.internal).map(r => r.path));

/** Lookup map: path → route entry */
export const ROUTE_MAP = new Map(ROUTES.map(r => [r.path, r]));

/**
 * Landing page for a member account that holds a given scope but not CHAT.
 * The order of this record is the priority order used by resolveLandingPath.
 */
export const SCOPE_LANDING_PATH: Partial<Record<GQL.PermissionScope, string>> = {
  [GQL.PermissionScope.Chat]: "/",
  [GQL.PermissionScope.Affiliate]: "/commerce/affiliate/campaigns",
  [GQL.PermissionScope.CustomerService]: "/commerce/customer-service/conversations",
  [GQL.PermissionScope.ShopManagement]: "/commerce/shops",
  [GQL.PermissionScope.ShopAnalytics]: "/commerce/shop-analytics",
  [GQL.PermissionScope.Ads]: "/commerce/ads",
  [GQL.PermissionScope.Inventory]: "/commerce/inventory",
  [GQL.PermissionScope.Billing]: "/account/billing",
};

/**
 * Base page shown when a member's role grants no scope we have a landing page
 * for. Automation carries no scope, so the sidebar is never empty here.
 */
export const FALLBACK_LANDING_PATH = "/automation/skills";

/**
 * First landing path the given scopes unlock, in SCOPE_LANDING_PATH order.
 * CHAT comes first, so a user who may open the chat page keeps landing on "/".
 */
export function resolveLandingPath(scopes: readonly string[]): string {
  const held = new Set(scopes);
  for (const [scope, path] of Object.entries(SCOPE_LANDING_PATH)) {
    if (held.has(scope) && path) return path;
  }
  return FALLBACK_LANDING_PATH;
}
