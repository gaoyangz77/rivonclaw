import { getClient } from "./apollo-client.js";
import { gql } from "@apollo/client/core";

const TOOL_SPECS_QUERY = gql`
  query ToolSpecsWarm {
    toolSpecs { id name category displayName description surfaces runProfiles }
  }
`;

/** Query toolSpecs through the GraphQL proxy to populate Desktop's entity-cache. */
export async function warmToolSpecs(): Promise<void> {
  await getClient().query({ query: TOOL_SPECS_QUERY, fetchPolicy: "network-only" });
}
