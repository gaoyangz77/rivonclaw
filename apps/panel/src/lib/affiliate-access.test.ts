import { describe, expect, it } from "vitest";
import { GQL } from "@rivonclaw/core";
import {
  AFFILIATE_FULL_ACCESS,
  affiliateAccessCreatorTab,
  affiliateAccessMaySeeCreatorTab,
  affiliateAccessMaySeeSurface,
  creatorWithinShopScope,
  resolveAffiliateStaffAccess,
} from "./affiliate-access.js";

const staff = (isTeamLead: boolean, isRegionAdmin: boolean) =>
  resolveAffiliateStaffAccess({ kind: GQL.AffiliateViewerKind.Staff, isTeamLead, isRegionAdmin });

describe("resolveAffiliateStaffAccess", () => {
  it("gives a staff login with neither profile no access at all", () => {
    expect(staff(false, false)).toBeNull();
  });

  it("makes a team lead read-only, with every Creator tab and contacts", () => {
    expect(staff(true, false)).toEqual({
      kind: "STAFF",
      isTeamLead: true,
      isRegionAdmin: false,
      readOnly: true,
      canAllocate: false,
      creatorDetailTabs: null,
      canReadCreatorContacts: true,
    });
  });

  it("lets a region admin allocate and read only the tabs the Backend serves", () => {
    const access = staff(false, true)!;
    expect(access.readOnly).toBe(true);
    expect(access.canAllocate).toBe(true);
    expect(access.creatorDetailTabs).toEqual(["profile", "samples", "activity"]);
    expect(access.canReadCreatorContacts).toBe(false);
  });

  it("gives both facets the union of reads and the region admin writes", () => {
    const access = staff(true, true)!;
    expect(access.readOnly).toBe(true);
    expect(access.canAllocate).toBe(true);
    expect(access.creatorDetailTabs).toBeNull();
    expect(access.canReadCreatorContacts).toBe(true);
  });

  it("leaves a supervisor or BD unrestricted", () => {
    for (const kind of [GQL.AffiliateViewerKind.Supervisor, GQL.AffiliateViewerKind.BusinessDeveloper]) {
      expect(
        resolveAffiliateStaffAccess({ kind, isTeamLead: false, isRegionAdmin: false }),
      ).toBe(AFFILIATE_FULL_ACCESS);
    }
  });

  it("keeps the same tab list reference so effects keyed on it do not re-run", () => {
    expect(staff(false, true)!.creatorDetailTabs).toBe(staff(false, true)!.creatorDetailTabs);
  });
});

describe("affiliateAccessMaySeeSurface", () => {
  it("opens the workbenches and collaborations to team leads only, and the Creator list to both", () => {
    const lead = staff(true, false)!;
    const admin = staff(false, true)!;
    expect(affiliateAccessMaySeeSurface(lead, "WORKBENCH")).toBe(true);
    expect(affiliateAccessMaySeeSurface(lead, "HISTORY")).toBe(true);
    expect(affiliateAccessMaySeeSurface(lead, "CREATORS")).toBe(true);
    expect(affiliateAccessMaySeeSurface(admin, "WORKBENCH")).toBe(false);
    expect(affiliateAccessMaySeeSurface(admin, "HISTORY")).toBe(false);
    expect(affiliateAccessMaySeeSurface(admin, "CREATORS")).toBe(true);
  });

  it("never closes a page to a supervisor or BD", () => {
    for (const surface of ["WORKBENCH", "HISTORY", "CREATORS"] as const) {
      expect(affiliateAccessMaySeeSurface(AFFILIATE_FULL_ACCESS, surface)).toBe(true);
    }
  });
});

describe("Creator detail tabs", () => {
  it("hides the tabs a region admin cannot read and opens on one they can", () => {
    const admin = staff(false, true)!;
    expect(affiliateAccessMaySeeCreatorTab(admin, "samples")).toBe(true);
    expect(affiliateAccessMaySeeCreatorTab(admin, "overview")).toBe(false);
    expect(affiliateAccessMaySeeCreatorTab(admin, "platform")).toBe(false);
    expect(affiliateAccessMaySeeCreatorTab(admin, "conversation")).toBe(false);
    expect(affiliateAccessCreatorTab(admin, "overview")).toBe("profile");
    expect(affiliateAccessCreatorTab(admin, "samples")).toBe("samples");
  });

  it("keeps the requested tab for everyone else", () => {
    expect(affiliateAccessCreatorTab(staff(true, false)!, "conversation")).toBe("conversation");
    expect(affiliateAccessCreatorTab(AFFILIATE_FULL_ACCESS, "overview")).toBe("overview");
  });
});

describe("creatorWithinShopScope", () => {
  const scope = new Set(["shop-1", "shop-2"]);

  it("needs every shop of the Creator in scope", () => {
    expect(creatorWithinShopScope(["shop-1", "shop-2"], scope)).toBe(true);
    expect(creatorWithinShopScope(["shop-1", "shop-9"], scope)).toBe(false);
  });

  it("leaves a Creator with no shop to the admins", () => {
    expect(creatorWithinShopScope([], scope)).toBe(false);
  });
});
