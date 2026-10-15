import { GQL } from "@rivonclaw/core";

/** Query snapshots and SSE can cross in flight; a stale Pending must not win. */
export function latestAffiliateProposal(
  incoming: GQL.ActionProposal,
  stored?: GQL.ActionProposal | null,
): GQL.ActionProposal {
  if (!stored || stored.id !== incoming.id) return incoming;
  const storedAt = Date.parse(stored.updatedAt);
  const incomingAt = Date.parse(incoming.updatedAt);
  return !Number.isFinite(incomingAt) || storedAt >= incomingAt
    ? { ...incoming, ...stored }
    : { ...stored, ...incoming };
}

export function affiliateProposalDecisionApplied(
  requested: GQL.ActionProposalStatus,
  actual: GQL.ActionProposalStatus,
): boolean {
  return actual === requested || (
    requested === GQL.ActionProposalStatus.Approved && actual === GQL.ActionProposalStatus.Executed
  );
}
