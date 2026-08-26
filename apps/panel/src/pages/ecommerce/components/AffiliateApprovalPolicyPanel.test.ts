import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GQL } from "@rivonclaw/core";
import {
  AFFILIATE_POLICY_ACTIONS,
  AFFILIATE_POLICY_SUPPORTS_CAMPAIGN_AND_PRODUCT,
  AFFILIATE_POLICY_SUPPORTS_CAMPAIGN,
  AFFILIATE_POLICY_SUPPORTS_MANUAL_TAG,
  AFFILIATE_POLICY_SUPPORTS_PRODUCT,
  AFFILIATE_POLICY_SUPPORTS_SAMPLE_TIER,
} from "./AffiliateApprovalPolicyPanel.js";

describe("Affiliate approval policy actions", () => {
  it("covers every ActionProposalType, including the no-action decision", () => {
    expect([...AFFILIATE_POLICY_ACTIONS].sort()).toEqual(
      Object.values(GQL.ActionProposalType).sort(),
    );
  });

  it("mirrors the backend policy dimensions for every action", () => {
    // A no-action decision and a tag change both carry no campaign and no
    // product, so the backend rejects those conditions for them.
    for (const action of [
      GQL.ActionProposalType.NoActionNeeded,
      GQL.ActionProposalType.ManageCreatorTag,
    ]) {
      expect(AFFILIATE_POLICY_SUPPORTS_CAMPAIGN_AND_PRODUCT[action]).toBe(false);
      expect(AFFILIATE_POLICY_SUPPORTS_CAMPAIGN[action]).toBe(false);
      expect(AFFILIATE_POLICY_SUPPORTS_PRODUCT[action]).toBe(false);
    }

    for (const action of [
      GQL.ActionProposalType.SendMessage,
      GQL.ActionProposalType.ReviewSampleApplication,
    ]) {
      expect(AFFILIATE_POLICY_SUPPORTS_CAMPAIGN[action]).toBe(true);
      expect(AFFILIATE_POLICY_SUPPORTS_PRODUCT[action]).toBe(true);
      expect(AFFILIATE_POLICY_SUPPORTS_CAMPAIGN_AND_PRODUCT[action]).toBe(true);
    }

    // Both tag dimensions resolve from the relationship, so every action has them.
    for (const action of Object.values(GQL.ActionProposalType)) {
      expect(AFFILIATE_POLICY_SUPPORTS_MANUAL_TAG[action]).toBe(true);
      expect(AFFILIATE_POLICY_SUPPORTS_SAMPLE_TIER[action]).toBe(true);
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
