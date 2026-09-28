import { describe, expect, it } from "vitest";
import { GQL } from "@rivonclaw/core";
import { ROUTES, resolveLandingPath, FALLBACK_LANDING_PATH } from "./routes.js";
import { canSeeRoute } from "./lib/permission-scope.js";
import { selectSidebarRoutes } from "./layout/sidebar-navigation.js";

describe("commerce navigation", () => {
  it("puts Campaign and Team on the first Affiliate row, then the two workbenches", () => {
    const affiliateChildren = ROUTES.filter(
      (route) => route.parentPath === "/commerce/affiliate",
    ).map((route) => route.path);

    expect(affiliateChildren).toEqual([
      "/commerce/affiliate/campaigns",
      "/commerce/affiliate/team",
      "/commerce/affiliate/attention",
      "/commerce/affiliate/manual-workbench",
      "/commerce/product-knowledge",
      "/commerce/affiliate/creators",
      "/commerce/affiliate/history",
      "/commerce/affiliate/analytics",
      "/commerce/affiliate/intelligence",
    ]);
  });
});

describe("runtime navigation", () => {
  it("promotes frequent tools and groups skills with plugins", () => {
    const routeByPath = new Map(ROUTES.map((route) => [route.path, route]));

    expect(routeByPath.get("/automation/crons")?.navGroupKey).toBeUndefined();
    expect(routeByPath.get("/connections/channels")?.navGroupKey).toBeUndefined();
    expect(routeByPath.get("/connections/models")?.navGroupKey).toBeUndefined();
    expect(routeByPath.get("/automation/skills")).toMatchObject({
      navLabelKey: "nav.skills",
      navGroupKey: "nav.extras",
    });
    expect(routeByPath.get("/connections/extensions")).toMatchObject({
      navLabelKey: "nav.plugins",
      navGroupKey: "nav.extras",
    });
  });

  it("promotes account and system destinations to first-level items", () => {
    const routeByPath = new Map(ROUTES.map((route) => [route.path, route]));

    for (const path of [
      "/account/usage",
      "/account/billing",
      "/account/settings",
      "/account/profile",
    ]) {
      expect(routeByPath.get(path)?.navGroupKey).toBeUndefined();
    }
  });
});

describe("design-system review route", () => {
  it("resolves directly without entering product navigation", () => {
    const route = ROUTES.find((entry) => entry.path === "/design-system");

    expect(route).toMatchObject({
      pageKey: "design-system",
      navHidden: true,
    });
    expect(route?.navLabelKey).toBeUndefined();
  });
});

describe("permission-scope navigation", () => {
  it("gives an AFFILIATE-only member the Affiliate group plus the base pages", () => {
    const supervisor = { isOwner: false, permissionScopes: [GQL.PermissionScope.Affiliate] };
    const visible = ROUTES.filter(
      (route) => route.navLabelKey && !route.navHidden && canSeeRoute(route, supervisor),
    ).map((route) => route.path);

    expect(visible).toEqual([
      "/commerce/affiliate",
      "/commerce/affiliate/campaigns",
      "/commerce/affiliate/team",
      "/commerce/affiliate/attention",
      "/commerce/affiliate/manual-workbench",
      "/commerce/product-knowledge",
      "/commerce/affiliate/creators",
      "/commerce/affiliate/history",
      "/commerce/affiliate/analytics",
      "/commerce/affiliate/intelligence",
      "/automation/crons",
      "/connections/channels",
      "/connections/models",
      "/automation/skills",
      "/connections/extensions",
      "/account/usage",
      "/account/settings",
      "/account/profile",
    ]);
  });

  it("gives a business developer only the BD workspace pages plus the base pages", () => {
    const bd = {
      isOwner: false,
      permissionScopes: [GQL.PermissionScope.AffiliateBusinessDeveloper],
    };
    const navEligible = (route: (typeof ROUTES)[number]) =>
      Boolean(route.navLabelKey) && !route.navHidden;
    const permitted = ROUTES.filter((route) => navEligible(route) && canSeeRoute(route, bd)).map(
      (route) => route.path,
    );
    const affiliateWorkspace = [
      "/commerce/affiliate/attention",
      "/commerce/affiliate/manual-workbench",
      "/commerce/product-knowledge",
      "/commerce/affiliate/creators",
      "/commerce/affiliate/history",
      "/commerce/affiliate/analytics",
    ];
    const basePages = [
      "/automation/crons",
      "/connections/channels",
      "/connections/models",
      "/automation/skills",
      "/connections/extensions",
      "/account/usage",
      "/account/settings",
      "/account/profile",
    ];

    // The Overview page itself stays reserved for full Affiliate control...
    expect(permitted).toEqual([...affiliateWorkspace, ...basePages]);
    // ...but its sidebar group still opens, since it holds the workspace pages.
    expect(
      selectSidebarRoutes(ROUTES, (route) => navEligible(route) && canSeeRoute(route, bd)).map(
        (route) => route.path,
      ),
    ).toEqual(["/commerce/affiliate", ...affiliateWorkspace, ...basePages]);
  });

  it("lands a business developer on Needs Attention", () => {
    expect(resolveLandingPath([GQL.PermissionScope.AffiliateBusinessDeveloper])).toBe(
      "/commerce/affiliate/attention",
    );
  });

  it("lands an AFFILIATE-only member on the campaigns page", () => {
    expect(resolveLandingPath([GQL.PermissionScope.Affiliate])).toBe(
      "/commerce/affiliate/campaigns",
    );
  });

  it("keeps the chat page for anyone holding CHAT", () => {
    expect(resolveLandingPath([GQL.PermissionScope.Chat, GQL.PermissionScope.Affiliate])).toBe("/");
  });

  it("points every scope landing path at a real route", () => {
    const paths = new Set(ROUTES.map((route) => route.path));
    for (const scope of Object.values(GQL.PermissionScope)) {
      expect(paths.has(resolveLandingPath([scope])), scope).toBe(true);
    }
    expect(resolveLandingPath([])).toBe(FALLBACK_LANDING_PATH);
    expect(paths.has(FALLBACK_LANDING_PATH)).toBe(true);
  });
});
