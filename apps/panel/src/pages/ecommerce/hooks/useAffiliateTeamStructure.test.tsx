// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { GQL } from "@rivonclaw/core";
import {
  SET_AFFILIATE_TEAM_PARENT_MUTATION,
  WRITE_AFFILIATE_TEAM_LEAD_MUTATION,
  WRITE_AFFILIATE_REGION_ADMIN_MUTATION,
} from "../../../api/affiliate-team-structure-queries.js";
import { useAffiliateTeamStructure } from "./useAffiliateTeamStructure.js";

const apollo = vi.hoisted(() => ({
  refetch: vi.fn(),
  mutations: new Map<unknown, ReturnType<typeof vi.fn>>(),
}));
vi.mock("@apollo/client/react", () => ({
  useQuery: () => ({ data: undefined, loading: false, error: undefined, refetch: apollo.refetch }),
  useMutation: (document: unknown) => {
    if (!apollo.mutations.has(document)) apollo.mutations.set(document, vi.fn());
    return [apollo.mutations.get(document)];
  },
}));

function mutation(document: unknown) {
  return apollo.mutations.get(document)!;
}

beforeEach(() => {
  apollo.refetch.mockReset().mockResolvedValue(undefined);
  apollo.mutations.clear();
});

describe("useAffiliateTeamStructure", () => {
  it("creates a lead, then sets its parent in a second call, then refetches", async () => {
    const { result } = renderHook(() => useAffiliateTeamStructure());
    mutation(WRITE_AFFILIATE_TEAM_LEAD_MUTATION).mockResolvedValue({
      data: { writeAffiliateTeamLead: { id: "lead-new" } },
    });
    mutation(SET_AFFILIATE_TEAM_PARENT_MUTATION).mockResolvedValue({});
    await result.current.saveTeamLead({
      memberUserId: "u1",
      displayName: "Lead",
      parentLeadId: "head",
      permissions: [GQL.AffiliateStaffPermission.View],
    });
    expect(mutation(WRITE_AFFILIATE_TEAM_LEAD_MUTATION)).toHaveBeenCalledWith({
      variables: { input: { memberUserId: "u1", displayName: "Lead", permissions: ["VIEW"] } },
    });
    expect(mutation(SET_AFFILIATE_TEAM_PARENT_MUTATION)).toHaveBeenCalledWith({
      variables: {
        input: {
          subjectKind: GQL.AffiliateTeamParentSubjectKind.TeamLead,
          subjectId: "lead-new",
          parentLeadId: "head",
        },
      },
    });
    expect(apollo.refetch).toHaveBeenCalledTimes(1);
  });

  it("creates a parentless lead with one call", async () => {
    const { result } = renderHook(() => useAffiliateTeamStructure());
    mutation(WRITE_AFFILIATE_TEAM_LEAD_MUTATION).mockResolvedValue({
      data: { writeAffiliateTeamLead: { id: "lead-new" } },
    });
    mutation(SET_AFFILIATE_TEAM_PARENT_MUTATION);
    await result.current.saveTeamLead({
      memberUserId: "u1",
      displayName: "Lead",
      parentLeadId: null,
      permissions: [GQL.AffiliateStaffPermission.View],
    });
    expect(mutation(SET_AFFILIATE_TEAM_PARENT_MUTATION)).not.toHaveBeenCalled();
  });

  it("edits only what changed and refetches even when the parent call is refused", async () => {
    const { result } = renderHook(() => useAffiliateTeamStructure());
    const refusal = Object.assign(new Error("cycle"), {
      graphQLErrors: [{ extensions: { code: "AFFILIATE_TEAM_PARENT_CYCLE" } }],
    });
    mutation(WRITE_AFFILIATE_TEAM_LEAD_MUTATION).mockResolvedValue({});
    mutation(SET_AFFILIATE_TEAM_PARENT_MUTATION).mockRejectedValue(refusal);
    await expect(
      result.current.saveTeamLead({
        id: "lead-1",
        displayName: "Same",
        parentLeadId: "child",
        permissions: [GQL.AffiliateStaffPermission.View],
        displayNameChanged: false,
        parentLeadIdChanged: true,
        permissionsChanged: false,
      }),
    ).rejects.toBe(refusal);
    expect(mutation(WRITE_AFFILIATE_TEAM_LEAD_MUTATION)).not.toHaveBeenCalled();
    expect(apollo.refetch).toHaveBeenCalledTimes(1);
  });

  it("sends an explicit scope for a region admin and keeps the member out of an update", async () => {
    const { result } = renderHook(() => useAffiliateTeamStructure());
    mutation(WRITE_AFFILIATE_REGION_ADMIN_MUTATION).mockResolvedValue({});
    await result.current.saveRegionAdmin({
      id: "ra1",
      memberUserId: "ignored",
      displayName: "UK",
      regions: [GQL.ShopRegion.Gb],
      shopIds: [],
      permissions: [GQL.AffiliateStaffPermission.Allocate],
      permissionsChanged: false,
    });
    expect(mutation(WRITE_AFFILIATE_REGION_ADMIN_MUTATION)).toHaveBeenCalledWith({
      variables: { input: { id: "ra1", displayName: "UK", regions: ["GB"], shopIds: [] } },
    });
  });

  it("sends the permissions of a new region admin and of an update that changed them", async () => {
    const { result } = renderHook(() => useAffiliateTeamStructure());
    mutation(WRITE_AFFILIATE_REGION_ADMIN_MUTATION).mockResolvedValue({});
    await result.current.saveRegionAdmin({
      memberUserId: "u2",
      displayName: "US",
      regions: [],
      shopIds: ["shop-us"],
      permissions: [GQL.AffiliateStaffPermission.Allocate],
    });
    expect(mutation(WRITE_AFFILIATE_REGION_ADMIN_MUTATION)).toHaveBeenLastCalledWith({
      variables: {
        input: {
          memberUserId: "u2",
          displayName: "US",
          regions: [],
          shopIds: ["shop-us"],
          permissions: ["ALLOCATE"],
        },
      },
    });
    await result.current.saveRegionAdmin({
      id: "ra1",
      displayName: "UK",
      regions: [GQL.ShopRegion.Gb],
      shopIds: [],
      permissions: [GQL.AffiliateStaffPermission.View, GQL.AffiliateStaffPermission.Operate],
      permissionsChanged: true,
    });
    expect(mutation(WRITE_AFFILIATE_REGION_ADMIN_MUTATION)).toHaveBeenLastCalledWith({
      variables: {
        input: {
          id: "ra1",
          displayName: "UK",
          regions: ["GB"],
          shopIds: [],
          permissions: ["VIEW", "OPERATE"],
        },
      },
    });
  });

  it("writes a lead update that only changed the permissions, without the name or a parent call", async () => {
    const { result } = renderHook(() => useAffiliateTeamStructure());
    mutation(WRITE_AFFILIATE_TEAM_LEAD_MUTATION).mockResolvedValue({});
    mutation(SET_AFFILIATE_TEAM_PARENT_MUTATION);
    await result.current.saveTeamLead({
      id: "lead-1",
      displayName: "Same",
      parentLeadId: null,
      permissions: [GQL.AffiliateStaffPermission.View, GQL.AffiliateStaffPermission.Operate],
      displayNameChanged: false,
      parentLeadIdChanged: false,
      permissionsChanged: true,
    });
    expect(mutation(WRITE_AFFILIATE_TEAM_LEAD_MUTATION)).toHaveBeenCalledWith({
      variables: { input: { id: "lead-1", permissions: ["VIEW", "OPERATE"] } },
    });
    expect(mutation(SET_AFFILIATE_TEAM_PARENT_MUTATION)).not.toHaveBeenCalled();
  });

  it("writes nothing for a lead update that changed neither the name nor the permissions", async () => {
    const { result } = renderHook(() => useAffiliateTeamStructure());
    mutation(WRITE_AFFILIATE_TEAM_LEAD_MUTATION).mockResolvedValue({});
    await result.current.saveTeamLead({
      id: "lead-1",
      displayName: "Same",
      parentLeadId: null,
      permissions: [GQL.AffiliateStaffPermission.View],
      displayNameChanged: false,
      parentLeadIdChanged: false,
      permissionsChanged: false,
    });
    expect(mutation(WRITE_AFFILIATE_TEAM_LEAD_MUTATION)).not.toHaveBeenCalled();
  });
});
