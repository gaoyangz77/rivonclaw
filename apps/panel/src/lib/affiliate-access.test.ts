import { describe, expect, it } from "vitest";
import { GQL } from "@rivonclaw/core";
import {
  AFFILIATE_BUSINESS_DEVELOPER_ACCESS,
  AFFILIATE_FULL_ACCESS,
  affiliateAccessMaySearchCampaigns,
  affiliateAccessCreatorTab,
  affiliateAccessMaySeeCreatorTab,
  affiliateAccessMaySeeSurface,
  affiliateStaffNoticeKey,
  resolveAffiliateStaffAccess,
} from "./affiliate-access.js";

const { View, Operate, Allocate, Campaign } = GQL.AffiliateStaffPermission;
const { MarketplaceRules, AiPreApproval, CreatorList } = GQL.AffiliateCampaignSelectionStrategy;
type Permissions = GQL.AffiliateStaffPermission[];

/** A login whose facets hold exactly these permissions; a facet with no list is not held. */
const staff = (lead: Permissions | null, admin: Permissions | null) =>
  resolveAffiliateStaffAccess({
    kind: GQL.AffiliateViewerKind.Staff,
    isTeamLead: lead !== null,
    isRegionAdmin: admin !== null,
    teamLeadPermissions: lead ?? [],
    regionAdminPermissions: admin ?? [],
  });

describe("resolveAffiliateStaffAccess", () => {
  it("gives a staff login with neither profile no access at all", () => {
    expect(staff(null, null)).toBeNull();
  });

  it("reads each capability from the permissions, whatever the role", () => {
    expect(staff([View], null)).toEqual({
      kind: "STAFF",
      isTeamLead: true,
      isRegionAdmin: false,
      canView: true,
      canOperate: false,
      canAllocate: false,
      canManageCollaborations: false,
      creatorDetailTabs: null,
      canReadCreatorContacts: true,
      campaignStrategies: [],
    });
    // The same permissions on the other role give the same capabilities.
    const lead = staff([View, Operate, Allocate], null)!;
    const admin = staff(null, [View, Operate, Allocate])!;
    for (const access of [lead, admin]) {
      expect(access).toMatchObject({ canView: true, canOperate: true, canAllocate: true });
    }
  });

  it.each([
    ["no permission", [], { canView: false, canOperate: false, canAllocate: false }],
    ["VIEW", [View], { canView: true, canOperate: false, canAllocate: false }],
    ["VIEW + OPERATE", [View, Operate], { canView: true, canOperate: true, canAllocate: false }],
    ["ALLOCATE", [Allocate], { canView: false, canOperate: false, canAllocate: true }],
    ["VIEW + ALLOCATE", [View, Allocate], { canView: true, canOperate: false, canAllocate: true }],
    [
      "VIEW + OPERATE + ALLOCATE",
      [View, Operate, Allocate],
      { canView: true, canOperate: true, canAllocate: true },
    ],
  ] as const)("holds %s on a region admin", (_label, permissions, expected) => {
    expect(staff(null, [...permissions])).toMatchObject(expected);
  });

  it("takes the union over both facets", () => {
    const access = staff([View], [Allocate])!;
    expect(access).toMatchObject({ canView: true, canOperate: false, canAllocate: true });
    expect(staff([Allocate], [View, Operate])).toMatchObject({
      canView: true,
      canOperate: true,
      canAllocate: true,
    });
  });

  it("never lets staff manage collaborations, whatever they hold", () => {
    expect(
      staff([View, Operate, Allocate], [View, Operate, Allocate])!.canManageCollaborations,
    ).toBe(false);
  });

  it("reads the contacts with VIEW only", () => {
    expect(staff(null, [Allocate])!.canReadCreatorContacts).toBe(false);
    expect(staff(null, [View])!.canReadCreatorContacts).toBe(true);
    expect(staff([Allocate], [View])!.canReadCreatorContacts).toBe(true);
  });

  it("leaves a supervisor unrestricted and a BD to the Creator list only", () => {
    const resolve = (kind: GQL.AffiliateViewerKind) =>
      resolveAffiliateStaffAccess({
        kind,
        isTeamLead: false,
        isRegionAdmin: false,
        teamLeadPermissions: [],
        regionAdminPermissions: [],
      });
    expect(resolve(GQL.AffiliateViewerKind.Supervisor)).toBe(AFFILIATE_FULL_ACCESS);
    expect(resolve(GQL.AffiliateViewerKind.BusinessDeveloper)).toBe(
      AFFILIATE_BUSINESS_DEVELOPER_ACCESS,
    );
    expect(AFFILIATE_FULL_ACCESS).toMatchObject({ canView: true, canOperate: true });
    expect(AFFILIATE_FULL_ACCESS.canManageCollaborations).toBe(true);
  });

  it("keeps the same tab list reference so effects keyed on it do not re-run", () => {
    expect(staff(null, [Allocate])!.creatorDetailTabs).toBe(staff([], null)!.creatorDetailTabs);
  });
});

describe("affiliateAccessMaySeeSurface", () => {
  it("opens the workbenches and collaborations to any facet holding VIEW", () => {
    for (const access of [staff([View], null)!, staff(null, [View])!, staff([Allocate], [View])!]) {
      expect(affiliateAccessMaySeeSurface(access, "WORKBENCH")).toBe(true);
      expect(affiliateAccessMaySeeSurface(access, "HISTORY")).toBe(true);
      expect(affiliateAccessMaySeeSurface(access, "CREATORS")).toBe(true);
    }
  });

  it("opens only the Creator list to a profile without VIEW, a team lead included", () => {
    for (const access of [staff([], null)!, staff([Allocate], null)!, staff(null, [Allocate])!]) {
      expect(affiliateAccessMaySeeSurface(access, "WORKBENCH")).toBe(false);
      expect(affiliateAccessMaySeeSurface(access, "HISTORY")).toBe(false);
      expect(affiliateAccessMaySeeSurface(access, "CREATORS")).toBe(true);
    }
  });

  it("never closes a page to a supervisor or BD", () => {
    for (const surface of ["WORKBENCH", "HISTORY", "CREATORS"] as const) {
      expect(affiliateAccessMaySeeSurface(AFFILIATE_FULL_ACCESS, surface)).toBe(true);
    }
  });
});

describe("Creator detail tabs", () => {
  it("shows every tab with VIEW from either facet", () => {
    for (const access of [staff([View], null)!, staff(null, [View])!, staff([Allocate], [View])!]) {
      expect(access.creatorDetailTabs).toBeNull();
      expect(affiliateAccessMaySeeCreatorTab(access, "conversation")).toBe(true);
    }
  });

  it("keeps the base tabs only for a profile without VIEW and opens on one it can read", () => {
    for (const admin of [staff(null, [Allocate])!, staff([Allocate], null)!]) {
      expect(affiliateAccessMaySeeCreatorTab(admin, "samples")).toBe(true);
      expect(affiliateAccessMaySeeCreatorTab(admin, "overview")).toBe(false);
      expect(affiliateAccessMaySeeCreatorTab(admin, "platform")).toBe(false);
      expect(affiliateAccessMaySeeCreatorTab(admin, "conversation")).toBe(false);
      expect(affiliateAccessCreatorTab(admin, "overview")).toBe("profile");
      expect(affiliateAccessCreatorTab(admin, "samples")).toBe("samples");
    }
  });

  it("keeps the requested tab for everyone else", () => {
    expect(affiliateAccessCreatorTab(staff([View], null)!, "conversation")).toBe("conversation");
    expect(affiliateAccessCreatorTab(AFFILIATE_FULL_ACCESS, "overview")).toBe("overview");
  });
});

describe("affiliateStaffNoticeKey", () => {
  it.each([
    [[], "noticeCreatorsOnly"],
    [[View], "noticeView"],
    [[View, Operate], "noticeViewOperate"],
    [[Allocate], "noticeAllocate"],
    [[View, Allocate], "noticeViewAllocate"],
    [[View, Operate, Allocate], "noticeViewOperateAllocate"],
  ] as const)("names what %j may do", (permissions, key) => {
    expect(affiliateStaffNoticeKey(staff(null, [...permissions])!)).toBe(key);
  });

  it("describes the union of both facets and gives supervisors and BDs no notice", () => {
    expect(affiliateStaffNoticeKey(staff([View], [Allocate])!)).toBe("noticeViewAllocate");
    expect(affiliateStaffNoticeKey(AFFILIATE_FULL_ACCESS)).toBeNull();
  });
});

describe("Campaign access (ADR-118)", () => {
  it("gives a supervisor all three strategies and a BD the Creator list alone", () => {
    expect(AFFILIATE_FULL_ACCESS.campaignStrategies).toEqual([
      MarketplaceRules,
      AiPreApproval,
      CreatorList,
    ]);
    expect(AFFILIATE_BUSINESS_DEVELOPER_ACCESS.campaignStrategies).toEqual([CreatorList]);
    // The BD keeps every other supervisor-level view; only the strategies differ.
    expect(AFFILIATE_BUSINESS_DEVELOPER_ACCESS).toMatchObject({ canView: true, canOperate: true });
  });

  it("gives a region admin all three strategies only when its profile holds CAMPAIGN", () => {
    expect(staff(null, [View, Campaign])!.campaignStrategies).toEqual([
      MarketplaceRules,
      AiPreApproval,
      CreatorList,
    ]);
    expect(staff(null, [View, Operate, Allocate])!.campaignStrategies).toEqual([]);
  });

  it("judges a login that is both team lead and region admin by the region admin facet alone", () => {
    // A team lead list can never legitimately hold it; even if it appeared it grants nothing.
    expect(staff([View, Campaign], [Allocate])!.campaignStrategies).toEqual([]);
    expect(staff([View], [Campaign])!.campaignStrategies).toHaveLength(3);
  });

  it("never gives a team lead anything", () => {
    expect(staff([View, Operate, Allocate], null)!.campaignStrategies).toEqual([]);
  });

  it("opens the Campaign surface to exactly the logins with a strategy", () => {
    expect(affiliateAccessMaySeeSurface(AFFILIATE_FULL_ACCESS, "CAMPAIGNS")).toBe(true);
    expect(affiliateAccessMaySeeSurface(AFFILIATE_BUSINESS_DEVELOPER_ACCESS, "CAMPAIGNS")).toBe(true);
    expect(affiliateAccessMaySeeSurface(staff(null, [Campaign])!, "CAMPAIGNS")).toBe(true);
    expect(affiliateAccessMaySeeSurface(staff(null, [View, Operate, Allocate])!, "CAMPAIGNS")).toBe(
      false,
    );
    expect(affiliateAccessMaySeeSurface(staff([View, Operate, Allocate], null)!, "CAMPAIGNS")).toBe(
      false,
    );
  });

  it("needs the search-only helpers only for a login that may use a search strategy", () => {
    expect(affiliateAccessMaySearchCampaigns(AFFILIATE_FULL_ACCESS)).toBe(true);
    expect(affiliateAccessMaySearchCampaigns(staff(null, [Campaign])!)).toBe(true);
    expect(affiliateAccessMaySearchCampaigns(AFFILIATE_BUSINESS_DEVELOPER_ACCESS)).toBe(false);
  });
});
