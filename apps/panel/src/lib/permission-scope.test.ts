import { describe, expect, it } from "vitest";
import { canSeeRoute, isAffiliateStaffOnly, isBusinessDeveloperOnly } from "./permission-scope.js";

const AFFILIATE = "AFFILIATE";
const AFFILIATE_BUSINESS_DEVELOPER = "AFFILIATE_BUSINESS_DEVELOPER";
const BILLING = "BILLING";

describe("canSeeRoute", () => {
  it("shows every route while signed out", () => {
    expect(canSeeRoute({ scopes: [AFFILIATE] }, null)).toBe(true);
    expect(canSeeRoute({}, null)).toBe(true);
  });

  it("shows every route to a main account, even with no scopes listed", () => {
    const owner = { isOwner: true, permissionScopes: [] };
    expect(canSeeRoute({ scopes: [AFFILIATE] }, owner)).toBe(true);
    expect(canSeeRoute({}, owner)).toBe(true);
  });

  it("shows unscoped base pages to a member holding no scopes", () => {
    expect(canSeeRoute({}, { isOwner: false, permissionScopes: [] })).toBe(true);
  });

  it("shows a scoped route only when the member holds that scope", () => {
    const supervisor = { isOwner: false, permissionScopes: [AFFILIATE] };
    expect(canSeeRoute({ scopes: [AFFILIATE] }, supervisor)).toBe(true);
    expect(canSeeRoute({ scopes: [BILLING] }, supervisor)).toBe(false);
  });

  it("shows a route listing several scopes to a member holding any one of them", () => {
    const workspace = { scopes: [AFFILIATE, AFFILIATE_BUSINESS_DEVELOPER] };
    const supervisor = { isOwner: false, permissionScopes: [AFFILIATE] };
    const bd = { isOwner: false, permissionScopes: [AFFILIATE_BUSINESS_DEVELOPER] };
    const billing = { isOwner: false, permissionScopes: [BILLING] };

    expect(canSeeRoute(workspace, supervisor)).toBe(true);
    expect(canSeeRoute(workspace, bd)).toBe(true);
    expect(canSeeRoute(workspace, billing)).toBe(false);
    expect(canSeeRoute({ scopes: [AFFILIATE] }, bd)).toBe(false);
  });
});

describe("isBusinessDeveloperOnly", () => {
  it("is true for a member holding the BD workspace scope without full Affiliate", () => {
    expect(
      isBusinessDeveloperOnly({
        isOwner: false,
        permissionScopes: [AFFILIATE_BUSINESS_DEVELOPER],
      }),
    ).toBe(true);
  });

  it("is false for a member who also holds full Affiliate", () => {
    expect(
      isBusinessDeveloperOnly({
        isOwner: false,
        permissionScopes: [AFFILIATE, AFFILIATE_BUSINESS_DEVELOPER],
      }),
    ).toBe(false);
  });

  it("is false for owners, who hold both scopes, and for signed-out users", () => {
    expect(
      isBusinessDeveloperOnly({
        isOwner: true,
        permissionScopes: [AFFILIATE_BUSINESS_DEVELOPER],
      }),
    ).toBe(false);
    expect(isBusinessDeveloperOnly(null)).toBe(false);
    expect(isBusinessDeveloperOnly(undefined)).toBe(false);
  });

  it("is false for a member without the BD workspace scope", () => {
    expect(isBusinessDeveloperOnly({ isOwner: false, permissionScopes: [AFFILIATE] })).toBe(false);
    expect(isBusinessDeveloperOnly({ isOwner: false, permissionScopes: [] })).toBe(false);
  });
});

describe("isAffiliateStaffOnly", () => {
  const TEAM_LEAD = "AFFILIATE_TEAM_LEAD";
  const REGION_ADMIN = "AFFILIATE_REGION_ADMIN";

  it("is true for a member holding a staff scope and no supervisor or BD scope", () => {
    expect(isAffiliateStaffOnly({ isOwner: false, permissionScopes: [TEAM_LEAD] })).toBe(true);
    expect(isAffiliateStaffOnly({ isOwner: false, permissionScopes: [REGION_ADMIN] })).toBe(true);
    expect(
      isAffiliateStaffOnly({ isOwner: false, permissionScopes: [TEAM_LEAD, REGION_ADMIN] }),
    ).toBe(true);
  });

  it("is false once the member is a supervisor or a BD, who win over the staff scopes", () => {
    expect(
      isAffiliateStaffOnly({ isOwner: false, permissionScopes: [TEAM_LEAD, AFFILIATE] }),
    ).toBe(false);
    expect(
      isAffiliateStaffOnly({
        isOwner: false,
        permissionScopes: [REGION_ADMIN, AFFILIATE_BUSINESS_DEVELOPER],
      }),
    ).toBe(false);
  });

  it("is false for owners, signed-out users and members with no staff scope", () => {
    expect(isAffiliateStaffOnly({ isOwner: true, permissionScopes: [TEAM_LEAD] })).toBe(false);
    expect(isAffiliateStaffOnly(null)).toBe(false);
    expect(isAffiliateStaffOnly(undefined)).toBe(false);
    expect(isAffiliateStaffOnly({ isOwner: false, permissionScopes: [BILLING] })).toBe(false);
  });
});
