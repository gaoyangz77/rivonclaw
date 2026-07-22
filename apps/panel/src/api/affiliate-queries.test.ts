import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildSchema, print, validate } from "graphql";
import { describe, expect, it } from "vitest";
import {
  AFFILIATE_ACTION_PROPOSALS_QUERY,
  AFFILIATE_CREATOR_CHANNEL_CONTACTS_QUERY,
  AFFILIATE_COLLABORATION_RECORDS_QUERY,
  AFFILIATE_CREATORS_QUERY,
  AFFILIATE_WORK_ITEMS_QUERY,
  DECIDE_ACTION_PROPOSAL_MUTATION,
  SET_AFFILIATE_BUSINESS_DEVELOPER_PREFERRED_ACCOUNT_MUTATION,
} from "./shops-queries.js";

function queryText(document: Parameters<typeof print>[0]): string {
  return print(document);
}

describe("affiliate workspace GraphQL contracts", () => {
  it("keeps every Affiliate workspace operation valid against the backend schema", () => {
    const schema = buildSchema(
      readFileSync(resolve(process.cwd(), "../../server/backend/schema.graphql"), "utf8"),
    );
    const operations = {
      workItems: AFFILIATE_WORK_ITEMS_QUERY,
      proposals: AFFILIATE_ACTION_PROPOSALS_QUERY,
      contacts: AFFILIATE_CREATOR_CHANNEL_CONTACTS_QUERY,
      collaborations: AFFILIATE_COLLABORATION_RECORDS_QUERY,
      creators: AFFILIATE_CREATORS_QUERY,
      decideProposal: DECIDE_ACTION_PROPOSAL_MUTATION,
      preferredAccount: SET_AFFILIATE_BUSINESS_DEVELOPER_PREFERRED_ACCOUNT_MUTATION,
    };
    expect(
      Object.entries(operations).flatMap(([operation, document]) =>
        validate(schema, document).map((error) => ({ operation, message: error.message })),
      ),
    ).toEqual([]);
  });

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

  it("retains work items as an internal relationship dispatch contract", () => {
    const query = queryText(AFFILIATE_WORK_ITEMS_QUERY);

    expect(query).toContain("affiliateWorkItems(input: $input)");
    expect(query).toContain("creatorRelation");
    expect(query).toContain("focusCollaboration");
    expect(query).toContain("activeCollaborations");
    expect(query).not.toContain("latestPendingProposal");
  });

  it("decides proposals at creator relationship granularity", () => {
    const mutation = queryText(DECIDE_ACTION_PROPOSAL_MUTATION);

    expect(mutation).toContain("decideActionProposal(input: $input)");
    expect(mutation).toContain("creatorRelationshipId");
    expect(mutation).toContain("decision");
  });

  it("loads exact seller-account to Creator contact assets", () => {
    const query = queryText(AFFILIATE_CREATOR_CHANNEL_CONTACTS_QUERY);

    expect(query).toContain("affiliateCreatorChannelContacts(input: $input)");
    expect(query).toContain("creatorRelationshipId");
    expect(query).toContain("accountBindingId");
    expect(query).toContain("businessDeveloperId");
    expect(query).toContain("effectiveAlias");
  });

  it("sets the preferred sender account through the BD-scoped mutation", () => {
    const mutation = queryText(SET_AFFILIATE_BUSINESS_DEVELOPER_PREFERRED_ACCOUNT_MUTATION);

    expect(mutation).toContain("setAffiliateBusinessDeveloperPreferredAccount(input: $input)");
    expect(mutation).toContain("preferredWhatsAppAccountBindingId");
    expect(mutation).toContain("preferredEmailAccountBindingId");
  });
});
