import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  canCreateManualTag,
  isDuplicateManualTagNameError,
  manualTagRenameIssue,
  selectableManualTags,
} from "./AffiliateCreatorManualTagEditor.js";

const CATALOG = [
  { id: "tag-1", name: "VIP" },
  { id: "tag-2", name: "误打扰" },
  { id: "tag-3", name: " Spaced " },
];

describe("manual tag selection", () => {
  it("offers only tags the relationship does not already carry", () => {
    expect(selectableManualTags(CATALOG, [{ id: "tag-2" }]).map((tag) => tag.id)).toEqual([
      "tag-1",
      "tag-3",
    ]);
    expect(selectableManualTags(CATALOG, [])).toHaveLength(3);
    expect(
      selectableManualTags(CATALOG, [{ id: "tag-1" }, { id: "tag-2" }, { id: "tag-3" }]),
    ).toEqual([]);
  });

  it("offers create only for a name the catalog does not already hold", () => {
    expect(canCreateManualTag(CATALOG, "New label")).toBe(true);
    expect(canCreateManualTag(CATALOG, "")).toBe(false);
    expect(canCreateManualTag(CATALOG, "   ")).toBe(false);
  });

  it("matches the backend uniqueness key of trim plus lowercase", () => {
    // Offering a create the backend would reject as a duplicate is worse than
    // offering nothing, so the client check has to use the same key.
    expect(canCreateManualTag(CATALOG, "vip")).toBe(false);
    expect(canCreateManualTag(CATALOG, "  VIP  ")).toBe(false);
    expect(canCreateManualTag(CATALOG, "spaced")).toBe(false);
    expect(canCreateManualTag(CATALOG, "误打扰")).toBe(false);
  });
});

describe("manual tag rename", () => {
  it("blocks an empty name and a name that did not change", () => {
    expect(manualTagRenameIssue(CATALOG, "tag-1", "VIP", "")).toBe("EMPTY");
    expect(manualTagRenameIssue(CATALOG, "tag-1", "VIP", "   ")).toBe("EMPTY");
    expect(manualTagRenameIssue(CATALOG, "tag-1", "VIP", "VIP")).toBe("UNCHANGED");
    expect(manualTagRenameIssue(CATALOG, "tag-1", "VIP", "  VIP  ")).toBe("UNCHANGED");
  });

  it("does not treat the tag being renamed as its own duplicate", () => {
    // Re-casing a tag is a legitimate rename, and the only row it collides with
    // under trim+lowercase is itself.
    expect(manualTagRenameIssue(CATALOG, "tag-1", "VIP", "vip")).toBeNull();
    expect(manualTagRenameIssue(CATALOG, "tag-1", "VIP", "VIP creators")).toBeNull();
  });

  it("uses the backend uniqueness key of trim plus lowercase for other rows", () => {
    expect(manualTagRenameIssue(CATALOG, "tag-1", "VIP", "误打扰")).toBe("DUPLICATE");
    expect(manualTagRenameIssue(CATALOG, "tag-1", "VIP", "  spaced ")).toBe("DUPLICATE");
  });

  it("recognises the unique-index violation a losing rename returns", () => {
    // The catalog the client checks is search-filtered, so the index is still
    // the authority and its error has to become something a seller can act on.
    expect(isDuplicateManualTagNameError("E11000 duplicate key error collection")).toBe(true);
    expect(isDuplicateManualTagNameError("duplicate key error")).toBe(true);
    expect(isDuplicateManualTagNameError("CreatorManualTag not found")).toBe(false);
  });
});

describe("manual tag editor state discipline", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/pages/ecommerce/components/AffiliateCreatorManualTagEditor.tsx"),
    "utf8",
  );

  it("keeps only ids and primitive drafts in React state", () => {
    // A tag modal holding a Relationship node across a store refresh is exactly
    // the dead-node bug .claude/rules/mst-react-state.md exists for.
    expect(source).toContain('useState("")');
    expect(source).toContain("useState<string | null>(null)");
    expect(source).toContain("useState<GQL.AffiliateCreatorSystemTag | null>(null)");
    expect(source).not.toContain("useRef");
    expect(source).not.toContain("useState<GQL.CreatorManualTag");
    expect(source).not.toContain("useState<GQL.AffiliateCreatorRelationship");
  });

  it("re-reads the rename target by id instead of capturing the row", () => {
    // The form outlives a refetch, so the row it writes has to come from the
    // current props at save time, not from whatever was clicked.
    expect(source).toContain("manualTags.find((tag) => tag.id === renameTagId)");
    expect(source).not.toMatch(/useState<\{[^}]*name/);
  });

  it("writes every change through the relationship id it was given", () => {
    expect(source).toContain("creatorRelationshipId: relationshipId");
    expect(source).not.toContain("shopId:");
  });

  it("keeps fixed system tags separate while exposing direct seller overrides", () => {
    expect(source).toContain("AFFILIATE_CREATOR_SYSTEM_TAG_DEFINITIONS_QUERY");
    expect(source).toContain("ASSIGN_CREATOR_RELATIONSHIP_SYSTEM_TAG_MUTATION");
    expect(source).toContain("REMOVE_CREATOR_RELATIONSHIP_SYSTEM_TAG_MUTATION");
    expect(source).toContain("creatorSystemTagDescription");
    expect(source).not.toContain("createSystemTag");
    expect(source).not.toContain("renameSystemTag");
  });

  it("surfaces a failed write instead of swallowing it", () => {
    // No optimistic local list means there is nothing to roll back: on failure
    // the toast fires and the server state stays authoritative.
    expect(source).toContain("ecommerce.affiliateWorkspace.manualTags.updateFailed");
    expect(source).toContain("ecommerce.affiliateWorkspace.manualTags.createFailed");
    expect(source).not.toMatch(/catch\s*\{\s*\}/);
  });
});
