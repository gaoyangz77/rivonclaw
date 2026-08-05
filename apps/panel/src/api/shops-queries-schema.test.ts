import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildSchema,
  NoUnusedFragmentsRule,
  specifiedRules,
  type DocumentNode,
  validate,
} from "graphql";
import { describe, expect, it } from "vitest";
import * as documents from "./shops-queries.js";

function isDocumentNode(value: unknown): value is DocumentNode {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value as { kind?: string }).kind === "Document",
  );
}

describe("Panel shop GraphQL documents", () => {
  it("validate against the current Backend schema", () => {
    const schema = buildSchema(readFileSync(resolve(process.cwd(), "../../server/backend/schema.graphql"), "utf8"));
    const failures: string[] = [];

    for (const [name, document] of Object.entries(documents)) {
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
