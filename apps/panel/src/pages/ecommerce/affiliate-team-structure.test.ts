import { describe, expect, it } from "vitest";
import {
  buildTeamTree,
  descendantLeadIds,
  displayNameAfterMemberPick,
  memberLabel,
  parentLeadCandidates,
  teamStructureErrorKey,
  unboundEligibleMembers,
  type TeamLeadProfile,
} from "./affiliate-team-structure.js";

function lead(
  id: string,
  parentLeadId: string | null = null,
  archivedAt: string | null = null,
): TeamLeadProfile {
  return {
    id,
    memberUserId: `member-${id}`,
    displayName: id.toUpperCase(),
    parentLeadId,
    archivedAt,
  };
}
const bd = (id: string, parentLeadId: string | null = null) => ({
  id,
  displayName: id.toUpperCase(),
  parentLeadId,
});

describe("buildTeamTree", () => {
  it("nests leads at any depth with child leads before BDs, and lists unparented BDs apart", () => {
    const tree = buildTeamTree({
      teamLeads: [lead("head"), lead("mid", "head"), lead("low", "mid"), lead("solo")],
      businessDevelopers: [bd("bd1", "low"), bd("bd2", "head"), bd("bd3")],
    });
    expect(tree.roots.map((node) => node.lead.id)).toEqual(["head", "solo"]);
    const head = tree.roots[0]!;
    expect(head.childLeads.map((node) => node.lead.id)).toEqual(["mid"]);
    expect(head.childLeads[0]!.childLeads[0]!.businessDevelopers.map((b) => b.id)).toEqual(["bd1"]);
    expect(head.businessDevelopers.map((b) => b.id)).toEqual(["bd2"]);
    expect(tree.unparentedBusinessDevelopers.map((b) => b.id)).toEqual(["bd3"]);
    expect(tree.roots.every((node) => !node.inCycle)).toBe(true);
  });

  it("treats a parent that is archived or unknown as no parent, and keeps archived leads out of the tree", () => {
    const tree = buildTeamTree({
      teamLeads: [lead("gone", null, "2026-11-01T00:00:00Z"), lead("orphan", "gone")],
      businessDevelopers: [bd("bd1", "gone"), bd("bd2", "missing")],
    });
    expect(tree.roots.map((node) => node.lead.id)).toEqual(["orphan"]);
    expect(tree.unparentedBusinessDevelopers.map((b) => b.id)).toEqual(["bd1", "bd2"]);
    expect(tree.archivedLeads.map((l) => l.id)).toEqual(["gone"]);
  });

  it("surfaces a stored cycle as flagged roots instead of dropping the leads", () => {
    const tree = buildTeamTree({
      teamLeads: [lead("a", "b"), lead("b", "a")],
      businessDevelopers: [],
    });
    expect(tree.roots.map((node) => [node.lead.id, node.inCycle])).toEqual([["a", true]]);
    expect(tree.roots[0]!.childLeads.map((node) => node.lead.id)).toEqual(["b"]);
  });
});

describe("parentLeadCandidates", () => {
  const structure = {
    teamLeads: [
      lead("head"),
      lead("mid", "head"),
      lead("low", "mid"),
      lead("other"),
      lead("old", null, "x"),
    ],
  };
  it("excludes a lead itself and its descendants, and archived leads", () => {
    expect(descendantLeadIds(structure, "head")).toEqual(new Set(["mid", "low"]));
    expect(
      parentLeadCandidates(structure, { kind: "TEAM_LEAD", id: "mid" }).map((l) => l.id),
    ).toEqual(["head", "other"]);
  });
  it("offers every live lead to a BD", () => {
    expect(
      parentLeadCandidates(structure, { kind: "BUSINESS_DEVELOPER" }).map((l) => l.id),
    ).toEqual(["head", "low", "mid", "other"]);
  });
});

describe("eligible members and errors", () => {
  it("drops members that already carry a live profile", () => {
    const members = [
      { userId: "u1", email: "a@x.com", name: "Ann", profileId: null },
      { userId: "u2", email: "b@x.com", name: null, profileId: "lead-1" },
    ];
    expect(unboundEligibleMembers(members).map((m) => m.userId)).toEqual(["u1"]);
    expect(memberLabel(members[0]!)).toBe("Ann (a@x.com)");
    expect(memberLabel(members[1]!)).toBe("b@x.com");
  });

  it("maps every Backend refusal code to its own translation key", () => {
    const codes = [
      "AFFILIATE_TEAM_MEMBER_INVALID",
      "AFFILIATE_TEAM_PROFILE_EXISTS",
      "AFFILIATE_TEAM_PROFILE_NOT_FOUND",
      "AFFILIATE_TEAM_PROFILE_ARCHIVED",
      "AFFILIATE_TEAM_BUSINESS_DEVELOPER_NOT_FOUND",
      "AFFILIATE_TEAM_PARENT_INVALID",
      "AFFILIATE_TEAM_PARENT_CYCLE",
      "AFFILIATE_TEAM_SHOP_NOT_FOUND",
      "AFFILIATE_TEAM_INPUT_INVALID",
    ];
    const keys = codes.map((code) =>
      teamStructureErrorKey({ graphQLErrors: [{ extensions: { code } }] }),
    );
    expect(keys.every((key) => key?.startsWith("ecommerce.affiliateTeam.teamStructureError"))).toBe(
      true,
    );
    expect(new Set(keys).size).toBe(codes.length);
    expect(
      teamStructureErrorKey({ graphQLErrors: [{ extensions: { code: "OTHER" } }] }),
    ).toBeNull();
    expect(teamStructureErrorKey(new Error("x"))).toBeNull();
  });
});

describe("displayNameAfterMemberPick", () => {
  const ann = { name: "Ann" };
  const bo = { name: "Bo" };

  it("fills an empty draft with the picked member's name", () => {
    expect(displayNameAfterMemberPick("", undefined, ann)).toBe("Ann");
    expect(displayNameAfterMemberPick("  ", undefined, ann)).toBe("Ann");
  });

  it("replaces the name the previous pick filled in", () => {
    expect(displayNameAfterMemberPick("Ann", ann, bo)).toBe("Bo");
  });

  it("never overwrites a name the admin typed", () => {
    expect(displayNameAfterMemberPick("Head of US", ann, bo)).toBe("Head of US");
    expect(displayNameAfterMemberPick("Head of US", undefined, ann)).toBe("Head of US");
  });

  it("leaves the draft alone for a member without a name", () => {
    expect(displayNameAfterMemberPick("", undefined, { name: null })).toBe("");
    expect(displayNameAfterMemberPick("Ann", ann, { name: null })).toBe("Ann");
  });
});
