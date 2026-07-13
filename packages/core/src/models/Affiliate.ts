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

function relationshipHasShop(
  relationship: { shopStates?: readonly { shopId?: string | null }[] } | null | undefined,
  shopId: string | null | undefined,
): boolean {
  if (!relationship || !shopId) return false;
  return (relationship.shopStates ?? []).some((state) => state.shopId === shopId);
}

function proposalTargetsCollaboration(
  proposal: { collaborationRecordId?: string | null; steps?: readonly Record<string, any>[] } | null | undefined,
  collaborationRecordId: string,
): boolean {
  if (!proposal || !collaborationRecordId) return false;
  if (proposal.collaborationRecordId === collaborationRecordId) return true;
  return (proposal.steps ?? []).some((step) => step?.collaborationRecordId === collaborationRecordId);
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

export const AffiliateCreatorRelationshipShopStateModel = types.model("AffiliateCreatorRelationshipShopState", {
  shopId: types.string,
  lifecycleStage: types.optional(types.string, "DISCOVERED"),
  tagIds: types.optional(types.array(types.string), []),
  lastContactedAt: types.maybeNull(types.string),
  lastInvitedAt: types.maybeNull(types.string),
  lastQualifiedAt: types.maybeNull(types.string),
});

export const AffiliateCreatorRelationshipModel = types.model("AffiliateCreatorRelationship", {
  id: types.identifier,
  userId: types.optional(types.string, ""),
  creatorId: types.string,
  businessDeveloperId: types.maybeNull(types.string),
  protectionIntentId: types.maybeNull(types.string),
  aiEngagementStatus: types.optional(types.string, "PROTECTED"),
  aiEngagementSource: types.optional(types.string, "ONBOARDING_DEFAULT"),
  operationalConfigRevision: types.optional(types.number, 1),
  shopStates: types.optional(types.array(AffiliateCreatorRelationshipShopStateModel), []),
  whatsappContacts: types.optional(types.array(types.frozen<Record<string, any>>()), []),
  emailContacts: types.optional(types.array(types.frozen<Record<string, any>>()), []),
  processingStatus: types.optional(types.string, "IDLE"),
  requiredAction: types.optional(types.string, "NO_ACTION"),
  processReasons: types.optional(types.array(types.string), []),
  nextSellerActionAt: types.maybeNull(types.string),
  lastInboundAt: types.maybeNull(types.string),
  lastOutboundAt: types.maybeNull(types.string),
  lastAgentHandledAt: types.maybeNull(types.string),
  committedCheckpointId: types.maybeNull(types.string),
  committedCheckpointAt: types.maybeNull(types.string),
  committedEventCursor: types.maybeNull(types.number),
  lifecycleEventSequence: types.maybeNull(types.number),
  activeRunId: types.maybeNull(types.string),
  activeRunBaseCheckpointId: types.maybeNull(types.string),
  activeRunBaseEventCursor: types.maybeNull(types.number),
  activeRunOperationalConfigRevision: types.maybeNull(types.number),
  activeRunBusinessDeveloperId: types.maybeNull(types.string),
  activeRunBusinessDeveloperConfigRevision: types.maybeNull(types.number),
  agendaItems: types.optional(types.array(types.frozen<Record<string, any>>()), []),
  workSummary: types.maybeNull(types.frozen<Record<string, any>>()),
  lastBlockedAt: types.maybeNull(types.string),
  lastPlatformSyncedAt: types.maybeNull(types.string),
  stateUpdatedAt: types.optional(types.string, nowIso),
  activeCollaborationRecordIds: types.optional(types.array(types.string), []),
  pendingActionProposalId: types.maybeNull(types.string),
  blocked: types.optional(types.boolean, false),
  blockedShopIds: types.optional(types.array(types.string), []),
  createdAt: types.optional(types.string, nowIso),
  updatedAt: types.optional(types.string, nowIso),
});

export const AffiliateBusinessDeveloperModel = types.model("AffiliateBusinessDeveloper", {
  id: types.identifier,
  userId: types.string,
  displayName: types.string,
  regions: types.optional(types.array(types.string), []),
  acceptingCreators: types.optional(types.boolean, true),
  agentAssistanceMode: types.optional(types.string, "AI_ASSISTED"),
  businessPrompt: types.maybeNull(types.string),
  configRevision: types.optional(types.number, 1),
  archivedAt: types.maybeNull(types.string),
  createdAt: types.optional(types.string, nowIso),
  updatedAt: types.optional(types.string, nowIso),
});

export const AffiliateOperationalSettingsModel = types.model("AffiliateOperationalSettings", {
  id: types.identifier,
  userId: types.string,
  onboardingCompletedAt: types.maybeNull(types.string),
  newRelationshipAiEngagementDefault: types.optional(types.string, "PROTECTED"),
});

export const AffiliateCreatorChannelConnectionModel = types.model("AffiliateCreatorChannelConnection", {
  id: types.identifier,
  creatorRelationshipId: types.string,
  creatorContactPointId: types.string,
  channel: types.string,
  accountBindingId: types.string,
  businessDeveloperId: types.maybeNull(types.string),
  status: types.string,
  source: types.string,
  firstObservedAt: types.string,
  lastObservedAt: types.string,
  lastInboundAt: types.maybeNull(types.string),
  lastOutboundAt: types.maybeNull(types.string),
});

export const AffiliateCreatorProtectionIntentModel = types.model("AffiliateCreatorProtectionIntent", {
  id: types.identifier,
  platform: types.string,
  matchType: types.string,
  matchValue: types.string,
  businessDeveloperId: types.maybeNull(types.string),
  importBatchId: types.maybeNull(types.string),
  note: types.maybeNull(types.string),
  appliedCreatorRelationshipId: types.maybeNull(types.string),
  appliedAt: types.maybeNull(types.string),
  createdAt: types.optional(types.string, nowIso),
  updatedAt: types.optional(types.string, nowIso),
});

export const AffiliateWhatsAppAccountModel = types.model("AffiliateWhatsAppAccount", {
  id: types.identifier,
  userId: types.string,
  businessDeveloperId: types.maybeNull(types.string),
  businessDeveloperAssignedAt: types.maybeNull(types.string),
  provider: types.string,
  status: types.string,
  evolutionInstanceName: types.string,
  evolutionInstanceId: types.maybeNull(types.string),
  displayName: types.maybeNull(types.string),
  phoneNumber: types.maybeNull(types.string),
  profilePicUrl: types.maybeNull(types.string),
  proxyId: types.maybeNull(types.string),
  lastConnectedAt: types.maybeNull(types.string),
  lastDisconnectedAt: types.maybeNull(types.string),
  lastQrAt: types.maybeNull(types.string),
  lastError: types.maybeNull(types.string),
  createdAt: types.optional(types.string, nowIso),
  updatedAt: types.optional(types.string, nowIso),
});

export const AffiliateEmailAccountModel = types.model("AffiliateEmailAccount", {
  id: types.identifier,
  userId: types.string,
  businessDeveloperId: types.maybeNull(types.string),
  businessDeveloperAssignedAt: types.maybeNull(types.string),
  provider: types.string,
  status: types.string,
  mailboxType: types.string,
  emailAddress: types.string,
  displayName: types.maybeNull(types.string),
  sharedMailboxAddress: types.maybeNull(types.string),
  lastSyncAt: types.maybeNull(types.string),
  lastError: types.maybeNull(types.string),
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
  userId: types.optional(types.string, ""),
  shopId: types.optional(types.string, ""),
  creatorRelationshipId: types.maybeNull(types.string),
  creatorId: types.optional(types.string, ""),
  creatorOpenId: types.maybeNull(types.string),
  creatorImId: types.maybeNull(types.string),
  productId: types.maybeNull(types.string),
  lifecycleStage: types.optional(types.string, ""),
  processingStatus: types.optional(types.string, "IDLE"),
  requiredAction: types.optional(types.string, "NO_ACTION"),
  processReasons: types.optional(types.array(types.string), []),
  nextSellerActionAt: types.maybeNull(types.string),
  stateUpdatedAt: types.optional(types.string, nowIso),
  lastSignalAt: types.maybeNull(types.string),
  workHandledUntil: types.maybeNull(types.string),
  affiliateCollaborationId: types.maybeNull(types.string),
  collaborationType: types.maybeNull(types.string),
  sampleApplicationRecordId: types.maybeNull(types.string),
  platformCollaborationId: types.maybeNull(types.string),
  lastCreatorMessageId: types.maybeNull(types.string),
  lastCreatorMessageAt: types.maybeNull(types.string),
  startedAt: types.optional(types.string, nowIso),
  endedAt: types.maybeNull(types.string),
  predictionSnapshots: types.optional(types.array(types.frozen<Record<string, any>>()), []),
  createdAt: types.optional(types.string, nowIso),
  updatedAt: types.optional(types.string, nowIso),
});

export const AffiliateSampleApplicationRecordModel = types.model("AffiliateSampleApplicationRecord", {
  id: types.identifier,
  userId: types.optional(types.string, ""),
  shopId: types.optional(types.string, ""),
  creatorId: types.maybeNull(types.string),
  creatorOpenId: types.maybeNull(types.string),
  productId: types.maybeNull(types.string),
  affiliateCollaborationId: types.maybeNull(types.string),
  collaborationType: types.maybeNull(types.string),
  platformApplicationId: types.optional(types.string, ""),
  platformCollaborationId: types.maybeNull(types.string),
  platformOpenCollaborationId: types.maybeNull(types.string),
  platformTargetCollaborationId: types.maybeNull(types.string),
  sampleWorkStatus: types.optional(types.string, ""),
  order: types.maybeNull(types.frozen<GQL.SampleApplicationOrderRecord>()),
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
  updatedAt: types.optional(types.string, nowIso),
});

export const AffiliateLifecycleEventModel = types.model("AffiliateLifecycleEvent", {
  id: types.identifier,
  userId: types.string,
  shopId: types.string,
  entityType: types.string,
  entityId: types.string,
  eventType: types.string,
  actorType: types.maybeNull(types.string),
  actorRole: types.maybeNull(types.string),
  actorId: types.maybeNull(types.string),
  collaborationRecordId: types.maybeNull(types.string),
  creatorRelationshipId: types.maybeNull(types.string),
  proposalId: types.maybeNull(types.string),
  creatorId: types.maybeNull(types.string),
  productId: types.maybeNull(types.string),
  campaignId: types.maybeNull(types.string),
  fromStage: types.maybeNull(types.string),
  toStage: types.maybeNull(types.string),
  displayPayloadJson: types.maybeNull(types.string),
  createdAt: types.string,
});

export interface AffiliateLifecycleEvent extends Instance<typeof AffiliateLifecycleEventModel> {}

export const AffiliateActionProposalModel = types.model("AffiliateActionProposal", {
  id: types.identifier,
  userId: types.optional(types.string, ""),
  focusShopId: types.optional(types.string, ""),
  campaignId: types.maybeNull(types.string),
  creatorId: types.maybeNull(types.string),
  creatorRelationshipId: types.maybeNull(types.string),
  collaborationRecordId: types.maybeNull(types.string),
  collaborationRecordLastSignalAt: types.maybeNull(types.string),
  collaborationRecordStateUpdatedAt: types.maybeNull(types.string),
  type: types.optional(types.string, ""),
  status: types.optional(types.string, ""),
  operatorSummary: types.optional(types.string, ""),
  predictionCacheIds: types.maybeNull(types.array(types.string)),
  steps: types.optional(types.array(types.frozen<Record<string, any>>()), []),
  policySnapshot: types.maybeNull(types.frozen<Record<string, any>>()),
  decision: types.maybeNull(types.frozen<Record<string, any>>()),
  executionResult: types.maybeNull(types.frozen<Record<string, any>>()),
  sourceWorkBoundary: types.maybeNull(types.frozen<Record<string, any>>()),
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
  createdAt: types.optional(types.string, nowIso),
  updatedAt: types.optional(types.string, nowIso),
});

export const AffiliateWorkspaceModel = types
  .model("AffiliateWorkspace", {
    actionProposals: types.optional(types.array(AffiliateActionProposalModel), []),
    collaborationRecords: types.optional(types.array(AffiliateCollaborationRecordModel), []),
    creatorRelationships: types.optional(types.array(AffiliateCreatorRelationshipModel), []),
    creatorProfiles: types.optional(types.array(AffiliateCreatorProfileModel), []),
    sampleApplicationRecords: types.optional(types.array(AffiliateSampleApplicationRecordModel), []),
    lifecycleEvents: types.optional(types.array(AffiliateLifecycleEventModel), []),
    productSummaries: types.optional(types.array(AffiliateProductSummaryModel), []),
    businessDevelopers: types.optional(types.array(AffiliateBusinessDeveloperModel), []),
    operationalSettings: types.maybeNull(AffiliateOperationalSettingsModel),
    creatorChannelConnections: types.optional(types.array(AffiliateCreatorChannelConnectionModel), []),
    creatorProtectionIntents: types.optional(types.array(AffiliateCreatorProtectionIntentModel), []),
    whatsappAccounts: types.optional(types.array(AffiliateWhatsAppAccountModel), []),
    emailAccounts: types.optional(types.array(AffiliateEmailAccountModel), []),
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
    getCreatorRelationship(id: string | null | undefined) {
      if (!id) return null;
      return self.creatorRelationships.find((relationship) => relationship.id === id) ?? null;
    },
    getCreatorRelationshipByCreatorId(creatorId: string | null | undefined) {
      if (!creatorId) return null;
      return self.creatorRelationships.find((relationship) => relationship.creatorId === creatorId) ?? null;
    },
    getBusinessDeveloper(id: string | null | undefined) {
      if (!id) return null;
      return self.businessDevelopers.find((developer) => developer.id === id) ?? null;
    },
    whatsappAccountsForBusinessDeveloper(id: string | null | undefined) {
      return self.whatsappAccounts.filter((account) => (account.businessDeveloperId ?? null) === (id ?? null));
    },
    emailAccountsForBusinessDeveloper(id: string | null | undefined) {
      return self.emailAccounts.filter((account) => (account.businessDeveloperId ?? null) === (id ?? null));
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
            typeof collaborationRecord.affiliateCollaborationId === "string" &&
            record.affiliateCollaborationId === collaborationRecord.affiliateCollaborationId
          )
        ))
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    },
    collaborationRecordsForRelationship(creatorRelationshipId: string | null | undefined) {
      if (!creatorRelationshipId) return [];
      return self.collaborationRecords
        .filter((record) => record.creatorRelationshipId === creatorRelationshipId)
        .sort((a, b) => Date.parse(b.stateUpdatedAt) - Date.parse(a.stateUpdatedAt));
    },
    sampleApplicationsForRelationship(creatorRelationshipId: string | null | undefined) {
      if (!creatorRelationshipId) return [];
      const collaborations = self.collaborationRecords
        .filter((record) => record.creatorRelationshipId === creatorRelationshipId);
      const sampleRecordIds = new Set(
        collaborations
          .map((record) => record.sampleApplicationRecordId)
          .filter((id): id is string => Boolean(id)),
      );
      const affiliateCollaborationIds = new Set(
        collaborations
          .map((record) => record.affiliateCollaborationId)
          .filter((id): id is string => Boolean(id)),
      );
      return self.sampleApplicationRecords
        .filter((record) => (
          sampleRecordIds.has(record.id) ||
          (
            typeof record.affiliateCollaborationId === "string" &&
            affiliateCollaborationIds.has(record.affiliateCollaborationId)
          )
        ))
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    },
    lifecycleEventsForCollaboration(collaborationRecordId: string) {
      const proposalIds = new Set(
        self.actionProposals
          .filter((proposal) => proposalTargetsCollaboration(proposal, collaborationRecordId))
          .map((proposal) => proposal.id),
      );
      return self.lifecycleEvents
        .filter((event) => (
          event.collaborationRecordId === collaborationRecordId ||
          (
            typeof event.proposalId === "string" &&
            proposalIds.has(event.proposalId)
          )
        ))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    },
    lifecycleEventsForRelationship(creatorRelationshipId: string | null | undefined) {
      if (!creatorRelationshipId) return [];
      const collaborationRecordIds = new Set(
        self.collaborationRecords
          .filter((record) => record.creatorRelationshipId === creatorRelationshipId)
          .map((record) => record.id),
      );
      const proposalIds = new Set(
        self.actionProposals
          .filter((proposal) => (
            proposal.creatorRelationshipId === creatorRelationshipId ||
            (
              typeof proposal.collaborationRecordId === "string" &&
              collaborationRecordIds.has(proposal.collaborationRecordId)
            )
          ))
          .map((proposal) => proposal.id),
      );
      return self.lifecycleEvents
        .filter((event) => (
          event.creatorRelationshipId === creatorRelationshipId ||
          (
            typeof event.collaborationRecordId === "string" &&
            collaborationRecordIds.has(event.collaborationRecordId)
          ) ||
          (
            typeof event.proposalId === "string" &&
            proposalIds.has(event.proposalId)
          )
        ))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    },
    proposalsForCollaboration(collaborationRecordId: string) {
      return self.actionProposals
        .filter((proposal) => proposalTargetsCollaboration(proposal, collaborationRecordId))
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    },
    proposalsForRelationship(creatorRelationshipId: string | null | undefined) {
      if (!creatorRelationshipId) return [];
      const collaborationRecordIds = new Set(
        self.collaborationRecords
          .filter((record) => record.creatorRelationshipId === creatorRelationshipId)
          .map((record) => record.id),
      );
      return self.actionProposals
        .filter((proposal) => (
          proposal.creatorRelationshipId === creatorRelationshipId ||
          (
            typeof proposal.collaborationRecordId === "string" &&
            collaborationRecordIds.has(proposal.collaborationRecordId)
          )
        ))
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    },
  }))
  .views((self) => ({
    proposalProjection(proposalId: string) {
      const proposal = self.getActionProposal(proposalId);
      if (!proposal) return null;
      const collaborationRecord = self.getCollaborationRecord(proposal.collaborationRecordId);
      const creatorProfile = self.getCreatorProfile(proposal.creatorId ?? collaborationRecord?.creatorId);
      const creatorRelationship = self.getCreatorRelationship(
        proposal.creatorRelationshipId ?? collaborationRecord?.creatorRelationshipId,
      );
      const productSummary = self.getProductSummary(
        collaborationRecord?.productId
          ?? (proposal.messageIntent as any)?.productId
          ?? (proposal.steps?.[0] as any)?.messageIntent?.productId,
      );
      return { proposal, collaborationRecord, creatorProfile, creatorRelationship, productSummary };
    },
    relationshipProjection(creatorRelationshipId: string) {
      const creatorRelationship = self.getCreatorRelationship(creatorRelationshipId);
      if (!creatorRelationship) return null;
      const creatorProfile = self.getCreatorProfile(creatorRelationship.creatorId);
      const collaborationRecords = self.collaborationRecordsForRelationship(creatorRelationshipId);
      const sampleApplications = self.sampleApplicationsForRelationship(creatorRelationshipId);
      const productIds = new Set(
        [
          ...collaborationRecords.map((record) => record.productId),
          ...sampleApplications.map((record) => record.productId),
        ].filter((id): id is string => Boolean(id)),
      );
      const productSummaries = Array.from(productIds)
        .map((productId) => self.getProductSummary(productId))
        .filter((product): product is NonNullable<typeof product> => Boolean(product));
      const actionProposals = self.proposalsForRelationship(creatorRelationshipId);
      const pendingActionProposal = (
        creatorRelationship.pendingActionProposalId
          ? self.getActionProposal(creatorRelationship.pendingActionProposalId)
          : null
      ) ?? actionProposals.find((proposal) => proposal.status === "PENDING") ?? null;
      return {
        creatorRelationship,
        creatorProfile,
        collaborationRecords,
        sampleApplications,
        productSummaries,
        actionProposals,
        pendingActionProposal,
        lifecycleEvents: self.lifecycleEventsForRelationship(creatorRelationshipId),
      };
    },
    collaborationProjection(collaborationRecordId: string) {
      const collaborationRecord = self.getCollaborationRecord(collaborationRecordId);
      if (!collaborationRecord) return null;
      const creatorProfile = self.getCreatorProfile(collaborationRecord.creatorId);
      const creatorRelationship = self.getCreatorRelationship(collaborationRecord.creatorRelationshipId);
      const productSummary = self.getProductSummary(collaborationRecord.productId);
      const sampleApplications = self.sampleApplicationsForCollaboration(collaborationRecord);
      const sampleApplication = sampleApplications[0] ?? null;
      return {
        collaborationRecord,
        creatorProfile,
        creatorRelationship,
        productSummary,
        sampleApplication,
        sampleApplications,
        actionProposals: self.proposalsForCollaboration(collaborationRecordId),
        lifecycleEvents: self.lifecycleEventsForCollaboration(collaborationRecordId),
      };
    },
    actionProposalPage(input?: { shopId?: string; status?: string; type?: string; search?: string }) {
      const search = normalizedText(input?.search);
      return self.actionProposals
        .filter((proposal) => !input?.status || proposal.status === input.status)
        .filter((proposal) => !input?.type || proposal.type === input.type)
        .map((proposal) => (self as any).proposalProjection(proposal.id))
        .filter((projection): projection is NonNullable<typeof projection> => !!projection)
        .filter((projection) => {
          if (!input?.shopId) return true;
          if (projection.proposal.focusShopId === input.shopId) return true;
          if (projection.collaborationRecord?.shopId === input.shopId) return true;
          return relationshipHasShop(projection.creatorRelationship, input.shopId);
        })
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

    function upsertCreator(profile: GQL.AffiliateCreatorIdentity | null | undefined): void {
      if (!profile?.id) return;
      upsertById(self.creatorProfiles as any, profile as any);
    }

    function upsertCreatorRelationship(relationship: GQL.AffiliateCreatorRelationship | null | undefined): void {
      if (!relationship?.id) return;
      upsertById(self.creatorRelationships as any, relationship as any);
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
      upsertCreatorRelationship(proposal.creatorRelationship);
      upsertCollaborationRecord(proposal.collaborationRecord);
      upsertProduct(proposal.productSummary);
      upsertById(self.actionProposals as any, proposal as any);
    }

    function upsertLifecycleEvent(event: AffiliateLifecycleEvent | null | undefined): void {
      if (!event?.id) return;
      upsertById(self.lifecycleEvents as any, event as any);
    }

    function upsertSampleApplication(record: GQL.SampleApplicationRecord | null | undefined): void {
      if (!record?.id) return;
      upsertById(self.sampleApplicationRecords as any, record as any);
    }

    function upsertBusinessDeveloper(developer: GQL.AffiliateBusinessDeveloper | null | undefined): void {
      if (!developer?.id) return;
      upsertById(self.businessDevelopers as any, developer as any);
    }

    function upsertChannelConnection(connection: GQL.AffiliateCreatorChannelConnection | null | undefined): void {
      if (!connection?.id) return;
      upsertById(self.creatorChannelConnections as any, connection as any);
    }

    function upsertProtectionIntent(intent: GQL.AffiliateCreatorProtectionIntent | null | undefined): void {
      if (!intent?.id) return;
      upsertById(self.creatorProtectionIntents as any, intent as any);
    }

    return {
      upsertAffiliateActionProposal: upsertProposal,
      ingestAffiliateActionProposals(proposals: GQL.ActionProposal[]) {
        for (const proposal of proposals) upsertProposal(proposal);
      },
      replaceAffiliateActionProposals(proposals: GQL.ActionProposal[]) {
        self.actionProposals.clear();
        for (const proposal of proposals) upsertProposal(proposal);
      },
      upsertAffiliateCollaborationRecord: upsertCollaborationRecord,
      replaceAffiliateCollaborationRecords(records: GQL.AffiliateCollaborationRecord[]) {
        self.collaborationRecords.clear();
        for (const record of records) upsertCollaborationRecord(record);
      },
      upsertAffiliateCreatorRelationship: upsertCreatorRelationship,
      replaceAffiliateCreatorRelationships(relationships: GQL.AffiliateCreatorRelationship[]) {
        self.creatorRelationships.clear();
        for (const relationship of relationships) upsertCreatorRelationship(relationship);
      },
      upsertAffiliateCreatorProfile: upsertCreator,
      replaceAffiliateCreatorProfiles(profiles: GQL.AffiliateCreatorIdentity[]) {
        self.creatorProfiles.clear();
        for (const profile of profiles) upsertCreator(profile);
      },
      upsertAffiliateProductSummary: upsertProduct,
      upsertAffiliateSampleApplicationRecord: upsertSampleApplication,
      upsertAffiliateLifecycleEvent: upsertLifecycleEvent,
      upsertAffiliateBusinessDeveloper: upsertBusinessDeveloper,
      replaceAffiliateBusinessDevelopers(developers: GQL.AffiliateBusinessDeveloper[]) {
        self.businessDevelopers.clear();
        for (const developer of developers) upsertBusinessDeveloper(developer);
      },
      setAffiliateOperationalSettings(settings: GQL.AffiliateOperationalSettings | null | undefined) {
        self.operationalSettings = settings as any;
      },
      replaceAffiliateCreatorChannelConnections(connections: GQL.AffiliateCreatorChannelConnection[]) {
        self.creatorChannelConnections.clear();
        for (const connection of connections) upsertChannelConnection(connection);
      },
      replaceAffiliateCreatorProtectionIntents(intents: GQL.AffiliateCreatorProtectionIntent[]) {
        self.creatorProtectionIntents.clear();
        for (const intent of intents) upsertProtectionIntent(intent);
      },
      replaceAffiliateWhatsAppAccounts(accounts: GQL.WhatsAppAccountBinding[]) {
        self.whatsappAccounts.clear();
        for (const account of accounts) upsertById(self.whatsappAccounts as any, account as any);
      },
      replaceAffiliateEmailAccounts(accounts: GQL.EmailAccountBinding[]) {
        self.emailAccounts.clear();
        for (const account of accounts) upsertById(self.emailAccounts as any, account as any);
      },
      ingestAffiliateWorkspace(workspace: GQL.AffiliateWorkspacePayload | null | undefined) {
        for (const relationship of workspace?.creatorRelations ?? []) upsertCreatorRelationship(relationship);
        for (const profile of workspace?.creatorProfiles ?? []) upsertCreator(profile);
        for (const record of workspace?.collaborationRecords ?? []) upsertCollaborationRecord(record);
        for (const sample of workspace?.sampleApplicationRecords ?? []) upsertSampleApplication(sample);
        for (const proposal of workspace?.actionProposals ?? []) upsertProposal(proposal);
        const lifecycleEvents = (workspace as (GQL.AffiliateWorkspacePayload & {
          lifecycleEvents?: AffiliateLifecycleEvent[];
        }) | null | undefined)?.lifecycleEvents ?? [];
        for (const event of lifecycleEvents) upsertLifecycleEvent(event);
      },
      clearAffiliateWorkspace() {
        self.actionProposals.clear();
        self.collaborationRecords.clear();
        self.creatorRelationships.clear();
        self.creatorProfiles.clear();
        self.sampleApplicationRecords.clear();
        self.lifecycleEvents.clear();
        self.productSummaries.clear();
        self.businessDevelopers.clear();
        self.operationalSettings = null;
        self.creatorChannelConnections.clear();
        self.creatorProtectionIntents.clear();
        self.whatsappAccounts.clear();
        self.emailAccounts.clear();
      },
    };
  });

export interface AffiliateWorkspace extends Instance<typeof AffiliateWorkspaceModel> {}
