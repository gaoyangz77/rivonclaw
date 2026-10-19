import { useCallback } from "react";
import { GQL } from "@rivonclaw/core";
import {
  AFFILIATE_CREATOR_MESSAGE_HISTORY_QUERY,
  AFFILIATE_RELATIONSHIP_TIMELINE_QUERY,
} from "../../../api/shops-queries.js";
import { creatorScopeMessages } from "../creator-detail-scope.js";
import { useAffiliateLoadedQuery } from "../hooks/useAffiliateLoadedQuery.js";
import {
  affiliateHistoryCursor,
  affiliateHistoryPageInfo,
  affiliateTimelinePageInfo,
} from "../affiliate-loaded-pages.js";

const PAGE_SIZE = 25;

/** Both global offset history and shop cursor history retain their loaded range on refresh. */
export function useCreatorScopeConversation(
  relationshipId: string | null,
  shopId: string,
  enabled = true,
) {
  const historyInput = { creatorRelationshipId: relationshipId ?? "", limit: PAGE_SIZE };
  const scopeKey = JSON.stringify([relationshipId, shopId]);
  const historyQuery = useAffiliateLoadedQuery<
    GQL.AffiliateCreatorMessageHistoryItem,
    GQL.AffiliateCreatorMessageHistoryPayload,
    GQL.AffiliateCreatorMessageHistoryInput,
    "affiliateCreatorMessageHistory"
  >(AFFILIATE_CREATOR_MESSAGE_HISTORY_QUERY, {
    field: "affiliateCreatorMessageHistory",
    input: historyInput,
    queryKey: scopeKey,
    enabled: enabled && Boolean(relationshipId) && !shopId,
    rowKey: (message) => `${message.channel}:${message.messageRef}`,
    pageInfo: affiliateHistoryPageInfo,
    withCursor: affiliateHistoryCursor,
    throwOnError: true,
  });
  const timelineQuery = useAffiliateLoadedQuery<
    GQL.AffiliateRelationshipTimelineItem,
    GQL.AffiliateRelationshipTimelinePayload,
    GQL.AffiliateRelationshipTimelineInput,
    "affiliateRelationshipTimeline"
  >(AFFILIATE_RELATIONSHIP_TIMELINE_QUERY, {
    field: "affiliateRelationshipTimeline",
    input: {
      ...historyInput,
      shopIds: [shopId],
      itemTypes: [GQL.AffiliateRelationshipTimelineItemType.Message],
    },
    queryKey: scopeKey,
    enabled: enabled && Boolean(relationshipId) && Boolean(shopId),
    rowKey: (entry) => entry.id,
    pageInfo: affiliateTimelinePageInfo,
    throwOnError: true,
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
  const refetchHistory = historyQuery.refetch;
  const refetchTimeline = timelineQuery.refetch;
  const refetch = useCallback(
    () => (enabled ? (shopId ? refetchTimeline() : refetchHistory()) : Promise.resolve(undefined)),
    [enabled, shopId, refetchHistory, refetchTimeline],
  );
  const hasOlder = shopId
    ? Boolean(timeline?.hasOlder && timeline.olderCursor)
    : Boolean(history?.hasMore && history.nextOffset != null);
  async function loadOlder() {
    if (!enabled || !hasOlder || query.loading || !relationshipId) return;
    await query.loadMore();
  }
  return { messages, hasOlder, loadOlder, loading: query.loading, error: query.error, refetch };
}
