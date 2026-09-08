import { describe, expect, it } from "vitest";
import { GQL } from "@rivonclaw/core";
import {
  matchesCreatorShop,
  creatorProposalShopIds,
  matchesCreatorProposalShop,
  creatorProposalRequiresGlobalView,
  creatorScopeWorkSummary,
  creatorScopeTimeline,
  creatorScopeMessages,
  mergeCreatorScopeTimeline,
} from "./creator-detail-scope.js";

function message(
  id: string,
  shopId: string | null,
  occurredAt: string,
): GQL.AffiliateRelationshipTimelineItem {
  return {
    id,
    occurredAt,
    kind: GQL.AffiliateRelationshipTimelineItemKind.Message,
    relatedIds: { shopId },
    summary: "message",
    message: {
      channel: GQL.AffiliateMessageChannel.PlatformChat,
      messageRef: id,
      parts: [{ kind: GQL.AffiliateHistoryPartKind.Text, text: id }],
    },
  };
}

describe("creator detail view scope", () => {
  it("defaults to all shops but never assigns unknown ownership to one shop", () => {
    expect([null, undefined, "1", "2"].filter((id) => matchesCreatorShop(id, ""))).toHaveLength(4);
    expect([null, undefined, "1", "2"].filter((id) => matchesCreatorShop(id, "1"))).toEqual(["1"]);
  });
  it("uses canonical proposal shops and preserves atomic cross-shop approval", () => {
    const crossShop = { shopIds: ["1", "2", "1"], focusShopId: "3" };
    expect(creatorProposalShopIds(crossShop)).toEqual(["1", "2"]);
    expect(matchesCreatorProposalShop(crossShop, "3")).toBe(false);
    expect(matchesCreatorProposalShop(crossShop, "2")).toBe(true);
    expect(creatorProposalRequiresGlobalView(crossShop, "2")).toBe(true);
    expect(creatorProposalRequiresGlobalView(crossShop, "")).toBe(false);
    const legacy = { shopIds: [], focusShopId: "1" };
    expect(matchesCreatorProposalShop(legacy, "1")).toBe(true);
    expect(creatorProposalRequiresGlobalView(legacy, "1")).toBe(false);
  });
  it("counts the selected agenda instead of reusing global needsAttention", () => {
    const items = [
      { shopId: "1", owner: GQL.AffiliateRelationshipAgendaOwner.External },
      { shopId: "2", owner: GQL.AffiliateRelationshipAgendaOwner.Agent },
      { shopId: "2", owner: GQL.AffiliateRelationshipAgendaOwner.Staff },
    ];
    expect(
      creatorScopeWorkSummary(items.filter((item) => matchesCreatorShop(item.shopId, "1"))),
    ).toEqual({ agentRequiredCount: 0, staffRequiredCount: 0, externalWaitingCount: 1 });
    expect(creatorScopeWorkSummary([])).toEqual({
      agentRequiredCount: 0,
      staffRequiredCount: 0,
      externalWaitingCount: 0,
    });
  });
  it("excludes global messages and unrelated events from shop history, preserving message payloads", () => {
    const newer = message("new", "1", "2026-09-08T12:00:00Z");
    const older = message("old", "1", "2026-09-07T12:00:00Z");
    const parts = [
      {
        kind: GQL.AffiliateHistoryPartKind.Attachment,
        fileName: "sample.jpg",
        attachmentRef: "attachment-1",
      },
    ];
    older.message!.parts = parts;
    const marker = {
      ...message("marker", null, older.occurredAt),
      kind: GQL.AffiliateRelationshipTimelineItemKind.TimePassed,
    };
    const items = [
      newer,
      message("other", "2", newer.occurredAt),
      message("global", null, newer.occurredAt),
      marker,
      older,
    ];
    expect(creatorScopeTimeline(items, "")).toEqual(items);
    expect(creatorScopeTimeline(items, "1")).toEqual([newer, older]);
    const result = creatorScopeMessages(items, "1");
    expect(result.map((item) => item.messageRef)).toEqual(["old", "new"]);
    expect(result[0].parts).toEqual(parts);
    expect(creatorScopeMessages(items, "")).toHaveLength(4);
  });
  it("merges overlapping pages once and advances the server cursor", () => {
    const newer = message("new", "1", "2026-09-08T12:00:00Z");
    const older = message("old", "1", "2026-09-07T12:00:00Z");
    const previous = {
      items: [newer],
      hasOlder: true,
      olderCursor: "first",
    } as GQL.AffiliateRelationshipTimelinePayload;
    const next = {
      items: [older, newer],
      hasOlder: false,
      olderCursor: null,
    } as GQL.AffiliateRelationshipTimelinePayload;
    const result = mergeCreatorScopeTimeline(previous, next);
    expect(result.items).toEqual([older, newer]);
    expect(result.hasOlder).toBe(false);
    expect(result.olderCursor).toBeNull();
    expect(previous.items).toEqual([newer]);
  });
});
