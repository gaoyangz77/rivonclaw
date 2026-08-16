import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GQL } from "@rivonclaw/core";
import {
  AFFILIATE_POLICY_ACTIONS,
  AFFILIATE_POLICY_SUPPORTS_CAMPAIGN_AND_PRODUCT,
} from "./AffiliateApprovalPolicyPanel.js";

describe("Affiliate approval policy actions", () => {
  it("covers every ActionProposalType, including the no-action decision", () => {
    expect([...AFFILIATE_POLICY_ACTIONS].sort()).toEqual(
      Object.values(GQL.ActionProposalType).sort(),
    );
  });

  it("offers campaign and product conditions only where the backend accepts them", () => {
    expect(
      AFFILIATE_POLICY_SUPPORTS_CAMPAIGN_AND_PRODUCT[GQL.ActionProposalType.NoActionNeeded],
    ).toBe(false);
    for (const action of AFFILIATE_POLICY_ACTIONS) {
      if (action === GQL.ActionProposalType.NoActionNeeded) continue;
      expect(AFFILIATE_POLICY_SUPPORTS_CAMPAIGN_AND_PRODUCT[action]).toBe(true);
    }
  });

  it("seeds the recommended policy set from the full action list", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/components/AffiliateApprovalPolicyPanel.tsx"),
      "utf8",
    );

    // One policy row exists per action, so the recommended set must iterate the
    // same list the tabs render; otherwise a new action stays ungated.
    expect(source).toContain("for (const action of AFFILIATE_POLICY_ACTIONS) {");
    expect(source).toContain("ecommerce.affiliateWorkspace.policies.creatorTagOnlyHint");
  });
});
