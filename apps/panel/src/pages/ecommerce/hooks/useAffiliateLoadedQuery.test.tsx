import type { ReactNode } from "react";
import type { DocumentNode, SelectionSetNode, FragmentDefinitionNode } from "graphql";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing/react";
import { afterEach, expect, it } from "vitest";
import type { GQL } from "@rivonclaw/core";
import {
  AFFILIATE_ACTION_PROPOSALS_QUERY,
  AFFILIATE_RELATIONSHIP_SAMPLE_APPLICATIONS_QUERY,
  AFFILIATE_RELATIONSHIP_PLATFORM_COLLABORATIONS_QUERY,
  AFFILIATE_RELATIONSHIP_TIMELINE_QUERY,
} from "../../../api/shops-queries.js";
import {
  affiliateTimelinePageInfo,
  mergeSampleDetailPages,
  mergePlatformDetailPages,
} from "../affiliate-loaded-pages.js";
import { mergeCreatorScopeTimeline } from "../creator-detail-scope.js";
import { useAffiliateLoadedQuery } from "./useAffiliateLoadedQuery.js";

type Row =
  | GQL.ActionProposal
  | GQL.SampleApplicationRecord
  | GQL.AffiliateRelationshipPlatformCollaborationItem
  | GQL.AffiliateRelationshipTimelineItem;
type Page =
  | GQL.AffiliateActionProposalPage
  | GQL.AffiliateRelationshipSampleApplicationPage
  | GQL.AffiliateRelationshipPlatformCollaborationPage
  | GQL.AffiliateRelationshipTimelinePayload;
const rowKey = (row: Row) => ("collaboration" in row ? row.collaboration.id : row.id);
const pageInfo = (page: Page) =>
  "hasOlder" in page
    ? affiliateTimelinePageInfo(page)
    : { hasMore: page.hasMore, nextCursor: page.nextCursor ?? null };
// Complete optional query selections so the test exercises real Apollo cache reads.
function selectedFields(
  set: SelectionSetNode,
  value: Record<string, unknown>,
  fragments: Map<string, FragmentDefinitionNode>,
): Record<string, unknown> {
  return Object.assign(
    {},
    ...set.selections.map((field) => {
      if (field.kind === "FragmentSpread")
        return selectedFields(fragments.get(field.name.value)!.selectionSet, value, fragments);
      if (field.kind === "InlineFragment")
        return selectedFields(field.selectionSet, value, fragments);
      const item = value[field.name.value] ?? null;
      return {
        [field.name.value]:
          field.selectionSet && item != null
            ? Array.isArray(item)
              ? item.map((row) => selectedFields(field.selectionSet!, row, fragments))
              : selectedFields(field.selectionSet, item as Record<string, unknown>, fragments)
            : item,
      };
    }),
  );
}
function dataFor(query: DocumentNode, data: Record<string, unknown>) {
  const operation = query.definitions.find((def) => def.kind === "OperationDefinition")!;
  if (operation.kind !== "OperationDefinition") throw new Error("missing operation");
  const fragments = new Map(
    query.definitions
      .filter((def): def is FragmentDefinitionNode => def.kind === "FragmentDefinition")
      .map((def) => [def.name.value, def]),
  );
  return selectedFields(operation.selectionSet, data, fragments);
}
const cases = [
  {
    name: "pending proposals",
    query: AFFILIATE_ACTION_PROPOSALS_QUERY,
    field: "affiliateActionProposalPage",
    input: {
      shopId: null,
      status: "PENDING",
      limit: 20,
      cursor: null,
      createdAtGe: "2026-10-01T00:00:00Z",
      createdAtLt: "2026-11-01T00:00:00Z",
    },
  },
  {
    name: "sample applications",
    query: AFFILIATE_RELATIONSHIP_SAMPLE_APPLICATIONS_QUERY,
    field: "affiliateRelationshipSampleApplications",
    input: { creatorRelationshipId: "creator", shopId: "shop-1", limit: 25 },
  },
  {
    name: "platform collaborations",
    query: AFFILIATE_RELATIONSHIP_PLATFORM_COLLABORATIONS_QUERY,
    field: "affiliateRelationshipPlatformCollaborations",
    input: { creatorRelationshipId: "creator", shopId: "shop-1", limit: 25 },
  },
  {
    name: "proposal history",
    query: AFFILIATE_ACTION_PROPOSALS_QUERY,
    field: "affiliateActionProposalPage",
    input: { creatorRelationshipId: "creator", shopId: "shop-1", limit: 25 },
  },
  {
    name: "operation history",
    query: AFFILIATE_RELATIONSHIP_TIMELINE_QUERY,
    field: "affiliateRelationshipTimeline",
    input: { creatorRelationshipId: "creator", shopIds: ["shop-1"], limit: 25 },
  },
];
afterEach(cleanup);
it.each(cases)(
  "retains and revalidates $name, including its loaded cursor and metadata",
  async ({ query, field, input, name }) => {
    const platform = name === "platform collaborations";
    const timeline = name === "operation history";
    const expectedIds = (ids: number[]) => (timeline ? [...ids].reverse() : ids).map(String);
    const summaries = (ids: number[]) =>
      ids.map((id) => ({
        shopId: "shop-1",
        product: { productId: `product-${id}`, title: `Product ${id}`, skus: [] },
      }));
    const makePage = (ids: number[], cursor: string | null) => ({
      items: (timeline ? [...ids].reverse() : ids).map((id) =>
        platform
          ? { collaboration: { id: String(id) }, sources: [] }
          : { id: String(id), status: "PENDING", occurredAt: `2026-10-18T00:00:0${8 - id}Z` },
      ),
      productSummaries: summaries(ids),
      hasMore: Boolean(cursor),
      nextCursor: cursor,
      hasOlder: Boolean(cursor),
      olderCursor: cursor,
      limit: 25,
      realItemCount: ids.length,
      readAt: "2026-10-18T00:00:00Z",
    });
    const mock = (cursor: string | null, ids: number[], nextCursor: string | null, delay = 0) => ({
      request: { query, variables: { input: cursor === null ? input : { ...input, cursor } } },
      result: { data: dataFor(query, { [field]: makePage(ids, nextCursor) }) },
      delay,
    });
    const mocks = [
      mock(null, [1, 2], "after-2"),
      mock("after-2", [3, 4], "after-4"),
      mock(null, [2, 3], "new-after-3"),
      mock("new-after-3", [5, 6], "after-6", 50),
      mock("after-6", [7], null),
    ];
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MockedProvider mocks={mocks}>{children}</MockedProvider>
    );
    const { result } = renderHook(
      () =>
        useAffiliateLoadedQuery<Row, Page, typeof input, string>(query, {
          field,
          input,
          queryKey: name,
          enabled: true,
          rowKey,
          pageInfo,
          mergePages: (previous, next) => {
            if ("hasOlder" in previous && "hasOlder" in next)
              return mergeCreatorScopeTimeline(previous, next);
            if ("productSummaries" in previous && "productSummaries" in next) {
              return platform
                ? mergePlatformDetailPages(
                    previous as GQL.AffiliateRelationshipPlatformCollaborationPage,
                    next as GQL.AffiliateRelationshipPlatformCollaborationPage,
                  )
                : mergeSampleDetailPages(
                    previous as GQL.AffiliateRelationshipSampleApplicationPage,
                    next as GQL.AffiliateRelationshipSampleApplicationPage,
                  );
            }
            return { ...next, items: [...previous.items, ...next.items] } as Page;
          },
        }),
      { wrapper },
    );
    const ids = () => result.current.data?.[field].items.map(rowKey);
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.loadMore());
    expect(ids()).toEqual(expectedIds([1, 2, 3, 4]));
    let refresh!: Promise<void>;
    act(() => {
      refresh = result.current.refetch();
    });
    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(ids()).toEqual(expectedIds([1, 2, 3, 4]));
    await act(async () => {
      await refresh;
    });
    expect(ids()).toEqual(expectedIds([2, 3, 5, 6]));
    const refreshed = result.current.data![field];
    if ("productSummaries" in refreshed)
      expect(refreshed.productSummaries.map((entry) => entry.product.productId)).toEqual([
        "product-2",
        "product-3",
        "product-5",
        "product-6",
      ]);
    await act(() => result.current.loadMore());
    expect(ids()).toEqual(expectedIds([2, 3, 5, 6, 7]));
    expect(pageInfo(result.current.data![field]).hasMore).toBe(false);
  },
);
