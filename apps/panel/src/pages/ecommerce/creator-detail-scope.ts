import { GQL } from "@rivonclaw/core";

/** Empty scope means all authorized shops. Unknown ownership never matches a shop. */
export function matchesCreatorShop(shopId: string | null | undefined, scope: string): boolean {
  return !scope || shopId === scope;
}

type ProposalScope = Pick<GQL.ActionProposal, "shopIds" | "focusShopId">;
export function creatorProposalShopIds(proposal: ProposalScope): string[] {
  return [...new Set(proposal.shopIds?.length ? proposal.shopIds : [proposal.focusShopId])].filter(
    Boolean,
  );
}

export function matchesCreatorProposalShop(proposal: ProposalScope, scope: string): boolean {
  return !scope || creatorProposalShopIds(proposal).includes(scope);
}

/** A cross-shop decision is atomic: do not hide half its payload and keep approval enabled. */
export function creatorProposalRequiresGlobalView(proposal: ProposalScope, scope: string): boolean {
  return Boolean(scope) && creatorProposalShopIds(proposal).length !== 1;
}

export function creatorScopeWorkSummary(
  items: readonly Pick<GQL.AffiliateRelationshipAgendaItem, "owner">[],
) {
  return {
    agentRequiredCount: items.filter(
      (item) => item.owner === GQL.AffiliateRelationshipAgendaOwner.Agent,
    ).length,
    staffRequiredCount: items.filter(
      (item) => item.owner === GQL.AffiliateRelationshipAgendaOwner.Staff,
    ).length,
    externalWaitingCount: items.filter(
      (item) => item.owner === GQL.AffiliateRelationshipAgendaOwner.External,
    ).length,
  };
}

/** Timeline also returns global events and temporal markers. Keep only owned real records. */
export function creatorScopeTimeline(
  items: readonly GQL.AffiliateRelationshipTimelineItem[],
  scope: string,
) {
  return scope ? items.filter((item) => item.relatedIds.shopId === scope) : [...items];
}

export function creatorScopeMessages(
  items: readonly GQL.AffiliateRelationshipTimelineItem[],
  scope: string,
): GQL.AffiliateCreatorMessageHistoryItem[] {
  return creatorScopeTimeline(items, scope)
    .flatMap((item) => {
      if (item.kind !== GQL.AffiliateRelationshipTimelineItemKind.Message || !item.message)
        return [];
      const message = item.message;
      return [
        {
          channel: message.channel,
          direction: message.direction,
          messageRef: message.messageRef ?? item.id,
          parts: message.parts ?? [],
          messageType: message.messageType,
          createdAt: item.occurredAt,
          subject: message.subject,
          channelLabel: message.channelLabel,
          shopId: item.relatedIds.shopId,
          shopName: message.shopName,
          accountLabel: message.accountLabel,
          source: "RELATIONSHIP_TIMELINE",
        },
      ];
    })
    .sort(
      (a, b) =>
        new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime() ||
        a.messageRef.localeCompare(b.messageRef),
    );
}

export function mergeCreatorScopeTimeline(
  previous: GQL.AffiliateRelationshipTimelinePayload,
  next: GQL.AffiliateRelationshipTimelinePayload,
): GQL.AffiliateRelationshipTimelinePayload {
  const byId = new Map([...previous.items, ...next.items].map((item) => [item.id, item]));
  return {
    ...next,
    items: [...byId.values()].sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    ),
  };
}
