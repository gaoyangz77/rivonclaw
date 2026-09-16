import { gql } from "@apollo/client/core";

/**
 * Resolves `media://<assetId>` URIs embedded in user Markdown to displayable
 * URLs. The backend returns only the assets the current user owns; unknown or
 * foreign URIs are omitted from the result rather than erroring, so a document
 * that references a deleted asset still loads.
 *
 * Validated against `server/backend/schema.graphql` by
 * `product-knowledge-queries.test.ts` together with the Product Knowledge
 * documents.
 */
export const MEDIA_ASSETS_BY_URI_QUERY = gql`
  query MediaAssetsByUri($uris: [String!]!) {
    mediaAssetsByUri(uris: $uris) {
      uri
      assetId
      kind
      mimeType
      sizeBytes
      width
      height
      publicUrl
    }
  }
`;

/** Maximum URIs the backend accepts in a single `mediaAssetsByUri` call. */
export const MEDIA_ASSETS_BY_URI_BATCH_LIMIT = 100;

export type MediaAssetRef = {
  uri: string;
  assetId: string;
  kind: "IMAGE" | "VIDEO";
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  publicUrl: string;
};

export type MediaAssetsByUriResult = {
  mediaAssetsByUri: MediaAssetRef[];
};
