import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  canCreateManualTag,
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

describe("manual tag editor state discipline", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/pages/ecommerce/components/AffiliateCreatorManualTagEditor.tsx"),
    "utf8",
  );

  it("keeps only ids and primitive drafts in React state", () => {
    // A tag modal holding a Relationship node across a store refresh is exactly
    // the dead-node bug .claude/rules/mst-react-state.md exists for.
    expect(source).toContain("useState(\"\")");
    expect(source).toContain("useState<string | null>(null)");
    expect(source).not.toContain("useRef");
    expect(source).not.toMatch(/useState<GQL\./);
  });

  it("writes every change through the relationship id it was given", () => {
    expect(source).toContain("creatorRelationshipId: relationshipId");
    expect(source).not.toContain("shopId:");
  });

  it("surfaces a failed write instead of swallowing it", () => {
    // No optimistic local list means there is nothing to roll back: on failure
    // the toast fires and the server state stays authoritative.
    expect(source).toContain("ecommerce.affiliateWorkspace.manualTags.updateFailed");
    expect(source).toContain("ecommerce.affiliateWorkspace.manualTags.createFailed");
    expect(source).not.toMatch(/catch\s*\{\s*\}/);
  });
});
