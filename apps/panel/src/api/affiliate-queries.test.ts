import { print } from "graphql";
import { describe, expect, it } from "vitest";
import {
  AFFILIATE_ACTION_PROPOSALS_QUERY,
  AFFILIATE_COLLABORATION_RECORDS_QUERY,
  AFFILIATE_CREATORS_QUERY,
  AFFILIATE_WORK_ITEMS_QUERY,
  DECIDE_ACTION_PROPOSAL_MUTATION,
} from "./shops-queries.js";

function queryText(document: Parameters<typeof print>[0]): string {
  return print(document);
}

describe("affiliate workspace GraphQL contracts", () => {
  it("loads creator relationship roster from the creator relationship API", () => {
    const query = queryText(AFFILIATE_CREATORS_QUERY);

    expect(query).toContain("affiliateCreators(input: $input)");
    expect(query).toContain("creatorRelation");
    expect(query).toContain("creatorProfile");
    expect(query).toContain("latestCollaborationRecord");
    expect(query).toContain("latestPendingProposal");
  });

  it("loads approval proposals with relationship and collaboration focus context", () => {
    const query = queryText(AFFILIATE_ACTION_PROPOSALS_QUERY);

    expect(query).toContain("actionProposals(input: $input)");
    expect(query).toContain("creatorRelationshipId");
    expect(query).toContain("creatorProfile");
    expect(query).toContain("sourceWorkBoundary");
    expect(query).toContain("collaborationRecord");
    expect(query).toContain("sampleReviewIntent");
    expect(query).toContain("steps");
  });

  it("loads collaboration records directly for the collaboration history page", () => {
    const query = queryText(AFFILIATE_COLLABORATION_RECORDS_QUERY);

    expect(query).toContain("collaborationRecords(input: $input)");
    expect(query).toContain("creatorRelationshipId");
    expect(query).toContain("creatorProfile");
    expect(query).toContain("sampleApplicationRecords");
    expect(query).toContain("order");
    expect(query).toContain("trackingNumber");
  });

  it("loads staff handling items as work items with relationship context", () => {
    const query = queryText(AFFILIATE_WORK_ITEMS_QUERY);

    expect(query).toContain("affiliateWorkItems(input: $input)");
    expect(query).toContain("creatorRelation");
    expect(query).toContain("focusCollaboration");
    expect(query).toContain("activeCollaborations");
    expect(query).toContain("latestPendingProposal");
  });

  it("decides proposals at creator relationship granularity", () => {
    const mutation = queryText(DECIDE_ACTION_PROPOSAL_MUTATION);

    expect(mutation).toContain("decideActionProposal(input: $input)");
    expect(mutation).toContain("creatorRelationshipId");
    expect(mutation).toContain("decision");
  });
});
