import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { manualTagDeleteConsequences } from "./AffiliateCreatorTagCatalogPanel.js";

const UNUSED = {
  creatorRelationshipCount: 0,
  approvalPolicyMatchCount: 0,
  approvalPolicyExclusionCount: 0,
  approvalPolicyDisableCount: 0,
};

describe("manual tag delete consequences", () => {
  it("always states the creator count, zero included", () => {
    expect(manualTagDeleteConsequences(UNUSED)).toEqual([{ kind: "CREATORS", count: 0 }]);
    expect(manualTagDeleteConsequences({ ...UNUSED, creatorRelationshipCount: 12 })).toEqual([
      { kind: "CREATORS", count: 12 },
    ]);
  });

  it("says nothing about approval policies when no policy is affected", () => {
    // Most deletes are of an unused tag. A confirmation padded with three
    // zeroes is one people learn to click through, which is precisely the
    // habit that would carry them past the delete that disables a live rule.
    const lines = manualTagDeleteConsequences({ ...UNUSED, creatorRelationshipCount: 3 });
    expect(lines.map((line) => line.kind)).toEqual(["CREATORS"]);
  });

  it("states each non-zero policy consequence separately", () => {
    expect(
      manualTagDeleteConsequences({
        creatorRelationshipCount: 4,
        approvalPolicyMatchCount: 2,
        approvalPolicyExclusionCount: 0,
        approvalPolicyDisableCount: 1,
      }),
    ).toEqual([
      { kind: "CREATORS", count: 4 },
      { kind: "POLICY_MATCHES", count: 2 },
      { kind: "POLICIES_DISABLED", count: 1 },
    ]);

    expect(
      manualTagDeleteConsequences({
        creatorRelationshipCount: 0,
        approvalPolicyMatchCount: 0,
        approvalPolicyExclusionCount: 5,
        approvalPolicyDisableCount: 0,
      }),
    ).toEqual([
      { kind: "CREATORS", count: 0 },
      { kind: "POLICY_EXCLUSIONS", count: 5 },
    ]);
  });

  it("keeps the disabled-policy warning even when it equals the match count", () => {
    // approvalPolicyDisableCount is a subset of approvalPolicyMatchCount, so
    // the two can coincide. The disable line must still be its own statement:
    // "removed from a rule" and "that rule is now off" are different outcomes.
    expect(
      manualTagDeleteConsequences({
        creatorRelationshipCount: 1,
        approvalPolicyMatchCount: 3,
        approvalPolicyExclusionCount: 0,
        approvalPolicyDisableCount: 3,
      }).map((line) => line.kind),
    ).toEqual(["CREATORS", "POLICY_MATCHES", "POLICIES_DISABLED"]);
  });
});

describe("tag catalog panel state discipline", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/pages/ecommerce/components/AffiliateCreatorTagCatalogPanel.tsx"),
    "utf8",
  );

  it("keeps only ids and primitive drafts in React state", () => {
    expect(source).toContain('useState<string | null>(null)');
    expect(source).not.toContain("useRef");
    expect(source).not.toMatch(/useState<GQL\./);
  });

  it("reads the deletion cost fresh instead of from cache", () => {
    // The counts drive an irreversible cascade. A cached count could predate
    // another session's approval-policy edit.
    expect(source).toContain('fetchPolicy: "network-only"');
  });
});
