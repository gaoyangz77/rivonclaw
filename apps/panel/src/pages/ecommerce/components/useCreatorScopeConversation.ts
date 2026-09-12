import { useQuery } from "@apollo/client/react";
import { GQL } from "@rivonclaw/core";
import {
  AFFILIATE_CREATOR_MESSAGE_HISTORY_QUERY,
  AFFILIATE_RELATIONSHIP_TIMELINE_QUERY,
} from "../../../api/shops-queries.js";
import { creatorScopeMessages, mergeCreatorScopeTimeline } from "../creator-detail-scope.js";

const PAGE_SIZE = 25;

/** Existing APIs only: preserve global channel history; use the shop-capable timeline for a shop. */
export function useCreatorScopeConversation(relationshipId: string | null, shopId: string) {
  const historyInput = { creatorRelationshipId: relationshipId ?? "", limit: PAGE_SIZE };
  const timelineInput = {
    ...historyInput,
    shopIds: [shopId],
    itemTypes: [GQL.AffiliateRelationshipTimelineItemType.Message],
  };
  const historyQuery = useQuery<
    { affiliateCreatorMessageHistory: GQL.AffiliateCreatorMessageHistoryPayload },
    { input: GQL.AffiliateCreatorMessageHistoryInput }
  >(AFFILIATE_CREATOR_MESSAGE_HISTORY_QUERY, {
    variables: { input: historyInput },
    skip: !relationshipId || Boolean(shopId),
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  const timelineQuery = useQuery<
    { affiliateRelationshipTimeline: GQL.AffiliateRelationshipTimelinePayload },
    { input: GQL.AffiliateRelationshipTimelineInput }
  >(AFFILIATE_RELATIONSHIP_TIMELINE_QUERY, {
    variables: { input: timelineInput },
    skip: !relationshipId || !shopId,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  const history = historyQuery.data?.affiliateCreatorMessageHistory;
  const timeline = timelineQuery.data?.affiliateRelationshipTimeline;
  const messages = shopId
    ? creatorScopeMessages(timeline?.items ?? [], shopId)
    : [...(history?.items ?? [])].sort(
        (a, b) =>
          new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime() ||
          a.messageRef.localeCompare(b.messageRef),
      );
  const query = shopId ? timelineQuery : historyQuery;
  const hasOlder = shopId
    ? Boolean(timeline?.hasOlder && timeline.olderCursor)
    : Boolean(history?.hasMore && history.nextOffset != null);

  async function loadOlder() {
    if (!hasOlder || query.loading || !relationshipId) return;
    if (shopId) {
      await timelineQuery.fetchMore({
        variables: { input: { ...timelineInput, cursor: timeline!.olderCursor } },
        updateQuery: (previous, { fetchMoreResult }) =>
          fetchMoreResult
            ? {
                affiliateRelationshipTimeline: mergeCreatorScopeTimeline(
                  previous.affiliateRelationshipTimeline,
                  fetchMoreResult.affiliateRelationshipTimeline,
                ),
              }
            : previous,
      });
    } else {
      await historyQuery.fetchMore({
        variables: { input: { ...historyInput, offset: history!.nextOffset } },
        updateQuery: (previous, { fetchMoreResult }) =>
          fetchMoreResult
            ? {
                affiliateCreatorMessageHistory: {
                  ...fetchMoreResult.affiliateCreatorMessageHistory,
                  items: [
                    ...new Map(
                      [
                        ...previous.affiliateCreatorMessageHistory.items,
                        ...fetchMoreResult.affiliateCreatorMessageHistory.items,
                      ].map((item) => [`${item.channel}:${item.messageRef}`, item]),
                    ).values(),
                  ],
                },
              }
            : previous,
      });
    }
  }
  return {
    messages,
    hasOlder,
    loadOlder,
    loading: query.loading,
    error: query.error,
    refetch: () => (shopId ? timelineQuery.refetch() : historyQuery.refetch()),
  };
}
