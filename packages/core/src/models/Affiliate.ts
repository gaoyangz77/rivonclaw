import { applySnapshot, getSnapshot, types, type Instance } from "mobx-state-tree";
import type * as GQL from "../generated/graphql.js";

function nowIso(): string {
  return new Date().toISOString();
}

function normalizedText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function includesSearch(search: string, values: unknown[]): boolean {
  if (!search) return true;
  return values.some((value) => normalizedText(value).includes(search));
}

function productSummaryKey(productId: string | null | undefined): string {
  return productId ?? "";
}

function conversationKey(shopId: string, conversationId: string): string {
  return `${shopId}:${conversationId}`;
}

function messageIdentity(message: Record<string, any>): string {
  return String(message.messageId ?? message.conversationIndex ?? message.createdAt ?? JSON.stringify(message));
}

export const AffiliateCreatorProfileModel = types.model("AffiliateCreatorProfile", {
  id: types.identifier,
  platform: types.optional(types.string, "TIKTOK_SHOP"),
  creatorOpenId: types.maybeNull(types.string),
  creatorImId: types.maybeNull(types.string),
  username: types.maybeNull(types.string),
  nickname: types.maybeNull(types.string),
  avatarUrl: types.maybeNull(types.string),
  followerCount: types.maybeNull(types.number),
  categoryIds: types.optional(types.array(types.string), []),
  marketplaceSnapshotJson: types.maybeNull(types.string),
  aggregatedSignalsSnapshotJson: types.maybeNull(types.string),
  createdAt: types.optional(types.string, nowIso),
  updatedAt: types.optional(types.string, nowIso),
});

export const AffiliateProductSkuSummaryModel = types.model("AffiliateProductSkuSummary", {
  skuId: types.maybeNull(types.string),
  skuName: types.maybeNull(types.string),
  sellerSku: types.maybeNull(types.string),
  price: types.maybeNull(types.string),
  currency: types.maybeNull(types.string),
});

export const AffiliateProductSummaryModel = types.model("AffiliateProductSummary", {
  productId: types.identifier,
  title: types.maybeNull(types.string),
  coverImage: types.maybeNull(types.string),
  status: types.maybeNull(types.string),
  priceMin: types.maybeNull(types.string),
  priceMax: types.maybeNull(types.string),
  description: types.maybeNull(types.string),
  createTime: types.maybeNull(types.number),
  updateTime: types.maybeNull(types.number),
  skus: types.optional(types.array(AffiliateProductSkuSummaryModel), []),
});

export const AffiliateCollaborationRecordModel = types.model("AffiliateCollaborationRecord", {
  id: types.identifier,
  userId: types.string,
  shopId: types.string,
  creatorId: types.string,
  creatorOpenId: types.maybeNull(types.string),
  creatorImId: types.maybeNull(types.string),
  productId: types.maybeNull(types.string),
  lifecycleStage: types.string,
  processingStatus: types.string,
  requiredAction: types.string,
  processReasons: types.optional(types.array(types.string), []),
  nextSellerActionAt: types.maybeNull(types.string),
  stateUpdatedAt: types.string,
  lastSignalAt: types.maybeNull(types.string),
  workHandledUntil: types.maybeNull(types.string),
  affiliateCollaborationId: types.maybeNull(types.string),
  collaborationType: types.maybeNull(types.string),
  sampleApplicationRecordId: types.maybeNull(types.string),
  platformCollaborationId: types.maybeNull(types.string),
  platformConversationId: types.maybeNull(types.string),
  lastCreatorMessageId: types.maybeNull(types.string),
  lastCreatorMessageAt: types.maybeNull(types.string),
  startedAt: types.string,
  endedAt: types.maybeNull(types.string),
  predictionSnapshots: types.optional(types.array(types.frozen<Record<string, any>>()), []),
  createdAt: types.string,
  updatedAt: types.string,
});

export const AffiliateSampleApplicationRecordModel = types.model("AffiliateSampleApplicationRecord", {
  id: types.identifier,
  userId: types.string,
  shopId: types.string,
  creatorId: types.maybeNull(types.string),
  creatorOpenId: types.maybeNull(types.string),
  productId: types.maybeNull(types.string),
  affiliateCollaborationId: types.maybeNull(types.string),
  collaborationType: types.maybeNull(types.string),
  platformApplicationId: types.string,
  platformCollaborationId: types.maybeNull(types.string),
  platformOpenCollaborationId: types.maybeNull(types.string),
  platformTargetCollaborationId: types.maybeNull(types.string),
  sampleWorkStatus: types.string,
  trackingNumber: types.maybeNull(types.string),
  carrier: types.maybeNull(types.string),
  shippedAt: types.maybeNull(types.string),
  deliveredAt: types.maybeNull(types.string),
  observedContentCount: types.optional(types.number, 0),
  latestObservedContentAt: types.maybeNull(types.string),
  latestObservedContentId: types.maybeNull(types.string),
  latestObservedContentFormat: types.maybeNull(types.string),
  latestObservedContentUrl: types.maybeNull(types.string),
  latestObservedContentViewCount: types.maybeNull(types.number),
  latestObservedContentPaidOrderCount: types.maybeNull(types.number),
  updatedAt: types.string,
});

export const AffiliateLifecycleEventModel = types.model("AffiliateLifecycleEvent", {
  id: types.identifier,
  userId: types.string,
  shopId: types.string,
  entityType: types.string,
  entityId: types.string,
  eventType: types.string,
  actorType: types.maybeNull(types.string),
  actorId: types.maybeNull(types.string),
  collaborationRecordId: types.maybeNull(types.string),
  proposalId: types.maybeNull(types.string),
  creatorId: types.maybeNull(types.string),
  productId: types.maybeNull(types.string),
  campaignId: types.maybeNull(types.string),
  fromStage: types.maybeNull(types.string),
  toStage: types.maybeNull(types.string),
  displayPayloadJson: types.maybeNull(types.string),
  createdAt: types.string,
});

export const AffiliateActionProposalModel = types.model("AffiliateActionProposal", {
  id: types.identifier,
  userId: types.string,
  shopId: types.string,
  campaignId: types.maybeNull(types.string),
  creatorId: types.maybeNull(types.string),
  collaborationRecordId: types.maybeNull(types.string),
  collaborationRecordLastSignalAt: types.maybeNull(types.string),
  collaborationRecordStateUpdatedAt: types.maybeNull(types.string),
  type: types.string,
  status: types.string,
  operatorSummary: types.string,
  predictionCacheIds: types.maybeNull(types.array(types.string)),
  steps: types.optional(types.array(types.frozen<Record<string, any>>()), []),
  policySnapshot: types.maybeNull(types.frozen<Record<string, any>>()),
  decision: types.maybeNull(types.frozen<Record<string, any>>()),
  executionResult: types.maybeNull(types.frozen<Record<string, any>>()),
  messageIntent: types.maybeNull(types.frozen<Record<string, any>>()),
  sampleReviewIntent: types.maybeNull(types.frozen<Record<string, any>>()),
  sampleShipmentIntent: types.maybeNull(types.frozen<Record<string, any>>()),
  targetCollaborationIntent: types.maybeNull(types.frozen<Record<string, any>>()),
  creatorTagIntent: types.maybeNull(types.frozen<Record<string, any>>()),
  blockCreatorIntent: types.maybeNull(types.frozen<Record<string, any>>()),
  campaignProductUpdateIntent: types.maybeNull(types.frozen<Record<string, any>>()),
  approvalPolicyUpdateIntent: types.maybeNull(types.frozen<Record<string, any>>()),
  candidateDecisionIntent: types.maybeNull(types.frozen<Record<string, any>>()),
  expiresAt: types.maybeNull(types.string),
  createdAt: types.string,
  updatedAt: types.string,
});

export const AffiliateConversationRecordModel = types.model("AffiliateConversationRecord", {
  id: types.identifier,
  userId: types.string,
  shopId: types.string,
  platform: types.string,
  conversationId: types.string,
  creatorId: types.maybeNull(types.string),
  unreadCount: types.maybeNull(types.number),
  lastMessageAt: types.maybeNull(types.string),
  lastMessageId: types.maybeNull(types.string),
  lastMessageIndex: types.maybeNull(types.string),
  lastInboundAt: types.maybeNull(types.string),
  lastOutboundAt: types.maybeNull(types.string),
  createdAt: types.string,
  updatedAt: types.string,
});

export const AffiliateConversationMessagePageModel = types.model("AffiliateConversationMessagePage", {
  key: types.identifier,
  shopId: types.string,
  conversationId: types.string,
  items: types.optional(types.array(types.frozen<Record<string, any>>()), []),
  nextPageToken: types.maybeNull(types.string),
  hasMore: types.optional(types.boolean, false),
  loadedAt: types.optional(types.string, nowIso),
});

export const AffiliateWorkspaceModel = types
  .model("AffiliateWorkspace", {
    actionProposals: types.optional(types.array(AffiliateActionProposalModel), []),
    collaborationRecords: types.optional(types.array(AffiliateCollaborationRecordModel), []),
    creatorProfiles: types.optional(types.array(AffiliateCreatorProfileModel), []),
    conversationRecords: types.optional(types.array(AffiliateConversationRecordModel), []),
    sampleApplicationRecords: types.optional(types.array(AffiliateSampleApplicationRecordModel), []),
    lifecycleEvents: types.optional(types.array(AffiliateLifecycleEventModel), []),
    productSummaries: types.optional(types.array(AffiliateProductSummaryModel), []),
    conversationMessagePages: types.optional(types.array(AffiliateConversationMessagePageModel), []),
  })
  .views((self) => ({
    getActionProposal(id: string) {
      return self.actionProposals.find((proposal) => proposal.id === id) ?? null;
    },
    getCollaborationRecord(id: string | null | undefined) {
      if (!id) return null;
      return self.collaborationRecords.find((record) => record.id === id) ?? null;
    },
    getCreatorProfile(id: string | null | undefined) {
      if (!id) return null;
      return self.creatorProfiles.find((profile) => profile.id === id) ?? null;
    },
    getProductSummary(productId: string | null | undefined) {
      const key = productSummaryKey(productId);
      if (!key) return null;
      return self.productSummaries.find((product) => product.productId === key) ?? null;
    },
    getSampleApplicationRecord(id: string | null | undefined) {
      if (!id) return null;
      return self.sampleApplicationRecords.find((record) => record.id === id) ?? null;
    },
    sampleApplicationsForCollaboration(collaborationRecord: {
      sampleApplicationRecordId?: string | null;
      affiliateCollaborationId?: string | null;
    }) {
      const ids = new Set(
        [collaborationRecord.sampleApplicationRecordId].filter(
          (id): id is string => Boolean(id),
        ),
      );
      return self.sampleApplicationRecords
        .filter((record) => (
          ids.has(record.id) ||
          (
            Boolean(collaborationRecord.affiliateCollaborationId) &&
            record.affiliateCollaborationId === collaborationRecord.affiliateCollaborationId
          )
        ))
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    },
    getConversationRecordByPlatformId(shopId: string | null | undefined, conversationId: string | null | undefined) {
      if (!shopId || !conversationId) return null;
      return self.conversationRecords.find((record) => (
        record.shopId === shopId && record.conversationId === conversationId
      )) ?? null;
    },
    getConversationMessagePage(shopId: string | null | undefined, conversationId: string | null | undefined) {
      if (!shopId || !conversationId) return null;
      return self.conversationMessagePages.find((page) => page.key === conversationKey(shopId, conversationId)) ?? null;
    },
    lifecycleEventsForCollaboration(collaborationRecordId: string) {
      return self.lifecycleEvents
        .filter((event) => event.collaborationRecordId === collaborationRecordId)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    },
    proposalsForCollaboration(collaborationRecordId: string) {
      return self.actionProposals
        .filter((proposal) => proposal.collaborationRecordId === collaborationRecordId)
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    },
  }))
  .views((self) => ({
    proposalProjection(proposalId: string) {
      const proposal = self.getActionProposal(proposalId);
      if (!proposal) return null;
      const collaborationRecord = self.getCollaborationRecord(proposal.collaborationRecordId);
      const creatorProfile = self.getCreatorProfile(proposal.creatorId ?? collaborationRecord?.creatorId);
      const productSummary = self.getProductSummary(
        collaborationRecord?.productId
          ?? (proposal.messageIntent as any)?.productId
          ?? (proposal.steps?.[0] as any)?.messageIntent?.productId,
      );
      return { proposal, collaborationRecord, creatorProfile, productSummary };
    },
    collaborationProjection(collaborationRecordId: string) {
      const collaborationRecord = self.getCollaborationRecord(collaborationRecordId);
      if (!collaborationRecord) return null;
      const creatorProfile = self.getCreatorProfile(collaborationRecord.creatorId);
      const productSummary = self.getProductSummary(collaborationRecord.productId);
      const sampleApplications = self.sampleApplicationsForCollaboration(collaborationRecord);
      const sampleApplication = sampleApplications[0] ?? null;
      const conversationRecord = self.getConversationRecordByPlatformId(
        collaborationRecord.shopId,
        collaborationRecord.platformConversationId,
      );
      return {
        collaborationRecord,
        creatorProfile,
        productSummary,
        sampleApplication,
        sampleApplications,
        conversationRecord,
        actionProposals: self.proposalsForCollaboration(collaborationRecordId),
        lifecycleEvents: self.lifecycleEventsForCollaboration(collaborationRecordId),
      };
    },
    actionProposalPage(input?: { shopId?: string; status?: string; search?: string }) {
      const search = normalizedText(input?.search);
      return self.actionProposals
        .filter((proposal) => !input?.shopId || proposal.shopId === input.shopId)
        .filter((proposal) => !input?.status || proposal.status === input.status)
        .map((proposal) => (self as any).proposalProjection(proposal.id))
        .filter((projection): projection is NonNullable<typeof projection> => !!projection)
        .filter((projection) => includesSearch(search, [
          projection.proposal.id,
          projection.proposal.operatorSummary,
          projection.proposal.type,
          projection.proposal.status,
          projection.collaborationRecord?.id,
          projection.collaborationRecord?.productId,
          projection.creatorProfile?.username,
          projection.creatorProfile?.nickname,
          projection.creatorProfile?.creatorOpenId,
          projection.creatorProfile?.creatorImId,
          projection.productSummary?.title,
          projection.productSummary?.productId,
        ]))
        .sort((a, b) => Date.parse(b.proposal.updatedAt) - Date.parse(a.proposal.updatedAt));
    },
    collaborationRecordPage(input?: {
      shopId?: string;
      processingStatus?: string;
      processingStatuses?: string[];
      search?: string;
    }) {
      const search = normalizedText(input?.search);
      return self.collaborationRecords
        .filter((record) => !input?.shopId || record.shopId === input.shopId)
        .filter((record) => {
          if (input?.processingStatuses?.length) {
            return input.processingStatuses.includes(record.processingStatus);
          }
          return !input?.processingStatus || record.processingStatus === input.processingStatus;
        })
        .map((record) => (self as any).collaborationProjection(record.id))
        .filter((projection): projection is NonNullable<typeof projection> => !!projection)
        .filter((projection) => includesSearch(search, [
          projection.collaborationRecord.id,
          projection.collaborationRecord.processingStatus,
          projection.collaborationRecord.requiredAction,
          projection.collaborationRecord.productId,
          projection.creatorProfile?.username,
          projection.creatorProfile?.nickname,
          projection.creatorProfile?.creatorOpenId,
          projection.creatorProfile?.creatorImId,
          projection.productSummary?.title,
          projection.productSummary?.productId,
        ]))
        .sort((a, b) => Date.parse(b.collaborationRecord.stateUpdatedAt) - Date.parse(a.collaborationRecord.stateUpdatedAt));
    },
  }))
  .actions((self) => {
    function upsertById<T extends { id: string }>(target: T[], item: T): void {
      const idx = target.findIndex((existing) => existing.id === item.id);
      if (idx >= 0) {
        applySnapshot(target[idx] as any, {
          ...(getSnapshot(target[idx] as any) as Record<string, any>),
          ...(item as Record<string, any>),
        });
      } else {
        target.push(item);
      }
    }

    function upsertProduct(product: GQL.EcomProductSummary | null | undefined): void {
      if (!product?.productId) return;
      const idx = self.productSummaries.findIndex((existing) => existing.productId === product.productId);
      if (idx >= 0) {
        applySnapshot(self.productSummaries[idx] as any, {
          ...(getSnapshot(self.productSummaries[idx] as any) as Record<string, any>),
          ...(product as Record<string, any>),
        });
      } else {
        self.productSummaries.push(product as any);
      }
    }

    function upsertCreator(profile: GQL.CreatorGlobalProfile | null | undefined): void {
      if (!profile?.id) return;
      upsertById(self.creatorProfiles as any, profile as any);
    }

    function upsertCollaborationRecord(record: GQL.AffiliateCollaborationRecord | null | undefined): void {
      if (!record?.id) return;
      upsertById(self.collaborationRecords as any, record as any);
      for (const snapshot of record.predictionSnapshots ?? []) {
        const product = (snapshot as any)?.resolvedContext?.productSummary;
        upsertProduct(product);
      }
    }

    function upsertProposal(proposal: GQL.ActionProposal | null | undefined): void {
      if (!proposal?.id) return;
      upsertCreator(proposal.creatorProfile);
      upsertCollaborationRecord(proposal.collaborationRecord);
      upsertProduct(proposal.productSummary);
      upsertById(self.actionProposals as any, proposal as any);
    }

    function upsertLifecycleEvent(event: GQL.LifecycleEvent | null | undefined): void {
      if (!event?.id) return;
      upsertById(self.lifecycleEvents as any, event as any);
    }

    function upsertSampleApplication(record: GQL.SampleApplicationRecord | null | undefined): void {
      if (!record?.id) return;
      upsertById(self.sampleApplicationRecords as any, record as any);
    }

    function upsertConversationRecord(record: GQL.AffiliateConversationRecord | null | undefined): void {
      if (!record?.id) return;
      upsertById(self.conversationRecords as any, record as any);
    }

    return {
      upsertAffiliateActionProposal: upsertProposal,
      replaceAffiliateActionProposals(proposals: GQL.ActionProposal[]) {
        self.actionProposals.clear();
        for (const proposal of proposals) upsertProposal(proposal);
      },
      upsertAffiliateCollaborationRecord: upsertCollaborationRecord,
      replaceAffiliateCollaborationRecords(records: GQL.AffiliateCollaborationRecord[]) {
        self.collaborationRecords.clear();
        for (const record of records) upsertCollaborationRecord(record);
      },
      upsertAffiliateCreatorProfile: upsertCreator,
      replaceAffiliateCreatorProfiles(profiles: GQL.CreatorGlobalProfile[]) {
        self.creatorProfiles.clear();
        for (const profile of profiles) upsertCreator(profile);
      },
      upsertAffiliateProductSummary: upsertProduct,
      upsertAffiliateSampleApplicationRecord: upsertSampleApplication,
      upsertAffiliateLifecycleEvent: upsertLifecycleEvent,
      upsertAffiliateConversationRecord: upsertConversationRecord,
      replaceAffiliateConversationRecords(records: GQL.AffiliateConversationRecord[]) {
        self.conversationRecords.clear();
        for (const record of records) upsertConversationRecord(record);
      },
      ingestAffiliateCollaborationRecordItems(items: GQL.AffiliateCollaborationRecordListItem[]) {
        for (const item of items) {
          upsertCreator(item.creatorProfile);
          upsertProduct(item.productSummary);
          upsertCollaborationRecord(item.collaborationRecord);
        }
      },
      ingestAffiliateCollaborationActivity(activity: {
        actionProposals?: GQL.ActionProposal[];
        lifecycleEvents?: GQL.LifecycleEvent[];
        sampleApplicationRecords?: GQL.SampleApplicationRecord[];
        sampleApplications?: GQL.SampleApplicationRecord[];
      } | null | undefined) {
        for (const proposal of activity?.actionProposals ?? []) upsertProposal(proposal);
        for (const event of activity?.lifecycleEvents ?? []) upsertLifecycleEvent(event);
        for (const sample of activity?.sampleApplicationRecords ?? activity?.sampleApplications ?? []) {
          upsertSampleApplication(sample);
        }
      },
      ingestAffiliateConversationMessages(
        shopId: string,
        conversationId: string,
        page: GQL.AffiliateConversationMessagesPage,
        mode: "replace" | "append" = "replace",
      ) {
        const key = conversationKey(shopId, conversationId);
        const existing = self.conversationMessagePages.find((candidate) => candidate.key === key);
        const nextItems =
          mode === "append" && existing
            ? [...(existing.items as any[]), ...page.items]
            : [...page.items];
        const deduped = Array.from(
          new Map(nextItems.map((item) => [messageIdentity(item as any), item])).values(),
        );
        const snapshot = {
          key,
          shopId,
          conversationId,
          items: deduped,
          nextPageToken: page.nextPageToken ?? null,
          hasMore: page.hasMore,
          loadedAt: nowIso(),
        };
        if (existing) {
          applySnapshot(existing, snapshot);
        } else {
          self.conversationMessagePages.push(snapshot as any);
        }
        for (const message of page.items ?? []) {
          for (const ref of message.productRefs ?? []) upsertProduct(ref.productSummary);
          for (const ref of message.sampleApplicationRefs ?? []) upsertSampleApplication(ref.sampleApplicationRecord);
          for (const ref of message.targetCollaborationRefs ?? []) upsertCollaborationRecord(ref.affiliateCollaboration as any);
        }
      },
      clearAffiliateWorkspace() {
        self.actionProposals.clear();
        self.collaborationRecords.clear();
        self.creatorProfiles.clear();
        self.conversationRecords.clear();
        self.sampleApplicationRecords.clear();
        self.lifecycleEvents.clear();
        self.productSummaries.clear();
        self.conversationMessagePages.clear();
      },
    };
  });

export interface AffiliateWorkspace extends Instance<typeof AffiliateWorkspaceModel> {}
