import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GQL } from "@rivonclaw/core";
import {
  AFFILIATE_POLICY_ACTIONS,
  AFFILIATE_POLICY_SUPPORTS_CAMPAIGN_AND_PRODUCT,
  AFFILIATE_POLICY_SUPPORTS_CAMPAIGN,
  AFFILIATE_POLICY_SUPPORTS_CREATOR_TAG,
  AFFILIATE_POLICY_SUPPORTS_PRODUCT,
} from "./AffiliateApprovalPolicyPanel.js";

describe("Affiliate approval policy actions", () => {
  it("covers every ActionProposalType, including the no-action decision", () => {
    expect([...AFFILIATE_POLICY_ACTIONS].sort()).toEqual(
      Object.values(GQL.ActionProposalType).sort(),
    );
  });

  it("mirrors the backend policy dimensions for every action", () => {
    expect(
      AFFILIATE_POLICY_SUPPORTS_CAMPAIGN_AND_PRODUCT[GQL.ActionProposalType.NoActionNeeded],
    ).toBe(false);
    expect(AFFILIATE_POLICY_SUPPORTS_CREATOR_TAG[GQL.ActionProposalType.NoActionNeeded]).toBe(true);
    expect(AFFILIATE_POLICY_SUPPORTS_CAMPAIGN[GQL.ActionProposalType.NoActionNeeded]).toBe(false);
    expect(AFFILIATE_POLICY_SUPPORTS_PRODUCT[GQL.ActionProposalType.NoActionNeeded]).toBe(false);

    for (const action of [
      GQL.ActionProposalType.SendMessage,
      GQL.ActionProposalType.ReviewSampleApplication,
    ]) {
      expect(AFFILIATE_POLICY_SUPPORTS_CREATOR_TAG[action]).toBe(true);
      expect(AFFILIATE_POLICY_SUPPORTS_CAMPAIGN[action]).toBe(true);
      expect(AFFILIATE_POLICY_SUPPORTS_PRODUCT[action]).toBe(true);
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
