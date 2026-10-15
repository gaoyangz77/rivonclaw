import { describe, expect, it } from "vitest";
import { GQL } from "@rivonclaw/core";
import { affiliateProposalDecisionApplied, latestAffiliateProposal } from "./affiliate-proposal-state.js";

describe("authoritative proposal state", () => {
  const pending = { id: "old-proposal", status: GQL.ActionProposalStatus.Pending, updatedAt: "2026-10-14T10:27:06Z" } as GQL.ActionProposal;
  const superseded = { ...pending, status: GQL.ActionProposalStatus.Superseded, updatedAt: "2026-10-14T10:27:48Z" };
  it("does not let a late query response revive an invalidated proposal", () => {
    expect(latestAffiliateProposal(pending, superseded).status).toBe(GQL.ActionProposalStatus.Superseded);
    expect(latestAffiliateProposal(superseded, pending).status).toBe(GQL.ActionProposalStatus.Superseded);
  });
  it("does not apply an old proposal's terminal state to a new proposal for the same Creator", () => {
    const next = { ...pending, id: "new-proposal" };
    expect(latestAffiliateProposal(next, superseded)).toEqual(next);
  });
  it("never reports a conflict as a successful ignore/approval", () => {
    expect(affiliateProposalDecisionApplied(GQL.ActionProposalStatus.Ignored, GQL.ActionProposalStatus.Superseded)).toBe(false);
    expect(affiliateProposalDecisionApplied(GQL.ActionProposalStatus.Approved, GQL.ActionProposalStatus.Expired)).toBe(false);
    expect(affiliateProposalDecisionApplied(GQL.ActionProposalStatus.Approved, GQL.ActionProposalStatus.Executed)).toBe(true);
    expect(affiliateProposalDecisionApplied(GQL.ActionProposalStatus.Ignored, GQL.ActionProposalStatus.Ignored)).toBe(true);
  });
});
