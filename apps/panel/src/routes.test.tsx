import { describe, expect, it } from "vitest";
import { GQL } from "@rivonclaw/core";
import {
  ROUTES,
  resolveLandingPath,
  FALLBACK_LANDING_PATH,
  isRouteAvailableOnHost,
  isRoutableOnHost,
} from "./routes.js";
import { HOST_CAPABILITIES } from "./host/host-adapter.js";
import { getHost, installHost } from "./host/index.js";
import type { HostAdapter } from "./host/index.js";
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
      "/commerce/affiliate/creators",
      "/commerce/affiliate/history",
      "/commerce/affiliate/analytics",
      "/commerce/affiliate/intelligence",
    ]);
  });
});

describe("product knowledge navigation", () => {
  it("is one first-level commerce entry that Affiliate and Customer Service members both see", () => {
    const entries = ROUTES.filter(
      (route) =>
        route.component === ROUTES.find((r) => r.path === "/commerce/product-knowledge")?.component,
    );
    expect(entries.map((route) => route.path)).toEqual(["/commerce/product-knowledge"]);
    const [entry] = entries;
    expect(entry.parentPath).toBeUndefined();
    expect(entry.navGroupOnly).toBeUndefined();

    for (const scope of [
      GQL.PermissionScope.Affiliate,
      GQL.PermissionScope.AffiliateBusinessDeveloper,
      GQL.PermissionScope.CustomerService,
    ]) {
      expect(canSeeRoute(entry, { isOwner: false, permissionScopes: [scope] })).toBe(true);
    }
    expect(
      canSeeRoute(entry, {
        isOwner: false,
        permissionScopes: [GQL.PermissionScope.ShopManagement],
      }),
    ).toBe(false);
  });
});

describe("runtime navigation", () => {
  it("promotes frequent tools and groups skills with plugins", () => {
    const routeByPath = new Map(ROUTES.map((route) => [route.path, route]));

    expect(routeByPath.get("/automation/crons")?.navGroupKey).toBeUndefined();
    expect(routeByPath.get("/connections/channels")?.navGroupKey).toBeUndefined();
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
      "/commerce/affiliate/creators",
      "/commerce/affiliate/history",
      "/commerce/affiliate/analytics",
      "/commerce/affiliate/intelligence",
      "/commerce/product-knowledge",
      "/automation/crons",
      "/connections/channels",
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
      // Creator-list Campaigns (ADR-118): the page narrows itself to that strategy for a BD.
      "/commerce/affiliate/campaigns",
      "/commerce/affiliate/attention",
      "/commerce/affiliate/manual-workbench",
      "/commerce/affiliate/creators",
      "/commerce/affiliate/history",
      "/commerce/affiliate/analytics",
      "/commerce/product-knowledge",
    ];
    const basePages = [
      "/automation/crons",
      "/connections/channels",
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

  it("gives a team lead the four BD workbench pages and no supervision, analytics or product knowledge", () => {
    const lead = { isOwner: false, permissionScopes: [GQL.PermissionScope.AffiliateTeamLead] };
    const permitted = ROUTES.filter(
      (route) => route.navLabelKey && !route.navHidden && canSeeRoute(route, lead),
    ).map((route) => route.path);

    expect(permitted.filter((path) => path.startsWith("/commerce/"))).toEqual([
      "/commerce/affiliate/attention",
      "/commerce/affiliate/manual-workbench",
      "/commerce/affiliate/creators",
      "/commerce/affiliate/history",
    ]);
    // The Affiliate group opens for them, as it does for a BD, though its own overview page does not.
    expect(
      selectSidebarRoutes(
        ROUTES,
        (route) => Boolean(route.navLabelKey) && !route.navHidden && canSeeRoute(route, lead),
      )
        .map((route) => route.path)
        .filter((path) => path.startsWith("/commerce/")),
    ).toEqual([
      "/commerce/affiliate",
      ...permitted.filter((path) => path.startsWith("/commerce/")),
    ]);
  });

  it("gives a region admin the four pages plus Campaigns; the gate decides by permission", () => {
    const admin = { isOwner: false, permissionScopes: [GQL.PermissionScope.AffiliateRegionAdmin] };
    const permitted = ROUTES.filter(
      (route) => route.navLabelKey && !route.navHidden && canSeeRoute(route, admin),
    ).map((route) => route.path);

    expect(permitted.filter((path) => path.startsWith("/commerce/"))).toEqual([
      "/commerce/affiliate/campaigns",
      "/commerce/affiliate/attention",
      "/commerce/affiliate/manual-workbench",
      "/commerce/affiliate/creators",
      "/commerce/affiliate/history",
    ]);
  });

  it("gives a login holding both staff scopes the union of their pages", () => {
    const both = {
      isOwner: false,
      permissionScopes: [
        GQL.PermissionScope.AffiliateTeamLead,
        GQL.PermissionScope.AffiliateRegionAdmin,
      ],
    };
    const permitted = ROUTES.filter(
      (route) => route.navLabelKey && !route.navHidden && canSeeRoute(route, both),
    ).map((route) => route.path);

    expect(permitted.filter((path) => path.startsWith("/commerce/"))).toEqual([
      "/commerce/affiliate/campaigns",
      "/commerce/affiliate/attention",
      "/commerce/affiliate/manual-workbench",
      "/commerce/affiliate/creators",
      "/commerce/affiliate/history",
    ]);
  });

  it("keeps staff scopes out of every supervision route", () => {
    const staff = {
      isOwner: false,
      permissionScopes: [
        GQL.PermissionScope.AffiliateTeamLead,
        GQL.PermissionScope.AffiliateRegionAdmin,
      ],
    };
    for (const path of [
      "/commerce/affiliate",
      "/commerce/affiliate/team",
      "/commerce/affiliate/analytics",
      "/commerce/affiliate/intelligence",
      "/commerce/product-knowledge",
    ]) {
      expect(canSeeRoute(ROUTES.find((route) => route.path === path)!, staff), path).toBe(false);
    }
  });

  it("keeps Campaigns away from a team lead and offers them to a region admin and a BD (ADR-118)", () => {
    const campaigns = ROUTES.find((route) => route.path === "/commerce/affiliate/campaigns")!;
    const login = (...permissionScopes: GQL.PermissionScope[]) => ({
      isOwner: false,
      permissionScopes,
    });
    expect(canSeeRoute(campaigns, login(GQL.PermissionScope.AffiliateTeamLead))).toBe(false);
    expect(canSeeRoute(campaigns, login(GQL.PermissionScope.AffiliateRegionAdmin))).toBe(true);
    expect(canSeeRoute(campaigns, login(GQL.PermissionScope.AffiliateBusinessDeveloper))).toBe(
      true,
    );
    expect(canSeeRoute(campaigns, login(GQL.PermissionScope.Affiliate))).toBe(true);
  });

  it("lands a team lead on Needs Attention and a region admin on the Creator list", () => {
    expect(resolveLandingPath([GQL.PermissionScope.AffiliateTeamLead])).toBe(
      "/commerce/affiliate/attention",
    );
    expect(resolveLandingPath([GQL.PermissionScope.AffiliateRegionAdmin])).toBe(
      "/commerce/affiliate/creators",
    );
    expect(
      resolveLandingPath([
        GQL.PermissionScope.AffiliateRegionAdmin,
        GQL.PermissionScope.AffiliateTeamLead,
      ]),
    ).toBe("/commerce/affiliate/attention");
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

describe("host requirements", () => {
  it("names only known capabilities", () => {
    for (const route of ROUTES) {
      for (const capability of route.requires) expect(HOST_CAPABILITIES).toContain(capability);
    }
  });

  it("keeps every route available on the Desktop host", () => {
    for (const route of ROUTES) expect(isRouteAvailableOnHost(route)).toBe(true);
    expect(isRoutableOnHost("/commerce/affiliate/campaigns")).toBe(true);
  });

  it("hides a route from a host that lacks its capability, and refuses its URL", () => {
    const desktop = getHost();
    try {
      installHost({ ...desktop, capabilities: new Set() } as HostAdapter);
      expect(isRoutableOnHost("/connections/channels")).toBe(false);
      expect(isRoutableOnHost("/")).toBe(false);
      expect(isRoutableOnHost("/commerce/affiliate/campaigns")).toBe(true);
      // Internal and unknown paths are never routable.
      expect(isRoutableOnHost("/welcome")).toBe(false);
      expect(isRoutableOnHost("/nope")).toBe(false);
    } finally {
      installHost(desktop);
    }
  });
});
