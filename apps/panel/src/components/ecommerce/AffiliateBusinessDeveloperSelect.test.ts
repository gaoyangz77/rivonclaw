import { describe, expect, it } from "vitest";
import { GQL } from "@rivonclaw/core";
import {
  AFFILIATE_BUSINESS_DEVELOPER_UNASSIGNED_VALUE,
  affiliateBusinessDeveloperSelectOptions,
} from "./AffiliateBusinessDeveloperSelect.js";

const labels = {
  all: "All BDs",
  unassigned: "AI team",
  unassignedDescription: "Unassigned relationships",
  archived: "Archived",
};

const developers = [
  {
    id: "bd-z",
    displayName: "Zoe",
    creatorDisplayName: "Zoé",
    archivedAt: null,
  },
  {
    id: "bd-a",
    displayName: "Alice",
    creatorDisplayName: null,
    archivedAt: "2026-01-01T00:00:00.000Z",
  },
] as unknown as GQL.AffiliateBusinessDeveloper[];

describe("AffiliateBusinessDeveloperSelect options", () => {
  it("builds a searchable filter catalog with all, unassigned and archived owners", () => {
    const options = affiliateBusinessDeveloperSelectOptions({
      developers,
      purpose: "FILTER",
      includeAll: true,
      includeUnassigned: true,
      labels,
    });

    expect(options.map((option) => option.value)).toEqual([
      "",
      AFFILIATE_BUSINESS_DEVELOPER_UNASSIGNED_VALUE,
      "bd-a",
      "bd-z",
    ]);
    expect(options.find((option) => option.value === "bd-a")?.badge).toBe("Archived");
    expect(options.find((option) => option.value === "bd-z")?.searchTerms).toEqual(["Zoé"]);
  });

  it("excludes archived owners from assignment choices", () => {
    const options = affiliateBusinessDeveloperSelectOptions({
      developers,
      purpose: "ASSIGNMENT",
      includeAll: false,
      includeUnassigned: false,
      labels,
    });

    expect(options.map((option) => option.value)).toEqual(["bd-z"]);
  });
});
