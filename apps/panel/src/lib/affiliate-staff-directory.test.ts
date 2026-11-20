import { describe, expect, it } from "vitest";
import {
  affiliateRegionDevelopers,
  affiliateStaffDeveloperOptions,
  affiliateSubtreeDevelopers,
  mergeAffiliateStaffDevelopers,
} from "./affiliate-staff-directory.js";

const subtree = {
  self: { id: "lead-self", displayName: "Mei", parentLeadId: null },
  descendantLeads: [
    { id: "lead-b", displayName: "Zed", parentLeadId: "lead-self" },
    { id: "lead-a", displayName: "Abe", parentLeadId: "lead-self" },
  ],
  businessDevelopers: [
    { id: "bd-3", displayName: "Cara", parentLeadId: "lead-b" },
    { id: "bd-1", displayName: "Bo", parentLeadId: "lead-self" },
    { id: "bd-2", displayName: "Ann", parentLeadId: "lead-a" },
    { id: "bd-4", displayName: "Al", parentLeadId: "lead-self" },
  ],
};

describe("affiliateSubtreeDevelopers", () => {
  it("groups BDs by the lead they report to: own team first, then sub-teams by lead name", () => {
    expect(affiliateSubtreeDevelopers(subtree).map((d) => [d.displayName, d.teamName])).toEqual([
      ["Al", "Mei"],
      ["Bo", "Mei"],
      ["Ann", "Abe"],
      ["Cara", "Zed"],
    ]);
  });

  it("keeps a BD whose lead is unknown, last and without a team name", () => {
    const result = affiliateSubtreeDevelopers({
      ...subtree,
      businessDevelopers: [{ id: "bd-x", displayName: "Orphan", parentLeadId: "gone" }],
    });
    expect(result).toEqual([{ id: "bd-x", displayName: "Orphan", teamName: null }]);
  });
});

describe("affiliateRegionDevelopers and merging", () => {
  it("sorts region options by name and knows no team", () => {
    expect(
      affiliateRegionDevelopers([
        { id: "b", displayName: "Zoe" },
        { id: "a", displayName: "Amy" },
      ]),
    ).toEqual([
      { id: "a", displayName: "Amy", teamName: null },
      { id: "b", displayName: "Zoe", teamName: null },
    ]);
  });

  it("keeps the first list's entry for a BD both lists name, which keeps the team", () => {
    const merged = mergeAffiliateStaffDevelopers(
      [{ id: "a", displayName: "Amy", teamName: "Mei" }],
      [
        { id: "a", displayName: "Amy", teamName: null },
        { id: "b", displayName: "Zoe", teamName: null },
      ],
    );
    expect(merged).toEqual([
      { id: "a", displayName: "Amy", teamName: "Mei" },
      { id: "b", displayName: "Zoe", teamName: null },
    ]);
  });
});

describe("affiliateStaffDeveloperOptions", () => {
  it("offers the default entry, the public pool when the surface has one, then the BDs in order", () => {
    const options = affiliateStaffDeveloperOptions(
      [{ id: "bd-1", displayName: "Bo", teamName: "Mei" }],
      { all: "All of my team", publicPool: { value: "__UNASSIGNED__", label: "Public" } },
    );
    expect(options).toEqual([
      { value: "", label: "All of my team" },
      { value: "__UNASSIGNED__", label: "Public" },
      { value: "bd-1", label: "Bo", description: "Mei", searchTerms: ["Mei"] },
    ]);
  });

  it("omits the public pool when the surface has none", () => {
    expect(affiliateStaffDeveloperOptions([], { all: "All" })).toEqual([{ value: "", label: "All" }]);
  });
});
