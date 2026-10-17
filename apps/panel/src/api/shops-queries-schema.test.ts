import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildSchema,
  graphql,
  print,
  NoUnusedFragmentsRule,
  specifiedRules,
  type DocumentNode,
  validate,
} from "graphql";
import { describe, expect, it } from "vitest";
import * as documents from "./shops-queries.js";
import * as knowledgeDocuments from "./product-knowledge-queries.js";

function isDocumentNode(value: unknown): value is DocumentNode {
  return Boolean(
    value && typeof value === "object" && (value as { kind?: string }).kind === "Document",
  );
}

describe("Panel shop GraphQL documents", () => {
  it("exposes a keyword-only user search without caller-controlled user/shop scope", () => {
    const schema = buildSchema(
      readFileSync(resolve(process.cwd(), "../../server/backend/schema.graphql"), "utf8"),
    );
    const field = schema.getQueryType()!.getFields().searchProductsForUser;
    expect(field.args.map((arg) => [arg.name, String(arg.type)])).toEqual([
      ["keywordOrId", "String!"],
    ]);
    expect(String(field.type)).toBe("UserProductSearchResult!");
  });
  it("delivers the top-level rejection code to the manual-send retry policy", async () => {
    const schema = buildSchema(
      readFileSync(resolve(process.cwd(), "../../server/backend/schema.graphql"), "utf8"),
    );
    const result = await graphql({
      schema,
      source: print(documents.SEND_AFFILIATE_CREATOR_MESSAGE_MUTATION),
      variableValues: { input: {
        shopId: "shop", creatorRelationshipId: "relationship", idempotencyKey: "human-ui:test",
        parts: [{ kind: "TEXT", text: "Hello" }],
      } },
      rootValue: { sendAffiliateCreatorMessage: () => ({
        delivery: {
          id: "delivery", preferredChannel: "PLATFORM_CHAT", actualChannel: "PLATFORM_CHAT",
          channelSelectionSource: "RELATIONSHIP_DEFAULT", status: "FAILED", parts: [],
          errorCode: "TikTokApiError", errorMessage: "TikTok rejected the message", createdAt: "2026-10-17T00:00:00Z",
        },
        affiliateCollaboration: null,
      }) },
    });
    expect(result.errors).toBeUndefined();
    expect(result.data?.sendAffiliateCreatorMessage).toMatchObject({
      delivery: { status: "FAILED", errorCode: "TikTokApiError" },
    });
  });
  it("validate against the current Backend schema", () => {
    const schema = buildSchema(
      readFileSync(resolve(process.cwd(), "../../server/backend/schema.graphql"), "utf8"),
    );
    const failures: string[] = [];

    for (const [name, document] of Object.entries({ ...documents, ...knowledgeDocuments })) {
      if (!isDocumentNode(document)) continue;
      for (const error of validate(
        schema,
        document,
        specifiedRules.filter((rule) => rule !== NoUnusedFragmentsRule),
      )) {
        failures.push(`${name}: ${error.message}`);
      }
    }

    expect(failures).toEqual([]);
  });
});
