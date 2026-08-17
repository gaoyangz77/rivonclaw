export type Maybe<T> = T | null;
export type InputMaybe<T> = T | null;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export interface Scalars {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** A date-time string at UTC, such as 2007-12-03T10:15:30Z, compliant with the `date-time` format outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar.This scalar is serialized to a string in ISO 8601 format and parsed from a string in ISO 8601 format. */
  DateTimeISO: { input: any; output: any; }
  /** Arbitrary JSON object used for model-specific prediction output and diagnostics. */
  JSONObject: { input: any; output: any; }
}

export interface AccountLlmBillingStatus {
  entitlement: BillingEntitlementStatus;
  planId?: Maybe<BillingPlanId>;
}

/** Input for acknowledging a CS escalation event */
export interface AckCsEscalationEventInput {
  eventId: Scalars['ID']['input'];
  success: Scalars['Boolean']['input'];
}

/** Durable result of one Affiliate Agent dispatch. It may remain pending for staff review, execute automatically, record no action needed, or retain a terminal review outcome. */
export interface ActionProposal {
  /** Current canonical platform Collaboration projection for staff review display. */
  affiliateCollaboration?: Maybe<AffiliateCollaboration>;
  affiliateCollaborationId?: Maybe<Scalars['ID']['output']>;
  approvalPolicyUpdateIntent?: Maybe<ActionProposalApprovalPolicyUpdateIntent>;
  /** Committed relationship checkpoint used as this proposal's reasoning base. */
  baseCheckpointId?: Maybe<Scalars['String']['output']>;
  baseEventCursor?: Maybe<Scalars['Int']['output']>;
  blockCreatorIntent?: Maybe<ActionProposalBlockCreatorIntent>;
  campaignId?: Maybe<Scalars['ID']['output']>;
  campaignProductUpdateIntent?: Maybe<ActionProposalCampaignProductUpdateIntent>;
  /** Candidate checkpoint produced by the agent run. It is promoted only after direct execution or approved execution succeeds. */
  candidateCheckpointId?: Maybe<Scalars['String']['output']>;
  candidateDecisionIntent?: Maybe<ActionProposalCandidateDecisionIntent>;
  createdAt: Scalars['DateTimeISO']['output'];
  creatorId?: Maybe<Scalars['ID']['output']>;
  /** Best-known creator identity for staff review display. This is a profile projection, not proposal execution input. */
  creatorProfile?: Maybe<AffiliateCreatorIdentity>;
  /** Relationship workspace that owns this proposal. A relationship can have at most one blocking PENDING or transient APPROVED proposal. */
  creatorRelationship?: Maybe<AffiliateCreatorRelationship>;
  /** CreatorRelationship owner for BD work; absent for seller shop-operations proposals. */
  creatorRelationshipId?: Maybe<Scalars['ID']['output']>;
  creatorTagIntent?: Maybe<ActionProposalCreatorTagIntent>;
  decision?: Maybe<ActionProposalDecisionSnapshot>;
  executionResult?: Maybe<ActionProposalExecutionResultSnapshot>;
  expiresAt?: Maybe<Scalars['DateTimeISO']['output']>;
  focusShopId: Scalars['ID']['output'];
  humanReviewRequest?: Maybe<ActionProposalHumanReviewRequest>;
  id: Scalars['ID']['output'];
  messageIntent?: Maybe<ActionProposalMessageIntent>;
  /** Staff-facing proposal summary. Pending creator-facing content lives in ordered messageIntent.parts and is cleared at terminal state. */
  operatorSummary: Scalars['String']['output'];
  policySnapshot?: Maybe<ActionProposalPolicySnapshot>;
  /** Source cache references used to assemble the proposal's immutable predictionSnapshots. They are lineage only and may expire independently. */
  predictionCacheIds?: Maybe<Array<Scalars['ID']['output']>>;
  /** Immutable prediction evidence owned by this proposal. It remains reviewable after the short-lived source cache expires and does not depend on Collaboration state. */
  predictionSnapshots: Array<AffiliateActionProposalPredictionSnapshot>;
  productId?: Maybe<Scalars['String']['output']>;
  /** Best-known related product summary for staff review display. Proposal execution still uses frozen proposal fields. */
  productSummary?: Maybe<EcomProductSummary>;
  requestedByActorId?: Maybe<Scalars['String']['output']>;
  requestedByActorType?: Maybe<AffiliateLifecycleActorType>;
  reviewSource: AffiliateProposalReviewSource;
  /** Ordered compact V1..Vn rewrite history for this work bundle. */
  revisionHistory: Array<ActionProposalRevisionSummary>;
  /** One-based version number within the proposal rewrite chain. */
  revisionNumber: Scalars['Int']['output'];
  /** Direct predecessor when this work bundle was produced by a staff rewrite request. */
  revisionOfProposalId?: Maybe<Scalars['ID']['output']>;
  /** Stable V1 root for this proposal rewrite chain. */
  revisionRootProposalId?: Maybe<Scalars['ID']['output']>;
  /** Current canonical Sample Application projection for staff review display. */
  sampleApplicationRecord?: Maybe<SampleApplicationRecord>;
  sampleApplicationRecordId?: Maybe<Scalars['ID']['output']>;
  sampleReviewIntent?: Maybe<ActionProposalSampleReviewIntent>;
  sampleShipmentIntent?: Maybe<ActionProposalSampleShipmentIntent>;
  /** Frozen structured intent for seller-wide Open/Target Collaboration operations. */
  shopOperationIntent?: Maybe<Scalars['JSONObject']['output']>;
  sourceWorkBoundary?: Maybe<ActionProposalSourceWorkBoundary>;
  status: ActionProposalStatus;
  /** Frozen ordered action steps. Current single-action proposals contain exactly one step. */
  steps: Array<ActionProposalStep>;
  /** Direct rewritten successor created from this proposal. */
  supersededByProposalId?: Maybe<Scalars['ID']['output']>;
  targetCollaborationIntent?: Maybe<ActionProposalTargetCollaborationIntent>;
  targetEventCursor?: Maybe<Scalars['Int']['output']>;
  type: ActionProposalType;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['ID']['output'];
}

export interface ActionProposalApprovalPolicyUpdateIntent {
  action: ActionProposalType;
  campaignIds?: Maybe<Array<Scalars['ID']['output']>>;
  creatorTagIds?: Maybe<Array<Scalars['ID']['output']>>;
  enabled: Scalars['Boolean']['output'];
  policyId?: Maybe<Scalars['ID']['output']>;
  productIds?: Maybe<Array<Scalars['String']['output']>>;
  reason?: Maybe<Scalars['String']['output']>;
}

export interface ActionProposalBlockCreatorIntent {
  creatorId: Scalars['ID']['output'];
  reason?: Maybe<Scalars['String']['output']>;
}

export interface ActionProposalCampaignProductUpdateIntent {
  campaignId: Scalars['ID']['output'];
  campaignProductId?: Maybe<Scalars['ID']['output']>;
  commissionRate?: Maybe<Scalars['Float']['output']>;
  maxCommissionRate?: Maybe<Scalars['Float']['output']>;
  productId: Scalars['String']['output'];
  promotionPriority?: Maybe<CampaignProductPromotionPriority>;
  sampleOfferMode?: Maybe<CampaignProductSampleOfferMode>;
  sampleQuota?: Maybe<Scalars['Int']['output']>;
  sampleUnitCostAmount?: Maybe<Scalars['Float']['output']>;
  sampleUnitCostCurrency?: Maybe<EcomProductSkuCurrency>;
}

export interface ActionProposalCandidateDecisionIntent {
  candidateIds: Array<Scalars['ID']['output']>;
  evidenceItems?: Maybe<Array<CreatorCandidateEvidence>>;
  rationale?: Maybe<Scalars['String']['output']>;
  status: CreatorCandidateStatus;
}

export interface ActionProposalCreatorTagIntent {
  creatorId: Scalars['ID']['output'];
  tagId: Scalars['ID']['output'];
}

export interface ActionProposalDecisionSnapshot {
  actorId?: Maybe<Scalars['String']['output']>;
  actorType?: Maybe<AffiliateLifecycleActorType>;
  decidedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  note?: Maybe<Scalars['String']['output']>;
}

export interface ActionProposalDecisionSnapshotInput {
  actorId?: InputMaybe<Scalars['String']['input']>;
  actorType?: InputMaybe<AffiliateLifecycleActorType>;
  decidedAt?: InputMaybe<Scalars['DateTimeISO']['input']>;
  note?: InputMaybe<Scalars['String']['input']>;
}

export interface ActionProposalExecutionResultSnapshot {
  actualChannel?: Maybe<AffiliateMessageChannel>;
  channelSelectionSource?: Maybe<AffiliateDeliveryChannelSelectionSource>;
  deliveryId?: Maybe<Scalars['ID']['output']>;
  deliveryStatus?: Maybe<AffiliateDeliveryStatus>;
  domainObjectId?: Maybe<Scalars['ID']['output']>;
  errorMessage?: Maybe<Scalars['String']['output']>;
  /** Producer-side retryability of the failure behind errorMessage. Absent means no Provider error was classified, which is not the same as UNKNOWN. */
  errorRetryability?: Maybe<TikTokPlatformErrorRetryability>;
  executedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lifecycleEventIds: Array<Scalars['ID']['output']>;
  platformObjectId?: Maybe<Scalars['String']['output']>;
  preferredChannel?: Maybe<AffiliateMessageChannel>;
}

export interface ActionProposalHumanReviewRequest {
  question: Scalars['String']['output'];
  reason: AffiliateHumanReviewReason;
}

export interface ActionProposalMessageIntent {
  creatorId?: Maybe<Scalars['ID']['output']>;
  creatorOpenId?: Maybe<Scalars['String']['output']>;
  emailSubject?: Maybe<Scalars['String']['output']>;
  parts: Array<AffiliateMessagePart>;
  preferredChannel?: Maybe<AffiliateMessageChannel>;
  subjectHash?: Maybe<Scalars['String']['output']>;
  subjectLength?: Maybe<Scalars['Int']['output']>;
}

export interface ActionProposalPolicySnapshot {
  action: ActionProposalType;
  matchedPolicyIds: Array<Scalars['ID']['output']>;
  reasons: Array<Scalars['String']['output']>;
  requiresApproval: Scalars['Boolean']['output'];
}

/** One compact version entry in an Affiliate work-bundle rewrite chain. */
export interface ActionProposalRevisionSummary {
  createdAt: Scalars['DateTimeISO']['output'];
  decision?: Maybe<ActionProposalDecisionSnapshot>;
  executionResult?: Maybe<ActionProposalExecutionResultSnapshot>;
  id: Scalars['ID']['output'];
  operatorSummary: Scalars['String']['output'];
  requestedByActorId?: Maybe<Scalars['String']['output']>;
  requestedByActorType?: Maybe<AffiliateLifecycleActorType>;
  revisionNumber: Scalars['Int']['output'];
  revisionOfProposalId?: Maybe<Scalars['ID']['output']>;
  revisionRootProposalId?: Maybe<Scalars['ID']['output']>;
  status: ActionProposalStatus;
  supersededByProposalId?: Maybe<Scalars['ID']['output']>;
  type: ActionProposalType;
  updatedAt: Scalars['DateTimeISO']['output'];
}

export interface ActionProposalSampleReviewIntent {
  decision: AffiliateSampleReviewDecision;
  lastObservedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  /** Frozen provider audit id resolved by Backend; callers must not supply it. */
  platformApplicationId?: Maybe<Scalars['String']['output']>;
  projectionRevision?: Maybe<Scalars['Int']['output']>;
  rejectReason?: Maybe<AffiliateSampleRejectReason>;
  /** Agent-authored explanation for the structured rejection reason. Required for new OTHER rejections. */
  rejectReasonExplanation?: Maybe<Scalars['String']['output']>;
  /** Local Mongo projection id. Nullable only for terminal legacy audit records created before sample projections became mandatory; current writes still require a valid local record id. */
  sampleApplicationRecordId?: Maybe<Scalars['ID']['output']>;
}

export interface ActionProposalSampleReviewIntentInput {
  decision: AffiliateSampleReviewDecision;
  lastObservedAt?: InputMaybe<Scalars['DateTimeISO']['input']>;
  /** Frozen provider audit id resolved by Backend; callers must not supply it. */
  platformApplicationId?: InputMaybe<Scalars['String']['input']>;
  projectionRevision?: InputMaybe<Scalars['Int']['input']>;
  rejectReason?: InputMaybe<AffiliateSampleRejectReason>;
  /** Agent-authored explanation for the structured rejection reason. Required for new OTHER rejections. */
  rejectReasonExplanation?: InputMaybe<Scalars['String']['input']>;
  /** Local Mongo projection id. Nullable only for terminal legacy audit records created before sample projections became mandatory; current writes still require a valid local record id. */
  sampleApplicationRecordId?: InputMaybe<Scalars['ID']['input']>;
}

export interface ActionProposalSampleShipmentIntent {
  platformApplicationId?: Maybe<Scalars['String']['output']>;
  quantity?: Maybe<Scalars['Int']['output']>;
  sampleApplicationRecordId: Scalars['ID']['output'];
  skuId?: Maybe<Scalars['String']['output']>;
  warehouseId?: Maybe<Scalars['ID']['output']>;
}

export interface ActionProposalSellerContactInfoIntent {
  email: Scalars['String']['output'];
  line?: Maybe<Scalars['String']['output']>;
  phoneNumber?: Maybe<Scalars['String']['output']>;
  telegram?: Maybe<Scalars['String']['output']>;
  whatsapp?: Maybe<Scalars['String']['output']>;
}

export interface ActionProposalSellerContactInfoIntentInput {
  email: Scalars['String']['input'];
  line?: InputMaybe<Scalars['String']['input']>;
  phoneNumber?: InputMaybe<Scalars['String']['input']>;
  telegram?: InputMaybe<Scalars['String']['input']>;
  whatsapp?: InputMaybe<Scalars['String']['input']>;
}

export interface ActionProposalSourceWorkBoundary {
  /** Optional canonical platform Collaboration context inside the CreatorRelationship. */
  affiliateCollaborationId?: Maybe<Scalars['ID']['output']>;
  /** Primary CreatorRelationship workspace ID for this work item. Agent sessions, proposals, and action history should be anchored here. */
  creatorRelationshipId: Scalars['ID']['output'];
  productId?: Maybe<Scalars['String']['output']>;
  recommendedActionTypes: Array<ActionProposalType>;
  sampleApplicationRecordId?: Maybe<Scalars['ID']['output']>;
  /** Business subject for dispatch. New affiliate work should use CREATOR_RELATIONSHIP as the primary workspace boundary. */
  subjectType: AffiliateWorkItemSubjectType;
  triggerChannel?: Maybe<AffiliateMessageChannel>;
  triggerId?: Maybe<Scalars['String']['output']>;
  triggerKind?: Maybe<Scalars['String']['output']>;
  triggerLifecycleEventId?: Maybe<Scalars['ID']['output']>;
  /** Shop that produced the primary agenda event. This is provenance only; each proposal step carries its own execution shopId. */
  triggerShopId?: Maybe<Scalars['ID']['output']>;
  versionAt: Scalars['DateTimeISO']['output'];
  workBundleKind: AffiliateWorkBundleKind;
  workKind: AffiliateWorkKind;
}

export const ActionProposalStatus = {
  Approved: 'APPROVED',
  Executed: 'EXECUTED',
  ExecutionFailed: 'EXECUTION_FAILED',
  Expired: 'EXPIRED',
  Pending: 'PENDING',
  Rejected: 'REJECTED',
  RevisionRequested: 'REVISION_REQUESTED',
  Superseded: 'SUPERSEDED'
} as const;

export type ActionProposalStatus = typeof ActionProposalStatus[keyof typeof ActionProposalStatus];
export interface ActionProposalStep {
  affiliateCollaborationId?: Maybe<Scalars['ID']['output']>;
  approvalPolicyUpdateIntent?: Maybe<ActionProposalApprovalPolicyUpdateIntent>;
  /** Committed relationship checkpoint used as this proposal's reasoning base. */
  baseCheckpointId?: Maybe<Scalars['String']['output']>;
  baseEventCursor?: Maybe<Scalars['Int']['output']>;
  blockCreatorIntent?: Maybe<ActionProposalBlockCreatorIntent>;
  businessDeveloperConfigRevision?: Maybe<Scalars['Int']['output']>;
  businessDeveloperIdSnapshot?: Maybe<Scalars['ID']['output']>;
  campaignId?: Maybe<Scalars['ID']['output']>;
  campaignProductUpdateIntent?: Maybe<ActionProposalCampaignProductUpdateIntent>;
  /** Candidate checkpoint produced by the agent run. It is promoted only after direct execution or approved execution succeeds. */
  candidateCheckpointId?: Maybe<Scalars['String']['output']>;
  candidateDecisionIntent?: Maybe<ActionProposalCandidateDecisionIntent>;
  creatorTagIntent?: Maybe<ActionProposalCreatorTagIntent>;
  messageIntent?: Maybe<ActionProposalMessageIntent>;
  /**
   * Deprecated wire-only projection of ActionProposal.operatorSummary for released Desktop clients.
   * @deprecated Read ActionProposal.operatorSummary once for the complete action bundle.
   */
  operatorSummary: Scalars['String']['output'];
  /** Source cache references associated with this action step. The proposal-owned predictionSnapshots remain the durable review evidence. */
  predictionCacheIds?: Maybe<Array<Scalars['ID']['output']>>;
  productId?: Maybe<Scalars['String']['output']>;
  relationshipOperationalConfigRevision: Scalars['Int']['output'];
  sampleApplicationRecordId?: Maybe<Scalars['ID']['output']>;
  sampleReviewIntent?: Maybe<ActionProposalSampleReviewIntent>;
  sampleShipmentIntent?: Maybe<ActionProposalSampleShipmentIntent>;
  /** Platform-action shop scope for this step. The proposal itself is owned by creatorRelationshipId. */
  shopId: Scalars['ID']['output'];
  stepId: Scalars['String']['output'];
  targetCollaborationIntent?: Maybe<ActionProposalTargetCollaborationIntent>;
  targetEventCursor?: Maybe<Scalars['Int']['output']>;
  type: ActionProposalType;
}

export interface ActionProposalTargetCollaborationIntent {
  creatorIds?: Maybe<Array<Scalars['ID']['output']>>;
  creatorOpenIds?: Maybe<Array<Scalars['String']['output']>>;
  endTime: Scalars['DateTimeISO']['output'];
  hasFreeSample: Scalars['Boolean']['output'];
  isSampleApprovalExempt: Scalars['Boolean']['output'];
  message?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  products: Array<ActionProposalTargetCollaborationProductIntent>;
  sellerContactInfo: ActionProposalSellerContactInfoIntent;
}

export interface ActionProposalTargetCollaborationProductIntent {
  productId: Scalars['String']['output'];
  shopAdsCommissionRateBps?: Maybe<Scalars['Int']['output']>;
  targetCommissionRateBps: Scalars['Int']['output'];
}

export interface ActionProposalTargetCollaborationProductIntentInput {
  productId: Scalars['String']['input'];
  shopAdsCommissionRateBps?: InputMaybe<Scalars['Int']['input']>;
  targetCommissionRateBps: Scalars['Int']['input'];
}

export const ActionProposalType = {
  CreateTargetCollaboration: 'CREATE_TARGET_COLLABORATION',
  ManageOpenCollaboration: 'MANAGE_OPEN_COLLABORATION',
  ManageTargetCollaboration: 'MANAGE_TARGET_COLLABORATION',
  NoActionNeeded: 'NO_ACTION_NEEDED',
  ReviewSampleApplication: 'REVIEW_SAMPLE_APPLICATION',
  SendMessage: 'SEND_MESSAGE'
} as const;

export type ActionProposalType = typeof ActionProposalType[keyof typeof ActionProposalType];
/** Server-driven announcement resolved for the current user and locale. */
export interface ActiveAnnouncement {
  actions: Array<ActiveAnnouncementAction>;
  category: AnnouncementCategory;
  id: Scalars['ID']['output'];
  key: Scalars['String']['output'];
  maxWidth: Scalars['Int']['output'];
  priority: Scalars['Int']['output'];
  surface: AnnouncementSurface;
  template: ActiveAnnouncementTemplate;
  title: Scalars['String']['output'];
}

/** Resolved action for a server-driven announcement. */
export interface ActiveAnnouncementAction {
  label?: Maybe<Scalars['String']['output']>;
  path?: Maybe<Scalars['String']['output']>;
  role: AnnouncementActionRole;
  type: AnnouncementActionType;
  url?: Maybe<Scalars['String']['output']>;
}

/** Resolved server-driven announcement template content. */
export interface ActiveAnnouncementTemplate {
  format: AnnouncementTemplateFormat;
  html: Scalars['String']['output'];
}

/** Client log file uploaded by a desktop device. */
export interface AdminClientLogFile {
  downloadUrl: Scalars['String']['output'];
  filename: Scalars['String']['output'];
  path: Scalars['String']['output'];
  sizeBytes: Scalars['Int']['output'];
  updatedAt: Scalars['DateTimeISO']['output'];
}

/** Admin view of the current Telegram debugging channel target stored in the relay. */
export interface AdminDebugChannelOverview {
  /** Desktop device ID that currently receives debug-channel Telegram updates. */
  deviceId?: Maybe<Scalars['String']['output']>;
  /** Last Telegram proxy method observed for the targeted desktop device. */
  deviceLastMethod?: Maybe<Scalars['String']['output']>;
  /** Last relay activity timestamp for the targeted desktop device, if currently known. */
  deviceLastSeenAt?: Maybe<Scalars['DateTimeISO']['output']>;
  /** Number of relay requests observed for the targeted desktop device in the active window. */
  deviceRequestCount?: Maybe<Scalars['Int']['output']>;
  /** Account email matched from the active debug proxy token. */
  email?: Maybe<Scalars['String']['output']>;
  /** True when the relay currently has a debug-channel target. */
  enabled: Scalars['Boolean']['output'];
  /** Relay target label, usually the customer email. */
  label?: Maybe<Scalars['String']['output']>;
  /** Account display name matched from the active debug proxy token. */
  name?: Maybe<Scalars['String']['output']>;
  /** True when the active relay token can be matched to a RivonClaw account. */
  tokenMatched: Scalars['Boolean']['output'];
  /** When the relay target was last changed. */
  updatedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  /** Account ID matched from the active debug proxy token. */
  userId?: Maybe<Scalars['String']['output']>;
}

/** Admin debug-channel mutation result. */
export interface AdminDebugChannelResult {
  deviceId: Scalars['String']['output'];
  email: Scalars['String']['output'];
  enabled: Scalars['Boolean']['output'];
  message?: Maybe<Scalars['String']['output']>;
  requestId: Scalars['String']['output'];
  respondedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  status: AdminDebugChannelStatus;
  userId: Scalars['String']['output'];
}

export const AdminDebugChannelStatus = {
  Disabled: 'DISABLED',
  Enabled: 'ENABLED',
  Failed: 'FAILED'
} as const;

export type AdminDebugChannelStatus = typeof AdminDebugChannelStatus[keyof typeof AdminDebugChannelStatus];
export const AdminDesktopPlatform = {
  Darwin: 'DARWIN',
  Linux: 'LINUX',
  Unknown: 'UNKNOWN',
  Windows: 'WINDOWS'
} as const;

export type AdminDesktopPlatform = typeof AdminDesktopPlatform[keyof typeof AdminDesktopPlatform];
/** A short-lived admin probe request sent to online desktop clients. */
export interface AdminDevicePresenceProbeRequest {
  requestId: Scalars['String']['output'];
  requestedAt: Scalars['DateTimeISO']['output'];
}

/** Desktop response to a short-lived admin device probe. */
export interface AdminDevicePresenceProbeResponseInput {
  appVersion?: InputMaybe<Scalars['String']['input']>;
  deviceId: Scalars['String']['input'];
  platform: AdminDesktopPlatform;
  requestId: Scalars['String']['input'];
}

/** An online desktop device that answered an admin presence probe. */
export interface AdminOnlineDevice {
  appVersion?: Maybe<Scalars['String']['output']>;
  deviceId: Scalars['String']['output'];
  platform: AdminDesktopPlatform;
  respondedAt: Scalars['DateTimeISO']['output'];
}

/** Result of probing one user's online desktop clients. */
export interface AdminUserDevicesProbeResult {
  devices: Array<AdminOnlineDevice>;
  email: Scalars['String']['output'];
  requestId: Scalars['String']['output'];
  userId: Scalars['String']['output'];
}

/** Connected advertising account */
export interface AdsAdvertiser {
  advertiserId: Scalars['String']['output'];
  advertiserName?: Maybe<Scalars['String']['output']>;
  advertiserRole?: Maybe<Scalars['String']['output']>;
  auth: AdsAdvertiserAuth;
  biSyncStatus: AdsBiSyncStatus;
  createdAt: Scalars['DateTimeISO']['output'];
  currency?: Maybe<Scalars['String']['output']>;
  firstConnectedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  id: Scalars['ID']['output'];
  lastAdsObjectSyncedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastBiSyncError?: Maybe<Scalars['String']['output']>;
  lastContextSyncedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastReportSyncedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastStoreAccessSyncedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  ownerType: AdsAdvertiserOwnerType;
  platform: AdsPlatform;
  platformStatus?: Maybe<Scalars['String']['output']>;
  syncHealthCheckedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  syncHealthStatus: AdsSyncHealthStatus;
  syncIssueCode?: Maybe<AdsSyncIssueCode>;
  syncIssueDetectedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  syncIssueMessage?: Maybe<Scalars['String']['output']>;
  timezone?: Maybe<SupportedTimezone>;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['String']['output'];
}

/** OAuth status for an advertising account */
export interface AdsAdvertiserAuth {
  accessTokenExpiresAt?: Maybe<Scalars['DateTimeISO']['output']>;
  authorizedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastError?: Maybe<Scalars['String']['output']>;
  lastRefreshedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  refreshTokenExpiresAt?: Maybe<Scalars['DateTimeISO']['output']>;
  status: AdsAdvertiserAuthStatus;
}

/** OAuth authorization status for an advertising account */
export const AdsAdvertiserAuthStatus = {
  Authorized: 'AUTHORIZED',
  Disconnected: 'DISCONNECTED',
  Revoked: 'REVOKED',
  TokenExpired: 'TOKEN_EXPIRED'
} as const;

export type AdsAdvertiserAuthStatus = typeof AdsAdvertiserAuthStatus[keyof typeof AdsAdvertiserAuthStatus];
/** Who owns or operates this advertising account */
export const AdsAdvertiserOwnerType = {
  UserOwned: 'USER_OWNED'
} as const;

export type AdsAdvertiserOwnerType = typeof AdsAdvertiserOwnerType[keyof typeof AdsAdvertiserOwnerType];
/** BI warehouse sync state for an advertising account */
export const AdsBiSyncStatus = {
  Disabled: 'DISABLED',
  Enabled: 'ENABLED',
  Paused: 'PAUSED'
} as const;

export type AdsBiSyncStatus = typeof AdsBiSyncStatus[keyof typeof AdsBiSyncStatus];
/** Local request lifecycle for advertiser-to-shop GMV Max authorization */
export const AdsGmvMaxAuthorizationRequestStatus = {
  Active: 'ACTIVE',
  Failed: 'FAILED',
  NotRequested: 'NOT_REQUESTED',
  Requested: 'REQUESTED'
} as const;

export type AdsGmvMaxAuthorizationRequestStatus = typeof AdsGmvMaxAuthorizationRequestStatus[keyof typeof AdsGmvMaxAuthorizationRequestStatus];
/** TikTok Ads OAuth completion event for refreshing advertiser-scoped data. */
export interface AdsOAuthCompletePayload {
  advertiserCount: Scalars['Int']['output'];
  advertiserIds: Array<Scalars['ID']['output']>;
  platform: AdsPlatform;
}

/** Advertising platform identifier */
export const AdsPlatform = {
  TiktokAds: 'TIKTOK_ADS'
} as const;

export type AdsPlatform = typeof AdsPlatform[keyof typeof AdsPlatform];
/** Ads-side TikTok store asset visible to an advertising account. This is not a persisted EasyClaw Shop link. */
export interface AdsStoreAccess {
  adsAdvertiserId: Scalars['ID']['output'];
  advertiserId: Scalars['String']['output'];
  businessCenterId?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTimeISO']['output'];
  exclusiveAdvertiserStatus?: Maybe<Scalars['String']['output']>;
  exclusiveAuthorizationStatus?: Maybe<Scalars['String']['output']>;
  exclusiveAuthorizedAdvertiserId?: Maybe<Scalars['String']['output']>;
  firstSeenAt?: Maybe<Scalars['DateTimeISO']['output']>;
  gmvMaxAuthorizationRequestStatus: AdsGmvMaxAuthorizationRequestStatus;
  id: Scalars['ID']['output'];
  isGmvMaxAvailable: Scalars['Boolean']['output'];
  lastGmvMaxAuthorizationError?: Maybe<Scalars['String']['output']>;
  lastGmvMaxAuthorizationRequestId?: Maybe<Scalars['String']['output']>;
  lastGmvMaxAuthorizationRequestedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastSeenAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastSyncedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  platform: AdsPlatform;
  /** @deprecated Ads store access rows are keyed by storeId; they do not persist a direct EasyClaw Shop link. */
  shopId?: Maybe<Scalars['String']['output']>;
  status: AdsStoreAccessStatus;
  storeAuthorizedBcId?: Maybe<Scalars['String']['output']>;
  storeId: Scalars['String']['output'];
  storeName?: Maybe<Scalars['String']['output']>;
  storeRole?: Maybe<Scalars['String']['output']>;
  storeStatus?: Maybe<Scalars['String']['output']>;
  storeType?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['String']['output'];
}

/** Lifecycle state for an advertiser-to-store ads asset access row */
export const AdsStoreAccessStatus = {
  Active: 'ACTIVE',
  Archived: 'ARCHIVED'
} as const;

export type AdsStoreAccessStatus = typeof AdsStoreAccessStatus[keyof typeof AdsStoreAccessStatus];
/** Whether BI sync can currently read data for an ads scope. */
export const AdsSyncHealthStatus = {
  Failed: 'FAILED',
  Healthy: 'HEALTHY'
} as const;

export type AdsSyncHealthStatus = typeof AdsSyncHealthStatus[keyof typeof AdsSyncHealthStatus];
/** Structured reason for an ads BI sync health problem. */
export const AdsSyncIssueCode = {
  BackendError: 'BACKEND_ERROR',
  PermissionDenied: 'PERMISSION_DENIED',
  PlatformError: 'PLATFORM_ERROR',
  Unknown: 'UNKNOWN'
} as const;

export type AdsSyncIssueCode = typeof AdsSyncIssueCode[keyof typeof AdsSyncIssueCode];
/** Subscription payload for a changed affiliate action proposal. */
export interface AffiliateActionProposalChanged {
  proposal: ActionProposal;
}

export interface AffiliateActionProposalDeltaInput {
  affiliateCollaborationId?: InputMaybe<Scalars['ID']['input']>;
  creatorRelationshipId: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  sampleApplicationRecordId?: InputMaybe<Scalars['ID']['input']>;
  shopId: Scalars['ID']['input'];
  since?: InputMaybe<Scalars['DateTimeISO']['input']>;
}

/** A stable cursor page of durable Affiliate Agent work bundles. */
export interface AffiliateActionProposalPage {
  hasMore: Scalars['Boolean']['output'];
  items: Array<ActionProposal>;
  nextCursor?: Maybe<Scalars['String']['output']>;
}

/** Immutable prediction evidence frozen into an ActionProposal when the proposal is created. The canonical per-family model signals live in predictionEvidence; Desktop decides Agent-prompt visibility via its evidenceMode. */
export interface AffiliateActionProposalPredictionSnapshot {
  captureMode: AffiliatePredictionCaptureMode;
  capturedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  /** Frozen validation and diagnostic evidence returned with the prediction. */
  diagnostics: Scalars['JSONObject']['output'];
  message?: Maybe<Scalars['String']['output']>;
  /** Frozen model identity, contract, scope, version, and training lineage. */
  model: Scalars['JSONObject']['output'];
  /** Frozen model output captured when this proposal was authored. */
  output: Scalars['JSONObject']['output'];
  predictedAt: Scalars['DateTimeISO']['output'];
  /** Canonical per-family model-signal evidence (evidenceMode, expectedSales, humanDecision) frozen exactly as computed at prediction time. Null when the prediction request itself failed. */
  predictionEvidence?: Maybe<AffiliatePredictionEvidence>;
  predictionType: AffiliatePredictionType;
  resolvedContext?: Maybe<AffiliateExpectedSalesResolvedContext>;
  scenario: AffiliateExpectedSalesPredictionScenario;
  sourceCacheId?: Maybe<Scalars['ID']['output']>;
  status: AffiliatePredictionStatus;
  subject: AffiliateExpectedSalesSubjectRef;
}

/** Result mode for an affiliate action request after backend policy evaluation. */
export const AffiliateActionRequestMode = {
  Executed: 'EXECUTED',
  ProposalCreated: 'PROPOSAL_CREATED'
} as const;

export type AffiliateActionRequestMode = typeof AffiliateActionRequestMode[keyof typeof AffiliateActionRequestMode];
/** Whether relationships owned by a business developer may dispatch the Affiliate Agent. */
export const AffiliateAgentAssistanceMode = {
  AiAssisted: 'AI_ASSISTED',
  HumanOnly: 'HUMAN_ONLY'
} as const;

export type AffiliateAgentAssistanceMode = typeof AffiliateAgentAssistanceMode[keyof typeof AffiliateAgentAssistanceMode];
export const AffiliateAgentEligibilityReason = {
  AffiliateDeviceUnassigned: 'AFFILIATE_DEVICE_UNASSIGNED',
  AffiliateOnboardingIncomplete: 'AFFILIATE_ONBOARDING_INCOMPLETE',
  AffiliateServiceDisabled: 'AFFILIATE_SERVICE_DISABLED',
  AwaitingCreatorResponse: 'AWAITING_CREATOR_RESPONSE',
  BusinessDeveloperArchived: 'BUSINESS_DEVELOPER_ARCHIVED',
  BusinessDeveloperHumanOnly: 'BUSINESS_DEVELOPER_HUMAN_ONLY',
  CreatorProtected: 'CREATOR_PROTECTED',
  Eligible: 'ELIGIBLE',
  OpenActionProposal: 'OPEN_ACTION_PROPOSAL',
  PlatformStateSync: 'PLATFORM_STATE_SYNC',
  RelationshipBlocked: 'RELATIONSHIP_BLOCKED',
  StaffReviewRequired: 'STAFF_REVIEW_REQUIRED'
} as const;

export type AffiliateAgentEligibilityReason = typeof AffiliateAgentEligibilityReason[keyof typeof AffiliateAgentEligibilityReason];
/** Approval interception policy for affiliate actions. If all non-empty condition arrays match, the backend creates an ActionProposal instead of executing automatically. */
export interface AffiliateApprovalPolicy {
  action: ActionProposalType;
  /** AND condition dimension. Empty means any campaign. */
  campaignIds: Array<Scalars['ID']['output']>;
  createdAt: Scalars['DateTimeISO']['output'];
  /** AND condition dimension. Empty means any creator tags. Non-empty matches when the creator has at least one listed tag. */
  creatorTagIds: Array<Scalars['ID']['output']>;
  enabled: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  /** AND condition dimension. Empty means any product. */
  productIds: Array<Scalars['String']['output']>;
  reason?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['ID']['output'];
}

export interface AffiliateApprovalPolicyContextPayload {
  shops: Array<AffiliateApprovalPolicyContextShop>;
}

export interface AffiliateApprovalPolicyContextShop {
  campaigns: Array<AffiliateCampaign>;
  creatorTags: Array<CreatorTag>;
  shopId: Scalars['ID']['output'];
  shopName: Scalars['String']['output'];
}

export interface AffiliateBusinessDeveloper {
  acceptingCreators: Scalars['Boolean']['output'];
  agentAssistanceMode: AffiliateAgentAssistanceMode;
  archivedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  businessPrompt?: Maybe<Scalars['String']['output']>;
  configRevision: Scalars['Int']['output'];
  createdAt: Scalars['DateTimeISO']['output'];
  creatorDisplayName?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  normalizedDisplayName: Scalars['String']['output'];
  preferredEmailAccountBindingId?: Maybe<Scalars['ID']['output']>;
  preferredWhatsAppAccountBindingId?: Maybe<Scalars['ID']['output']>;
  profileConfirmedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  profileStatus: AffiliateBusinessDeveloperProfileStatus;
  provisioningSource: AffiliateBusinessDeveloperProvisioningSource;
  regions: Array<ShopRegion>;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['ID']['output'];
}

export interface AffiliateBusinessDeveloperDispatchContext {
  businessPrompt?: Maybe<Scalars['String']['output']>;
  creatorDisplayName?: Maybe<Scalars['String']['output']>;
  email?: Maybe<AffiliateBusinessDeveloperDispatchEmail>;
  whatsApp?: Maybe<AffiliateBusinessDeveloperDispatchWhatsApp>;
}

export interface AffiliateBusinessDeveloperDispatchEmail {
  displayName?: Maybe<Scalars['String']['output']>;
  emailAddress: Scalars['String']['output'];
}

export interface AffiliateBusinessDeveloperDispatchWhatsApp {
  displayName?: Maybe<Scalars['String']['output']>;
  phoneNumber: Scalars['String']['output'];
}

export interface AffiliateBusinessDeveloperPage {
  items: Array<AffiliateBusinessDeveloperSummary>;
  limit: Scalars['Int']['output'];
  offset: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
}

export interface AffiliateBusinessDeveloperPageInput {
  includeArchived?: InputMaybe<Scalars['Boolean']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
}

/** Whether an imported Affiliate business developer profile has been reviewed by staff. */
export const AffiliateBusinessDeveloperProfileStatus = {
  NeedsConfiguration: 'NEEDS_CONFIGURATION',
  Ready: 'READY'
} as const;

export type AffiliateBusinessDeveloperProfileStatus = typeof AffiliateBusinessDeveloperProfileStatus[keyof typeof AffiliateBusinessDeveloperProfileStatus];
export const AffiliateBusinessDeveloperProvisionAction = {
  CreateIfMissing: 'CREATE_IF_MISSING',
  RestoreArchived: 'RESTORE_ARCHIVED'
} as const;

export type AffiliateBusinessDeveloperProvisionAction = typeof AffiliateBusinessDeveloperProvisionAction[keyof typeof AffiliateBusinessDeveloperProvisionAction];
export const AffiliateBusinessDeveloperProvisionDisposition = {
  Created: 'CREATED',
  Existing: 'EXISTING',
  Rejected: 'REJECTED',
  Restored: 'RESTORED'
} as const;

export type AffiliateBusinessDeveloperProvisionDisposition = typeof AffiliateBusinessDeveloperProvisionDisposition[keyof typeof AffiliateBusinessDeveloperProvisionDisposition];
export interface AffiliateBusinessDeveloperProvisionResult {
  clientKey: Scalars['String']['output'];
  developer?: Maybe<AffiliateBusinessDeveloper>;
  disposition: AffiliateBusinessDeveloperProvisionDisposition;
  errorCode?: Maybe<Scalars['String']['output']>;
  errorMessage?: Maybe<Scalars['String']['output']>;
  normalizedDisplayName: Scalars['String']['output'];
  requestedDisplayName: Scalars['String']['output'];
}

/** How the Affiliate business developer profile was first provisioned. */
export const AffiliateBusinessDeveloperProvisioningSource = {
  Manual: 'MANUAL',
  ProtectionImport: 'PROTECTION_IMPORT'
} as const;

export type AffiliateBusinessDeveloperProvisioningSource = typeof AffiliateBusinessDeveloperProvisioningSource[keyof typeof AffiliateBusinessDeveloperProvisioningSource];
export interface AffiliateBusinessDeveloperSummary {
  creatorRelationshipCount: Scalars['Int']['output'];
  developer: AffiliateBusinessDeveloper;
  emailAccountCount: Scalars['Int']['output'];
  unhealthyEmailAccountCount: Scalars['Int']['output'];
  unhealthyWhatsappAccountCount: Scalars['Int']['output'];
  whatsappAccountCount: Scalars['Int']['output'];
}

/** One affiliate campaign objective owned by a TikTok seller shop. */
export interface AffiliateCampaign {
  activatedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  activeSearchPlanId?: Maybe<Scalars['ID']['output']>;
  commissionRatePercent: Scalars['Float']['output'];
  completedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  configRevision: Scalars['Int']['output'];
  createdAt: Scalars['DateTimeISO']['output'];
  dailyOutreachTarget: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  lastSearchPlanCompletedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  market: ShopRegion;
  messageProductName: Scalars['String']['output'];
  messageTemplateSource: AffiliateCampaignMessageTemplateSource;
  messageTemplateText: Scalars['String']['output'];
  name: Scalars['String']['output'];
  needsReconfiguration: Scalars['Boolean']['output'];
  nextTickAt?: Maybe<Scalars['DateTimeISO']['output']>;
  pausedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  primaryProductId: Scalars['String']['output'];
  productSnapshot?: Maybe<AffiliateCampaignProductSnapshot>;
  productSnapshotHash?: Maybe<Scalars['String']['output']>;
  productSnapshotId?: Maybe<Scalars['ID']['output']>;
  resolvedTimeZone: Scalars['String']['output'];
  searchPlanErrorCode?: Maybe<Scalars['String']['output']>;
  searchPlanGeneration: Scalars['Int']['output'];
  searchPlanGuidance?: Maybe<Scalars['String']['output']>;
  searchPlanningState: AffiliateCampaignSearchPlanningState;
  selectionPolicy: AffiliateCampaignSelectionPolicy;
  shopId: Scalars['ID']['output'];
  status: AffiliateCampaignStatus;
  templateTextHash: Scalars['String']['output'];
  templateVersion: Scalars['Int']['output'];
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['ID']['output'];
}

export interface AffiliateCampaignAffiliatePerformanceRules {
  averageCommissionRate?: Maybe<Scalars['String']['output']>;
  creatorAgencyStatus?: Maybe<Scalars['String']['output']>;
  fastGrowingOnly?: Maybe<Scalars['Boolean']['output']>;
  notInvitedLast90Days?: Maybe<Scalars['Boolean']['output']>;
  postRate?: Maybe<Scalars['String']['output']>;
}

export interface AffiliateCampaignAffiliatePerformanceRulesInput {
  averageCommissionRate?: InputMaybe<Scalars['String']['input']>;
  creatorAgencyStatus?: InputMaybe<Scalars['String']['input']>;
  fastGrowingOnly?: InputMaybe<Scalars['Boolean']['input']>;
  notInvitedLast90Days?: InputMaybe<Scalars['Boolean']['input']>;
  postRate?: InputMaybe<Scalars['String']['input']>;
}

export interface AffiliateCampaignAudienceRules {
  ageRanges?: Maybe<Array<CreatorSearchFollowerAgeRange>>;
  genderDistribution?: Maybe<AffiliateCampaignGenderDistributionRule>;
}

export interface AffiliateCampaignAudienceRulesInput {
  ageRanges?: InputMaybe<Array<CreatorSearchFollowerAgeRange>>;
  genderDistribution?: InputMaybe<AffiliateCampaignGenderDistributionRuleInput>;
}

export interface AffiliateCampaignCategoryRule {
  childCategoryIds?: Maybe<Array<Scalars['String']['output']>>;
  parentCategoryId: Scalars['String']['output'];
}

export interface AffiliateCampaignCategoryRuleInput {
  childCategoryIds?: InputMaybe<Array<Scalars['String']['input']>>;
  parentCategoryId: Scalars['String']['input'];
}

export interface AffiliateCampaignContentPerformanceRules {
  averageEngagementRate?: Maybe<Scalars['String']['output']>;
  averageLiveViewers?: Maybe<Scalars['String']['output']>;
  averageShoppableEngagementRate?: Maybe<Scalars['String']['output']>;
  averageShoppableLiveViewers?: Maybe<Scalars['String']['output']>;
  averageShoppableVideoViews?: Maybe<Scalars['String']['output']>;
  averageVideoViews?: Maybe<Scalars['String']['output']>;
}

export interface AffiliateCampaignContentPerformanceRulesInput {
  averageEngagementRate?: InputMaybe<Scalars['String']['input']>;
  averageLiveViewers?: InputMaybe<Scalars['String']['input']>;
  averageShoppableEngagementRate?: InputMaybe<Scalars['String']['input']>;
  averageShoppableLiveViewers?: InputMaybe<Scalars['String']['input']>;
  averageShoppableVideoViews?: InputMaybe<Scalars['String']['input']>;
  averageVideoViews?: InputMaybe<Scalars['String']['input']>;
}

export interface AffiliateCampaignCreatorState {
  campaignId: Scalars['ID']['output'];
  creatorId: Scalars['ID']['output'];
  creatorPerformance?: Maybe<AffiliateCreatorPerformanceCurrent>;
  creatorProfile?: Maybe<AffiliateCreatorIdentity>;
  creatorRelationship?: Maybe<AffiliateCreatorRelationship>;
  decisionReason?: Maybe<Scalars['String']['output']>;
  decisionReasonCodes: Array<Scalars['String']['output']>;
  efficiencyScore?: Maybe<Scalars['Float']['output']>;
  eligibilityCategory?: Maybe<AffiliateCampaignEligibilityCategory>;
  eligibilityEvaluatedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  eligibilityPolicyVersion?: Maybe<Scalars['Int']['output']>;
  eligibilityReasonCode?: Maybe<Scalars['String']['output']>;
  /** Raw arithmetic expectation of attributed units through Sample terminal, conditional on approval. */
  expectedSalesUnits?: Maybe<Scalars['Float']['output']>;
  filterResult?: Maybe<AffiliateCampaignRuleFilterResult>;
  firstSeenAt: Scalars['DateTimeISO']['output'];
  followerCount?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  lastSeenAt: Scalars['DateTimeISO']['output'];
  latestSearchDailyExecutionId?: Maybe<Scalars['ID']['output']>;
  latestSearchMatchedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  latestSearchPlanGeneration?: Maybe<Scalars['Int']['output']>;
  latestSearchPlanId?: Maybe<Scalars['ID']['output']>;
  latestSearchProviderOrdinal?: Maybe<Scalars['Int']['output']>;
  market: Scalars['String']['output'];
  predictionStatus?: Maybe<AffiliateCampaignPredictionStatus>;
  productId?: Maybe<Scalars['String']['output']>;
  providerOrdinal?: Maybe<Scalars['Int']['output']>;
  providerPageSequence?: Maybe<Scalars['Int']['output']>;
  reachedOutAt?: Maybe<Scalars['DateTimeISO']['output']>;
  repliedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  scheduledAt?: Maybe<Scalars['DateTimeISO']['output']>;
  searchOccurrenceCount: Scalars['Int']['output'];
  selectionStrategy?: Maybe<AffiliateCampaignSelectionStrategy>;
  shopId: Scalars['ID']['output'];
  sourceSearchPlanIds: Array<Scalars['ID']['output']>;
  status: AffiliateCampaignCreatorStateStatus;
}

export interface AffiliateCampaignCreatorStatePage {
  items: Array<AffiliateCampaignCreatorState>;
  nextCursor?: Maybe<Scalars['String']['output']>;
}

export const AffiliateCampaignCreatorStateStatus = {
  Cancelled: 'CANCELLED',
  Deferred: 'DEFERRED',
  Discovered: 'DISCOVERED',
  Disqualified: 'DISQUALIFIED',
  EvaluationPending: 'EVALUATION_PENDING',
  Failed: 'FAILED',
  Ignored: 'IGNORED',
  IneligibleOutreachPolicy: 'INELIGIBLE_OUTREACH_POLICY',
  IneligibleProtected: 'INELIGIBLE_PROTECTED',
  IneligibleQualification: 'INELIGIBLE_QUALIFICATION',
  QualifiedNotSelected: 'QUALIFIED_NOT_SELECTED',
  ReachedOut: 'REACHED_OUT',
  Replied: 'REPLIED',
  Reserved: 'RESERVED',
  Scheduled: 'SCHEDULED',
  Selected: 'SELECTED',
  Submitted: 'SUBMITTED'
} as const;

export type AffiliateCampaignCreatorStateStatus = typeof AffiliateCampaignCreatorStateStatus[keyof typeof AffiliateCampaignCreatorStateStatus];
export interface AffiliateCampaignDailyExecution {
  allocatedTarget: Scalars['Int']['output'];
  campaignId: Scalars['ID']['output'];
  completedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  completionReason?: Maybe<Scalars['String']['output']>;
  configRevision: Scalars['Int']['output'];
  counterSchemaVersion: Scalars['Int']['output'];
  counters: AffiliateCampaignExecutionCounters;
  createdAt: Scalars['DateTimeISO']['output'];
  effectiveTarget: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  market: Scalars['String']['output'];
  marketLocalDate: Scalars['String']['output'];
  modelVersion?: Maybe<Scalars['String']['output']>;
  nextTickAt?: Maybe<Scalars['DateTimeISO']['output']>;
  requestedTarget: Scalars['Int']['output'];
  riskReason?: Maybe<Scalars['String']['output']>;
  riskState: AffiliateCampaignExecutionRiskState;
  searchPlanExecutions: Array<AffiliateCampaignSearchPlanExecution>;
  selectionStrategy: AffiliateCampaignSelectionStrategy;
  shopId: Scalars['ID']['output'];
  status: AffiliateCampaignDailyExecutionStatus;
  stopReason?: Maybe<Scalars['String']['output']>;
  templateVersion: Scalars['Int']['output'];
  timezone: Scalars['String']['output'];
  underDeliveryReason?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTimeISO']['output'];
}

export const AffiliateCampaignDailyExecutionStatus = {
  BlockedModelNotReady: 'BLOCKED_MODEL_NOT_READY',
  Cancelled: 'CANCELLED',
  Completed: 'COMPLETED',
  Discovering: 'DISCOVERING',
  Failed: 'FAILED',
  Partial: 'PARTIAL',
  Paused: 'PAUSED',
  Planned: 'PLANNED',
  Scheduling: 'SCHEDULING',
  Sending: 'SENDING',
  WaitingForSearchPlan: 'WAITING_FOR_SEARCH_PLAN'
} as const;

export type AffiliateCampaignDailyExecutionStatus = typeof AffiliateCampaignDailyExecutionStatus[keyof typeof AffiliateCampaignDailyExecutionStatus];
export interface AffiliateCampaignDiscoveryRules {
  affiliatePerformance30d?: Maybe<AffiliateCampaignAffiliatePerformanceRules>;
  audience?: Maybe<AffiliateCampaignAudienceRules>;
  categories?: Maybe<Array<AffiliateCampaignCategoryRule>>;
  contentPerformance30d?: Maybe<AffiliateCampaignContentPerformanceRules>;
  followerCount?: Maybe<AffiliateCampaignFollowerCountRule>;
  keyword?: Maybe<Scalars['String']['output']>;
  marketSpecific?: Maybe<AffiliateCampaignMarketSpecificRules>;
  salesPerformance30d?: Maybe<AffiliateCampaignSalesPerformanceRules>;
}

export interface AffiliateCampaignDiscoveryRulesInput {
  affiliatePerformance30d?: InputMaybe<AffiliateCampaignAffiliatePerformanceRulesInput>;
  audience?: InputMaybe<AffiliateCampaignAudienceRulesInput>;
  categories?: InputMaybe<Array<AffiliateCampaignCategoryRuleInput>>;
  contentPerformance30d?: InputMaybe<AffiliateCampaignContentPerformanceRulesInput>;
  followerCount?: InputMaybe<AffiliateCampaignFollowerCountRuleInput>;
  keyword?: InputMaybe<Scalars['String']['input']>;
  marketSpecific?: InputMaybe<AffiliateCampaignMarketSpecificRulesInput>;
  salesPerformance30d?: InputMaybe<AffiliateCampaignSalesPerformanceRulesInput>;
}

export const AffiliateCampaignEligibilityCategory = {
  OutreachPolicy: 'OUTREACH_POLICY',
  Protected: 'PROTECTED',
  Qualification: 'QUALIFICATION'
} as const;

export type AffiliateCampaignEligibilityCategory = typeof AffiliateCampaignEligibilityCategory[keyof typeof AffiliateCampaignEligibilityCategory];
export interface AffiliateCampaignExecutionCounters {
  evaluated: Scalars['Int']['output'];
  failed: Scalars['Int']['output'];
  matched: Scalars['Int']['output'];
  outreachPolicyBlocked: Scalars['Int']['output'];
  protected: Scalars['Int']['output'];
  qualificationFailed: Scalars['Int']['output'];
  qualified: Scalars['Int']['output'];
  replied: Scalars['Int']['output'];
  reserved: Scalars['Int']['output'];
  scanned: Scalars['Int']['output'];
  selected: Scalars['Int']['output'];
  sent: Scalars['Int']['output'];
  submitted: Scalars['Int']['output'];
  uncertain: Scalars['Int']['output'];
}

export const AffiliateCampaignExecutionRiskState = {
  CircuitOpen: 'CIRCUIT_OPEN',
  Normal: 'NORMAL',
  Throttled: 'THROTTLED'
} as const;

export type AffiliateCampaignExecutionRiskState = typeof AffiliateCampaignExecutionRiskState[keyof typeof AffiliateCampaignExecutionRiskState];
export interface AffiliateCampaignFollowerCountRule {
  maximum?: Maybe<Scalars['Int']['output']>;
  minimum?: Maybe<Scalars['Int']['output']>;
}

export interface AffiliateCampaignFollowerCountRuleInput {
  maximum?: InputMaybe<Scalars['Int']['input']>;
  minimum?: InputMaybe<Scalars['Int']['input']>;
}

export interface AffiliateCampaignGenderDistributionRule {
  gender: CreatorSearchFollowerGender;
  minimumPercentage: Scalars['Float']['output'];
}

export interface AffiliateCampaignGenderDistributionRuleInput {
  gender: CreatorSearchFollowerGender;
  minimumPercentage: Scalars['Float']['input'];
}

export interface AffiliateCampaignMarketSpecificRules {
  categoryPros?: Maybe<Array<Scalars['String']['output']>>;
  creatorLevels?: Maybe<Array<Scalars['String']['output']>>;
  languages?: Maybe<Array<Scalars['String']['output']>>;
}

export interface AffiliateCampaignMarketSpecificRulesInput {
  categoryPros?: InputMaybe<Array<Scalars['String']['input']>>;
  creatorLevels?: InputMaybe<Array<Scalars['String']['input']>>;
  languages?: InputMaybe<Array<Scalars['String']['input']>>;
}

export const AffiliateCampaignMessageTemplateSource = {
  AiGenerated: 'AI_GENERATED',
  UserAuthored: 'USER_AUTHORED'
} as const;

export type AffiliateCampaignMessageTemplateSource = typeof AffiliateCampaignMessageTemplateSource[keyof typeof AffiliateCampaignMessageTemplateSource];
export interface AffiliateCampaignMessageTemplateSuggestion {
  productShortName: Scalars['String']['output'];
  source: AffiliateCampaignMessageTemplateSource;
  text: Scalars['String']['output'];
}

export const AffiliateCampaignPredictionStatus = {
  DataNotReady: 'DATA_NOT_READY',
  Error: 'ERROR',
  ModelNotReady: 'MODEL_NOT_READY',
  NotRequested: 'NOT_REQUESTED',
  Ok: 'OK'
} as const;

export type AffiliateCampaignPredictionStatus = typeof AffiliateCampaignPredictionStatus[keyof typeof AffiliateCampaignPredictionStatus];
export interface AffiliateCampaignProductPreview {
  brandId?: Maybe<Scalars['String']['output']>;
  brandName?: Maybe<Scalars['String']['output']>;
  categoryLeafId: Scalars['String']['output'];
  categoryLeafName: Scalars['String']['output'];
  categoryPathIds: Array<Scalars['String']['output']>;
  categoryPathNames: Array<Scalars['String']['output']>;
  coverImage?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  maximumPriceUsdAmount: Scalars['Float']['output'];
  minimumPriceUsdAmount: Scalars['Float']['output'];
  observedAt: Scalars['DateTimeISO']['output'];
  originalCurrency: Scalars['String']['output'];
  productId: Scalars['String']['output'];
  snapshotHash: Scalars['String']['output'];
  status?: Maybe<Scalars['String']['output']>;
  title: Scalars['String']['output'];
}

export interface AffiliateCampaignProductSnapshot {
  brandId?: Maybe<Scalars['String']['output']>;
  brandName?: Maybe<Scalars['String']['output']>;
  categoryPathIds: Array<Scalars['String']['output']>;
  categoryPathNames: Array<Scalars['String']['output']>;
  coverImage?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  maximumPriceUsdAmount: Scalars['Float']['output'];
  minimumPriceUsdAmount: Scalars['Float']['output'];
  observedAt: Scalars['DateTimeISO']['output'];
  originalCurrency: Scalars['String']['output'];
  productId: Scalars['String']['output'];
  sellerSkus: Array<Scalars['String']['output']>;
  snapshotHash: Scalars['String']['output'];
  status?: Maybe<Scalars['String']['output']>;
  title: Scalars['String']['output'];
}

export const AffiliateCampaignRuleFilterResult = {
  Failed: 'FAILED',
  NotEvaluated: 'NOT_EVALUATED',
  Passed: 'PASSED'
} as const;

export type AffiliateCampaignRuleFilterResult = typeof AffiliateCampaignRuleFilterResult[keyof typeof AffiliateCampaignRuleFilterResult];
export interface AffiliateCampaignSalesPerformanceRules {
  gmvRanges?: Maybe<Array<AffiliateMarketplaceGmvRange>>;
  unitsSoldRanges?: Maybe<Array<AffiliateMarketplaceUnitsSoldRange>>;
}

export interface AffiliateCampaignSalesPerformanceRulesInput {
  gmvRanges?: InputMaybe<Array<AffiliateMarketplaceGmvRange>>;
  unitsSoldRanges?: InputMaybe<Array<AffiliateMarketplaceUnitsSoldRange>>;
}

export interface AffiliateCampaignSearchPhraseCandidateInput {
  discoveryRules?: InputMaybe<AffiliateCampaignDiscoveryRulesInput>;
  explanation: Scalars['String']['input'];
  text: Scalars['String']['input'];
}

export interface AffiliateCampaignSearchPlan {
  blockStage?: Maybe<AffiliateCampaignSearchPlanBlockStage>;
  campaignId: Scalars['ID']['output'];
  completedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  completionReason?: Maybe<AffiliateCampaignSearchPlanCompletionReason>;
  configRevision: Scalars['Int']['output'];
  discoveryRules?: Maybe<AffiliateCampaignDiscoveryRules>;
  errorCode?: Maybe<Scalars['String']['output']>;
  generation: Scalars['Int']['output'];
  generationAttemptCount: Scalars['Int']['output'];
  guidanceInterpretation?: Maybe<AffiliateCampaignSearchPlanGuidanceInterpretation>;
  id: Scalars['ID']['output'];
  lastSearchedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  pageSequence: Scalars['Int']['output'];
  phrase?: Maybe<AffiliateCampaignSearchPlanPhrase>;
  productId: Scalars['String']['output'];
  providerFailureCount: Scalars['Int']['output'];
  requestedAt: Scalars['DateTimeISO']['output'];
  shopId: Scalars['ID']['output'];
  startedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  status: AffiliateCampaignSearchPlanStatus;
  totals: AffiliateCampaignSearchPlanTotals;
}

export const AffiliateCampaignSearchPlanBlockStage = {
  AgentGeneration: 'AGENT_GENERATION',
  ProviderSearch: 'PROVIDER_SEARCH'
} as const;

export type AffiliateCampaignSearchPlanBlockStage = typeof AffiliateCampaignSearchPlanBlockStage[keyof typeof AffiliateCampaignSearchPlanBlockStage];
export const AffiliateCampaignSearchPlanCompletionReason = {
  CampaignCompletedOrArchived: 'CAMPAIGN_COMPLETED_OR_ARCHIVED',
  CampaignConfigChanged: 'CAMPAIGN_CONFIG_CHANGED',
  PageBudgetReached: 'PAGE_BUDGET_REACHED',
  ProviderCursorExpired: 'PROVIDER_CURSOR_EXPIRED',
  ProviderExhausted: 'PROVIDER_EXHAUSTED'
} as const;

export type AffiliateCampaignSearchPlanCompletionReason = typeof AffiliateCampaignSearchPlanCompletionReason[keyof typeof AffiliateCampaignSearchPlanCompletionReason];
export interface AffiliateCampaignSearchPlanExecution {
  completedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  endPageSequence: Scalars['Int']['output'];
  generation: Scalars['Int']['output'];
  lastSearchedAt: Scalars['DateTimeISO']['output'];
  matched: Scalars['Int']['output'];
  phrase: Scalars['String']['output'];
  phraseKey: Scalars['String']['output'];
  qualified: Scalars['Int']['output'];
  scanned: Scalars['Int']['output'];
  searchPlanId: Scalars['ID']['output'];
  selected: Scalars['Int']['output'];
  startPageSequence: Scalars['Int']['output'];
  startedAt: Scalars['DateTimeISO']['output'];
}

export interface AffiliateCampaignSearchPlanGenerationContext {
  campaign: Scalars['JSONObject']['output'];
  capability: Scalars['JSONObject']['output'];
  leaseToken: Scalars['String']['output'];
  productSnapshot: Scalars['JSONObject']['output'];
  recentPlans: Array<Scalars['JSONObject']['output']>;
  searchPlanId: Scalars['ID']['output'];
  shop: Scalars['JSONObject']['output'];
  uiLocale: Scalars['String']['output'];
}

export interface AffiliateCampaignSearchPlanGuidanceInterpretation {
  hardConstraints?: Maybe<AffiliateCampaignDiscoveryRules>;
  softDirections: Array<Scalars['String']['output']>;
  sourceGuidanceHash: Scalars['String']['output'];
}

export interface AffiliateCampaignSearchPlanGuidanceInterpretationInput {
  hardConstraints?: InputMaybe<AffiliateCampaignDiscoveryRulesInput>;
  softDirections: Array<Scalars['String']['input']>;
  sourceGuidanceHash: Scalars['String']['input'];
  unsupportedHardConstraints: Array<Scalars['String']['input']>;
}

export interface AffiliateCampaignSearchPlanPage {
  items: Array<AffiliateCampaignSearchPlan>;
  nextCursor?: Maybe<Scalars['String']['output']>;
}

export interface AffiliateCampaignSearchPlanPhrase {
  explanation: Scalars['String']['output'];
  explanationLocale: Scalars['String']['output'];
  key: Scalars['String']['output'];
  text: Scalars['String']['output'];
}

export interface AffiliateCampaignSearchPlanRequest {
  attempt: Scalars['Int']['output'];
  campaignId: Scalars['ID']['output'];
  configRevision: Scalars['Int']['output'];
  generation: Scalars['Int']['output'];
  platformShopId: Scalars['String']['output'];
  requestedAt: Scalars['DateTimeISO']['output'];
  searchPlanId: Scalars['ID']['output'];
  shopId: Scalars['ID']['output'];
}

export const AffiliateCampaignSearchPlanStatus = {
  Active: 'ACTIVE',
  Blocked: 'BLOCKED',
  Exhausted: 'EXHAUSTED',
  Generating: 'GENERATING',
  Invalidated: 'INVALIDATED',
  WaitingForDesktopAgent: 'WAITING_FOR_DESKTOP_AGENT'
} as const;

export type AffiliateCampaignSearchPlanStatus = typeof AffiliateCampaignSearchPlanStatus[keyof typeof AffiliateCampaignSearchPlanStatus];
export interface AffiliateCampaignSearchPlanTotals {
  matched: Scalars['Int']['output'];
  outreachPolicyBlocked: Scalars['Int']['output'];
  protected: Scalars['Int']['output'];
  qualificationFailed: Scalars['Int']['output'];
  qualified: Scalars['Int']['output'];
  scanned: Scalars['Int']['output'];
  selected: Scalars['Int']['output'];
}

export const AffiliateCampaignSearchPlanningState = {
  Blocked: 'BLOCKED',
  Idle: 'IDLE',
  PlanActive: 'PLAN_ACTIVE',
  WaitingForDesktopAgent: 'WAITING_FOR_DESKTOP_AGENT'
} as const;

export type AffiliateCampaignSearchPlanningState = typeof AffiliateCampaignSearchPlanningState[keyof typeof AffiliateCampaignSearchPlanningState];
export interface AffiliateCampaignSelectionPolicy {
  minimumExpectedSalesUnits?: Maybe<Scalars['Float']['output']>;
  ranking: AffiliateCampaignSelectionRanking;
  strategy: AffiliateCampaignSelectionStrategy;
}

export interface AffiliateCampaignSelectionPolicyInput {
  minimumExpectedSalesUnits?: InputMaybe<Scalars['Float']['input']>;
  ranking: AffiliateCampaignSelectionRanking;
  strategy: AffiliateCampaignSelectionStrategy;
}

export const AffiliateCampaignSelectionRanking = {
  ExpectedSalesPerFollower: 'EXPECTED_SALES_PER_FOLLOWER',
  ProviderOrder: 'PROVIDER_ORDER'
} as const;

export type AffiliateCampaignSelectionRanking = typeof AffiliateCampaignSelectionRanking[keyof typeof AffiliateCampaignSelectionRanking];
export interface AffiliateCampaignSelectionReadiness {
  campaignId: Scalars['ID']['output'];
  message?: Maybe<Scalars['String']['output']>;
  ready: Scalars['Boolean']['output'];
  reasonCode?: Maybe<Scalars['String']['output']>;
  strategy: AffiliateCampaignSelectionStrategy;
}

export const AffiliateCampaignSelectionStrategy = {
  ExpectedSales: 'EXPECTED_SALES',
  MarketplaceRules: 'MARKETPLACE_RULES'
} as const;

export type AffiliateCampaignSelectionStrategy = typeof AffiliateCampaignSelectionStrategy[keyof typeof AffiliateCampaignSelectionStrategy];
export interface AffiliateCampaignShopDailyCapacity {
  activeCampaignDailyTargetSum: Scalars['Int']['output'];
  circuitOpenUntil?: Maybe<Scalars['DateTimeISO']['output']>;
  circuitReason?: Maybe<Scalars['String']['output']>;
  countedOutreachCount: Scalars['Int']['output'];
  effectiveDailyLimit?: Maybe<Scalars['Int']['output']>;
  marketLocalDate: Scalars['String']['output'];
  nextAllowedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  remainingOutreachCapacity: Scalars['Int']['output'];
  targetToLimitRatio?: Maybe<Scalars['Float']['output']>;
}

export const AffiliateCampaignStatus = {
  Active: 'ACTIVE',
  Archived: 'ARCHIVED',
  Completed: 'COMPLETED',
  Draft: 'DRAFT',
  Paused: 'PAUSED'
} as const;

export type AffiliateCampaignStatus = typeof AffiliateCampaignStatus[keyof typeof AffiliateCampaignStatus];
export interface AffiliateCampaignSummary {
  campaignId: Scalars['ID']['output'];
  counters: AffiliateCampaignExecutionCounters;
  latestExecution?: Maybe<AffiliateCampaignDailyExecution>;
  shopDailyCapacity: AffiliateCampaignShopDailyCapacity;
  totalCreators: Scalars['Int']['output'];
}

export const AffiliateCampaignTemplateGenerationMode = {
  Alternative: 'ALTERNATIVE',
  Initial: 'INITIAL'
} as const;

export type AffiliateCampaignTemplateGenerationMode = typeof AffiliateCampaignTemplateGenerationMode[keyof typeof AffiliateCampaignTemplateGenerationMode];
/** Platform-level affiliate collaboration, normalized across TikTok open and target collaborations. */
export interface AffiliateCollaboration {
  campaignId?: Maybe<Scalars['ID']['output']>;
  collaborationSubType?: Maybe<Scalars['String']['output']>;
  commissionEndTime?: Maybe<Scalars['DateTimeISO']['output']>;
  commissionRate?: Maybe<Scalars['Float']['output']>;
  commissionStartTime?: Maybe<Scalars['DateTimeISO']['output']>;
  contentCreatorCount?: Maybe<Scalars['Int']['output']>;
  createdAt: Scalars['DateTimeISO']['output'];
  creatorIds: Array<Scalars['ID']['output']>;
  creatorInvitedCount?: Maybe<Scalars['Int']['output']>;
  creatorOpenIds: Array<Scalars['String']['output']>;
  effectiveTime?: Maybe<Scalars['DateTimeISO']['output']>;
  endTime?: Maybe<Scalars['DateTimeISO']['output']>;
  firstObservedAt: Scalars['DateTimeISO']['output'];
  freeSampleRule?: Maybe<EcomFreeSampleRule>;
  id: Scalars['ID']['output'];
  lastObservedAt: Scalars['DateTimeISO']['output'];
  lastSyncSource: AffiliateProjectionSyncSource;
  message?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  openSampleRule?: Maybe<EcomOpenCollaborationSampleRule>;
  platformCollaborationId: Scalars['String']['output'];
  platformUpdatedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  productCount?: Maybe<Scalars['Int']['output']>;
  productIds: Array<Scalars['String']['output']>;
  products: Array<EcomAffiliateProduct>;
  projectionRevision: Scalars['Int']['output'];
  sellerContactInfo?: Maybe<EcomSellerContactInfo>;
  shopId: Scalars['ID']['output'];
  showcaseCreatorCount?: Maybe<Scalars['Int']['output']>;
  startTime?: Maybe<Scalars['DateTimeISO']['output']>;
  status: AffiliateCollaborationStatus;
  targetCreators: Array<EcomTargetCollaborationCreator>;
  type: AffiliateCollaborationType;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['ID']['output'];
}

export interface AffiliateCollaborationDetailInput {
  id: Scalars['ID']['input'];
}

/** Canonical platform Collaboration detail with linked Creators, Sample Applications, and Product summaries. */
export interface AffiliateCollaborationDetailPayload {
  collaboration: AffiliateCollaboration;
  creators: Array<AffiliateCreatorIdentity>;
  productSummaries: Array<AffiliateRelationshipProductSummary>;
  sampleApplications: Array<SampleApplicationRecord>;
}

/** Normalized platform collaboration status for open and target collaborations. */
export const AffiliateCollaborationStatus = {
  Active: 'ACTIVE',
  Cancelled: 'CANCELLED',
  Deleted: 'DELETED',
  Expired: 'EXPIRED',
  Expiring: 'EXPIRING',
  Failed: 'FAILED',
  Paused: 'PAUSED',
  Terminating: 'TERMINATING',
  Unknown: 'UNKNOWN'
} as const;

export type AffiliateCollaborationStatus = typeof AffiliateCollaborationStatus[keyof typeof AffiliateCollaborationStatus];
/** TikTok affiliate collaboration shape: open collaboration or target collaboration. */
export const AffiliateCollaborationType = {
  Open: 'OPEN',
  Target: 'TARGET'
} as const;

export type AffiliateCollaborationType = typeof AffiliateCollaborationType[keyof typeof AffiliateCollaborationType];
/** How the concrete seller-account to creator-contact route was selected */
export const AffiliateContactSelectionSource = {
  BdPreferredAccount: 'BD_PREFERRED_ACCOUNT',
  PlatformDefault: 'PLATFORM_DEFAULT',
  RecentContact: 'RECENT_CONTACT',
  StaffOverride: 'STAFF_OVERRIDE',
  TriggerContact: 'TRIGGER_CONTACT'
} as const;

export type AffiliateContactSelectionSource = typeof AffiliateContactSelectionSource[keyof typeof AffiliateContactSelectionSource];
export interface AffiliateContextBuilderInput {
  baseCheckpointId?: InputMaybe<Scalars['String']['input']>;
  baseEventCursor?: InputMaybe<Scalars['Int']['input']>;
  creatorRelationshipId: Scalars['ID']['input'];
  /** Internal Desktop optimization. False omits lifecycle event rendering from checkpoint preparation. */
  includeEventDelta?: InputMaybe<Scalars['Boolean']['input']>;
  /** Internal Desktop optimization. False omits the current workspace snapshot from checkpoint preparation. */
  includeWorkspace?: InputMaybe<Scalars['Boolean']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  shopId: Scalars['ID']['input'];
  /** Frozen inclusive boundary from the dispatched Agent Working Agenda. */
  targetEventCursor: Scalars['Int']['input'];
}

export interface AffiliateContextBuilderPayload {
  baseCheckpointId?: Maybe<Scalars['String']['output']>;
  baseEventCursor: Scalars['Int']['output'];
  baseMatchesCommitted: Scalars['Boolean']['output'];
  businessDeveloper?: Maybe<AffiliateBusinessDeveloper>;
  businessDeveloperConfigRevision?: Maybe<Scalars['Int']['output']>;
  businessDeveloperDispatchContext?: Maybe<AffiliateBusinessDeveloperDispatchContext>;
  businessDeveloperIdSnapshot?: Maybe<Scalars['ID']['output']>;
  creatorRelationship: AffiliateCreatorRelationship;
  events: Array<AffiliateRelationshipTimelineItem>;
  involvedShopInstructions: Array<AffiliateInvolvedShopInstruction>;
  relationshipOperationalConfigRevision: Scalars['Int']['output'];
  targetEventCursor: Scalars['Int']['output'];
  truncated: Scalars['Boolean']['output'];
  workspace: AffiliateWorkspacePayload;
}

export interface AffiliateConversationWindow {
  containsUnsupportedContent: Scalars['Boolean']['output'];
  coverage: AffiliateConversationWindowCoverage;
  creatorTurns: Array<AffiliateConversationWindowTurn>;
  includedCharacterCount: Scalars['Int']['output'];
  includedCreatorTurnCount: Scalars['Int']['output'];
  lastPendingRelationshipSequence: Scalars['Int']['output'];
  maxCharacterCount: Scalars['Int']['output'];
  maxCreatorTurnCount: Scalars['Int']['output'];
  resolvedThroughRelationshipSequence: Scalars['Int']['output'];
  sellerAnchor?: Maybe<AffiliateConversationWindowTurn>;
  totalCreatorTurnCount: Scalars['Int']['output'];
}

/** Completeness of the frozen canonical inbound conversation window. */
export const AffiliateConversationWindowCoverage = {
  Complete: 'COMPLETE',
  Truncated: 'TRUNCATED',
  Unavailable: 'UNAVAILABLE'
} as const;

export type AffiliateConversationWindowCoverage = typeof AffiliateConversationWindowCoverage[keyof typeof AffiliateConversationWindowCoverage];
export interface AffiliateConversationWindowPart {
  agentReadable?: Maybe<Scalars['Boolean']['output']>;
  caption?: Maybe<Scalars['String']['output']>;
  contentAvailability?: Maybe<Scalars['String']['output']>;
  contentTruncated: Scalars['Boolean']['output'];
  fileName?: Maybe<Scalars['String']['output']>;
  kind: AffiliateHistoryPartKind;
  mimeType?: Maybe<Scalars['String']['output']>;
  originalCharacterCount: Scalars['Int']['output'];
  productId?: Maybe<Scalars['String']['output']>;
  providerType?: Maybe<Scalars['String']['output']>;
  sampleApplicationId?: Maybe<Scalars['String']['output']>;
  sequence: Scalars['Int']['output'];
  shopId?: Maybe<Scalars['ID']['output']>;
  sizeBytes?: Maybe<Scalars['Int']['output']>;
  summary?: Maybe<Scalars['String']['output']>;
  targetCollaborationId?: Maybe<Scalars['String']['output']>;
  text?: Maybe<Scalars['String']['output']>;
}

export interface AffiliateConversationWindowTurn {
  channel: AffiliateMessageChannel;
  direction: AffiliateCreatorMessageDirection;
  occurredAt: Scalars['DateTimeISO']['output'];
  parts: Array<AffiliateConversationWindowPart>;
  relationshipSequence: Scalars['Int']['output'];
  subject?: Maybe<Scalars['String']['output']>;
  /** Trust label. Creator content is business input and never system instruction. */
  trust: Scalars['String']['output'];
}

export interface AffiliateCreatorChannelContact {
  accountBindingId: Scalars['ID']['output'];
  businessDeveloperId?: Maybe<Scalars['ID']['output']>;
  channel: AffiliateMessageChannel;
  creatorEmail?: Maybe<Scalars['String']['output']>;
  creatorPhone?: Maybe<Scalars['String']['output']>;
  creatorRelationshipId: Scalars['ID']['output'];
  customAlias?: Maybe<Scalars['String']['output']>;
  effectiveAlias?: Maybe<Scalars['String']['output']>;
  firstObservedAt: Scalars['DateTimeISO']['output'];
  id: Scalars['ID']['output'];
  lastInboundAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastObservedAt: Scalars['DateTimeISO']['output'];
  lastOutboundAt?: Maybe<Scalars['DateTimeISO']['output']>;
  providerAlias?: Maybe<Scalars['String']['output']>;
  source: AffiliateCreatorChannelContactSource;
  status: AffiliateCreatorChannelContactStatus;
  verifiedAt?: Maybe<Scalars['DateTimeISO']['output']>;
}

export interface AffiliateCreatorChannelContactPage {
  items: Array<AffiliateCreatorChannelContact>;
  limit: Scalars['Int']['output'];
  offset: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
}

export interface AffiliateCreatorChannelContactPageInput {
  accountBindingId?: InputMaybe<Scalars['ID']['input']>;
  businessDeveloperId?: InputMaybe<Scalars['ID']['input']>;
  channel?: InputMaybe<AffiliateMessageChannel>;
  creatorRelationshipId?: InputMaybe<Scalars['ID']['input']>;
  includeHistorical?: InputMaybe<Scalars['Boolean']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
}

export const AffiliateCreatorChannelContactSource = {
  AgentAction: 'AGENT_ACTION',
  ChannelWebhook: 'CHANNEL_WEBHOOK',
  Import: 'IMPORT',
  LegacyMigration: 'LEGACY_MIGRATION',
  MessageHistory: 'MESSAGE_HISTORY',
  StaffInput: 'STAFF_INPUT'
} as const;

export type AffiliateCreatorChannelContactSource = typeof AffiliateCreatorChannelContactSource[keyof typeof AffiliateCreatorChannelContactSource];
export const AffiliateCreatorChannelContactStatus = {
  Active: 'ACTIVE',
  Historical: 'HISTORICAL',
  Invalid: 'INVALID',
  Unresolved: 'UNRESOLVED'
} as const;

export type AffiliateCreatorChannelContactStatus = typeof AffiliateCreatorChannelContactStatus[keyof typeof AffiliateCreatorChannelContactStatus];
/** Canonical platform Open/Target Collaborations for one CreatorRelationship across the seller's authorized shops. */
export interface AffiliateCreatorCollaborationListPayload {
  complete: Scalars['Boolean']['output'];
  coverageComplete: Scalars['Boolean']['output'];
  creatorOpenId: Scalars['String']['output'];
  currentStatus: AffiliateOperationalProjectionStatus;
  historyCutoffAt?: Maybe<Scalars['DateTimeISO']['output']>;
  historyStatus: AffiliateOperationalProjectionStatus;
  items: Array<AffiliateCollaboration>;
  lastHeadSyncAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastHistorySyncAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastSuccessfulSyncAt?: Maybe<Scalars['DateTimeISO']['output']>;
  oldestCoveredAt?: Maybe<Scalars['DateTimeISO']['output']>;
  projectionStatus: AffiliateOperationalProjectionStatus;
  providerWindowLimited: Scalars['Boolean']['output'];
  readAt: Scalars['DateTimeISO']['output'];
  shopCoverage: Array<AffiliateOperationalProjectionShopCoverage>;
  source: AffiliateProviderReadSource;
  username?: Maybe<Scalars['String']['output']>;
}

export interface AffiliateCreatorContactStateInput {
  /** CreatorRelationship is the business boundary for affiliate contact state. Do not pass raw channel or creator identity ids as the primary lookup. */
  creatorRelationshipId: Scalars['ID']['input'];
}

export interface AffiliateCreatorContactStatePayload {
  businessDeveloper?: Maybe<AffiliateBusinessDeveloper>;
  channelContacts: Array<AffiliateCreatorChannelContact>;
  creatorRelationship: AffiliateCreatorRelationship;
  defaultOutboundChannel: AffiliateMessageChannel;
  emailAccounts: Array<EmailAccountBinding>;
  hasUsableEmailContact: Scalars['Boolean']['output'];
  hasUsableWhatsAppContact: Scalars['Boolean']['output'];
  preferredEmailAccount?: Maybe<EmailAccountBinding>;
  preferredWhatsAppAccount?: Maybe<WhatsAppAccountBinding>;
  whatsAppAccounts: Array<WhatsAppAccountBinding>;
}

/** Platform Creator identity and display profile. Dynamic performance is exposed separately by market. */
export interface AffiliateCreatorIdentity {
  avatarUrl?: Maybe<Scalars['String']['output']>;
  bioDescription?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTimeISO']['output'];
  creatorImId?: Maybe<Scalars['String']['output']>;
  creatorOpenId?: Maybe<Scalars['String']['output']>;
  currentPerformance: Array<AffiliateCreatorPerformanceCurrent>;
  firstObservedAt: Scalars['DateTimeISO']['output'];
  id: Scalars['ID']['output'];
  lastObservedAt: Scalars['DateTimeISO']['output'];
  nickname?: Maybe<Scalars['String']['output']>;
  platform: ShopPlatform;
  profileTtUri?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTimeISO']['output'];
  username?: Maybe<Scalars['String']['output']>;
}

/** Shop-scoped Creator relationship row with market-specific profile, work, proposal, and sample context. */
export interface AffiliateCreatorManagementItem {
  activeCollaborationCount: Scalars['Int']['output'];
  activeSampleApplicationCount: Scalars['Int']['output'];
  creatorId: Scalars['ID']['output'];
  creatorPerformance?: Maybe<AffiliateCreatorPerformanceCurrent>;
  creatorProfile?: Maybe<AffiliateCreatorIdentity>;
  creatorRelation?: Maybe<AffiliateCreatorRelationship>;
  lastInteractionAt?: Maybe<Scalars['DateTimeISO']['output']>;
  latestAffiliateCollaboration?: Maybe<AffiliateCollaboration>;
  latestPendingProposal?: Maybe<ActionProposal>;
  latestSampleApplicationRecord?: Maybe<SampleApplicationRecord>;
  market?: Maybe<Scalars['String']['output']>;
  needsAttention: Scalars['Boolean']['output'];
  shopState?: Maybe<AffiliateCreatorRelationshipShopState>;
  tagIds: Array<Scalars['ID']['output']>;
  tags: Array<CreatorTag>;
}

/** Server-paginated, shop-scoped Creator relationship management page. */
export interface AffiliateCreatorManagementPage {
  hasMore: Scalars['Boolean']['output'];
  items: Array<AffiliateCreatorManagementItem>;
  limit: Scalars['Int']['output'];
  offset: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
}

/** Direction of an observed affiliate IM message. */
export const AffiliateCreatorMessageDirection = {
  Creator: 'CREATOR',
  Seller: 'SELLER',
  System: 'SYSTEM'
} as const;

export type AffiliateCreatorMessageDirection = typeof AffiliateCreatorMessageDirection[keyof typeof AffiliateCreatorMessageDirection];
export interface AffiliateCreatorMessageHistoryInput {
  /** Optional business channel filter. This narrows the relationship-level timeline without exposing provider route ids. */
  channelFilter?: InputMaybe<Array<AffiliateMessageChannel>>;
  /** CreatorRelationship is the relationship-level timeline boundary. The response may include channel labels, but provider route ids are not input keys. */
  creatorRelationshipId: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
}

/** Relationship-level affiliate creator message with channel labels across platform chat, WhatsApp, Outlook email, and delivery records. */
export interface AffiliateCreatorMessageHistoryItem {
  accountLabel?: Maybe<Scalars['String']['output']>;
  channel: AffiliateMessageChannel;
  channelLabel?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['DateTimeISO']['output']>;
  deliveryStatus?: Maybe<AffiliateDeliveryStatus>;
  direction?: Maybe<AffiliateCreatorMessageDirection>;
  messageRef: Scalars['String']['output'];
  messageType?: Maybe<Scalars['String']['output']>;
  parts: Array<AffiliateHistoryPart>;
  shopId?: Maybe<Scalars['ID']['output']>;
  shopName?: Maybe<Scalars['String']['output']>;
  source: Scalars['String']['output'];
  subject?: Maybe<Scalars['String']['output']>;
}

/** Merged relationship-level affiliate creator chat history across channels. */
export interface AffiliateCreatorMessageHistoryPayload {
  creatorRelationship: AffiliateCreatorRelationship;
  hasMore: Scalars['Boolean']['output'];
  items: Array<AffiliateCreatorMessageHistoryItem>;
  limit: Scalars['Int']['output'];
  nextOffset?: Maybe<Scalars['Int']['output']>;
  offset: Scalars['Int']['output'];
}

/** Latest typed Creator Performance projection for one market. */
export interface AffiliateCreatorPerformanceCurrent {
  averageVideoViews?: Maybe<Scalars['Float']['output']>;
  categoryIds: Array<Scalars['String']['output']>;
  contentWindow?: Maybe<Scalars['String']['output']>;
  engagementRate?: Maybe<Scalars['Float']['output']>;
  followerCount?: Maybe<Scalars['Int']['output']>;
  gmv?: Maybe<AffiliateCreatorPerformanceMoneyMetric>;
  gpm?: Maybe<AffiliateCreatorPerformanceMoneyMetric>;
  id: Scalars['ID']['output'];
  liveCount?: Maybe<Scalars['Int']['output']>;
  liveGmv?: Maybe<AffiliateCreatorPerformanceMoneyMetric>;
  market: Scalars['String']['output'];
  observedAt: Scalars['DateTimeISO']['output'];
  pps?: Maybe<Scalars['Float']['output']>;
  preciseDataAuthorized: Scalars['Boolean']['output'];
  ratingScore?: Maybe<Scalars['Float']['output']>;
  sourceShopId: Scalars['ID']['output'];
  sourceType: Scalars['String']['output'];
  unitsSold?: Maybe<Scalars['Int']['output']>;
  videoCount?: Maybe<Scalars['Int']['output']>;
  videoGmv?: Maybe<AffiliateCreatorPerformanceMoneyMetric>;
}

/** Market-scoped Creator Performance money metric with explicit window and precision. */
export interface AffiliateCreatorPerformanceMoneyMetric {
  amount?: Maybe<Scalars['Float']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  maximumAmount?: Maybe<Scalars['Float']['output']>;
  minimumAmount?: Maybe<Scalars['Float']['output']>;
  precision: Scalars['String']['output'];
  window: Scalars['String']['output'];
}

export interface AffiliateCreatorProductFitInput {
  /** Optional Backend AffiliateCreatorIdentity id. When omitted, backend derives it from creatorRelationshipId. */
  creatorId?: InputMaybe<Scalars['ID']['input']>;
  /** Optional TikTok creator_open_id. When provided, it must match the CreatorRelationship's creator identity. */
  creatorOpenId?: InputMaybe<Scalars['String']['input']>;
  /** CreatorRelationship is the business boundary for this prediction evidence request. The prediction is evidence for the relationship-scoped Desktop Agent, not a standalone backend decision. */
  creatorRelationshipId: Scalars['ID']['input'];
  /** Optional TikTok Shop sample application id. Omit it when sampleApplicationRecordId is available; Backend resolves and validates the Provider id. */
  platformApplicationId?: InputMaybe<Scalars['String']['input']>;
  /** TikTok Shop product id to evaluate as a candidate collaboration product. This does not bind the product to any collaboration record. */
  productId: Scalars['String']['input'];
  /** Backend SampleApplicationRecord id when the prediction evidence is for a concrete sample review. */
  sampleApplicationRecordId?: InputMaybe<Scalars['ID']['input']>;
  /** Prediction scenario. Defaults to CREATOR_PROSPECTING for creator-product fit checks from affiliate chat. */
  scenario?: InputMaybe<AffiliateExpectedSalesPredictionScenario>;
  shopId: Scalars['ID']['input'];
}

/** Agent-facing creator-product fit result for affiliate chat/card decisions. It reuses the expected-sales prediction model and does not mutate collaboration product context. */
export interface AffiliateCreatorProductFitPayload {
  decisionThresholds?: Maybe<AffiliateDecisionThresholds>;
  /** Plain-language merchant interpretation for agent reasoning. This is explanatory only; the agent still decides how to respond. */
  merchantInterpretation?: Maybe<Scalars['String']['output']>;
  prediction?: Maybe<AffiliateExpectedSalesSubjectPrediction>;
  predictionPayload: AffiliateExpectedSalesPredictionPayload;
  productSummary?: Maybe<EcomProductSummary>;
}

/** Whether Creator profile data was already fresh, refreshed on demand, or returned stale after a failed refresh. */
export const AffiliateCreatorProfileFreshnessStatus = {
  Fresh: 'FRESH',
  Refreshed: 'REFRESHED',
  StaleRefreshFailed: 'STALE_REFRESH_FAILED'
} as const;

export type AffiliateCreatorProfileFreshnessStatus = typeof AffiliateCreatorProfileFreshnessStatus[keyof typeof AffiliateCreatorProfileFreshnessStatus];
export interface AffiliateCreatorProfileInput {
  creatorRelationshipId: Scalars['ID']['input'];
  preferredShopId?: InputMaybe<Scalars['ID']['input']>;
}

export interface AffiliateCreatorProfilePayload {
  creator: AffiliateCreatorIdentity;
  dataUpdatedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  freshnessStatus: AffiliateCreatorProfileFreshnessStatus;
  market: Scalars['String']['output'];
  performance?: Maybe<AffiliateCreatorPerformanceCurrent>;
  refreshAttemptedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  refreshErrorCode?: Maybe<Scalars['String']['output']>;
  refreshErrorMessage?: Maybe<Scalars['String']['output']>;
  refreshShopId?: Maybe<Scalars['ID']['output']>;
}

export interface AffiliateCreatorProtection {
  businessDeveloperId?: Maybe<Scalars['ID']['output']>;
  createdAt: Scalars['DateTimeISO']['output'];
  creatorId?: Maybe<Scalars['ID']['output']>;
  creatorOpenId?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  importBatchId?: Maybe<Scalars['String']['output']>;
  note?: Maybe<Scalars['String']['output']>;
  platform: ShopPlatform;
  source: AffiliateCreatorProtectionSource;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['ID']['output'];
  username?: Maybe<Scalars['String']['output']>;
}

export interface AffiliateCreatorProtectionBusinessDeveloperCount {
  businessDeveloperId?: Maybe<Scalars['ID']['output']>;
  count: Scalars['Int']['output'];
}

export interface AffiliateCreatorProtectionPage {
  businessDeveloperCounts: Array<AffiliateCreatorProtectionBusinessDeveloperCount>;
  items: Array<AffiliateCreatorProtection>;
  limit: Scalars['Int']['output'];
  offset: Scalars['Int']['output'];
  resolvedCount: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
  unresolvedCount: Scalars['Int']['output'];
}

export interface AffiliateCreatorProtectionPageInput {
  businessDeveloperId?: InputMaybe<Scalars['ID']['input']>;
  creatorId?: InputMaybe<Scalars['ID']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  resolution?: InputMaybe<AffiliateCreatorProtectionResolution>;
  search?: InputMaybe<Scalars['String']['input']>;
}

export interface AffiliateCreatorProtectionRejectedRow {
  index: Scalars['Int']['output'];
  reason: Scalars['String']['output'];
}

export interface AffiliateCreatorProtectionRemovalPayload {
  creatorId?: Maybe<Scalars['ID']['output']>;
  creatorRelationshipId?: Maybe<Scalars['ID']['output']>;
  redispatchScheduled: Scalars['Boolean']['output'];
  removedId?: Maybe<Scalars['ID']['output']>;
}

export const AffiliateCreatorProtectionResolution = {
  Resolved: 'RESOLVED',
  Unresolved: 'UNRESOLVED'
} as const;

export type AffiliateCreatorProtectionResolution = typeof AffiliateCreatorProtectionResolution[keyof typeof AffiliateCreatorProtectionResolution];
export const AffiliateCreatorProtectionSource = {
  Import: 'IMPORT',
  Staff: 'STAFF'
} as const;

export type AffiliateCreatorProtectionSource = typeof AffiliateCreatorProtectionSource[keyof typeof AffiliateCreatorProtectionSource];
/** User-scoped creator relationship. Shop-specific lifecycle and tags are embedded because a user's shop count is bounded. */
export interface AffiliateCreatorRelationship {
  activeAffiliateCollaborationIds: Array<Scalars['ID']['output']>;
  activeRunBaseCheckpointId?: Maybe<Scalars['String']['output']>;
  activeRunBaseEventCursor?: Maybe<Scalars['Int']['output']>;
  activeRunBusinessDeveloperConfigRevision?: Maybe<Scalars['Int']['output']>;
  activeRunBusinessDeveloperId?: Maybe<Scalars['ID']['output']>;
  activeRunId?: Maybe<Scalars['String']['output']>;
  activeRunOperationalConfigRevision?: Maybe<Scalars['Int']['output']>;
  activeSampleApplicationRecordIds: Array<Scalars['ID']['output']>;
  agendaItems?: Maybe<Array<AffiliateRelationshipAgendaItem>>;
  blocked: Scalars['Boolean']['output'];
  /** When blocked=true and this list is empty, the user-level block applies to all current/future shops. */
  blockedShopIds: Array<Scalars['ID']['output']>;
  businessDeveloperId?: Maybe<Scalars['ID']['output']>;
  committedCheckpointAt?: Maybe<Scalars['DateTimeISO']['output']>;
  committedCheckpointId?: Maybe<Scalars['String']['output']>;
  committedEventCursor?: Maybe<Scalars['Int']['output']>;
  createdAt: Scalars['DateTimeISO']['output'];
  creatorId: Scalars['ID']['output'];
  creatorImId?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  lastAgentHandledAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastBlockedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastInboundAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastInboundChannel?: Maybe<AffiliateMessageChannel>;
  lastInboundLifecycleEventId?: Maybe<Scalars['ID']['output']>;
  lastOutboundAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastPlatformSyncedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lifecycleEventSequence?: Maybe<Scalars['Int']['output']>;
  operationalConfigRevision: Scalars['Int']['output'];
  shopStates: Array<AffiliateCreatorRelationshipShopState>;
  stateUpdatedAt: Scalars['DateTimeISO']['output'];
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['ID']['output'];
  workSummary?: Maybe<AffiliateRelationshipWorkSummary>;
}

export interface AffiliateCreatorRelationshipDetailCounts {
  activePlatformCollaborationCount: Scalars['Int']['output'];
  activeSampleApplicationCount: Scalars['Int']['output'];
  agendaItemCount: Scalars['Int']['output'];
  lifecycleEventCount: Scalars['Int']['output'];
  pendingProposalCount: Scalars['Int']['output'];
  platformCollaborationCount: Scalars['Int']['output'];
  proposalCount: Scalars['Int']['output'];
  sampleApplicationCount: Scalars['Int']['output'];
}

export interface AffiliateCreatorRelationshipDetailInput {
  creatorRelationshipId: Scalars['ID']['input'];
}

/** Canonical user-level CreatorRelationship summary. Historical entities are read through their dedicated pages. */
export interface AffiliateCreatorRelationshipDetailPayload {
  businessDeveloper?: Maybe<AffiliateBusinessDeveloper>;
  counts: AffiliateCreatorRelationshipDetailCounts;
  creator: AffiliateCreatorIdentity;
  creatorRelationship: AffiliateCreatorRelationship;
  includedShopIds: Array<Scalars['ID']['output']>;
  lastBusinessActivityAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastContactedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  performance?: Maybe<AffiliateCreatorPerformanceCurrent>;
  protection?: Maybe<AffiliateCreatorProtection>;
  shopActivitySummaries: Array<AffiliateCreatorRelationshipShopActivitySummary>;
}

/** Canonical contact and business activity summary for one shop in a CreatorRelationship. */
export interface AffiliateCreatorRelationshipShopActivitySummary {
  agendaItemCount: Scalars['Int']['output'];
  lastBusinessActivityAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastContactedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  pendingProposalCount: Scalars['Int']['output'];
  platformCollaborationCount: Scalars['Int']['output'];
  sampleApplicationCount: Scalars['Int']['output'];
  shopId: Scalars['ID']['output'];
}

/** Embedded shop membership, tags, and activity timestamps for a user-level creator relation. */
export interface AffiliateCreatorRelationshipShopState {
  lastContactedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastInvitedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastQualifiedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  shopId: Scalars['ID']['output'];
  tagIds: Array<Scalars['ID']['output']>;
}

/** Current relationship and BD configuration for Agent reads. Creator profile facts are available only through affiliate_get_creator_profile. */
export interface AffiliateCreatorRelationshipStatePayload {
  businessDeveloper?: Maybe<AffiliateBusinessDeveloper>;
  observedAt: Scalars['DateTimeISO']['output'];
  relationship: AffiliateCreatorRelationship;
  source: AffiliateProviderReadSource;
}

/** Mongo operational Sample Application projection for one CreatorRelationship across the seller's authorized shops. */
export interface AffiliateCreatorSampleApplicationListPayload {
  complete: Scalars['Boolean']['output'];
  coverageComplete: Scalars['Boolean']['output'];
  creatorOpenId: Scalars['String']['output'];
  currentStatus: AffiliateOperationalProjectionStatus;
  historyCutoffAt?: Maybe<Scalars['DateTimeISO']['output']>;
  historyStatus: AffiliateOperationalProjectionStatus;
  items: Array<SampleApplicationRecord>;
  lastHeadSyncAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastHistorySyncAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastSuccessfulSyncAt?: Maybe<Scalars['DateTimeISO']['output']>;
  oldestCoveredAt?: Maybe<Scalars['DateTimeISO']['output']>;
  projectionStatus: AffiliateOperationalProjectionStatus;
  providerWindowLimited: Scalars['Boolean']['output'];
  readAt: Scalars['DateTimeISO']['output'];
  shopCoverage: Array<AffiliateOperationalProjectionShopCoverage>;
  source: AffiliateProviderReadSource;
  username?: Maybe<Scalars['String']['output']>;
}

/** Shop-level affiliate decision references. They inform Agent judgment but do not directly approve or reject a Sample Application. */
export interface AffiliateDecisionThresholds {
  /** Default shop reference line for an available Creator-product expected-sales prediction. It is not an automatic Sample decision. Deterministic Campaign filtering requires an explicit Campaign selection-policy threshold. */
  minExpectedSalesUnits?: Maybe<Scalars['Float']['output']>;
}

export interface AffiliateDecisionThresholdsInput {
  /** Default shop reference line for an available Creator-product expected-sales prediction. It is not an automatic Sample decision. Deterministic Campaign filtering requires an explicit Campaign selection-policy threshold. */
  minExpectedSalesUnits?: InputMaybe<Scalars['Float']['input']>;
}

/** How the outbound Affiliate delivery channel was selected */
export const AffiliateDeliveryChannelSelectionSource = {
  AgentOverride: 'AGENT_OVERRIDE',
  RelationshipDefault: 'RELATIONSHIP_DEFAULT',
  TriggerChannel: 'TRIGGER_CHANNEL'
} as const;

export type AffiliateDeliveryChannelSelectionSource = typeof AffiliateDeliveryChannelSelectionSource[keyof typeof AffiliateDeliveryChannelSelectionSource];
export const AffiliateDeliveryPartStatus = {
  Failed: 'FAILED',
  Queued: 'QUEUED',
  Sent: 'SENT',
  Skipped: 'SKIPPED',
  Submitted: 'SUBMITTED'
} as const;

export type AffiliateDeliveryPartStatus = typeof AffiliateDeliveryPartStatus[keyof typeof AffiliateDeliveryPartStatus];
/** Source of an affiliate creator-facing message delivery */
export const AffiliateDeliverySource = {
  AgentAction: 'AGENT_ACTION',
  CampaignFirstTouch: 'CAMPAIGN_FIRST_TOUCH',
  HumanManual: 'HUMAN_MANUAL',
  System: 'SYSTEM'
} as const;

export type AffiliateDeliverySource = typeof AffiliateDeliverySource[keyof typeof AffiliateDeliverySource];
/** Delivery lifecycle for an affiliate creator-facing message */
export const AffiliateDeliveryStatus = {
  Cancelled: 'CANCELLED',
  Failed: 'FAILED',
  PartiallySent: 'PARTIALLY_SENT',
  Queued: 'QUEUED',
  Sent: 'SENT',
  Submitted: 'SUBMITTED'
} as const;

export type AffiliateDeliveryStatus = typeof AffiliateDeliveryStatus[keyof typeof AffiliateDeliveryStatus];
export const AffiliateEmailAttachmentDisposition = {
  Attachment: 'ATTACHMENT',
  Inline: 'INLINE'
} as const;

export type AffiliateEmailAttachmentDisposition = typeof AffiliateEmailAttachmentDisposition[keyof typeof AffiliateEmailAttachmentDisposition];
export interface AffiliateExpectedSalesAutomaticSelection {
  dataFoundationLevel?: Maybe<Scalars['String']['output']>;
  effectiveTenantScope?: Maybe<Scalars['String']['output']>;
  evaluationSampleCount: Scalars['Int']['output'];
  outperformanceProbability?: Maybe<Scalars['Float']['output']>;
  requestedTenantScope?: Maybe<Scalars['String']['output']>;
  selectionBasis: Scalars['String']['output'];
}

/** One evaluated step of serving's quality-seeking Expected Sales scope chain (shop -> region -> user). Audit data; artifactFound=true with a reason means the artifact exists but is invalid. */
export interface AffiliateExpectedSalesEvaluatedScope {
  artifactFound: Scalars['Boolean']['output'];
  expectedSalesReliability?: Maybe<AffiliateExpectedSalesReliability>;
  reason?: Maybe<AffiliateExpectedSalesScopeEvaluationReason>;
  reliabilityReasons?: Maybe<Array<Scalars['String']['output']>>;
  tenantId?: Maybe<Scalars['String']['output']>;
  tenantScope?: Maybe<AffiliateExpectedSalesTenantScope>;
}

export const AffiliateExpectedSalesFeatureTemporalBasis = {
  BestAvailable: 'BEST_AVAILABLE',
  CurrentStateProxy: 'CURRENT_STATE_PROXY',
  DecisionTime: 'DECISION_TIME'
} as const;

export type AffiliateExpectedSalesFeatureTemporalBasis = typeof AffiliateExpectedSalesFeatureTemporalBasis[keyof typeof AffiliateExpectedSalesFeatureTemporalBasis];
export interface AffiliateExpectedSalesMissingField {
  field: Scalars['String']['output'];
  reason: Scalars['String']['output'];
}

export interface AffiliateExpectedSalesModelSelection {
  effectiveTenantId?: Maybe<Scalars['String']['output']>;
  effectiveTenantScope?: Maybe<AffiliateExpectedSalesTenantScope>;
  /** Serving's evaluated scope chain; EXPECTED_SALES selections only. */
  evaluatedScopes?: Maybe<Array<AffiliateExpectedSalesEvaluatedScope>>;
  /** Only populated for EXPECTED_SALES selections; null for Human Decision and for sources that predate the signal. */
  expectedSalesReliability?: Maybe<AffiliateExpectedSalesReliability>;
  featureTemporalBasis?: Maybe<AffiliateExpectedSalesFeatureTemporalBasis>;
  modelStage?: Maybe<AffiliateExpectedSalesModelStage>;
  modelStatus?: Maybe<Scalars['String']['output']>;
  modelVersion?: Maybe<AffiliateExpectedSalesModelVersion>;
  /** Stable reason codes from the artifact's serving_reliability (ADR-059), passed through verbatim; empty when TRUSTED. */
  reliabilityReasons?: Maybe<Array<Scalars['String']['output']>>;
  requestedTenantId?: Maybe<Scalars['String']['output']>;
  requestedTenantScope?: Maybe<AffiliateExpectedSalesTenantScope>;
}

export const AffiliateExpectedSalesModelStage = {
  Unified: 'UNIFIED'
} as const;

export type AffiliateExpectedSalesModelStage = typeof AffiliateExpectedSalesModelStage[keyof typeof AffiliateExpectedSalesModelStage];
export interface AffiliateExpectedSalesModelVersion {
  bentomlTag?: Maybe<Scalars['String']['output']>;
  contractHash?: Maybe<Scalars['String']['output']>;
  featureVersion?: Maybe<Scalars['String']['output']>;
  modelFamily?: Maybe<Scalars['String']['output']>;
  modelStage?: Maybe<AffiliateExpectedSalesModelStage>;
  modelVersionKey?: Maybe<Scalars['String']['output']>;
  tenantId?: Maybe<Scalars['String']['output']>;
  tenantModelName?: Maybe<Scalars['String']['output']>;
  tenantScope?: Maybe<Scalars['String']['output']>;
  trainedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  trainingIndex?: Maybe<Scalars['Int']['output']>;
  trainingRunId?: Maybe<Scalars['String']['output']>;
}

export interface AffiliateExpectedSalesPredictionBucket {
  actualAvgUnits?: Maybe<Scalars['Float']['output']>;
  actualMedianUnits?: Maybe<Scalars['Float']['output']>;
  actualP25Units?: Maybe<Scalars['Float']['output']>;
  actualP75Units?: Maybe<Scalars['Float']['output']>;
  actualP90Units?: Maybe<Scalars['Float']['output']>;
  actualZeroRate?: Maybe<Scalars['Float']['output']>;
  bucketIndex?: Maybe<Scalars['Int']['output']>;
  sampleCount?: Maybe<Scalars['Int']['output']>;
  scoreMax?: Maybe<Scalars['Float']['output']>;
  scoreMin?: Maybe<Scalars['Float']['output']>;
}

export interface AffiliateExpectedSalesPredictionContextInput {
  affiliateCollaborationId?: InputMaybe<Scalars['ID']['input']>;
  campaignId?: InputMaybe<Scalars['ID']['input']>;
  platformCollaborationId?: InputMaybe<Scalars['String']['input']>;
  productId?: InputMaybe<Scalars['String']['input']>;
}

export interface AffiliateExpectedSalesPredictionInput {
  context?: InputMaybe<AffiliateExpectedSalesPredictionContextInput>;
  scenario: AffiliateExpectedSalesPredictionScenario;
  shopId: Scalars['ID']['input'];
  subjects: Array<AffiliateExpectedSalesPredictionSubjectInput>;
}

export interface AffiliateExpectedSalesPredictionInterval {
  confidenceLevel?: Maybe<Scalars['Float']['output']>;
  interpretation?: Maybe<Scalars['String']['output']>;
  lowerExpectedSalesUnits?: Maybe<Scalars['Float']['output']>;
  method?: Maybe<Scalars['String']['output']>;
  upperExpectedSalesUnits?: Maybe<Scalars['Float']['output']>;
}

export interface AffiliateExpectedSalesPredictionPayload {
  effectiveTenantId?: Maybe<Scalars['String']['output']>;
  effectiveTenantScope?: Maybe<AffiliateExpectedSalesTenantScope>;
  expectedSales?: Maybe<AffiliateExpectedSalesModelSelection>;
  /** Raw arithmetic expectation of attributed units through Sample terminal, conditional on approval. */
  expectedSalesUnits?: Maybe<Scalars['Float']['output']>;
  featureTemporalBasis?: Maybe<AffiliateExpectedSalesFeatureTemporalBasis>;
  featureVersion?: Maybe<Scalars['String']['output']>;
  humanDecision?: Maybe<AffiliateExpectedSalesModelSelection>;
  modelMetadata?: Maybe<AffiliateExpectedSalesModelVersion>;
  modelStage?: Maybe<AffiliateExpectedSalesModelStage>;
  modelStatus?: Maybe<Scalars['String']['output']>;
  modelTag?: Maybe<Scalars['String']['output']>;
  modelType?: Maybe<Scalars['String']['output']>;
  modelVersion?: Maybe<Scalars['String']['output']>;
  predictions: Array<AffiliateExpectedSalesSubjectPrediction>;
  requestId?: Maybe<Scalars['String']['output']>;
  requestedTenantId?: Maybe<Scalars['String']['output']>;
  requestedTenantScope?: Maybe<AffiliateExpectedSalesTenantScope>;
  status: AffiliateExpectedSalesPredictionStatus;
  trainedAt?: Maybe<Scalars['DateTimeISO']['output']>;
}

export interface AffiliateExpectedSalesPredictionQuality {
  dataSupportScore?: Maybe<Scalars['Float']['output']>;
  featureCompletenessScore?: Maybe<Scalars['Float']['output']>;
  interpretation?: Maybe<Scalars['String']['output']>;
  level?: Maybe<Scalars['String']['output']>;
  predictionBucketSupportScore?: Maybe<Scalars['Float']['output']>;
  probabilityMarginScore?: Maybe<Scalars['Float']['output']>;
  score?: Maybe<Scalars['Float']['output']>;
}

export const AffiliateExpectedSalesPredictionScenario = {
  CreatorProspecting: 'CREATOR_PROSPECTING',
  RelationshipProductIntent: 'RELATIONSHIP_PRODUCT_INTENT',
  SampleReview: 'SAMPLE_REVIEW'
} as const;

export type AffiliateExpectedSalesPredictionScenario = typeof AffiliateExpectedSalesPredictionScenario[keyof typeof AffiliateExpectedSalesPredictionScenario];
export const AffiliateExpectedSalesPredictionStatus = {
  DataNotReady: 'DATA_NOT_READY',
  FeatureContractError: 'FEATURE_CONTRACT_ERROR',
  FeatureVersionMismatch: 'FEATURE_VERSION_MISMATCH',
  InvalidInput: 'INVALID_INPUT',
  ModelUpgrading: 'MODEL_UPGRADING',
  Ok: 'OK',
  Partial: 'PARTIAL',
  ServiceUnavailable: 'SERVICE_UNAVAILABLE'
} as const;

export type AffiliateExpectedSalesPredictionStatus = typeof AffiliateExpectedSalesPredictionStatus[keyof typeof AffiliateExpectedSalesPredictionStatus];
export interface AffiliateExpectedSalesPredictionSubjectInput {
  affiliateCollaborationId?: InputMaybe<Scalars['ID']['input']>;
  campaignId?: InputMaybe<Scalars['ID']['input']>;
  creatorCandidateId?: InputMaybe<Scalars['ID']['input']>;
  creatorId?: InputMaybe<Scalars['ID']['input']>;
  creatorOpenId?: InputMaybe<Scalars['String']['input']>;
  platformApplicationId?: InputMaybe<Scalars['String']['input']>;
  platformCollaborationId?: InputMaybe<Scalars['String']['input']>;
  productId?: InputMaybe<Scalars['String']['input']>;
  sampleApplicationRecordId?: InputMaybe<Scalars['ID']['input']>;
}

export interface AffiliateExpectedSalesPredictionValidation {
  hardErrorCount: Scalars['Int']['output'];
  hardErrors: Array<AffiliateExpectedSalesValidationIssue>;
  softWarningCount: Scalars['Int']['output'];
  softWarnings: Array<AffiliateExpectedSalesValidationIssue>;
  status?: Maybe<Scalars['String']['output']>;
}

/** Expected Sales artifact reliability, consumed verbatim from the artifact's versioned serving_reliability object (ADR-059). The training/publication side is the sole source of truth; serving and backend never re-derive it. */
export const AffiliateExpectedSalesReliability = {
  Degraded: 'DEGRADED',
  Trusted: 'TRUSTED'
} as const;

export type AffiliateExpectedSalesReliability = typeof AffiliateExpectedSalesReliability[keyof typeof AffiliateExpectedSalesReliability];
export interface AffiliateExpectedSalesResolvedContext {
  affiliateCollaborationId?: Maybe<Scalars['ID']['output']>;
  campaignId?: Maybe<Scalars['ID']['output']>;
  creatorId?: Maybe<Scalars['ID']['output']>;
  creatorNickname?: Maybe<Scalars['String']['output']>;
  creatorOpenId?: Maybe<Scalars['String']['output']>;
  creatorUsername?: Maybe<Scalars['String']['output']>;
  platformApplicationId?: Maybe<Scalars['String']['output']>;
  platformCollaborationId?: Maybe<Scalars['String']['output']>;
  productId?: Maybe<Scalars['String']['output']>;
  productTitle?: Maybe<Scalars['String']['output']>;
  sampleApplicationRecordId?: Maybe<Scalars['ID']['output']>;
  shopId: Scalars['ID']['output'];
  skuId?: Maybe<Scalars['String']['output']>;
  source?: Maybe<Scalars['String']['output']>;
}

/** Why one scope of serving's tenant chain did not serve. A closed vocabulary carrying no artifact paths, file names, or exception text. */
export const AffiliateExpectedSalesScopeEvaluationReason = {
  ArtifactInvalid: 'ARTIFACT_INVALID',
  ArtifactNotFound: 'ARTIFACT_NOT_FOUND',
  FeatureContractMismatch: 'FEATURE_CONTRACT_MISMATCH'
} as const;

export type AffiliateExpectedSalesScopeEvaluationReason = typeof AffiliateExpectedSalesScopeEvaluationReason[keyof typeof AffiliateExpectedSalesScopeEvaluationReason];
/** Canonical Expected Sales model signal. READY carries a value (kept even when DEGRADED); NOT_AVAILABLE strictly means no artifact exists; ERROR carries the real failure. */
export interface AffiliateExpectedSalesSignal {
  error?: Maybe<AffiliateModelSignalError>;
  family: AffiliateModelSignalFamily;
  selection: AffiliateModelSignalSelection;
  status: AffiliateModelSignalStatus;
  value?: Maybe<AffiliateExpectedSalesSignalValue>;
}

export interface AffiliateExpectedSalesSignalValue {
  percentile?: Maybe<Scalars['Float']['output']>;
  quality?: Maybe<AffiliateExpectedSalesPredictionQuality>;
  reliability: AffiliateExpectedSalesReliability;
  reliabilityReasons: Array<Scalars['String']['output']>;
  /** Raw arithmetic expectation of attributed units through Sample terminal, conditional on approval. */
  units: Scalars['Float']['output'];
}

export interface AffiliateExpectedSalesSubjectPrediction {
  /** Short-lived backend cache id for promoting this exact prediction into a persisted affiliate decision snapshot. */
  cacheId?: Maybe<Scalars['ID']['output']>;
  contractName?: Maybe<Scalars['String']['output']>;
  contractVersion?: Maybe<Scalars['String']['output']>;
  expectedSalesPercentile?: Maybe<Scalars['Float']['output']>;
  /** Raw arithmetic expectation of attributed units through Sample terminal, conditional on approval. */
  expectedSalesUnits?: Maybe<Scalars['Float']['output']>;
  featureAsOf?: Maybe<Scalars['DateTimeISO']['output']>;
  humanDecision?: Maybe<AffiliateHumanDecisionPrediction>;
  message?: Maybe<Scalars['String']['output']>;
  missingFields?: Maybe<Array<AffiliateExpectedSalesMissingField>>;
  predictionBucket?: Maybe<AffiliateExpectedSalesPredictionBucket>;
  /** Canonical per-family model-signal evidence; null when the request itself failed and no family signal was produced. */
  predictionEvidence?: Maybe<AffiliatePredictionEvidence>;
  predictionInterval?: Maybe<AffiliateExpectedSalesPredictionInterval>;
  predictionQuality?: Maybe<AffiliateExpectedSalesPredictionQuality>;
  resolvedContext?: Maybe<AffiliateExpectedSalesResolvedContext>;
  /** Per-subject REQUEST outcome only. Family availability lives exclusively on predictionEvidence. */
  status: AffiliateExpectedSalesSubjectPredictionStatus;
  subject: AffiliateExpectedSalesSubjectRef;
  thresholdPercentiles?: Maybe<AffiliateExpectedSalesThresholdPercentiles>;
  thresholdProbabilities?: Maybe<AffiliateExpectedSalesThresholdProbabilities>;
  validation?: Maybe<AffiliateExpectedSalesPredictionValidation>;
}

export const AffiliateExpectedSalesSubjectPredictionStatus = {
  DataNotReady: 'DATA_NOT_READY',
  FeatureContractError: 'FEATURE_CONTRACT_ERROR',
  FeatureVersionMismatch: 'FEATURE_VERSION_MISMATCH',
  InvalidContext: 'INVALID_CONTEXT',
  ModelUpgrading: 'MODEL_UPGRADING',
  Ok: 'OK',
  PredictionNotAvailable: 'PREDICTION_NOT_AVAILABLE',
  ServiceError: 'SERVICE_ERROR'
} as const;

export type AffiliateExpectedSalesSubjectPredictionStatus = typeof AffiliateExpectedSalesSubjectPredictionStatus[keyof typeof AffiliateExpectedSalesSubjectPredictionStatus];
export interface AffiliateExpectedSalesSubjectRef {
  affiliateCollaborationId?: Maybe<Scalars['ID']['output']>;
  campaignId?: Maybe<Scalars['ID']['output']>;
  creatorCandidateId?: Maybe<Scalars['ID']['output']>;
  creatorId?: Maybe<Scalars['ID']['output']>;
  creatorOpenId?: Maybe<Scalars['String']['output']>;
  platformApplicationId?: Maybe<Scalars['String']['output']>;
  platformCollaborationId?: Maybe<Scalars['String']['output']>;
  productId?: Maybe<Scalars['String']['output']>;
  sampleApplicationRecordId?: Maybe<Scalars['ID']['output']>;
}

export const AffiliateExpectedSalesTenantScope = {
  Region: 'REGION',
  Shop: 'SHOP',
  User: 'USER'
} as const;

export type AffiliateExpectedSalesTenantScope = typeof AffiliateExpectedSalesTenantScope[keyof typeof AffiliateExpectedSalesTenantScope];
export interface AffiliateExpectedSalesThresholdPercentile {
  percentile?: Maybe<Scalars['Float']['output']>;
  topPercent?: Maybe<Scalars['Float']['output']>;
}

export interface AffiliateExpectedSalesThresholdPercentiles {
  unitsGe1?: Maybe<AffiliateExpectedSalesThresholdPercentile>;
  unitsGe2?: Maybe<AffiliateExpectedSalesThresholdPercentile>;
  unitsGe3?: Maybe<AffiliateExpectedSalesThresholdPercentile>;
  unitsGe5?: Maybe<AffiliateExpectedSalesThresholdPercentile>;
  unitsGe10?: Maybe<AffiliateExpectedSalesThresholdPercentile>;
}

/** Tail probabilities for realized sales. Each unitsGeN field means P(realized sales units >= N), never P(units < N). */
export interface AffiliateExpectedSalesThresholdProbabilities {
  /** Probability of reaching at least 1 realized sales unit: P(units >= 1). For example, 0.008 means a 0.8% chance of reaching one or more units, not a 0.8% chance of staying below one unit. */
  unitsGe1?: Maybe<Scalars['Float']['output']>;
  /** Probability of reaching at least 2 realized sales units: P(units >= 2). */
  unitsGe2?: Maybe<Scalars['Float']['output']>;
  /** Probability of reaching at least 3 realized sales units: P(units >= 3). */
  unitsGe3?: Maybe<Scalars['Float']['output']>;
  /** Probability of reaching at least 5 realized sales units: P(units >= 5). */
  unitsGe5?: Maybe<Scalars['Float']['output']>;
  /** Probability of reaching at least 10 realized sales units: P(units >= 10). */
  unitsGe10?: Maybe<Scalars['Float']['output']>;
}

export interface AffiliateExpectedSalesValidationIssue {
  code?: Maybe<Scalars['String']['output']>;
  field?: Maybe<Scalars['String']['output']>;
  message?: Maybe<Scalars['String']['output']>;
  recordIndex?: Maybe<Scalars['Int']['output']>;
  severity?: Maybe<Scalars['String']['output']>;
}

/** Frozen record of the most recent Provider execution attempt on this agenda boundary, attached only while that attempt is the newest one and it failed. A later successful attempt on the same boundary removes it. */
export interface AffiliateFailedExecutionContext {
  /** How many consecutive Provider attempts on this boundary have failed, counting back from the newest. Always at least 1 while this context exists. Any non-failed attempt breaks the run, so a success followed by a fresh failure counts as 1 again. This is what makes an attempt-bounded retry policy enforceable by the Agent. Nullable only for a Backend older than this field. */
  consecutiveFailureCount?: Maybe<Scalars['Int']['output']>;
  /** True when the failure run was still unbroken at the oldest attempt the bounded scan could read, so consecutiveFailureCount is a floor rather than an exact figure. Nullable only for a Backend older than this field. */
  consecutiveFailureCountTruncated?: Maybe<Scalars['Boolean']['output']>;
  errorMessage?: Maybe<Scalars['String']['output']>;
  /** Retryability projected for the Agent from the producer-side classification frozen at failure time. Only a proven NON_RETRYABLE is surfaced as such: UNKNOWN and an unclassified failure are both projected to RETRYABLE, because rejecting a Creator's Sample is a real business decision and an unclassifiable Provider outcome is not grounds for one. The untouched frozen value stays on the proposal's own execution result. Nullable only for a Backend older than this projection. */
  errorRetryability?: Maybe<TikTokPlatformErrorRetryability>;
  failedAt: Scalars['DateTimeISO']['output'];
  operatorSummary: Scalars['String']['output'];
  proposalId: Scalars['ID']['output'];
  proposalType: ActionProposalType;
}

export interface AffiliateFreeSampleRuleInput {
  hasFreeSample: Scalars['Boolean']['input'];
  isSampleApprovalExempt: Scalars['Boolean']['input'];
}

export interface AffiliateHistoryPart {
  agentReadable?: Maybe<Scalars['Boolean']['output']>;
  attachmentRef?: Maybe<Scalars['String']['output']>;
  caption?: Maybe<Scalars['String']['output']>;
  durationMs?: Maybe<Scalars['Int']['output']>;
  fileName?: Maybe<Scalars['String']['output']>;
  height?: Maybe<Scalars['Int']['output']>;
  inline?: Maybe<Scalars['Boolean']['output']>;
  kind: AffiliateHistoryPartKind;
  mimeType?: Maybe<Scalars['String']['output']>;
  productId?: Maybe<Scalars['String']['output']>;
  providerType?: Maybe<Scalars['String']['output']>;
  /** Relationship-owned Mongo SampleApplicationRecord ID for a FREE_SAMPLE_CARD. This is never a TikTok Provider application ID; use it with affiliate_get_sample_application. */
  sampleApplicationId?: Maybe<Scalars['ID']['output']>;
  sizeBytes?: Maybe<Scalars['Int']['output']>;
  summary?: Maybe<Scalars['String']['output']>;
  targetCollaborationId?: Maybe<Scalars['ID']['output']>;
  text?: Maybe<Scalars['String']['output']>;
  width?: Maybe<Scalars['Int']['output']>;
}

export const AffiliateHistoryPartKind = {
  Attachment: 'ATTACHMENT',
  FreeSampleCard: 'FREE_SAMPLE_CARD',
  ProductCard: 'PRODUCT_CARD',
  TargetCollaborationCard: 'TARGET_COLLABORATION_CARD',
  Text: 'TEXT',
  Unknown: 'UNKNOWN'
} as const;

export type AffiliateHistoryPartKind = typeof AffiliateHistoryPartKind[keyof typeof AffiliateHistoryPartKind];
export interface AffiliateHumanDecisionPrediction {
  approvalCutoff?: Maybe<Scalars['Float']['output']>;
  historicalApprovalRate?: Maybe<Scalars['Float']['output']>;
  humanApprovalPercentile?: Maybe<Scalars['Float']['output']>;
  humanApprovalProbability?: Maybe<Scalars['Float']['output']>;
  message?: Maybe<Scalars['String']['output']>;
  quality?: Maybe<AffiliateExpectedSalesPredictionQuality>;
  /** Whether the selected Human Decision model predicts historical staff would likely approve this subject. */
  wouldApprove?: Maybe<Scalars['Boolean']['output']>;
}

/** Canonical Human Decision (merchant approval tendency) model signal. */
export interface AffiliateHumanDecisionSignal {
  error?: Maybe<AffiliateModelSignalError>;
  family: AffiliateModelSignalFamily;
  selection: AffiliateModelSignalSelection;
  status: AffiliateModelSignalStatus;
  value?: Maybe<AffiliateHumanDecisionSignalValue>;
}

export interface AffiliateHumanDecisionSignalValue {
  approvalPercentile?: Maybe<Scalars['Float']['output']>;
  approvalProbability?: Maybe<Scalars['Float']['output']>;
  cutoff?: Maybe<Scalars['Float']['output']>;
  historicalApprovalRate?: Maybe<Scalars['Float']['output']>;
  wouldApprove: Scalars['Boolean']['output'];
}

/** Structured reason an Agent asks a human to review its concrete proposed action bundle. */
export const AffiliateHumanReviewReason = {
  ConflictingAuthoritativeFacts: 'CONFLICTING_AUTHORITATIVE_FACTS',
  MissingRequiredContext: 'MISSING_REQUIRED_CONTEXT',
  StaffOnlyAuthority: 'STAFF_ONLY_AUTHORITY',
  UncertainBusinessJudgment: 'UNCERTAIN_BUSINESS_JUDGMENT'
} as const;

export type AffiliateHumanReviewReason = typeof AffiliateHumanReviewReason[keyof typeof AffiliateHumanReviewReason];
export interface AffiliateHumanReviewRequestInput {
  /** One concise, decision-ready question for the reviewer. Do not use this to hand off ordinary Affiliate work. */
  question: Scalars['String']['input'];
  /** Why a human decision is required for this concrete proposed action bundle. */
  reason: AffiliateHumanReviewReason;
}

export interface AffiliateInvolvedShopInstruction {
  businessPrompt?: Maybe<Scalars['String']['output']>;
  shopId: Scalars['ID']['output'];
  shopName: Scalars['String']['output'];
}

export const AffiliateLifecycleActorRole = {
  Agent: 'AGENT',
  Creator: 'CREATOR',
  Platform: 'PLATFORM',
  Staff: 'STAFF',
  System: 'SYSTEM'
} as const;

export type AffiliateLifecycleActorRole = typeof AffiliateLifecycleActorRole[keyof typeof AffiliateLifecycleActorRole];
export const AffiliateLifecycleActorType = {
  Agent: 'AGENT',
  CloudWorker: 'CLOUD_WORKER',
  Human: 'HUMAN',
  PlatformWebhook: 'PLATFORM_WEBHOOK',
  System: 'SYSTEM'
} as const;

export type AffiliateLifecycleActorType = typeof AffiliateLifecycleActorType[keyof typeof AffiliateLifecycleActorType];
export const AffiliateLifecycleEntityType = {
  ActionProposal: 'ACTION_PROPOSAL',
  AffiliateApprovalPolicy: 'AFFILIATE_APPROVAL_POLICY',
  AffiliateBusinessDeveloper: 'AFFILIATE_BUSINESS_DEVELOPER',
  AffiliateCampaign: 'AFFILIATE_CAMPAIGN',
  AffiliateCollaboration: 'AFFILIATE_COLLABORATION',
  AffiliateCreatorChannelContact: 'AFFILIATE_CREATOR_CHANNEL_CONTACT',
  AffiliateCreatorIdentity: 'AFFILIATE_CREATOR_IDENTITY',
  AffiliateCreatorProtection: 'AFFILIATE_CREATOR_PROTECTION',
  AffiliateCreatorRelationship: 'AFFILIATE_CREATOR_RELATIONSHIP',
  AffiliateMessageDelivery: 'AFFILIATE_MESSAGE_DELIVERY',
  CampaignProduct: 'CAMPAIGN_PRODUCT',
  CreatorCandidate: 'CREATOR_CANDIDATE',
  CreatorSearchRun: 'CREATOR_SEARCH_RUN',
  CreatorTag: 'CREATOR_TAG',
  EmailAccountBinding: 'EMAIL_ACCOUNT_BINDING',
  SampleApplicationRecord: 'SAMPLE_APPLICATION_RECORD',
  WhatsappAccountBinding: 'WHATSAPP_ACCOUNT_BINDING'
} as const;

export type AffiliateLifecycleEntityType = typeof AffiliateLifecycleEntityType[keyof typeof AffiliateLifecycleEntityType];
export const AffiliateLifecycleEventType = {
  ActionExecuted: 'ACTION_EXECUTED',
  ActionFailed: 'ACTION_FAILED',
  AffiliateOnboardingCompleted: 'AFFILIATE_ONBOARDING_COMPLETED',
  BdAccountBound: 'BD_ACCOUNT_BOUND',
  BdAccountTransferred: 'BD_ACCOUNT_TRANSFERRED',
  BdAccountUnbound: 'BD_ACCOUNT_UNBOUND',
  BusinessDeveloperArchived: 'BUSINESS_DEVELOPER_ARCHIVED',
  BusinessDeveloperCreated: 'BUSINESS_DEVELOPER_CREATED',
  BusinessDeveloperRestored: 'BUSINESS_DEVELOPER_RESTORED',
  BusinessDeveloperUpdated: 'BUSINESS_DEVELOPER_UPDATED',
  CandidateQualified: 'CANDIDATE_QUALIFIED',
  ChannelContactCreated: 'CHANNEL_CONTACT_CREATED',
  ChannelContactUpdated: 'CHANNEL_CONTACT_UPDATED',
  CollaborationClosed: 'COLLABORATION_CLOSED',
  CollaborationCreated: 'COLLABORATION_CREATED',
  CollaborationFirstObserved: 'COLLABORATION_FIRST_OBSERVED',
  CollaborationTerminalStateFirstObserved: 'COLLABORATION_TERMINAL_STATE_FIRST_OBSERVED',
  ContentDetected: 'CONTENT_DETECTED',
  CreatorProtectionAdded: 'CREATOR_PROTECTION_ADDED',
  CreatorProtectionMerged: 'CREATOR_PROTECTION_MERGED',
  CreatorProtectionRemoved: 'CREATOR_PROTECTION_REMOVED',
  CreatorProtectionUpdated: 'CREATOR_PROTECTION_UPDATED',
  MessageReceived: 'MESSAGE_RECEIVED',
  MessageSent: 'MESSAGE_SENT',
  ProposalApproved: 'PROPOSAL_APPROVED',
  ProposalCreated: 'PROPOSAL_CREATED',
  ProposalExecuted: 'PROPOSAL_EXECUTED',
  ProposalExpired: 'PROPOSAL_EXPIRED',
  ProposalRejected: 'PROPOSAL_REJECTED',
  ProposalRevisionRequested: 'PROPOSAL_REVISION_REQUESTED',
  ProposalSuperseded: 'PROPOSAL_SUPERSEDED',
  RelationshipBdAssigned: 'RELATIONSHIP_BD_ASSIGNED',
  RelationshipContactUpdated: 'RELATIONSHIP_CONTACT_UPDATED',
  SampleApplicationApproved: 'SAMPLE_APPLICATION_APPROVED',
  SampleApplicationCancelled: 'SAMPLE_APPLICATION_CANCELLED',
  SampleApplicationFirstObserved: 'SAMPLE_APPLICATION_FIRST_OBSERVED',
  SampleApplicationRejected: 'SAMPLE_APPLICATION_REJECTED',
  SampleApplicationStateObserved: 'SAMPLE_APPLICATION_STATE_OBSERVED',
  SampleApplicationSubmitted: 'SAMPLE_APPLICATION_SUBMITTED',
  SampleApplicationTerminalStateFirstObserved: 'SAMPLE_APPLICATION_TERMINAL_STATE_FIRST_OBSERVED',
  SampleCollaborationLinkConflictObserved: 'SAMPLE_COLLABORATION_LINK_CONFLICT_OBSERVED',
  SampleCommissionRateConflictObserved: 'SAMPLE_COMMISSION_RATE_CONFLICT_OBSERVED',
  SampleDelivered: 'SAMPLE_DELIVERED',
  SampleDeliveryFailed: 'SAMPLE_DELIVERY_FAILED',
  SampleShipped: 'SAMPLE_SHIPPED',
  StageChanged: 'STAGE_CHANGED',
  TagAdded: 'TAG_ADDED',
  TagRemoved: 'TAG_REMOVED',
  TargetInviteCreated: 'TARGET_INVITE_CREATED',
  WorkItemRequeued: 'WORK_ITEM_REQUEUED',
  WorkItemResolved: 'WORK_ITEM_RESOLVED',
  WorkItemRetryRequested: 'WORK_ITEM_RETRY_REQUESTED'
} as const;

export type AffiliateLifecycleEventType = typeof AffiliateLifecycleEventType[keyof typeof AffiliateLifecycleEventType];
export const AffiliateLifecycleStage = {
  Blocked: 'BLOCKED',
  Closed: 'CLOSED',
  Contacted: 'CONTACTED',
  ContentPending: 'CONTENT_PENDING',
  Converting: 'CONVERTING',
  Discovered: 'DISCOVERED',
  Invited: 'INVITED',
  Qualified: 'QUALIFIED',
  Retained: 'RETAINED',
  SamplePending: 'SAMPLE_PENDING'
} as const;

export type AffiliateLifecycleStage = typeof AffiliateLifecycleStage[keyof typeof AffiliateLifecycleStage];
export interface AffiliateMarketplaceCreatorRuleCapabilities {
  ageRanges: Array<CreatorSearchFollowerAgeRange>;
  apiVersion: Scalars['String']['output'];
  capabilityHash: Scalars['String']['output'];
  categoryPros: Array<Scalars['String']['output']>;
  creatorLevels: Array<Scalars['String']['output']>;
  fetchedAt: Scalars['DateTimeISO']['output'];
  genders: Array<CreatorSearchFollowerGender>;
  gmvRanges: Array<AffiliateMarketplaceGmvRange>;
  languages: Array<Scalars['String']['output']>;
  market: ShopRegion;
  shopId: Scalars['ID']['output'];
  unitsSoldRanges: Array<AffiliateMarketplaceUnitsSoldRange>;
}

export const AffiliateMarketplaceGmvRange = {
  GmvRange_0_100: 'GMV_RANGE_0_100',
  GmvRange_100_1000: 'GMV_RANGE_100_1000',
  GmvRange_1000_10000: 'GMV_RANGE_1000_10000',
  GmvRange_10000AndAbove: 'GMV_RANGE_10000_AND_ABOVE'
} as const;

export type AffiliateMarketplaceGmvRange = typeof AffiliateMarketplaceGmvRange[keyof typeof AffiliateMarketplaceGmvRange];
export const AffiliateMarketplaceUnitsSoldRange = {
  UnitsSoldRange_0_10: 'UNITS_SOLD_RANGE_0_10',
  UnitsSoldRange_10_100: 'UNITS_SOLD_RANGE_10_100',
  UnitsSoldRange_100_1000: 'UNITS_SOLD_RANGE_100_1000',
  UnitsSoldRange_1000AndAbove: 'UNITS_SOLD_RANGE_1000_AND_ABOVE'
} as const;

export type AffiliateMarketplaceUnitsSoldRange = typeof AffiliateMarketplaceUnitsSoldRange[keyof typeof AffiliateMarketplaceUnitsSoldRange];
/** Creator communication channel for affiliate outreach */
export const AffiliateMessageChannel = {
  Email: 'EMAIL',
  PlatformChat: 'PLATFORM_CHAT',
  Whatsapp: 'WHATSAPP'
} as const;

export type AffiliateMessageChannel = typeof AffiliateMessageChannel[keyof typeof AffiliateMessageChannel];
/** Recorded delivery attempt for a creator-facing affiliate message. */
export interface AffiliateMessageDelivery {
  actualChannel?: Maybe<AffiliateMessageChannel>;
  baseCheckpointId?: Maybe<Scalars['String']['output']>;
  baseEventCursor?: Maybe<Scalars['Int']['output']>;
  campaignCreatorStateId?: Maybe<Scalars['ID']['output']>;
  campaignDailyExecutionId?: Maybe<Scalars['ID']['output']>;
  campaignId?: Maybe<Scalars['ID']['output']>;
  candidateCheckpointId?: Maybe<Scalars['String']['output']>;
  channelContactId?: Maybe<Scalars['ID']['output']>;
  channelSelectionSource: AffiliateDeliveryChannelSelectionSource;
  contactSelectionSource: AffiliateContactSelectionSource;
  createdAt: Scalars['DateTimeISO']['output'];
  creatorId: Scalars['ID']['output'];
  creatorRelationshipId: Scalars['ID']['output'];
  emailAccountBindingId?: Maybe<Scalars['ID']['output']>;
  errorCode?: Maybe<Scalars['String']['output']>;
  errorMessage?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  idempotencyKey: Scalars['String']['output'];
  openClawRunId?: Maybe<Scalars['String']['output']>;
  openClawSessionKey?: Maybe<Scalars['String']['output']>;
  parts: Array<AffiliateMessageDeliveryPart>;
  preferredChannel: AffiliateMessageChannel;
  providerAttemptStartedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  providerMessageId?: Maybe<Scalars['String']['output']>;
  quotaCountedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  quotaMarketLocalDate?: Maybe<Scalars['String']['output']>;
  quotaReleaseReason?: Maybe<Scalars['String']['output']>;
  quotaReleasedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  replyToLifecycleEventId?: Maybe<Scalars['ID']['output']>;
  shopId?: Maybe<Scalars['ID']['output']>;
  source: AffiliateDeliverySource;
  status: AffiliateDeliveryStatus;
  targetEventCursor?: Maybe<Scalars['Int']['output']>;
  templateVersion?: Maybe<Scalars['Int']['output']>;
  textHash?: Maybe<Scalars['String']['output']>;
  textLength?: Maybe<Scalars['Int']['output']>;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['ID']['output'];
  whatsappAccountBindingId?: Maybe<Scalars['ID']['output']>;
}

export interface AffiliateMessageDeliveryPart {
  captionHash?: Maybe<Scalars['String']['output']>;
  captionLength?: Maybe<Scalars['Int']['output']>;
  emailDisposition?: Maybe<AffiliateEmailAttachmentDisposition>;
  errorCode?: Maybe<Scalars['String']['output']>;
  errorMessage?: Maybe<Scalars['String']['output']>;
  fileName?: Maybe<Scalars['String']['output']>;
  kind: AffiliateMessagePartKind;
  mimeType?: Maybe<Scalars['String']['output']>;
  productId?: Maybe<Scalars['String']['output']>;
  providerConfirmedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  providerMessageId?: Maybe<Scalars['String']['output']>;
  providerSubmittedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  sequence: Scalars['Int']['output'];
  sha256?: Maybe<Scalars['String']['output']>;
  sizeBytes?: Maybe<Scalars['Int']['output']>;
  status: AffiliateDeliveryPartStatus;
  textHash?: Maybe<Scalars['String']['output']>;
  textLength?: Maybe<Scalars['Int']['output']>;
}

export interface AffiliateMessagePart {
  caption?: Maybe<Scalars['String']['output']>;
  captionHash?: Maybe<Scalars['String']['output']>;
  captionLength?: Maybe<Scalars['Int']['output']>;
  draftAssetId?: Maybe<Scalars['ID']['output']>;
  emailDisposition?: Maybe<AffiliateEmailAttachmentDisposition>;
  fileName?: Maybe<Scalars['String']['output']>;
  kind: AffiliateMessagePartKind;
  mimeType?: Maybe<Scalars['String']['output']>;
  productId?: Maybe<Scalars['String']['output']>;
  sampleApplicationId?: Maybe<Scalars['ID']['output']>;
  sha256?: Maybe<Scalars['String']['output']>;
  sizeBytes?: Maybe<Scalars['Int']['output']>;
  targetCollaborationId?: Maybe<Scalars['ID']['output']>;
  text?: Maybe<Scalars['String']['output']>;
  textHash?: Maybe<Scalars['String']['output']>;
  textLength?: Maybe<Scalars['Int']['output']>;
}

export const AffiliateMessagePartKind = {
  Attachment: 'ATTACHMENT',
  FreeSampleCard: 'FREE_SAMPLE_CARD',
  ProductCard: 'PRODUCT_CARD',
  TargetCollaborationCard: 'TARGET_COLLABORATION_CARD',
  Text: 'TEXT'
} as const;

export type AffiliateMessagePartKind = typeof AffiliateMessagePartKind[keyof typeof AffiliateMessagePartKind];
export interface AffiliateMlHistogramBucket {
  count: Scalars['Int']['output'];
  key: Scalars['String']['output'];
  label: Scalars['String']['output'];
}

export interface AffiliateMlInsightSummariesInput {
  shopIds?: InputMaybe<Array<Scalars['ID']['input']>>;
}

export interface AffiliateMlInsightsBulkInput {
  shopIds: Array<Scalars['ID']['input']>;
}

export interface AffiliateMlInsightsBulkPayload {
  items: Array<AffiliateMlInsightsBulkRow>;
}

export interface AffiliateMlInsightsBulkRow {
  automaticExpectedSalesSelection?: Maybe<AffiliateExpectedSalesAutomaticSelection>;
  modelAvailability: Array<AffiliateModelAvailability>;
  modelScope: AffiliateMlInsightsModelScope;
  shopId?: Maybe<Scalars['ID']['output']>;
}

export interface AffiliateMlInsightsInput {
  modelScope?: InputMaybe<AffiliateMlInsightsModelScope>;
  shopId?: InputMaybe<Scalars['ID']['input']>;
}

export const AffiliateMlInsightsModelScope = {
  Region: 'REGION',
  Shop: 'SHOP',
  User: 'USER'
} as const;

export type AffiliateMlInsightsModelScope = typeof AffiliateMlInsightsModelScope[keyof typeof AffiliateMlInsightsModelScope];
export interface AffiliateMlInsightsPayload {
  automaticExpectedSalesSelection?: Maybe<AffiliateExpectedSalesAutomaticSelection>;
  modelAvailability: Array<AffiliateModelAvailability>;
}

export interface AffiliateMlModelEfficiencySummary {
  comparisonAvailable: Scalars['Boolean']['output'];
  /** @deprecated Internal estimate-precision diagnostic; seller UI should use outperformanceProbability and dataFoundationLevel. */
  confidenceLevel?: Maybe<Scalars['String']['output']>;
  dataFoundationLevel?: Maybe<Scalars['String']['output']>;
  effectEvidence?: Maybe<Scalars['String']['output']>;
  expectedSalesLiftRatio?: Maybe<Scalars['Float']['output']>;
  /** @deprecated Internal 95% diagnostic; seller UI should use the primary range fields. */
  expectedSalesLiftRatioLowerBound?: Maybe<Scalars['Float']['output']>;
  expectedSalesLiftRatioPrimaryRangeLevel?: Maybe<Scalars['Float']['output']>;
  expectedSalesLiftRatioPrimaryRangeLowerBound?: Maybe<Scalars['Float']['output']>;
  expectedSalesLiftRatioPrimaryRangeUpperBound?: Maybe<Scalars['Float']['output']>;
  /** @deprecated Internal 95% diagnostic; seller UI should use the primary range fields. */
  expectedSalesLiftRatioUpperBound?: Maybe<Scalars['Float']['output']>;
  historicalApplicationCount: Scalars['Int']['output'];
  historicalExpectedUnits?: Maybe<Scalars['Float']['output']>;
  historicalSelectedCount: Scalars['Int']['output'];
  modelExpectedUnits?: Maybe<Scalars['Float']['output']>;
  modelSelectedCount: Scalars['Int']['output'];
  outperformanceProbability?: Maybe<Scalars['Float']['output']>;
  sameBudgetComparison?: Maybe<AffiliateMlSameBudgetComparison>;
  sameThresholdComparison?: Maybe<AffiliateMlSameThresholdComparison>;
  selectionDifferenceCount: Scalars['Int']['output'];
}

export interface AffiliateMlSameBudgetComparison {
  historicalActualObservedCount?: Maybe<Scalars['Int']['output']>;
  historicalActualUnitsHistogram?: Maybe<Array<AffiliateMlHistogramBucket>>;
  historicalApprovalRate?: Maybe<Scalars['Float']['output']>;
  historicalExpectedUnitsHistogram?: Maybe<Array<AffiliateMlHistogramBucket>>;
  modelExpectedUnitsHistogram?: Maybe<Array<AffiliateMlHistogramBucket>>;
  modelRejectedHistoricalSelectedCount?: Maybe<Scalars['Int']['output']>;
  modelSelectedHistoricalRejectedCount?: Maybe<Scalars['Int']['output']>;
}

export interface AffiliateMlSameThresholdComparison {
  belowThresholdCount?: Maybe<Scalars['Int']['output']>;
  belowThresholdModelExpectedUnitsHistogram?: Maybe<Array<AffiliateMlHistogramBucket>>;
  historicalExpectedUnitsHistogram?: Maybe<Array<AffiliateMlHistogramBucket>>;
  historicalQualifiedCount?: Maybe<Scalars['Int']['output']>;
  minimumExpectedSalesUnits?: Maybe<Scalars['Float']['output']>;
  modelExpectedUnitsHistogram?: Maybe<Array<AffiliateMlHistogramBucket>>;
  modelQualifiedCount?: Maybe<Scalars['Int']['output']>;
  modelQualifiedHistoricalRejectedCount?: Maybe<Scalars['Int']['output']>;
  qualifiedCreatorLiftRatio?: Maybe<Scalars['Float']['output']>;
}

export interface AffiliateModelAvailability {
  bentomlTag?: Maybe<Scalars['String']['output']>;
  contractHash?: Maybe<Scalars['String']['output']>;
  contractStatus: Scalars['String']['output'];
  effectiveTenantId?: Maybe<Scalars['ID']['output']>;
  effectiveTenantScope?: Maybe<Scalars['String']['output']>;
  evaluationSummary?: Maybe<AffiliateMlModelEfficiencySummary>;
  featureTemporalBasis: Scalars['String']['output'];
  modelFamily: Scalars['String']['output'];
  modelStage: Scalars['String']['output'];
  modelVersionKey?: Maybe<Scalars['String']['output']>;
  reason?: Maybe<Scalars['String']['output']>;
  requestedTenantId: Scalars['ID']['output'];
  requestedTenantScope: Scalars['String']['output'];
  status: Scalars['String']['output'];
  trainedAt?: Maybe<Scalars['DateTimeISO']['output']>;
}

export interface AffiliateModelSignalError {
  code: AffiliatePredictionErrorCode;
  message?: Maybe<Scalars['String']['output']>;
}

export const AffiliateModelSignalFamily = {
  ExpectedSales: 'EXPECTED_SALES',
  HumanDecision: 'HUMAN_DECISION'
} as const;

export type AffiliateModelSignalFamily = typeof AffiliateModelSignalFamily[keyof typeof AffiliateModelSignalFamily];
/** Scope routing of one model signal: requested scope, effective scope after serving's fallback chain, and the audited evaluated chain. */
export interface AffiliateModelSignalSelection {
  effectiveScope?: Maybe<AffiliateExpectedSalesTenantScope>;
  evaluatedScopes: Array<AffiliateExpectedSalesEvaluatedScope>;
  modelVersion?: Maybe<Scalars['String']['output']>;
  requestedScope: AffiliateExpectedSalesTenantScope;
}

/** Canonical per-family model signal status. READY has a value and no error; NOT_AVAILABLE strictly means no artifact exists; ERROR carries the real failure. */
export const AffiliateModelSignalStatus = {
  Error: 'ERROR',
  NotAvailable: 'NOT_AVAILABLE',
  Ready: 'READY'
} as const;

export type AffiliateModelSignalStatus = typeof AffiliateModelSignalStatus[keyof typeof AffiliateModelSignalStatus];
export interface AffiliateOpenAutoAddProductInput {
  commissionRateBps: Scalars['Int']['input'];
  enable: Scalars['Boolean']['input'];
}

/** Seller shop operation performed against Open Collaboration configuration. */
export const AffiliateOpenCollaborationOperation = {
  Create: 'CREATE',
  EditSampleRule: 'EDIT_SAMPLE_RULE',
  EditSettings: 'EDIT_SETTINGS',
  Remove: 'REMOVE'
} as const;

export type AffiliateOpenCollaborationOperation = typeof AffiliateOpenCollaborationOperation[keyof typeof AffiliateOpenCollaborationOperation];
export interface AffiliateOpenCollaborationSampleRuleInput {
  endTime?: InputMaybe<Scalars['Int']['input']>;
  isSampleTimeUnlimited?: InputMaybe<Scalars['Boolean']['input']>;
  sampleQuota?: InputMaybe<Scalars['Int']['input']>;
  startTime?: InputMaybe<Scalars['Int']['input']>;
}

export interface AffiliateOpenCollaborationSampleThresholdsInput {
  avgEcVideoViews?: InputMaybe<Scalars['Int']['input']>;
  categoryIds?: InputMaybe<Array<Scalars['String']['input']>>;
  minimumFollowerCount?: InputMaybe<Scalars['Int']['input']>;
  minimumGmv?: InputMaybe<Scalars['Int']['input']>;
  predictedFulfillmentRank?: InputMaybe<Scalars['String']['input']>;
}

/** Whether an Open Collaboration product sample rule is activated or deactivated. */
export const AffiliateOpenSampleRuleActivation = {
  Activate: 'ACTIVATE',
  Deactivate: 'DEACTIVATE'
} as const;

export type AffiliateOpenSampleRuleActivation = typeof AffiliateOpenSampleRuleActivation[keyof typeof AffiliateOpenSampleRuleActivation];
export const AffiliateOperationalProjectionDataset = {
  Collaborations: 'COLLABORATIONS',
  Messages: 'MESSAGES',
  SampleApplications: 'SAMPLE_APPLICATIONS'
} as const;

export type AffiliateOperationalProjectionDataset = typeof AffiliateOperationalProjectionDataset[keyof typeof AffiliateOperationalProjectionDataset];
export interface AffiliateOperationalProjectionHealthPayload {
  datasets: Array<AffiliateOperationalProjectionReadiness>;
  ready: Scalars['Boolean']['output'];
  shopId: Scalars['ID']['output'];
}

/** Readiness and freshness of one shop-level Affiliate operational projection. */
export interface AffiliateOperationalProjectionReadiness {
  complete: Scalars['Boolean']['output'];
  currentStatus: AffiliateOperationalProjectionStatus;
  dataset: AffiliateOperationalProjectionDataset;
  historyCutoffAt?: Maybe<Scalars['DateTimeISO']['output']>;
  historyStatus: AffiliateOperationalProjectionStatus;
  lastHeadSyncAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastHistorySyncAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastSuccessfulSyncAt?: Maybe<Scalars['DateTimeISO']['output']>;
  oldestCoveredAt?: Maybe<Scalars['DateTimeISO']['output']>;
  providerWindowLimited: Scalars['Boolean']['output'];
  ready: Scalars['Boolean']['output'];
  reason?: Maybe<Scalars['String']['output']>;
  stale: Scalars['Boolean']['output'];
  status: AffiliateOperationalProjectionStatus;
}

/** Per-shop readiness and historical coverage for one CreatorRelationship operational dataset. */
export interface AffiliateOperationalProjectionShopCoverage {
  complete: Scalars['Boolean']['output'];
  currentStatus: AffiliateOperationalProjectionStatus;
  historyCutoffAt?: Maybe<Scalars['DateTimeISO']['output']>;
  historyStatus: AffiliateOperationalProjectionStatus;
  lastHeadSyncAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastHistorySyncAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastSuccessfulSyncAt?: Maybe<Scalars['DateTimeISO']['output']>;
  oldestCoveredAt?: Maybe<Scalars['DateTimeISO']['output']>;
  platformShopId: Scalars['String']['output'];
  projectionStatus: AffiliateOperationalProjectionStatus;
  providerWindowLimited: Scalars['Boolean']['output'];
  ready: Scalars['Boolean']['output'];
  reason?: Maybe<Scalars['String']['output']>;
  shopId: Scalars['ID']['output'];
  shopName: Scalars['String']['output'];
}

export const AffiliateOperationalProjectionStatus = {
  Bootstrapping: 'BOOTSTRAPPING',
  Degraded: 'DEGRADED',
  NotStarted: 'NOT_STARTED',
  ProviderWindowLimited: 'PROVIDER_WINDOW_LIMITED',
  Ready: 'READY',
  Syncing: 'SYNCING'
} as const;

export type AffiliateOperationalProjectionStatus = typeof AffiliateOperationalProjectionStatus[keyof typeof AffiliateOperationalProjectionStatus];
export interface AffiliateOperationalSettings {
  id: Scalars['ID']['output'];
  onboardingCompletedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  userId: Scalars['ID']['output'];
}

export interface AffiliateOutboundMessagePartInput {
  caption?: InputMaybe<Scalars['String']['input']>;
  draftAssetId?: InputMaybe<Scalars['ID']['input']>;
  emailDisposition?: InputMaybe<AffiliateEmailAttachmentDisposition>;
  kind: AffiliateMessagePartKind;
  productId?: InputMaybe<Scalars['String']['input']>;
  sampleApplicationId?: InputMaybe<Scalars['ID']['input']>;
  targetCollaborationId?: InputMaybe<Scalars['ID']['input']>;
  text?: InputMaybe<Scalars['String']['input']>;
}

/** Seller outreach account connection event for affiliate direct-channel onboarding. */
export interface AffiliateOutreachAccountConnectedPayload {
  accountId: Scalars['ID']['output'];
  address?: Maybe<Scalars['String']['output']>;
  channel: AffiliateMessageChannel;
  displayName?: Maybe<Scalars['String']['output']>;
}

export interface AffiliateOutreachDeliveryStatusCount {
  channel?: Maybe<AffiliateMessageChannel>;
  count: Scalars['Int']['output'];
  status: AffiliateDeliveryStatus;
}

export interface AffiliateOutreachInboundMessageCount {
  channel: AffiliateMessageChannel;
  count: Scalars['Int']['output'];
  direction: AffiliateCreatorMessageDirection;
}

export interface AffiliateOutreachOperationalEventCount {
  count: Scalars['Int']['output'];
  kind: AffiliateOutreachOperationalEventKind;
  provider: AffiliateOutreachOperationalEventProvider;
  status: AffiliateOutreachOperationalEventStatus;
}

/** Type of affiliate outreach connector operational event */
export const AffiliateOutreachOperationalEventKind = {
  MailboxDeltaSync: 'MAILBOX_DELTA_SYNC',
  MailboxSubscriptionRenewal: 'MAILBOX_SUBSCRIPTION_RENEWAL',
  WebhookReceived: 'WEBHOOK_RECEIVED',
  WebhookRejected: 'WEBHOOK_REJECTED'
} as const;

export type AffiliateOutreachOperationalEventKind = typeof AffiliateOutreachOperationalEventKind[keyof typeof AffiliateOutreachOperationalEventKind];
/** Connector provider that emitted an affiliate outreach operational event */
export const AffiliateOutreachOperationalEventProvider = {
  EvolutionApi: 'EVOLUTION_API',
  MicrosoftGraph: 'MICROSOFT_GRAPH'
} as const;

export type AffiliateOutreachOperationalEventProvider = typeof AffiliateOutreachOperationalEventProvider[keyof typeof AffiliateOutreachOperationalEventProvider];
/** Outcome bucket for affiliate outreach connector operational events */
export const AffiliateOutreachOperationalEventStatus = {
  Failed: 'FAILED',
  Ignored: 'IGNORED',
  Success: 'SUCCESS'
} as const;

export type AffiliateOutreachOperationalEventStatus = typeof AffiliateOutreachOperationalEventStatus[keyof typeof AffiliateOutreachOperationalEventStatus];
export interface AffiliateOutreachOperationalEventTypeCount {
  count: Scalars['Int']['output'];
  eventType?: Maybe<Scalars['String']['output']>;
  kind: AffiliateOutreachOperationalEventKind;
  provider: AffiliateOutreachOperationalEventProvider;
  status: AffiliateOutreachOperationalEventStatus;
}

export interface AffiliateOutreachOperationalStatusInput {
  days?: InputMaybe<Scalars['Int']['input']>;
  shopId: Scalars['ID']['input'];
}

export interface AffiliateOutreachOperationalStatusPayload {
  activeWhatsAppProxyCount: Scalars['Int']['output'];
  deliveryCounts: Array<AffiliateOutreachDeliveryStatusCount>;
  disabledWhatsAppProxyCount: Scalars['Int']['output'];
  emailAccountsMissingRefreshTokenCount: Scalars['Int']['output'];
  errorWhatsAppProxyCount: Scalars['Int']['output'];
  failedDeliveryCount: Scalars['Int']['output'];
  failedMailboxSyncCount: Scalars['Int']['output'];
  failedSubscriptionRenewalCount: Scalars['Int']['output'];
  ignoredWebhookCount: Scalars['Int']['output'];
  inboundCounts: Array<AffiliateOutreachInboundMessageCount>;
  latestDeliveryAt?: Maybe<Scalars['DateTimeISO']['output']>;
  latestInboundAt?: Maybe<Scalars['DateTimeISO']['output']>;
  latestOperationalEventAt?: Maybe<Scalars['DateTimeISO']['output']>;
  mailboxSyncCount: Scalars['Int']['output'];
  operationalEventCounts: Array<AffiliateOutreachOperationalEventCount>;
  operationalEventTypeCounts: Array<AffiliateOutreachOperationalEventTypeCount>;
  rejectedWebhookCount: Scalars['Int']['output'];
  sharedEmailAccountsMissingAddressCount: Scalars['Int']['output'];
  since: Scalars['DateTimeISO']['output'];
  subscriptionRenewalCount: Scalars['Int']['output'];
  webhookReceivedCount: Scalars['Int']['output'];
  whatsappAccountsNeedingReconnectCount: Scalars['Int']['output'];
  whatsappAccountsUsingUnavailableProxyCount: Scalars['Int']['output'];
}

export const AffiliatePredictionCaptureMode = {
  PromotedFromCache: 'PROMOTED_FROM_CACHE',
  QueryCache: 'QUERY_CACHE',
  WorkingAgenda: 'WORKING_AGENDA'
} as const;

export type AffiliatePredictionCaptureMode = typeof AffiliatePredictionCaptureMode[keyof typeof AffiliatePredictionCaptureMode];
export const AffiliatePredictionErrorCode = {
  ArtifactInvalid: 'ARTIFACT_INVALID',
  ContractMismatch: 'CONTRACT_MISMATCH',
  DataNotReady: 'DATA_NOT_READY',
  ServiceError: 'SERVICE_ERROR',
  VersionMismatch: 'VERSION_MISMATCH'
} as const;

export type AffiliatePredictionErrorCode = typeof AffiliatePredictionErrorCode[keyof typeof AffiliatePredictionErrorCode];
/** Canonical prediction evidence computed once in the backend and frozen into snapshots. */
export interface AffiliatePredictionEvidence {
  evidenceMode: AffiliatePredictionEvidenceMode;
  expectedSales: AffiliateExpectedSalesSignal;
  humanDecision: AffiliateHumanDecisionSignal;
}

/** Deterministic evidence mode computed once in the backend and frozen into snapshots. Desktop gates Agent-prompt evidence on it; Panel may render DEGRADED Expected Sales values de-emphasized. */
export const AffiliatePredictionEvidenceMode = {
  ExpectedSalesTrusted: 'EXPECTED_SALES_TRUSTED',
  MerchantApprovalTendency: 'MERCHANT_APPROVAL_TENDENCY',
  ModelSignalError: 'MODEL_SIGNAL_ERROR',
  NoModelSignal: 'NO_MODEL_SIGNAL'
} as const;

export type AffiliatePredictionEvidenceMode = typeof AffiliatePredictionEvidenceMode[keyof typeof AffiliatePredictionEvidenceMode];
export const AffiliatePredictionStatus = {
  DataNotReady: 'DATA_NOT_READY',
  FeatureContractError: 'FEATURE_CONTRACT_ERROR',
  FeatureVersionMismatch: 'FEATURE_VERSION_MISMATCH',
  InvalidContext: 'INVALID_CONTEXT',
  ModelUpgrading: 'MODEL_UPGRADING',
  Ok: 'OK',
  PredictionNotAvailable: 'PREDICTION_NOT_AVAILABLE',
  ServiceError: 'SERVICE_ERROR'
} as const;

export type AffiliatePredictionStatus = typeof AffiliatePredictionStatus[keyof typeof AffiliatePredictionStatus];
export const AffiliatePredictionType = {
  SalesUnitsForecast: 'SALES_UNITS_FORECAST'
} as const;

export type AffiliatePredictionType = typeof AffiliatePredictionType[keyof typeof AffiliatePredictionType];
export interface AffiliateProductSummaryBatchInput {
  refs: Array<AffiliateProductSummaryReferenceInput>;
}

export interface AffiliateProductSummaryReferenceInput {
  productId: Scalars['String']['input'];
  shopId: Scalars['ID']['input'];
}

export const AffiliateProjectionSyncSource = {
  AirflowBootstrap: 'AIRFLOW_BOOTSTRAP',
  AirflowReconcile: 'AIRFLOW_RECONCILE',
  PlatformAction: 'PLATFORM_ACTION',
  Webhook: 'WEBHOOK'
} as const;

export type AffiliateProjectionSyncSource = typeof AffiliateProjectionSyncSource[keyof typeof AffiliateProjectionSyncSource];
/** Why an Affiliate action proposal requires a human decision. */
export const AffiliateProposalReviewSource = {
  AgentRequested: 'AGENT_REQUESTED',
  Policy: 'POLICY',
  PolicyAndAgentRequested: 'POLICY_AND_AGENT_REQUESTED'
} as const;

export type AffiliateProposalReviewSource = typeof AffiliateProposalReviewSource[keyof typeof AffiliateProposalReviewSource];
/** Source and authority boundary for a specific Affiliate read operation. */
export const AffiliateProviderReadSource = {
  MongodbCurrentState: 'MONGODB_CURRENT_STATE',
  MongodbOperationalProjection: 'MONGODB_OPERATIONAL_PROJECTION'
} as const;

export type AffiliateProviderReadSource = typeof AffiliateProviderReadSource[keyof typeof AffiliateProviderReadSource];
export interface AffiliateRelationshipAgendaItem {
  affiliateCollaborationId?: Maybe<Scalars['ID']['output']>;
  boundaryEventCursor?: Maybe<Scalars['Int']['output']>;
  campaignId?: Maybe<Scalars['ID']['output']>;
  conversationWindow?: Maybe<AffiliateConversationWindow>;
  /** Whether an active Target Collaboration covers this item's exact shop, Creator and product — the seller commitment a Sample decision turns on. Null means the question is unanswerable from this item (it names no product, or its shop lies outside the Relationship), NOT that no commitment exists; never read null as false. */
  hasTargetCollaboration?: Maybe<Scalars['Boolean']['output']>;
  key: Scalars['String']['output'];
  /** The most recent Provider execution attempt on this agenda boundary when that attempt failed and nothing has succeeded on the boundary since. Absent means the boundary has no unresolved execution failure. */
  lastFailedExecution?: Maybe<AffiliateFailedExecutionContext>;
  messageChannel?: Maybe<AffiliateMessageChannel>;
  nextActionAt?: Maybe<Scalars['DateTimeISO']['output']>;
  owner: AffiliateRelationshipAgendaOwner;
  pendingLifecycleEventId?: Maybe<Scalars['ID']['output']>;
  pendingRelationshipSequence?: Maybe<Scalars['Int']['output']>;
  /** Backend-generated expected-sales and Human Decision evidence for this Sample Application dispatch. It is computed before the Agent run and later frozen into any resulting proposal. */
  predictionEvidence?: Maybe<AffiliateActionProposalPredictionSnapshot>;
  productId?: Maybe<Scalars['String']['output']>;
  proposalId?: Maybe<Scalars['ID']['output']>;
  reasons: Array<AffiliateWorkProcessReason>;
  requiredAction: AffiliateRelationshipRequiredAction;
  /** The frozen proposal being revised when this agenda item was created by a staff revision request. Ordinary pending proposals are never attached. */
  revisionRequestedProposal?: Maybe<AffiliateRevisionRequestedProposalContext>;
  sampleApplicationRecordId?: Maybe<Scalars['ID']['output']>;
  /** Why the Sample Application ended, on HANDLE_SAMPLE_TERMINAL_STATE work. Absent on every other agenda item, and on a terminal item whose transition event carried no work status at all. */
  sampleTerminalState?: Maybe<AffiliateSampleTerminalStateContext>;
  shopId?: Maybe<Scalars['ID']['output']>;
  /** Current region of the shop that owns this agenda fact. Request-scoped and not persisted on the Relationship. */
  shopRegion?: Maybe<Scalars['String']['output']>;
  sourceType: AffiliateRelationshipAgendaSourceType;
  updatedAt: Scalars['DateTimeISO']['output'];
  workKind: AffiliateWorkKind;
}

export const AffiliateRelationshipAgendaOwner = {
  Agent: 'AGENT',
  External: 'EXTERNAL',
  Staff: 'STAFF'
} as const;

export type AffiliateRelationshipAgendaOwner = typeof AffiliateRelationshipAgendaOwner[keyof typeof AffiliateRelationshipAgendaOwner];
export const AffiliateRelationshipAgendaSourceType = {
  CreatorChannelContact: 'CREATOR_CHANNEL_CONTACT',
  PlatformCollaboration: 'PLATFORM_COLLABORATION',
  PlatformConversationRoute: 'PLATFORM_CONVERSATION_ROUTE',
  Proposal: 'PROPOSAL',
  Relationship: 'RELATIONSHIP',
  SampleApplication: 'SAMPLE_APPLICATION'
} as const;

export type AffiliateRelationshipAgendaSourceType = typeof AffiliateRelationshipAgendaSourceType[keyof typeof AffiliateRelationshipAgendaSourceType];
export interface AffiliateRelationshipEntityPageInput {
  creatorRelationshipId: Scalars['ID']['input'];
  cursor?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  shopId?: InputMaybe<Scalars['ID']['input']>;
}

export interface AffiliateRelationshipPlatformCollaborationItem {
  collaboration: AffiliateCollaboration;
  sources: Array<AffiliateRelationshipPlatformCollaborationSource>;
}

export interface AffiliateRelationshipPlatformCollaborationPage {
  hasMore: Scalars['Boolean']['output'];
  items: Array<AffiliateRelationshipPlatformCollaborationItem>;
  nextCursor?: Maybe<Scalars['String']['output']>;
  productSummaries: Array<AffiliateRelationshipProductSummary>;
}

/** Why a platform Collaboration belongs in this CreatorRelationship view. */
export const AffiliateRelationshipPlatformCollaborationSource = {
  SampleReference: 'SAMPLE_REFERENCE',
  TargetMembership: 'TARGET_MEMBERSHIP'
} as const;

export type AffiliateRelationshipPlatformCollaborationSource = typeof AffiliateRelationshipPlatformCollaborationSource[keyof typeof AffiliateRelationshipPlatformCollaborationSource];
/** CreatorRelationship agenda owner state. This is relationship-level and should not encode sample or collaboration lifecycle details. */
export const AffiliateRelationshipProcessingStatus = {
  AgentRequired: 'AGENT_REQUIRED',
  ExternalWaiting: 'EXTERNAL_WAITING',
  Idle: 'IDLE',
  StaffRequired: 'STAFF_REQUIRED'
} as const;

export type AffiliateRelationshipProcessingStatus = typeof AffiliateRelationshipProcessingStatus[keyof typeof AffiliateRelationshipProcessingStatus];
export interface AffiliateRelationshipProductSummary {
  product: EcomProductSummary;
  shopId: Scalars['ID']['output'];
}

/** CreatorRelationship agenda next step. Concrete platform work is surfaced here; detailed sample and fulfillment state stays on SampleApplication, while Open/Target inventory stays on AffiliateCollaboration. */
export const AffiliateRelationshipRequiredAction = {
  CompleteCollaborationTask: 'COMPLETE_COLLABORATION_TASK',
  FollowUpCreator: 'FOLLOW_UP_CREATOR',
  HandleCreatorMessage: 'HANDLE_CREATOR_MESSAGE',
  HandleSampleTerminalState: 'HANDLE_SAMPLE_TERMINAL_STATE',
  NoAction: 'NO_ACTION',
  ResolveCreatorIdentity: 'RESOLVE_CREATOR_IDENTITY',
  ReviewAgentFailure: 'REVIEW_AGENT_FAILURE',
  ReviewAmbiguousContext: 'REVIEW_AMBIGUOUS_CONTEXT',
  ReviewSampleApplication: 'REVIEW_SAMPLE_APPLICATION',
  ShipSample: 'SHIP_SAMPLE',
  WaitCreatorResponse: 'WAIT_CREATOR_RESPONSE',
  WaitPlatformUpdate: 'WAIT_PLATFORM_UPDATE'
} as const;

export type AffiliateRelationshipRequiredAction = typeof AffiliateRelationshipRequiredAction[keyof typeof AffiliateRelationshipRequiredAction];
export interface AffiliateRelationshipSampleApplicationPage {
  hasMore: Scalars['Boolean']['output'];
  items: Array<SampleApplicationRecord>;
  nextCursor?: Maybe<Scalars['String']['output']>;
  productSummaries: Array<AffiliateRelationshipProductSummary>;
}

/** Ephemeral affiliate work signal pushed to desktop after backend materializes a reducer event. */
export interface AffiliateRelationshipSignal {
  /** Optional related AffiliateCollaboration platform ID when the relationship-level signal has a resolved collaboration context. */
  affiliateCollaborationId?: Maybe<Scalars['ID']['output']>;
  /** Provider Sample Application approval expiration as Unix seconds. */
  approveExpirationTime?: Maybe<Scalars['Int']['output']>;
  /** Sample shipment carrier or logistics provider when available. */
  carrier?: Maybe<Scalars['String']['output']>;
  /** Outreach channel where the relationship-level message was observed. */
  channel?: Maybe<AffiliateMessageChannel>;
  /** Open or target collaboration type when known. */
  collaborationType?: Maybe<AffiliateCollaborationType>;
  /** Sample commission snapshot as a decimal ratio in [0, 1]. */
  commissionRate?: Maybe<Scalars['Float']['output']>;
  /** Observed content comment count when available. */
  contentCommentCount?: Maybe<Scalars['Float']['output']>;
  /** Observed content description/title when available. */
  contentDescription?: Maybe<Scalars['String']['output']>;
  /** Observed content format, e.g. VIDEO or LIVE. */
  contentFormat?: Maybe<Scalars['String']['output']>;
  /** Platform content ID when tied to content/order attribution sync. */
  contentId?: Maybe<Scalars['String']['output']>;
  /** Observed content like count when available. */
  contentLikeCount?: Maybe<Scalars['Float']['output']>;
  /** Observed TikTok content page link when available. */
  contentPageLink?: Maybe<Scalars['String']['output']>;
  /** Observed paid order count attributed to the content when available. */
  contentPaidOrderCount?: Maybe<Scalars['Float']['output']>;
  /** Observed content source URL when available. */
  contentUrl?: Maybe<Scalars['String']['output']>;
  /** Observed content view count when available. */
  contentViewCount?: Maybe<Scalars['Float']['output']>;
  /** Best-known creator avatar URL carried by platform sync when available. */
  creatorAvatarUrl?: Maybe<Scalars['String']['output']>;
  /** Sample Application 30-day content count. */
  creatorContentCount30d?: Maybe<Scalars['Int']['output']>;
  /** Best-known creator follower count carried by platform sync when available. */
  creatorFollowerCount?: Maybe<Scalars['Float']['output']>;
  /** Sample Application 30-day GMV amount. */
  creatorGmv30dAmount?: Maybe<Scalars['String']['output']>;
  /** ISO 4217 currency for the Sample Application 30-day GMV. */
  creatorGmv30dCurrency?: Maybe<Scalars['String']['output']>;
  /** Creator IM user ID when available from the platform event. */
  creatorImId?: Maybe<Scalars['String']['output']>;
  /** Best-known creator display nickname carried by platform sync when available. */
  creatorNickname?: Maybe<Scalars['String']['output']>;
  /** Creator open ID when carried by the webhook/API event. */
  creatorOpenId?: Maybe<Scalars['String']['output']>;
  /** User-level AffiliateCreatorRelationship ID for channel-agnostic affiliate sessions. */
  creatorRelationshipId?: Maybe<Scalars['ID']['output']>;
  /** Best-known creator username carried by platform sync when available. */
  creatorUsername?: Maybe<Scalars['String']['output']>;
  /** When the platform event happened or the affiliate condition was detected. */
  eventTime: Scalars['DateTimeISO']['output'];
  /** Observed direction of an affiliate IM message. */
  messageDirection?: Maybe<AffiliateCreatorMessageDirection>;
  /** Platform message ID when tied to a creator message. */
  messageId?: Maybe<Scalars['String']['output']>;
  /** Platform message index when available from the creator chat webhook. */
  messageIndex?: Maybe<Scalars['String']['output']>;
  /** Platform message type, e.g. TEXT or IMAGE, when tied to a message. */
  messageType?: Maybe<Scalars['String']['output']>;
  /** Platform notification ID for webhook de-duplication or diagnostics. */
  notificationId?: Maybe<Scalars['String']['output']>;
  /** Order ID when tied to an affiliate order attribution. */
  orderId?: Maybe<Scalars['String']['output']>;
  /** Platform sample application ID when tied to a sample workflow update. */
  platformApplicationId?: Maybe<Scalars['String']['output']>;
  /** Platform collaboration ID normalized across open and target collaborations. */
  platformCollaborationId?: Maybe<Scalars['String']['output']>;
  /** Platform content/fulfillment ID when tied to content fulfillment sync. */
  platformFulfillmentId?: Maybe<Scalars['String']['output']>;
  /** Platform content fulfillment status when tied to sample fulfillment sync. */
  platformFulfillmentStatus?: Maybe<TikTokSampleContentFulfillmentPlatformStatus>;
  /** Platform open collaboration ID when tied to an open collaboration sample/update. */
  platformOpenCollaborationId?: Maybe<Scalars['String']['output']>;
  /** Platform affiliate program ID when tied to order attribution. */
  platformProgramId?: Maybe<Scalars['String']['output']>;
  /** Platform shop ID from the commerce platform webhook/API. */
  platformShopId: Scalars['String']['output'];
  /** Platform status string carried by the webhook/API event. */
  platformStatus?: Maybe<Scalars['String']['output']>;
  /** Platform target collaboration ID when tied to a target-collaboration update. */
  platformTargetCollaborationId?: Maybe<Scalars['String']['output']>;
  /** Backend-computed seller-turn reasons after materializing the event. */
  processReasons?: Maybe<Array<AffiliateWorkProcessReason>>;
  /** Backend-computed relationship agenda status after materializing the event. */
  processingStatus?: Maybe<AffiliateRelationshipProcessingStatus>;
  /** Product ID when carried by a sample or collaboration event. */
  productId?: Maybe<Scalars['String']['output']>;
  /** Backend-computed relationship agenda next action after materializing the event. */
  requiredAction?: Maybe<AffiliateRelationshipRequiredAction>;
  /** Platform sender ID when available. */
  senderId?: Maybe<Scalars['String']['output']>;
  /** Sender role from the platform event, e.g. CREATOR. */
  senderRole?: Maybe<Scalars['String']['output']>;
  /** MongoDB shop ID. Used for ownership checks and desktop shop routing. */
  shopId: Scalars['ID']['output'];
  /** System that emitted this signal. */
  source: AffiliateRelationshipSignalSource;
  /** Sample shipment tracking number when available. */
  trackingNumber?: Maybe<Scalars['String']['output']>;
  /** Business event that happened or was detected for affiliate operations. */
  type: AffiliateRelationshipSignalType;
  /** True when this payload represents seller-turn work that should be considered for desktop agent dispatch. */
  workSignal: Scalars['Boolean']['output'];
}

/** Origin of an affiliate signal */
export const AffiliateRelationshipSignalSource = {
  Airflow: 'AIRFLOW',
  Manual: 'MANUAL',
  PlatformAction: 'PLATFORM_ACTION',
  Webhook: 'WEBHOOK'
} as const;

export type AffiliateRelationshipSignalSource = typeof AffiliateRelationshipSignalSource[keyof typeof AffiliateRelationshipSignalSource];
/** Affiliate reducer event type. Events materialize CreatorRelationship state and may carry provider-route evidence. */
export const AffiliateRelationshipSignalType = {
  AffiliateRelationshipMessageObserved: 'AFFILIATE_RELATIONSHIP_MESSAGE_OBSERVED',
  AffiliateSampleApplicationObserved: 'AFFILIATE_SAMPLE_APPLICATION_OBSERVED',
  AffiliateSampleFulfillmentObserved: 'AFFILIATE_SAMPLE_FULFILLMENT_OBSERVED',
  AffiliateTargetCollaborationObserved: 'AFFILIATE_TARGET_COLLABORATION_OBSERVED',
  AffiliateTimerDue: 'AFFILIATE_TIMER_DUE'
} as const;

export type AffiliateRelationshipSignalType = typeof AffiliateRelationshipSignalType[keyof typeof AffiliateRelationshipSignalType];
export interface AffiliateRelationshipTimelineEvent {
  actorRole?: Maybe<AffiliateLifecycleActorRole>;
  decisionRelevant: Scalars['Boolean']['output'];
  displaySummary?: Maybe<Scalars['String']['output']>;
  entityId: Scalars['ID']['output'];
  entityType: AffiliateLifecycleEntityType;
  eventType: AffiliateLifecycleEventType;
  fromStage?: Maybe<AffiliateLifecycleStage>;
  lifecycleEventId: Scalars['ID']['output'];
  relationshipSequence?: Maybe<Scalars['Int']['output']>;
  toStage?: Maybe<AffiliateLifecycleStage>;
}

export interface AffiliateRelationshipTimelineInput {
  after?: InputMaybe<Scalars['Int']['input']>;
  /** Optional item/message/time anchor for reading a bounded window around one timeline point. */
  anchor?: InputMaybe<AffiliateTimelineAnchorInput>;
  before?: InputMaybe<Scalars['Int']['input']>;
  /** Optional message-channel filter. It applies only to MESSAGE items. */
  channels?: InputMaybe<Array<AffiliateMessageChannel>>;
  /** CreatorRelationship business boundary. Messages and immutable relationship events are merged chronologically. */
  creatorRelationshipId: Scalars['ID']['input'];
  cursor?: InputMaybe<Scalars['String']['input']>;
  endAt?: InputMaybe<Scalars['DateTimeISO']['input']>;
  /** Optional lifecycle-event filter. It applies to BUSINESS_EVENT and ACTION_EVENT items. */
  eventTypes?: InputMaybe<Array<AffiliateLifecycleEventType>>;
  /** Optional multi-select category filter. Empty or omitted means all real item types. */
  itemTypes?: InputMaybe<Array<AffiliateRelationshipTimelineItemType>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  /** Optional authorized shop filter. Omitted means the complete cross-shop CreatorRelationship timeline. */
  shopIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  startAt?: InputMaybe<Scalars['DateTimeISO']['input']>;
}

export interface AffiliateRelationshipTimelineItem {
  actionEvent?: Maybe<AffiliateRelationshipTimelineEvent>;
  actorRole?: Maybe<AffiliateLifecycleActorRole>;
  actorType?: Maybe<AffiliateLifecycleActorType>;
  businessEvent?: Maybe<AffiliateRelationshipTimelineEvent>;
  id: Scalars['ID']['output'];
  kind: AffiliateRelationshipTimelineItemKind;
  message?: Maybe<AffiliateRelationshipTimelineMessage>;
  occurredAt: Scalars['DateTimeISO']['output'];
  relatedIds: AffiliateRelationshipTimelineRelatedIds;
  summary: Scalars['String']['output'];
  timePassed?: Maybe<AffiliateTimelineTimePassed>;
}

/** Returned timeline item kind, including response-only temporal markers. */
export const AffiliateRelationshipTimelineItemKind = {
  ActionEvent: 'ACTION_EVENT',
  BusinessEvent: 'BUSINESS_EVENT',
  Message: 'MESSAGE',
  TimePassed: 'TIME_PASSED'
} as const;

export type AffiliateRelationshipTimelineItemKind = typeof AffiliateRelationshipTimelineItemKind[keyof typeof AffiliateRelationshipTimelineItemKind];
/** Real item categories selectable in a CreatorRelationship timeline read. */
export const AffiliateRelationshipTimelineItemType = {
  ActionEvent: 'ACTION_EVENT',
  BusinessEvent: 'BUSINESS_EVENT',
  Message: 'MESSAGE'
} as const;

export type AffiliateRelationshipTimelineItemType = typeof AffiliateRelationshipTimelineItemType[keyof typeof AffiliateRelationshipTimelineItemType];
export interface AffiliateRelationshipTimelineMessage {
  accountLabel?: Maybe<Scalars['String']['output']>;
  channel: AffiliateMessageChannel;
  channelLabel?: Maybe<Scalars['String']['output']>;
  direction?: Maybe<AffiliateCreatorMessageDirection>;
  messageRef?: Maybe<Scalars['String']['output']>;
  messageType?: Maybe<Scalars['String']['output']>;
  parts?: Maybe<Array<AffiliateHistoryPart>>;
  shopName?: Maybe<Scalars['String']['output']>;
  subject?: Maybe<Scalars['String']['output']>;
  textPreview?: Maybe<Scalars['String']['output']>;
}

export interface AffiliateRelationshipTimelinePayload {
  creatorRelationship: AffiliateCreatorRelationship;
  hasOlder: Scalars['Boolean']['output'];
  items: Array<AffiliateRelationshipTimelineItem>;
  limit: Scalars['Int']['output'];
  olderCursor?: Maybe<Scalars['String']['output']>;
  readAt: Scalars['DateTimeISO']['output'];
  realItemCount: Scalars['Int']['output'];
}

export interface AffiliateRelationshipTimelineRelatedIds {
  actionProposalId?: Maybe<Scalars['ID']['output']>;
  affiliateCollaborationId?: Maybe<Scalars['ID']['output']>;
  creatorId?: Maybe<Scalars['ID']['output']>;
  lifecycleEventId?: Maybe<Scalars['ID']['output']>;
  /** Provider audit id when an event originated from TikTok. */
  platformApplicationId?: Maybe<Scalars['String']['output']>;
  productId?: Maybe<Scalars['String']['output']>;
  sampleApplicationRecordId?: Maybe<Scalars['ID']['output']>;
  shopId?: Maybe<Scalars['ID']['output']>;
}

export interface AffiliateRelationshipWorkSummary {
  agentRequiredCount: Scalars['Int']['output'];
  externalWaitingCount: Scalars['Int']['output'];
  nextActionAt?: Maybe<Scalars['DateTimeISO']['output']>;
  staffRequiredCount: Scalars['Int']['output'];
}

/** Frozen revision source attached only to the Agent working agenda created by a staff revision request. */
export interface AffiliateRevisionRequestedProposalContext {
  decision?: Maybe<ActionProposalDecisionSnapshot>;
  id: Scalars['ID']['output'];
  messageIntent?: Maybe<ActionProposalMessageIntent>;
  operatorSummary: Scalars['String']['output'];
  sampleReviewIntent?: Maybe<ActionProposalSampleReviewIntent>;
  status: ActionProposalStatus;
  steps: Array<ActionProposalStep>;
  targetCollaborationIntent?: Maybe<ActionProposalTargetCollaborationIntent>;
  type: ActionProposalType;
}

/** Authority state of the current sample-application lookup. UNVERIFIED means neither presence nor absence has been established by Provider/workspace facts. */
export interface AffiliateSampleApplicationLookupContext {
  productIds: Array<Scalars['String']['output']>;
  queriedAt: Scalars['DateTimeISO']['output'];
  shopId?: Maybe<Scalars['ID']['output']>;
  status: AffiliateSampleApplicationLookupStatus;
}

/** Authority state of matching sample applications: confirmed present, confirmed absent, or unverified. */
export const AffiliateSampleApplicationLookupStatus = {
  ConfirmedAbsent: 'CONFIRMED_ABSENT',
  ConfirmedPresent: 'CONFIRMED_PRESENT',
  Unverified: 'UNVERIFIED'
} as const;

export type AffiliateSampleApplicationLookupStatus = typeof AffiliateSampleApplicationLookupStatus[keyof typeof AffiliateSampleApplicationLookupStatus];
/** Current Mongo control-plane lookup for one sample application under a CreatorRelationship. */
export interface AffiliateSampleApplicationStatePayload {
  complete: Scalars['Boolean']['output'];
  coverageComplete: Scalars['Boolean']['output'];
  currentStatus: AffiliateOperationalProjectionStatus;
  found: Scalars['Boolean']['output'];
  historyCutoffAt?: Maybe<Scalars['DateTimeISO']['output']>;
  historyStatus: AffiliateOperationalProjectionStatus;
  lastHeadSyncAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastHistorySyncAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastSuccessfulSyncAt?: Maybe<Scalars['DateTimeISO']['output']>;
  observedAt: Scalars['DateTimeISO']['output'];
  oldestCoveredAt?: Maybe<Scalars['DateTimeISO']['output']>;
  projectionStatus: AffiliateOperationalProjectionStatus;
  providerWindowLimited: Scalars['Boolean']['output'];
  readAt: Scalars['DateTimeISO']['output'];
  sampleApplication?: Maybe<SampleApplicationRecord>;
  source: AffiliateProviderReadSource;
}

export const AffiliateSampleCollaborationLinkBasis = {
  DirectProviderId: 'DIRECT_PROVIDER_ID',
  TargetSearchContext: 'TARGET_SEARCH_CONTEXT',
  UniqueOpenProductMatch: 'UNIQUE_OPEN_PRODUCT_MATCH'
} as const;

export type AffiliateSampleCollaborationLinkBasis = typeof AffiliateSampleCollaborationLinkBasis[keyof typeof AffiliateSampleCollaborationLinkBasis];
export const AffiliateSampleCommissionRateSource = {
  MysqlProviderPayloadMigration: 'MYSQL_PROVIDER_PAYLOAD_MIGRATION',
  ProviderSampleApplicationHydration: 'PROVIDER_SAMPLE_APPLICATION_HYDRATION',
  ProviderSampleApplicationSearch: 'PROVIDER_SAMPLE_APPLICATION_SEARCH'
} as const;

export type AffiliateSampleCommissionRateSource = typeof AffiliateSampleCommissionRateSource[keyof typeof AffiliateSampleCommissionRateSource];
export const AffiliateSampleRejectReason = {
  CreatorBlacklisted: 'CREATOR_BLACKLISTED',
  DuplicateApplication: 'DUPLICATE_APPLICATION',
  LowExpectedSales: 'LOW_EXPECTED_SALES',
  NotMatch: 'NOT_MATCH',
  Offline: 'OFFLINE',
  Other: 'OTHER',
  OutOfStock: 'OUT_OF_STOCK',
  PlatformError: 'PLATFORM_ERROR'
} as const;

export type AffiliateSampleRejectReason = typeof AffiliateSampleRejectReason[keyof typeof AffiliateSampleRejectReason];
export const AffiliateSampleReviewDecision = {
  Approve: 'APPROVE',
  Reject: 'REJECT'
} as const;

export type AffiliateSampleReviewDecision = typeof AffiliateSampleReviewDecision[keyof typeof AffiliateSampleReviewDecision];
/** Why a Sample Application reached the terminal state that opened seller follow-up work. Frozen by the Backend from the transition event; consumers read it verbatim and never re-derive it. UNDETERMINED means the platform did not say, and no cause may be presented to the Creator. */
export const AffiliateSampleTerminalCause = {
  ApprovalWindowExpired: 'APPROVAL_WINDOW_EXPIRED',
  ContentObligationUnfulfilled: 'CONTENT_OBLIGATION_UNFULFILLED',
  CreatorWithdrew: 'CREATOR_WITHDREW',
  PlatformForcedRejection: 'PLATFORM_FORCED_REJECTION',
  PlatformOperationsClosed: 'PLATFORM_OPERATIONS_CLOSED',
  SellerDidNotShip: 'SELLER_DID_NOT_SHIP',
  Undetermined: 'UNDETERMINED',
  Unfulfillable: 'UNFULFILLABLE'
} as const;

export type AffiliateSampleTerminalCause = typeof AffiliateSampleTerminalCause[keyof typeof AffiliateSampleTerminalCause];
/** Frozen reason a Sample Application reached the terminal state that opened this follow-up. Classified by the Backend from the immutable transition event, because the Sample row keeps no transition history and cannot recover it. */
export interface AffiliateSampleTerminalStateContext {
  /** The producer-side verdict. Read it verbatim: three very different endings share the CANCELLED work status, and only this field separates them. UNDETERMINED means the platform did not say why, and no cause may then be presented to the Creator. */
  cause: AffiliateSampleTerminalCause;
  /** Raw Provider application status frozen with the transition, for audit. Provenance only — the cause above is the verdict and must not be re-derived from this. Absent when the transition carried no application status. */
  platformStatus?: Maybe<Scalars['String']['output']>;
  /** The terminal work status the Sample Application landed in. */
  sampleWorkStatus: SampleWorkStatus;
}

export interface AffiliateSellerContactInfoInput {
  email: Scalars['String']['input'];
  line?: InputMaybe<Scalars['String']['input']>;
  phoneNumber?: InputMaybe<Scalars['String']['input']>;
  telegram?: InputMaybe<Scalars['String']['input']>;
  whatsapp?: InputMaybe<Scalars['String']['input']>;
}

/** Affiliate creator-management settings per shop (user-configurable) */
export interface AffiliateServiceSettings {
  /** Write-once cutoff for pre-automation affiliate history. Set when affiliate service is first enabled with an assigned device. */
  baselineCutoffAt?: Maybe<Scalars['DateTimeISO']['output']>;
  /** Per-shop affiliate business instructions injected into affiliate agent runs. */
  businessPrompt?: Maybe<Scalars['String']['output']>;
  /** Seller-configured maximum creators contacted automatically by Affiliate Campaigns per shop-local day. This is not a TikTok Provider quota. */
  campaignDailyCreatorOutreachLimit?: Maybe<Scalars['Int']['output']>;
  campaignDailyCreatorOutreachLimitRevision: Scalars['Int']['output'];
  campaignDailyCreatorOutreachLimitUpdatedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  /** Shop-level decision references for Agent interpretation. Campaign selection uses only thresholds explicitly frozen in that Campaign. */
  decisionThresholds?: Maybe<AffiliateDecisionThresholds>;
  /** Device ID of the desktop instance handling affiliate inbound signals for this shop. Empty or null means no device assigned. */
  deviceId?: Maybe<Scalars['String']['output']>;
  /** Whether affiliate creator-management inbound automation is enabled for this shop. */
  enabled: Scalars['Boolean']['output'];
  /** RunProfile ID for affiliate creator-management agent sessions. */
  runProfileId?: Maybe<Scalars['String']['output']>;
}

/** Affiliate creator-management settings patch. Omit a field or pass null to keep it; pass empty string to clear string fields; pass a value to set it. */
export interface AffiliateServiceSettingsInput {
  /** Per-shop affiliate business instructions. Omit or pass null to keep, empty string to clear. */
  businessPrompt?: InputMaybe<Scalars['String']['input']>;
  /** Maximum creators contacted automatically by Campaigns per shop-local day. Omit or null to keep the existing value; valid range 1-20000. */
  campaignDailyCreatorOutreachLimit?: InputMaybe<Scalars['Int']['input']>;
  /** Shop-level Affiliate decision references. Omit or pass null to keep, empty object to clear. These do not directly approve or reject Sample Applications. */
  decisionThresholds?: InputMaybe<AffiliateDecisionThresholdsInput>;
  /** Device ID of the desktop instance handling affiliate inbound signals. Omit or pass null to keep, empty string to clear. */
  deviceId?: InputMaybe<Scalars['String']['input']>;
  /** Affiliate service enabled flag. Omit or pass null to keep, true/false to set. */
  enabled?: InputMaybe<Scalars['Boolean']['input']>;
  /** RunProfile ID for affiliate sessions. Omit or pass null to keep, empty string to clear. */
  runProfileId?: InputMaybe<Scalars['String']['input']>;
}

export interface AffiliateShopOperationProposalPayload {
  actionMode: AffiliateActionRequestMode;
  collaboration?: Maybe<AffiliateCollaboration>;
  proposal: ActionProposal;
}

export interface AffiliateTargetCollaborationCreateProductInput {
  productId: Scalars['String']['input'];
  shopAdsCommissionRateBps?: InputMaybe<Scalars['Int']['input']>;
  targetCommissionRateBps: Scalars['Int']['input'];
}

/** Seller shop operation performed against a Target Collaboration. */
export const AffiliateTargetCollaborationOperation = {
  Create: 'CREATE',
  Remove: 'REMOVE',
  Update: 'UPDATE'
} as const;

export type AffiliateTargetCollaborationOperation = typeof AffiliateTargetCollaborationOperation[keyof typeof AffiliateTargetCollaborationOperation];
export interface AffiliateTargetCollaborationUpdateProductInput {
  commissionRateBps: Scalars['Int']['input'];
  productId: Scalars['String']['input'];
  targetAdCommissionRateBps?: InputMaybe<Scalars['Int']['input']>;
}

export interface AffiliateTimelineAnchorInput {
  itemId?: InputMaybe<Scalars['ID']['input']>;
  messageRef?: InputMaybe<Scalars['String']['input']>;
  occurredAt?: InputMaybe<Scalars['DateTimeISO']['input']>;
}

export interface AffiliateTimelineTimePassed {
  basis: AffiliateTimelineTimePassedBasis;
  durationHuman: Scalars['String']['output'];
  durationSeconds: Scalars['Float']['output'];
  fromAt: Scalars['DateTimeISO']['output'];
  toAt: Scalars['DateTimeISO']['output'];
}

export const AffiliateTimelineTimePassedBasis = {
  BetweenReturnedItems: 'BETWEEN_RETURNED_ITEMS',
  UntilCurrentRead: 'UNTIL_CURRENT_READ'
} as const;

export type AffiliateTimelineTimePassedBasis = typeof AffiliateTimelineTimePassedBasis[keyof typeof AffiliateTimelineTimePassedBasis];
export interface AffiliateWhatsAppMessagesInput {
  /** CreatorRelationship business boundary. This legacy WhatsApp-only read path is still relationship-scoped and does not accept creator/profile fallback keys. */
  creatorRelationshipId: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}

/** Record-level merged work bundle kind consumed by the affiliate agent-run factory. */
export const AffiliateWorkBundleKind = {
  ContentFollowUp: 'CONTENT_FOLLOW_UP',
  CreatorFollowUp: 'CREATOR_FOLLOW_UP',
  CreatorReplyOnly: 'CREATOR_REPLY_ONLY',
  CreatorReplyWithSampleReview: 'CREATOR_REPLY_WITH_SAMPLE_REVIEW',
  GeneralReview: 'GENERAL_REVIEW',
  ObservationOnly: 'OBSERVATION_ONLY',
  PlatformWaitOnly: 'PLATFORM_WAIT_ONLY',
  SampleReviewOnly: 'SAMPLE_REVIEW_ONLY',
  SampleShipmentStaffReview: 'SAMPLE_SHIPMENT_STAFF_REVIEW',
  StaffReviewOnly: 'STAFF_REVIEW_ONLY'
} as const;

export type AffiliateWorkBundleKind = typeof AffiliateWorkBundleKind[keyof typeof AffiliateWorkBundleKind];
/** Relationship-centered context resolved by backend before Desktop dispatches an affiliate agent. */
export interface AffiliateWorkContext {
  activeCollaborations: Array<AffiliateCollaboration>;
  affiliateCollaboration?: Maybe<AffiliateCollaboration>;
  ambiguousCollaborationCandidates: Array<AffiliateCollaboration>;
  creatorProfile?: Maybe<AffiliateCreatorIdentity>;
  creatorRelation?: Maybe<AffiliateCreatorRelationship>;
  focusCollaboration?: Maybe<AffiliateCollaboration>;
  missingContext: Array<AffiliateWorkMissingContext>;
  primarySampleApplication?: Maybe<SampleApplicationRecord>;
  productContext?: Maybe<AffiliateWorkProductContext>;
  recommendedActionTypes: Array<ActionProposalType>;
  relatedSampleApplications: Array<SampleApplicationRecord>;
  sampleApplicationLookup: AffiliateSampleApplicationLookupContext;
}

/** Backend-materialized affiliate work projection. Desktop should treat this as the current source of truth for dispatch/review, not reconstruct work from raw signals. */
export interface AffiliateWorkItem {
  affiliateCollaboration?: Maybe<AffiliateCollaboration>;
  /** Optional canonical platform Collaboration context inside the CreatorRelationship. */
  affiliateCollaborationId?: Maybe<Scalars['ID']['output']>;
  /** True when desktop should consider starting an affiliate agent run for this work item. */
  agentDispatchRecommended: Scalars['Boolean']['output'];
  agentEligibilityReason: AffiliateAgentEligibilityReason;
  /** Current Agent working agenda. Revision-requested proposals are attached only to the agenda item that caused the dispatch. */
  agentWorkingAgendaItems: Array<AffiliateRelationshipAgendaItem>;
  businessDeveloperConfigRevision?: Maybe<Scalars['Int']['output']>;
  businessDeveloperIdSnapshot?: Maybe<Scalars['ID']['output']>;
  context: AffiliateWorkContext;
  creatorProtected: Scalars['Boolean']['output'];
  creatorRelationship: AffiliateCreatorRelationship;
  /** Primary CreatorRelationship workspace ID for this work item. Agent sessions, proposals, and action history should be anchored here. */
  creatorRelationshipId: Scalars['ID']['output'];
  /** Stable work-item ID. Relationship-level work items use the CreatorRelationship ID. */
  id: Scalars['ID']['output'];
  processReasons: Array<AffiliateWorkProcessReason>;
  processingStatus: AffiliateRelationshipProcessingStatus;
  recommendedActionTypes: Array<ActionProposalType>;
  relationshipOperationalConfigRevision: Scalars['Int']['output'];
  requiredAction: AffiliateRelationshipRequiredAction;
  /** Operational desktop-routing platform shop IDs for this relationship work item. These are routing scopes, not business owners. */
  routingPlatformShopIds: Array<Scalars['String']['output']>;
  /** Operational desktop-routing shop IDs for this relationship work item. These are routing scopes, not business owners. */
  routingShopIds: Array<Scalars['ID']['output']>;
  sampleApplicationRecord?: Maybe<SampleApplicationRecord>;
  sampleApplicationRecordId?: Maybe<Scalars['ID']['output']>;
  /** True when the item should appear in staff review surfaces even if no agent run should start. */
  staffReviewRequired: Scalars['Boolean']['output'];
  /** Business subject for dispatch. New affiliate work should use CREATOR_RELATIONSHIP as the primary workspace boundary. */
  subjectType: AffiliateWorkItemSubjectType;
  triggerChannel?: Maybe<AffiliateMessageChannel>;
  triggerLifecycleEventId?: Maybe<Scalars['ID']['output']>;
  /** Platform shop that produced the primary agenda event for this dispatch. It is provenance only. */
  triggerPlatformShopId: Scalars['String']['output'];
  /** Shop that produced the primary agenda event for this dispatch. It is provenance only, not the Relationship read boundary or a universal action destination. */
  triggerShopId: Scalars['ID']['output'];
  /** Projection version timestamp. Desktop can use this for idempotent upsert. */
  versionAt: Scalars['DateTimeISO']['output'];
  /** Stable semantic WorkItem version used for Desktop idempotency. */
  versionKey: Scalars['String']['output'];
  workBundleKind: AffiliateWorkBundleKind;
  workKind: AffiliateWorkKind;
}

/** Subscription payload for a changed affiliate work projection. */
export interface AffiliateWorkItemChanged {
  workItem: AffiliateWorkItem;
}

/** Terminal decision for an agent-dispatched affiliate work item. */
export const AffiliateWorkItemResolutionDecision = {
  /** The work could not be completed in this run. */
  FailedOrIncomplete: 'FAILED_OR_INCOMPLETE',
  /** The work was reviewed and completed without a platform action, including when a Creator message does not warrant a reply. */
  NoActionNeeded: 'NO_ACTION_NEEDED',
  /** The work requires one or more concrete platform actions. */
  RequestAction: 'REQUEST_ACTION'
} as const;

export type AffiliateWorkItemResolutionDecision = typeof AffiliateWorkItemResolutionDecision[keyof typeof AffiliateWorkItemResolutionDecision];
/** Primary subject for an affiliate work item. */
export const AffiliateWorkItemSubjectType = {
  CreatorRelationship: 'CREATOR_RELATIONSHIP'
} as const;

export type AffiliateWorkItemSubjectType = typeof AffiliateWorkItemSubjectType[keyof typeof AffiliateWorkItemSubjectType];
/** Backend-derived affiliate work item kind consumed by desktop agent-run factories and review UI. */
export const AffiliateWorkKind = {
  ContentFollowUp: 'CONTENT_FOLLOW_UP',
  CreatorFollowUp: 'CREATOR_FOLLOW_UP',
  IdentityResolution: 'IDENTITY_RESOLUTION',
  InboundMessageTriage: 'INBOUND_MESSAGE_TRIAGE',
  ManualReview: 'MANUAL_REVIEW',
  ObservationReview: 'OBSERVATION_REVIEW',
  SampleApplicationDecision: 'SAMPLE_APPLICATION_DECISION',
  SamplePlatformFulfillmentWait: 'SAMPLE_PLATFORM_FULFILLMENT_WAIT',
  SamplePlatformTerminalFollowUp: 'SAMPLE_PLATFORM_TERMINAL_FOLLOW_UP',
  SampleShipment: 'SAMPLE_SHIPMENT'
} as const;

export type AffiliateWorkKind = typeof AffiliateWorkKind[keyof typeof AffiliateWorkKind];
export interface AffiliateWorkMissingContext {
  message: Scalars['String']['output'];
  reason: AffiliateWorkMissingContextReason;
  severity: AffiliateWorkMissingContextSeverity;
}

/** Typed missing-context diagnostic for backend-resolved affiliate work context. */
export const AffiliateWorkMissingContextReason = {
  CollaborationOfferMissing: 'COLLABORATION_OFFER_MISSING',
  CreatorOpenIdMissing: 'CREATOR_OPEN_ID_MISSING',
  CreatorProfileMissing: 'CREATOR_PROFILE_MISSING',
  PlatformChatRouteMissing: 'PLATFORM_CHAT_ROUTE_MISSING',
  SampleApplicationMissing: 'SAMPLE_APPLICATION_MISSING'
} as const;

export type AffiliateWorkMissingContextReason = typeof AffiliateWorkMissingContextReason[keyof typeof AffiliateWorkMissingContextReason];
/** Severity of a missing-context diagnostic for affiliate work. */
export const AffiliateWorkMissingContextSeverity = {
  Blocking: 'BLOCKING',
  Info: 'INFO',
  Warning: 'WARNING'
} as const;

export type AffiliateWorkMissingContextSeverity = typeof AffiliateWorkMissingContextSeverity[keyof typeof AffiliateWorkMissingContextSeverity];
/** Typed backend reasons explaining why a creator collaboration is in its processing state. */
export const AffiliateWorkProcessReason = {
  AgentRunFailed: 'AGENT_RUN_FAILED',
  ChannelOwnershipConflict: 'CHANNEL_OWNERSHIP_CONFLICT',
  CollaborationContextAmbiguous: 'COLLABORATION_CONTEXT_AMBIGUOUS',
  ContentPublished: 'CONTENT_PUBLISHED',
  CreatorActionFollowUpDue: 'CREATOR_ACTION_FOLLOW_UP_DUE',
  CreatorMessageNeedsHandling: 'CREATOR_MESSAGE_NEEDS_HANDLING',
  IdentityResolution: 'IDENTITY_RESOLUTION',
  MessageDeliveryFailed: 'MESSAGE_DELIVERY_FAILED',
  OrderAttributed: 'ORDER_ATTRIBUTED',
  PlatformStateSync: 'PLATFORM_STATE_SYNC',
  ProposalRevisionRequested: 'PROPOSAL_REVISION_REQUESTED',
  SampleAwaitingPlatformShipment: 'SAMPLE_AWAITING_PLATFORM_SHIPMENT',
  SampleAwaitingShipment: 'SAMPLE_AWAITING_SHIPMENT',
  SampleContentFollowUpDue: 'SAMPLE_CONTENT_FOLLOW_UP_DUE',
  SamplePendingReview: 'SAMPLE_PENDING_REVIEW',
  SamplePlatformTerminalState: 'SAMPLE_PLATFORM_TERMINAL_STATE',
  TargetCollaborationAccepted: 'TARGET_COLLABORATION_ACCEPTED',
  UserLevelBlocked: 'USER_LEVEL_BLOCKED'
} as const;

export type AffiliateWorkProcessReason = typeof AffiliateWorkProcessReason[keyof typeof AffiliateWorkProcessReason];
/** Backend-materialized affiliate work projection. Desktop should treat this as the current source of truth for dispatch/review, not reconstruct work from raw signals. */
export interface AffiliateWorkProductContext {
  imageUrl?: Maybe<Scalars['String']['output']>;
  productId: Scalars['String']['output'];
  /** Where this product context was resolved from, e.g. collaboration, sample application, or offer. */
  source?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
}

export interface AffiliateWorkspaceInput {
  campaignId?: InputMaybe<Scalars['ID']['input']>;
  candidateStatus?: InputMaybe<CreatorCandidateStatus>;
  creatorId?: InputMaybe<Scalars['ID']['input']>;
  /** Required CreatorRelationship workspace boundary for affiliate agent work. shopId remains the entitlement and shop-scope filter. */
  creatorRelationshipId: Scalars['ID']['input'];
  includePolicies?: InputMaybe<Scalars['Boolean']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  productId?: InputMaybe<Scalars['String']['input']>;
  proposalStatus?: InputMaybe<ActionProposalStatus>;
  /** Optional local Mongo Sample Application projection focus. */
  sampleApplicationRecordId?: InputMaybe<Scalars['ID']['input']>;
  shopId: Scalars['ID']['input'];
}

/** Compressed affiliate management workspace for agent planning and review. */
export interface AffiliateWorkspacePayload {
  actionProposals: Array<ActionProposal>;
  affiliateCollaborations: Array<AffiliateCollaboration>;
  approvalPolicies: Array<AffiliateApprovalPolicy>;
  campaignProducts: Array<CampaignProduct>;
  campaigns: Array<AffiliateCampaign>;
  candidates: Array<CreatorCandidate>;
  /** Best-known creator profile facts for the selected workspace filters. Use this when a dynamic decision needs creator metrics such as follower count. */
  creatorProfiles: Array<AffiliateCreatorIdentity>;
  creatorRelations: Array<AffiliateCreatorRelationship>;
  creatorTags: Array<CreatorTag>;
  sampleApplicationRecords: Array<SampleApplicationRecord>;
  searchRuns: Array<CreatorSearchRun>;
}

/** Agent-facing CS settings patch. Omit a field or pass null/blank to keep it; pass a concrete non-empty value to set it. This tool cannot clear fields; clear fields manually in shop settings. */
export interface AgentCsSettingsInput {
  /** Store instructions. Omit or pass null to keep, empty string to clear. */
  businessPrompt?: InputMaybe<Scalars['String']['input']>;
  /** CS model override. Omit or pass null to keep, empty string to clear. */
  csModelOverride?: InputMaybe<Scalars['String']['input']>;
  /** CS provider override. Omit or pass null to keep, empty string to clear. */
  csProviderOverride?: InputMaybe<Scalars['String']['input']>;
  /** CS enabled flag. Omit or pass null to keep, true/false to set. */
  enabled?: InputMaybe<Scalars['Boolean']['input']>;
  /** Escalation channel ID. Omit or pass null to keep, empty string to clear. */
  escalationChannelId?: InputMaybe<Scalars['String']['input']>;
  /** Escalation recipient ID. Omit or pass null to keep, empty string to clear. */
  escalationRecipientId?: InputMaybe<Scalars['String']['input']>;
  /** Optimistic concurrency token for an active configuration experiment. Required when disabling reachout/evaluation would stop that experiment. */
  expectedConfigExperimentId?: InputMaybe<Scalars['ID']['input']>;
  /** Optimistic concurrency token for an active holdout experiment. Required when a requested settings change can replace or stop that experiment. */
  expectedHoldoutExperimentId?: InputMaybe<Scalars['ID']['input']>;
  /** Review optimization settings. Omit or pass null to keep. */
  reviewOptimization?: InputMaybe<ReviewOptimizationSettingsInput>;
  /** RunProfile ID for CS. Omit or pass null to keep, empty string to clear. */
  runProfileId?: InputMaybe<Scalars['String']['input']>;
  /** Nested configuration optimization within holdout Treatment traffic. Variant A is always the current production configuration. */
  unpaidOrderConfigExperiment?: InputMaybe<AgentUnpaidOrderConfigExperimentInput>;
  /** Unpaid-order evaluation patch. Omit/null to keep. Read the current evaluation first and pass the active experiment IDs when changing it. */
  unpaidOrderEvaluation?: InputMaybe<AgentUnpaidOrderEvaluationInput>;
  /** Unpaid-order proactive reachout flag. Omit or pass null to keep, true/false to set. */
  unpaidOrderReachoutEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  /** Full replacement for unpaid-order reminder stages. Omit/null to keep. Maximum 3 stages. */
  unpaidOrderReachoutStages?: InputMaybe<Array<UnpaidOrderReachoutStageInput>>;
}

export interface AgentUnpaidOrderConfigExperimentInput {
  enabled: Scalars['Boolean']['input'];
  expectedExperimentId?: InputMaybe<Scalars['String']['input']>;
  /** Full replacement of 2-20 variants. Variant A must be first and its stages must equal the shop's current production unpaid-order stages; A's percentage remains configurable. */
  variants?: InputMaybe<Array<AgentUnpaidOrderConfigVariantInput>>;
}

export interface AgentUnpaidOrderConfigVariantInput {
  label: Scalars['String']['input'];
  percentage: Scalars['Float']['input'];
  stages: Array<UnpaidOrderReachoutStageInput>;
  /** Stable variant key. The first variant must be A and represent current production stages. */
  variantKey: Scalars['String']['input'];
}

export interface AgentUnpaidOrderEvaluationInput {
  enabled?: InputMaybe<Scalars['Boolean']['input']>;
  holdoutPercent?: InputMaybe<Scalars['Int']['input']>;
}

export const AnnouncementActionRole = {
  Primary: 'PRIMARY',
  Secondary: 'SECONDARY'
} as const;

export type AnnouncementActionRole = typeof AnnouncementActionRole[keyof typeof AnnouncementActionRole];
export const AnnouncementActionType = {
  Dismiss: 'DISMISS',
  ExternalUrl: 'EXTERNAL_URL',
  Navigate: 'NAVIGATE'
} as const;

export type AnnouncementActionType = typeof AnnouncementActionType[keyof typeof AnnouncementActionType];
export const AnnouncementCategory = {
  Billing: 'BILLING',
  Marketing: 'MARKETING',
  Product: 'PRODUCT',
  System: 'SYSTEM'
} as const;

export type AnnouncementCategory = typeof AnnouncementCategory[keyof typeof AnnouncementCategory];
export const AnnouncementEventType = {
  Dismiss: 'DISMISS',
  PrimaryClick: 'PRIMARY_CLICK',
  SecondaryClick: 'SECONDARY_CLICK'
} as const;

export type AnnouncementEventType = typeof AnnouncementEventType[keyof typeof AnnouncementEventType];
export const AnnouncementSurface = {
  DesktopModal: 'DESKTOP_MODAL'
} as const;

export type AnnouncementSurface = typeof AnnouncementSurface[keyof typeof AnnouncementSurface];
export const AnnouncementTemplateFormat = {
  SafeHtml: 'SAFE_HTML'
} as const;

export type AnnouncementTemplateFormat = typeof AnnouncementTemplateFormat[keyof typeof AnnouncementTemplateFormat];
export interface ApplyCreatorTagInput {
  creatorId: Scalars['ID']['input'];
  shopId: Scalars['ID']['input'];
  tagId: Scalars['ID']['input'];
}

export interface AssignAffiliateBusinessDeveloperInput {
  businessDeveloperId?: InputMaybe<Scalars['ID']['input']>;
  creatorRelationshipId: Scalars['ID']['input'];
  randomForShopId?: InputMaybe<Scalars['ID']['input']>;
}

/** Authentication response with JWT tokens */
export interface AuthPayload {
  accessToken: Scalars['String']['output'];
  refreshToken: Scalars['String']['output'];
  user: MeResponse;
}

/** Bad-review customer-service reachout settings per shop */
export interface BadReviewReachoutSettings {
  enabled: Scalars['Boolean']['output'];
  /** Only bad reviews created within this many days are eligible for customer-service reachout. Valid range: 1-90. */
  recentDays: Scalars['Int']['output'];
  /** Reviews at or below this star rating are treated as bad reviews. Valid range: 1-3. */
  stars: Scalars['Int']['output'];
}

/** Bad-review customer-service reachout settings patch. Omit or pass null to keep. */
export interface BadReviewReachoutSettingsInput {
  /** Bad-review reachout enabled flag. Omit or pass null to keep. */
  enabled?: InputMaybe<Scalars['Boolean']['input']>;
  /** Recent-review reachout window in days. Valid range: 1-90. Omit or pass null to keep. */
  recentDays?: InputMaybe<Scalars['Int']['input']>;
  /** Bad-review star threshold. Valid range: 1-3. Omit or pass null to keep. */
  stars?: InputMaybe<Scalars['Int']['input']>;
}

export const BillableProduct = {
  EcomAffiliate: 'ECOM_AFFILIATE',
  EcomAnalytics: 'ECOM_ANALYTICS',
  EcomCustomerService: 'ECOM_CUSTOMER_SERVICE',
  EcomInventory: 'ECOM_INVENTORY',
  EcomOnboardingTrialWindow: 'ECOM_ONBOARDING_TRIAL_WINDOW',
  LlmUsage: 'LLM_USAGE'
} as const;

export type BillableProduct = typeof BillableProduct[keyof typeof BillableProduct];
export interface BillingEntitlementStatus {
  allowed: Scalars['Boolean']['output'];
  code: EntitlementDecisionCode;
  product: BillableProduct;
  scopeId: Scalars['String']['output'];
  scopeType: BillingScopeType;
  source?: Maybe<EntitlementGrantSource>;
  subscription?: Maybe<BillingSubscriptionSummary>;
  usage: Array<BillingUsageStatus>;
  validUntil?: Maybe<Scalars['DateTimeISO']['output']>;
}

export interface BillingOverview {
  accountLlm: AccountLlmBillingStatus;
  shops: Array<ShopBillingStatus>;
}

/** Plan definition with pricing and product scope. */
export interface BillingPlanDefinition {
  /** Exchange-rate date used for priceMonthlyCny. */
  exchangeRateDate?: Maybe<Scalars['String']['output']>;
  metered: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  planId: BillingPlanId;
  priceCurrency: Currency;
  priceMonthly: Scalars['String']['output'];
  /** Monthly price converted from USD to CNY using the latest backend exchange-rate snapshot. */
  priceMonthlyCny?: Maybe<Scalars['String']['output']>;
  /** Monthly CNY amount in fen converted from the USD price. */
  priceMonthlyCnyMinor?: Maybe<Scalars['Int']['output']>;
  product: BillableProduct;
  /** USD/CNY rate used for priceMonthlyCny. */
  usdToCnyRate?: Maybe<Scalars['String']['output']>;
}

export const BillingPlanId = {
  EcomCustomerServiceUnlimitedMonthly: 'ECOM_CUSTOMER_SERVICE_UNLIMITED_MONTHLY',
  EcomOnboardingTrialWindow: 'ECOM_ONBOARDING_TRIAL_WINDOW',
  RivonclawAiMax: 'RIVONCLAW_AI_MAX',
  RivonclawAiPlus: 'RIVONCLAW_AI_PLUS',
  RivonclawAiPro: 'RIVONCLAW_AI_PRO'
} as const;

export type BillingPlanId = typeof BillingPlanId[keyof typeof BillingPlanId];
export const BillingProvider = {
  Lakala: 'LAKALA',
  Manual: 'MANUAL',
  Stripe: 'STRIPE'
} as const;

export type BillingProvider = typeof BillingProvider[keyof typeof BillingProvider];
export const BillingRenewalMode = {
  AutoRenews: 'AUTO_RENEWS',
  NonRenewing: 'NON_RENEWING',
  Prepaid: 'PREPAID'
} as const;

export type BillingRenewalMode = typeof BillingRenewalMode[keyof typeof BillingRenewalMode];
export const BillingScopeType = {
  Account: 'ACCOUNT',
  Seller: 'SELLER',
  Shop: 'SHOP'
} as const;

export type BillingScopeType = typeof BillingScopeType[keyof typeof BillingScopeType];
/** A billing subscription for an account- or shop-scoped product. */
export interface BillingSubscription {
  amountMinor: Scalars['Int']['output'];
  cancelAtPeriodEnd: Scalars['Boolean']['output'];
  createdAt: Scalars['DateTimeISO']['output'];
  currency: Currency;
  currentPeriodEnd: Scalars['DateTimeISO']['output'];
  currentPeriodStart: Scalars['DateTimeISO']['output'];
  /** Temporary access deadline after a recurring invoice payment failure. */
  graceUntil?: Maybe<Scalars['DateTimeISO']['output']>;
  id: Scalars['ID']['output'];
  ownerUserId: Scalars['String']['output'];
  planId: BillingPlanId;
  product: BillableProduct;
  /** Time when the latest complimentary service period was granted. */
  promotionGrantedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  /** Admin user ID that granted the latest complimentary service period. */
  promotionGrantedByUserId?: Maybe<Scalars['String']['output']>;
  /** Admin/operator note for a complimentary service-period grant. */
  promotionReason?: Maybe<Scalars['String']['output']>;
  provider: BillingProvider;
  providerCustomerId?: Maybe<Scalars['String']['output']>;
  providerPriceId?: Maybe<Scalars['String']['output']>;
  providerSubscriptionId?: Maybe<Scalars['String']['output']>;
  scopeId: Scalars['String']['output'];
  scopeType: BillingScopeType;
  status: BillingSubscriptionStatus;
  updatedAt: Scalars['DateTimeISO']['output'];
}

export const BillingSubscriptionStartAction = {
  AlreadyActive: 'ALREADY_ACTIVE',
  CheckoutCreated: 'CHECKOUT_CREATED',
  SubscriptionResumed: 'SUBSCRIPTION_RESUMED'
} as const;

export type BillingSubscriptionStartAction = typeof BillingSubscriptionStartAction[keyof typeof BillingSubscriptionStartAction];
export const BillingSubscriptionStatus = {
  Active: 'ACTIVE',
  Canceled: 'CANCELED',
  Expired: 'EXPIRED',
  Incomplete: 'INCOMPLETE',
  PastDue: 'PAST_DUE',
  Trialing: 'TRIALING'
} as const;

export type BillingSubscriptionStatus = typeof BillingSubscriptionStatus[keyof typeof BillingSubscriptionStatus];
export interface BillingSubscriptionSummary {
  amountMinor: Scalars['Int']['output'];
  cancelAtPeriodEnd: Scalars['Boolean']['output'];
  currency: Currency;
  currentPeriodEnd: Scalars['DateTimeISO']['output'];
  currentPeriodStart: Scalars['DateTimeISO']['output'];
  graceUntil?: Maybe<Scalars['DateTimeISO']['output']>;
  planId: BillingPlanId;
  provider: BillingProvider;
  renewalMode: BillingRenewalMode;
  status: BillingSubscriptionStatus;
}

export interface BillingUsageStatus {
  metric: UsageMetric;
  refreshAt: Scalars['DateTimeISO']['output'];
  /** Percentage of the quota still available, from 0 to 100. */
  remainingPercent: Scalars['Float']['output'];
  /** Percentage of the quota already consumed, from 0 to 100. */
  usedPercent: Scalars['Float']['output'];
  window: UsageLimitWindow;
}

/** The initial account form shown when the browser has no active session. */
export const BrowserToDesktopAuthIntent = {
  Login: 'LOGIN',
  Register: 'REGISTER'
} as const;

export type BrowserToDesktopAuthIntent = typeof BrowserToDesktopAuthIntent[keyof typeof BrowserToDesktopAuthIntent];
export interface BrowserToDesktopCodeInput {
  code: Scalars['String']['input'];
  codeVerifier: Scalars['String']['input'];
}

export interface BrowserToDesktopLoginApproval {
  redirectUrl: Scalars['String']['output'];
}

export interface BrowserToDesktopLoginAttempt {
  deviceName: Scalars['String']['output'];
  expiresAt: Scalars['DateTimeISO']['output'];
  status: Scalars['String']['output'];
}

export interface BrowserToDesktopLoginInput {
  codeChallenge: Scalars['String']['input'];
  deviceName: Scalars['String']['input'];
  intent?: InputMaybe<BrowserToDesktopAuthIntent>;
  redirectUri: Scalars['String']['input'];
  state: Scalars['String']['input'];
  surface?: InputMaybe<WebAppSurface>;
}

export interface BrowserToDesktopLoginStart {
  authorizationUrl: Scalars['String']['output'];
  expiresAt: Scalars['DateTimeISO']['output'];
  flowId: Scalars['String']['output'];
}

/** One product/SKU included in an affiliate campaign setup. */
export interface CampaignProduct {
  campaignId: Scalars['ID']['output'];
  /** Configured commission rate percentage when available. */
  commissionRate?: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['DateTimeISO']['output'];
  id: Scalars['ID']['output'];
  /** Hard product-level commission ceiling for backend validation and human approval context. */
  maxCommissionRate?: Maybe<Scalars['Float']['output']>;
  productId: Scalars['String']['output'];
  promotionPriority: CampaignProductPromotionPriority;
  sampleOfferMode: CampaignProductSampleOfferMode;
  sampleQuota?: Maybe<Scalars['Int']['output']>;
  sampleUnitCostAmount?: Maybe<Scalars['Float']['output']>;
  sampleUnitCostCurrency?: Maybe<EcomProductSkuCurrency>;
  shopId: Scalars['ID']['output'];
  title?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['ID']['output'];
}

/** Relative priority for choosing this product in affiliate outreach and follow-up. */
export const CampaignProductPromotionPriority = {
  High: 'HIGH',
  Low: 'LOW',
  Normal: 'NORMAL'
} as const;

export type CampaignProductPromotionPriority = typeof CampaignProductPromotionPriority[keyof typeof CampaignProductPromotionPriority];
/** How this campaign product should offer and approve free samples. */
export const CampaignProductSampleOfferMode = {
  AutoApprove: 'AUTO_APPROVE',
  ManualReview: 'MANUAL_REVIEW',
  None: 'NONE'
} as const;

export type CampaignProductSampleOfferMode = typeof CampaignProductSampleOfferMode[keyof typeof CampaignProductSampleOfferMode];
export interface CancelBillingSubscriptionInput {
  product: BillableProduct;
  /** Target scope ID. Use the user ID for account-scoped subscriptions, the shop ID for e-commerce requests, or an existing seller scope ID for seller-scoped subscriptions. */
  scopeId: Scalars['String']['input'];
  scopeType: BillingScopeType;
}

/** Captcha challenge response */
export interface CaptchaResponse {
  svg: Scalars['String']['output'];
  token: Scalars['String']['output'];
}

export interface CheckCreatorWhatsAppContactInput {
  creatorPhone: Scalars['String']['input'];
  /** CreatorRelationship is the business boundary for validating and optionally saving creator contact channels. */
  creatorRelationshipId: Scalars['ID']['input'];
  persist?: InputMaybe<Scalars['Boolean']['input']>;
}

export interface CheckCreatorWhatsAppContactPayload {
  creatorRelationship?: Maybe<AffiliateCreatorRelationship>;
  exists: Scalars['Boolean']['output'];
  jid?: Maybe<Scalars['String']['output']>;
  number: Scalars['String']['output'];
  whatsAppAccount: WhatsAppAccountBinding;
}

export interface ClaimAffiliateCampaignSearchPlanGenerationInput {
  deviceId: Scalars['String']['input'];
  generation: Scalars['Int']['input'];
  searchPlanId: Scalars['ID']['input'];
  uiLocale: Scalars['String']['input'];
}

/** Input for claiming a CS escalation event for local execution */
export interface ClaimCsEscalationEventInput {
  eventId: Scalars['ID']['input'];
}

/** Server-side request for an authenticated desktop client to upload its local log. */
export interface ClientLogUploadRequestPayload {
  deviceId?: Maybe<Scalars['String']['output']>;
  reason?: Maybe<Scalars['String']['output']>;
  requestId: Scalars['String']['output'];
  requestedAt: Scalars['DateTimeISO']['output'];
}

/** Input for completing Microsoft Outlook OAuth onboarding */
export interface CompleteMicrosoftEmailOAuthInput {
  businessDeveloperId?: InputMaybe<Scalars['ID']['input']>;
  code: Scalars['String']['input'];
  mailboxType?: InputMaybe<EmailMailboxType>;
  sharedMailboxAddress?: InputMaybe<Scalars['String']['input']>;
}

/** Result of completing TikTok Ads OAuth */
export interface CompleteTikTokAdsOAuthResponse {
  advertisers: Array<AdsAdvertiser>;
}

/** Public TikTok OAuth callback completion result. */
export interface CompleteTikTokOAuthResponse {
  claimRequiresExistingAccount?: Maybe<Scalars['Boolean']['output']>;
  claimStatus?: Maybe<Scalars['String']['output']>;
  mode: Scalars['String']['output'];
  platform: Scalars['String']['output'];
  shopId: Scalars['ID']['output'];
  shopName: Scalars['String']['output'];
  shops: Array<OAuthShopResponse>;
  webSessionEstablished: Scalars['Boolean']['output'];
}

/** OpenClaw-session anchor used to bound a platform conversation delta. Prefer platform cursor fields; session text/timestamp are legacy fuzzy fallback fields. */
export interface ConversationMessageDeltaAnchorInput {
  /** Platform message create time in Unix seconds. */
  createTime?: InputMaybe<Scalars['Int']['input']>;
  /** Platform message ID, preferred for exact cursor matching. */
  messageId?: InputMaybe<Scalars['String']['input']>;
  /** Platform message index, used when messageId is unavailable or as an ordering cursor. */
  messageIndex?: InputMaybe<Scalars['String']['input']>;
  /** Visible text of the local OpenClaw session message used as the seen-after anchor. The backend uses it as a fuzzy containment check against platform message text. */
  sessionMessageText?: InputMaybe<Scalars['String']['input']>;
  /** Timestamp in milliseconds from the local OpenClaw session message used as the seen-after anchor. */
  sessionMessageTimestampMs?: InputMaybe<Scalars['Float']['input']>;
}

/** How the backend matched the local session anchor against platform messages. */
export const ConversationMessageDeltaAnchorMatchType = {
  ContentAndTime: 'CONTENT_AND_TIME',
  ContentOnly: 'CONTENT_ONLY',
  None: 'NONE',
  PlatformCreateTime: 'PLATFORM_CREATE_TIME',
  PlatformMessageId: 'PLATFORM_MESSAGE_ID',
  PlatformMessageIndex: 'PLATFORM_MESSAGE_INDEX'
} as const;

export type ConversationMessageDeltaAnchorMatchType = typeof ConversationMessageDeltaAnchorMatchType[keyof typeof ConversationMessageDeltaAnchorMatchType];
/** Whether a platform conversation delta was bounded cleanly. */
export const ConversationMessageDeltaCompleteness = {
  AnchorNotFound: 'ANCHOR_NOT_FOUND',
  Complete: 'COMPLETE',
  CurrentMessageNotFound: 'CURRENT_MESSAGE_NOT_FOUND',
  PageLimitReached: 'PAGE_LIMIT_REACHED'
} as const;

export type ConversationMessageDeltaCompleteness = typeof ConversationMessageDeltaCompleteness[keyof typeof ConversationMessageDeltaCompleteness];
/** Debug/quality metadata for a conversation message delta. */
export interface ConversationMessageDeltaMeta {
  /** Unix seconds of the matched platform anchor message. */
  anchorCreateTime?: Maybe<Scalars['Int']['output']>;
  anchorMatchType: ConversationMessageDeltaAnchorMatchType;
  anchorMatched: Scalars['Boolean']['output'];
  anchorMessageId?: Maybe<Scalars['String']['output']>;
  completeness: ConversationMessageDeltaCompleteness;
  currentMessageFound: Scalars['Boolean']['output'];
  fetchedMessageCount: Scalars['Int']['output'];
  pageLimitReached: Scalars['Boolean']['output'];
}

export interface CreateAffiliateOpenCollaborationInput {
  commissionRateBps: Scalars['Int']['input'];
  productId: Scalars['String']['input'];
  shopId: Scalars['ID']['input'];
}

export interface CreateAffiliateOpenCollaborationPayload {
  collaboration: AffiliateCollaboration;
}

export interface CreateAffiliateTargetCollaborationInput {
  creatorOpenIds: Array<Scalars['String']['input']>;
  endTime: Scalars['DateTimeISO']['input'];
  freeSampleRule: AffiliateFreeSampleRuleInput;
  message?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  products: Array<AffiliateTargetCollaborationCreateProductInput>;
  sellerContactInfo: AffiliateSellerContactInfoInput;
  shopId: Scalars['ID']['input'];
}

export interface CreateAffiliateTargetCollaborationPayload {
  collaboration?: Maybe<AffiliateCollaboration>;
  providerResult: EcomCreateTargetCollaborationResult;
}

/** Create a provider-backed payment. */
export interface CreatePaymentGraphqlInput {
  /** Amount in the currency minor unit: cents for USD, fen for CNY. */
  amountMinor: Scalars['Int']['input'];
  /** Stripe Checkout cancel URL. Required for STRIPE. */
  cancelUrl?: InputMaybe<Scalars['String']['input']>;
  /** Payment currency. STRIPE currently expects USD; LAKALA expects CNY. */
  currency: Currency;
  description?: InputMaybe<Scalars['String']['input']>;
  /** Optional caller-supplied merchant order ID. Must be unique per provider. */
  merchantOrderId?: InputMaybe<Scalars['String']['input']>;
  /** Payment provider to use. STRIPE for USD cards, LAKALA for CNY QR code. */
  provider: PaymentProviderName;
  /** Short order title shown to the payment provider. */
  subject: Scalars['String']['input'];
  /** Stripe Checkout success URL. Required for STRIPE. */
  successUrl?: InputMaybe<Scalars['String']['input']>;
}

export interface CreateProductKnowledgeInput {
  creativeCasesMarkdown?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  qaMarkdown?: InputMaybe<Scalars['String']['input']>;
  usageInstructionsMarkdown?: InputMaybe<Scalars['String']['input']>;
}

/** Input for creating a new RunProfile */
export interface CreateRunProfileInput {
  name: Scalars['String']['input'];
  selectedToolIds: Array<Scalars['String']['input']>;
  surfaceId: Scalars['String']['input'];
}

export interface CreateStripeBillingPortalSessionInput {
  /** Product whose active Stripe subscription should be managed in Stripe Customer Portal. */
  product: BillableProduct;
  /** Target scope ID. Use the current user ID for ACCOUNT-scoped subscriptions, the shop ID for e-commerce requests, or an existing seller scope ID for seller-scoped subscriptions. */
  scopeId: Scalars['String']['input'];
  /** Billing scope to manage. Use ACCOUNT for LLM subscriptions. E-commerce callers may pass SHOP + shop ID; seller-scoped services are canonicalized to SELLER when applicable. */
  scopeType: BillingScopeType;
}

/** Input for creating a new Surface */
export interface CreateSurfaceInput {
  allowedToolIds: Array<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
}

export interface CreateWhatsAppProxyInput {
  host: Scalars['String']['input'];
  password?: InputMaybe<Scalars['String']['input']>;
  port: Scalars['String']['input'];
  protocol: ProxyProtocol;
  region?: InputMaybe<Scalars['String']['input']>;
  username?: InputMaybe<Scalars['String']['input']>;
}

export interface CreatedLlmApiKeyPayload {
  /** Newly created original LLM API key. Desktop should usually call provisionLlmApiKey instead, which reuses the active key when one already exists. */
  apiKey: LlmApiKey;
}

/** Creator candidate discovered by search before or during qualification. */
export interface CreatorCandidate {
  campaignId?: Maybe<Scalars['ID']['output']>;
  createdAt: Scalars['DateTimeISO']['output'];
  creatorId?: Maybe<Scalars['ID']['output']>;
  creatorOpenId?: Maybe<Scalars['String']['output']>;
  evidenceItems: Array<CreatorCandidateEvidence>;
  id: Scalars['ID']['output'];
  rationale?: Maybe<Scalars['String']['output']>;
  score?: Maybe<Scalars['Float']['output']>;
  shopId: Scalars['ID']['output'];
  sourceSearchRunId?: Maybe<Scalars['ID']['output']>;
  sourceType: CreatorCandidateSourceType;
  status: CreatorCandidateStatus;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['ID']['output'];
}

export interface CreatorCandidateEvidence {
  label: Scalars['String']['output'];
  source?: Maybe<Scalars['String']['output']>;
  type: CreatorCandidateEvidenceType;
  value?: Maybe<Scalars['String']['output']>;
}

/** Typed evidence categories used when an agent or human qualifies a creator candidate. */
export const CreatorCandidateEvidenceType = {
  CategoryMatch: 'CATEGORY_MATCH',
  ContentPerformance: 'CONTENT_PERFORMANCE',
  FollowerCount: 'FOLLOWER_COUNT',
  Gmv: 'GMV',
  ManualNote: 'MANUAL_NOTE',
  Other: 'OTHER',
  PastCollaboration: 'PAST_COLLABORATION',
  ProductFit: 'PRODUCT_FIT'
} as const;

export type CreatorCandidateEvidenceType = typeof CreatorCandidateEvidenceType[keyof typeof CreatorCandidateEvidenceType];
export const CreatorCandidateSourceType = {
  Manual: 'MANUAL',
  MarketplaceSearch: 'MARKETPLACE_SEARCH',
  PlatformReply: 'PLATFORM_REPLY',
  RpaImport: 'RPA_IMPORT',
  SampleApplication: 'SAMPLE_APPLICATION',
  TargetCollaborationSync: 'TARGET_COLLABORATION_SYNC'
} as const;

export type CreatorCandidateSourceType = typeof CreatorCandidateSourceType[keyof typeof CreatorCandidateSourceType];
export const CreatorCandidateStatus = {
  Discovered: 'DISCOVERED',
  Excluded: 'EXCLUDED',
  Qualified: 'QUALIFIED'
} as const;

export type CreatorCandidateStatus = typeof CreatorCandidateStatus[keyof typeof CreatorCandidateStatus];
export interface CreatorMarketplaceSearchParams {
  advancedFilters?: Maybe<CreatorSearchAdvancedFilter>;
  affiliateData?: Maybe<CreatorSearchAffiliateDataFilter>;
  categories?: Maybe<Array<CreatorSearchCategoryFilter>>;
  contentPerformance?: Maybe<CreatorSearchContentPerformanceFilter>;
  followerDemographics?: Maybe<CreatorSearchFollowerDemographics>;
  keyword?: Maybe<Scalars['String']['output']>;
  pageSize: Scalars['Int']['output'];
  pageToken?: Maybe<Scalars['String']['output']>;
  region?: Maybe<ShopRegion>;
  searchKey?: Maybe<Scalars['String']['output']>;
}

export interface CreatorMarketplaceSearchParamsInput {
  advancedFilters?: InputMaybe<CreatorSearchAdvancedFilterInput>;
  affiliateData?: InputMaybe<CreatorSearchAffiliateDataFilterInput>;
  categories?: InputMaybe<Array<CreatorSearchCategoryFilterInput>>;
  contentPerformance?: InputMaybe<CreatorSearchContentPerformanceFilterInput>;
  followerDemographics?: InputMaybe<CreatorSearchFollowerDemographicsInput>;
  keyword?: InputMaybe<Scalars['String']['input']>;
  pageSize: Scalars['Int']['input'];
  pageToken?: InputMaybe<Scalars['String']['input']>;
  region?: InputMaybe<ShopRegion>;
  searchKey?: InputMaybe<Scalars['String']['input']>;
}

export interface CreatorSearchAdvancedFilter {
  categoryPros?: Maybe<Array<Scalars['String']['output']>>;
  creatorLevels?: Maybe<Array<Scalars['String']['output']>>;
  languages?: Maybe<Array<Scalars['String']['output']>>;
}

export interface CreatorSearchAdvancedFilterInput {
  categoryPros?: InputMaybe<Array<Scalars['String']['input']>>;
  creatorLevels?: InputMaybe<Array<Scalars['String']['input']>>;
  languages?: InputMaybe<Array<Scalars['String']['input']>>;
}

export interface CreatorSearchAffiliateDataFilter {
  maxAvgCommissionRateBps?: Maybe<Scalars['Int']['output']>;
  maxGmvAmount?: Maybe<Scalars['Float']['output']>;
  minAvgCommissionRateBps?: Maybe<Scalars['Int']['output']>;
  minGmvAmount?: Maybe<Scalars['Float']['output']>;
  notInvitedLast90Days?: Maybe<Scalars['Boolean']['output']>;
}

export interface CreatorSearchAffiliateDataFilterInput {
  maxAvgCommissionRateBps?: InputMaybe<Scalars['Int']['input']>;
  maxGmvAmount?: InputMaybe<Scalars['Float']['input']>;
  minAvgCommissionRateBps?: InputMaybe<Scalars['Int']['input']>;
  minGmvAmount?: InputMaybe<Scalars['Float']['input']>;
  notInvitedLast90Days?: InputMaybe<Scalars['Boolean']['input']>;
}

export interface CreatorSearchCategoryFilter {
  categoryId: Scalars['String']['output'];
  subCategoryIds?: Maybe<Array<Scalars['String']['output']>>;
}

export interface CreatorSearchCategoryFilterInput {
  categoryId: Scalars['String']['input'];
  subCategoryIds?: InputMaybe<Array<Scalars['String']['input']>>;
}

export interface CreatorSearchContentPerformanceFilter {
  minAverageLiveViews?: Maybe<Scalars['Int']['output']>;
  minAverageVideoViews?: Maybe<Scalars['Int']['output']>;
  minShoppableVideoCount?: Maybe<Scalars['Int']['output']>;
}

export interface CreatorSearchContentPerformanceFilterInput {
  minAverageLiveViews?: InputMaybe<Scalars['Int']['input']>;
  minAverageVideoViews?: InputMaybe<Scalars['Int']['input']>;
  minShoppableVideoCount?: InputMaybe<Scalars['Int']['input']>;
}

/** Stable TikTok follower age range filter values for creator marketplace search. */
export const CreatorSearchFollowerAgeRange = {
  AgeRange_18_24: 'AGE_RANGE_18_24',
  AgeRange_25_34: 'AGE_RANGE_25_34',
  AgeRange_35_44: 'AGE_RANGE_35_44',
  AgeRange_45_54: 'AGE_RANGE_45_54',
  AgeRange_55AndAbove: 'AGE_RANGE_55_AND_ABOVE'
} as const;

export type CreatorSearchFollowerAgeRange = typeof CreatorSearchFollowerAgeRange[keyof typeof CreatorSearchFollowerAgeRange];
export interface CreatorSearchFollowerDemographics {
  ageRanges?: Maybe<Array<CreatorSearchFollowerAgeRange>>;
  genders?: Maybe<Array<CreatorSearchFollowerGender>>;
  maxFollowerCount?: Maybe<Scalars['Int']['output']>;
  minFollowerCount?: Maybe<Scalars['Int']['output']>;
}

export interface CreatorSearchFollowerDemographicsInput {
  ageRanges?: InputMaybe<Array<CreatorSearchFollowerAgeRange>>;
  genders?: InputMaybe<Array<CreatorSearchFollowerGender>>;
  maxFollowerCount?: InputMaybe<Scalars['Int']['input']>;
  minFollowerCount?: InputMaybe<Scalars['Int']['input']>;
}

/** Stable TikTok follower gender filter values for creator marketplace search. */
export const CreatorSearchFollowerGender = {
  Female: 'FEMALE',
  Male: 'MALE'
} as const;

export type CreatorSearchFollowerGender = typeof CreatorSearchFollowerGender[keyof typeof CreatorSearchFollowerGender];
/** One concrete marketplace creator search request/result page. This is a platform fact, not an AI-authored workflow plan. */
export interface CreatorSearchRun {
  campaignId?: Maybe<Scalars['ID']['output']>;
  completedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  createdAt: Scalars['DateTimeISO']['output'];
  createdCandidateIds: Array<Scalars['ID']['output']>;
  errorMessage?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  nextPageToken?: Maybe<Scalars['String']['output']>;
  platformRequestId?: Maybe<Scalars['String']['output']>;
  requestedByActorId?: Maybe<Scalars['String']['output']>;
  requestedByActorType?: Maybe<AffiliateLifecycleActorType>;
  requestedByRunId?: Maybe<Scalars['String']['output']>;
  resultCount?: Maybe<Scalars['Int']['output']>;
  searchParams: CreatorMarketplaceSearchParams;
  shopId: Scalars['ID']['output'];
  status: CreatorSearchRunStatus;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['ID']['output'];
}

export const CreatorSearchRunStatus = {
  Completed: 'COMPLETED',
  Failed: 'FAILED',
  Requested: 'REQUESTED',
  Running: 'RUNNING'
} as const;

export type CreatorSearchRunStatus = typeof CreatorSearchRunStatus[keyof typeof CreatorSearchRunStatus];
export const CreatorSystemTagKey = {
  Blocked: 'BLOCKED',
  Dormant: 'DORMANT',
  GoodFulfillment: 'GOOD_FULFILLMENT',
  HighGmv: 'HIGH_GMV',
  NoSampleAgain: 'NO_SAMPLE_AGAIN',
  SampleRisk: 'SAMPLE_RISK',
  Vip: 'VIP'
} as const;

export type CreatorSystemTagKey = typeof CreatorSystemTagKey[keyof typeof CreatorSystemTagKey];
/** Tag used by approval policies, segmentation, and human review boundaries. */
export interface CreatorTag {
  createdAt: Scalars['DateTimeISO']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  sensitive: Scalars['Boolean']['output'];
  shopId: Scalars['ID']['output'];
  /** Stable system key for default tags such as VIP or BLOCKED. */
  systemKey?: Maybe<CreatorSystemTagKey>;
  type: CreatorTagType;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['ID']['output'];
}

export const CreatorTagType = {
  Custom: 'CUSTOM',
  System: 'SYSTEM'
} as const;

export type CreatorTagType = typeof CreatorTagType[keyof typeof CreatorTagType];
/** Ephemeral customer-service conversation signal pushed to desktop. The platform API remains the source of truth for messages and conversation state. */
export interface CsConversationSignal {
  /** Whether desktop should let the local AI agent run for this conversation. False means skip automation. */
  aiEnabled?: Maybe<Scalars['Boolean']['output']>;
  /** Buyer display nickname if already known. */
  buyerNickname?: Maybe<Scalars['String']['output']>;
  /** Platform buyer user ID if already known. */
  buyerUserId?: Maybe<Scalars['String']['output']>;
  /** Platform conversation/thread ID that desktop should inspect. */
  conversationId: Scalars['String']['output'];
  /** Current platform customer-service session ID if already known. */
  currentSessionId?: Maybe<Scalars['String']['output']>;
  /** Backend emission time for this dispatch attempt. */
  dispatchEventTime?: Maybe<Scalars['DateTimeISO']['output']>;
  /** When the platform event happened or the unread condition was detected. */
  eventTime: Scalars['DateTimeISO']['output'];
  /** Platform IM user ID if available from webhook/API context. */
  imUserId?: Maybe<Scalars['String']['output']>;
  /** Human-readable preview of the latest platform message when available. */
  latestMessagePreview?: Maybe<Scalars['String']['output']>;
  /** Platform message ID when this signal is tied to a specific buyer message. */
  messageId?: Maybe<Scalars['String']['output']>;
  /** Platform message index when available for event ordering. */
  messageIndex?: Maybe<Scalars['String']['output']>;
  /** Platform message type, e.g. TEXT or IMAGE, if tied to a message. */
  messageType?: Maybe<Scalars['String']['output']>;
  /** Optional operator instruction/comment to inject into the local CS agent catch-up prompt. */
  operatorInstruction?: Maybe<Scalars['String']['output']>;
  /** Related order ID if the platform event already carried one. */
  orderId?: Maybe<Scalars['String']['output']>;
  /** Platform shop ID from the commerce platform webhook/API. */
  platformShopId: Scalars['String']['output'];
  /** Sender role from the platform event, e.g. BUYER. */
  senderRole?: Maybe<Scalars['String']['output']>;
  /** MongoDB shop ID. Used for ownership checks and desktop shop routing. */
  shopId: Scalars['ID']['output'];
  /** System that emitted this signal. */
  source: CsConversationSignalSource;
  /** Business event that happened or was detected for this CS conversation. */
  type: CsConversationSignalType;
}

/** Origin of a customer-service conversation signal */
export const CsConversationSignalSource = {
  Airflow: 'AIRFLOW',
  Manual: 'MANUAL',
  Webhook: 'WEBHOOK'
} as const;

export type CsConversationSignalSource = typeof CsConversationSignalSource[keyof typeof CsConversationSignalSource];
/** Business-level customer-service conversation signal type */
export const CsConversationSignalType = {
  ManualStart: 'MANUAL_START',
  MessageReceived: 'MESSAGE_RECEIVED',
  UnpaidOrderFollowUp: 'UNPAID_ORDER_FOLLOW_UP',
  UnreadDetected: 'UNREAD_DETECTED'
} as const;

export type CsConversationSignalType = typeof CsConversationSignalType[keyof typeof CsConversationSignalType];
/** Whether csEscalate created a new escalation or updated the active one */
export const CsEscalateAction = {
  Created: 'CREATED',
  Updated: 'UPDATED'
} as const;

export type CsEscalateAction = typeof CsEscalateAction[keyof typeof CsEscalateAction];
/** Result of creating a CS escalation */
export interface CsEscalateResult {
  action?: Maybe<CsEscalateAction>;
  error?: Maybe<Scalars['String']['output']>;
  escalationId?: Maybe<Scalars['ID']['output']>;
  ok: Scalars['Boolean']['output'];
  status?: Maybe<CsEscalationStatus>;
}

/** Cloud-authoritative customer-service escalation */
export interface CsEscalation {
  buyerNickname?: Maybe<Scalars['String']['output']>;
  buyerUserId: Scalars['String']['output'];
  context?: Maybe<Scalars['String']['output']>;
  conversationId: Scalars['String']['output'];
  createdAt: Scalars['DateTimeISO']['output'];
  /** Short user-scoped escalation code, e.g. A1B2C3 */
  id: Scalars['ID']['output'];
  orderId?: Maybe<Scalars['String']['output']>;
  reason: Scalars['String']['output'];
  result?: Maybe<CsEscalationResult>;
  shopId: Scalars['String']['output'];
  status: CsEscalationStatus;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['String']['output'];
  version: Scalars['Int']['output'];
}

/** CS escalation process event. The parent escalation owns routing/context; this record only stores the process step and local side-effect delivery state. */
export interface CsEscalationEvent {
  /** Time when this process event was created. */
  createdAt: Scalars['DateTimeISO']['output'];
  /** Manager decision captured on this event, present for response events. */
  decision?: Maybe<Scalars['String']['output']>;
  /** Stable public ID for this event, e.g. csevt_a1b2c3d4. */
  id: Scalars['ID']['output'];
  /** Manager instructions captured on this event, present for response events. */
  instructions?: Maybe<Scalars['String']['output']>;
  /** Current delivery state of the local side effect for this event. */
  status: CsEscalationEventStatus;
  /** Kind of process event the desktop actuator should handle. */
  type: CsEscalationEventType;
  /** Time when this event's delivery state was last updated. */
  updatedAt: Scalars['DateTimeISO']['output'];
}

/** Desktop delivery payload for a nested CS escalation event */
export interface CsEscalationEventDelivery {
  /** Parent escalation that owns the event and provides routing/context for local execution. */
  escalation: CsEscalation;
  /** Nested process event to claim, execute, and acknowledge. */
  event: CsEscalationEvent;
}

/** Filter for pending CS escalation side-effect events */
export interface CsEscalationEventFilterInput {
  limit?: InputMaybe<Scalars['Int']['input']>;
  shopIds?: InputMaybe<Array<Scalars['ID']['input']>>;
}

/** Delivery/execution status of a CS escalation event */
export const CsEscalationEventStatus = {
  Claimed: 'CLAIMED',
  Failed: 'FAILED',
  Handled: 'HANDLED',
  Pending: 'PENDING'
} as const;

export type CsEscalationEventStatus = typeof CsEscalationEventStatus[keyof typeof CsEscalationEventStatus];
/** Durable event type for local CS side-effect actuators */
export const CsEscalationEventType = {
  EscalationCreated: 'ESCALATION_CREATED',
  EscalationResolved: 'ESCALATION_RESOLVED',
  EscalationUpdated: 'ESCALATION_UPDATED'
} as const;

export type CsEscalationEventType = typeof CsEscalationEventType[keyof typeof CsEscalationEventType];
/** Escalation result plus guidance for the CS agent */
export interface CsEscalationLookupResult {
  buyerNickname?: Maybe<Scalars['String']['output']>;
  buyerUserId: Scalars['String']['output'];
  context?: Maybe<Scalars['String']['output']>;
  conversationId: Scalars['String']['output'];
  createdAt: Scalars['DateTimeISO']['output'];
  guidance?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  orderId?: Maybe<Scalars['String']['output']>;
  reason: Scalars['String']['output'];
  result?: Maybe<CsEscalationResult>;
  shopId: Scalars['String']['output'];
  status: CsEscalationStatus;
  version: Scalars['Int']['output'];
}

/** Manager decision and instructions for a CS escalation */
export interface CsEscalationResult {
  decision: Scalars['String']['output'];
  instructions: Scalars['String']['output'];
  resolved: Scalars['Boolean']['output'];
  resolvedAt: Scalars['DateTimeISO']['output'];
}

/** Lifecycle status of a CS escalation */
export const CsEscalationStatus = {
  Closed: 'CLOSED',
  InProgress: 'IN_PROGRESS',
  Pending: 'PENDING',
  Resolved: 'RESOLVED'
} as const;

export type CsEscalationStatus = typeof CsEscalationStatus[keyof typeof CsEscalationStatus];
export interface CsExperimentAnalysisPopulationView {
  actualWeightBps: Scalars['Int']['output'];
  assignedUnits: Scalars['Int']['output'];
  includedInPrimaryAnalysis: Scalars['Boolean']['output'];
  variantKey: Scalars['String']['output'];
}

export interface CsExperimentComparisonView {
  absoluteEffect?: Maybe<Scalars['Float']['output']>;
  adjustedPValue?: Maybe<Scalars['Float']['output']>;
  asOf: Scalars['DateTimeISO']['output'];
  baselineUnits: Scalars['Int']['output'];
  baselineValue?: Maybe<Scalars['Float']['output']>;
  baselineVariantKey: Scalars['String']['output'];
  confidenceIntervalHigh?: Maybe<Scalars['Float']['output']>;
  confidenceIntervalLow?: Maybe<Scalars['Float']['output']>;
  correctionMethod: Scalars['String']['output'];
  insufficientSample: Scalars['Boolean']['output'];
  metricKey: CsExperimentMetricKey;
  pValue?: Maybe<Scalars['Float']['output']>;
  relativeEffect?: Maybe<Scalars['Float']['output']>;
  variantKey: Scalars['String']['output'];
  variantUnits: Scalars['Int']['output'];
  variantValue?: Maybe<Scalars['Float']['output']>;
}

export const CsExperimentCorrectionMethod = {
  Holm: 'HOLM',
  None: 'NONE'
} as const;

export type CsExperimentCorrectionMethod = typeof CsExperimentCorrectionMethod[keyof typeof CsExperimentCorrectionMethod];
export const CsExperimentCurveEstimator = {
  AalenJohansen: 'AALEN_JOHANSEN',
  SharedShapeConstrainedHazard: 'SHARED_SHAPE_CONSTRAINED_HAZARD'
} as const;

export type CsExperimentCurveEstimator = typeof CsExperimentCurveEstimator[keyof typeof CsExperimentCurveEstimator];
export const CsExperimentCurveSeriesRole = {
  ConfigVariant: 'CONFIG_VARIANT',
  Control: 'CONTROL',
  Treatment: 'TREATMENT'
} as const;

export type CsExperimentCurveSeriesRole = typeof CsExperimentCurveSeriesRole[keyof typeof CsExperimentCurveSeriesRole];
export const CsExperimentDataStatus = {
  Final: 'FINAL',
  Provisional: 'PROVISIONAL'
} as const;

export type CsExperimentDataStatus = typeof CsExperimentDataStatus[keyof typeof CsExperimentDataStatus];
export interface CsExperimentDetailView {
  analysisPopulation: Array<CsExperimentAnalysisPopulationView>;
  comparisons: Array<CsExperimentComparisonView>;
  dataStatus: CsExperimentDataStatus;
  displayStatus: CsExperimentDisplayStatus;
  experimentType: ExperimentType;
  id: Scalars['ID']['output'];
  metrics: Array<CsExperimentMetricSummaryView>;
  quality?: Maybe<CsExperimentQualityView>;
  resultsFinalAt?: Maybe<Scalars['DateTimeISO']['output']>;
  startedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  stoppedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  targetCount: Scalars['Int']['output'];
  targets: Array<CsExperimentTargetView>;
  variantCount: Scalars['Int']['output'];
  variants: Array<CsExperimentVariantView>;
  version: Scalars['Int']['output'];
}

export const CsExperimentDisplayStatus = {
  Final: 'FINAL',
  Running: 'RUNNING',
  StoppedMaturing: 'STOPPED_MATURING'
} as const;

export type CsExperimentDisplayStatus = typeof CsExperimentDisplayStatus[keyof typeof CsExperimentDisplayStatus];
export interface CsExperimentListItemView {
  dataStatus: CsExperimentDataStatus;
  displayStatus: CsExperimentDisplayStatus;
  experimentType: ExperimentType;
  id: Scalars['ID']['output'];
  quality?: Maybe<CsExperimentQualityView>;
  resultsFinalAt?: Maybe<Scalars['DateTimeISO']['output']>;
  startedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  stoppedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  targetCount: Scalars['Int']['output'];
  targets: Array<CsExperimentTargetView>;
  variantCount: Scalars['Int']['output'];
  version: Scalars['Int']['output'];
}

export const CsExperimentMetricKey = {
  GmvPerAssignedOrder: 'GMV_PER_ASSIGNED_ORDER',
  MessageSendFailureRate: 'MESSAGE_SEND_FAILURE_RATE',
  PaymentLatency: 'PAYMENT_LATENCY',
  PaymentWithinWindow: 'PAYMENT_WITHIN_WINDOW',
  UnitsPerAssignedOrder: 'UNITS_PER_ASSIGNED_ORDER'
} as const;

export type CsExperimentMetricKey = typeof CsExperimentMetricKey[keyof typeof CsExperimentMetricKey];
export interface CsExperimentMetricSummaryView {
  dimensionKey: Scalars['String']['output'];
  dimensionValue: Scalars['String']['output'];
  eligibleUnits: Scalars['Int']['output'];
  metricKey: CsExperimentMetricKey;
  observedUnits: Scalars['Int']['output'];
  value?: Maybe<Scalars['Float']['output']>;
  variantKey: Scalars['String']['output'];
}

export const CsExperimentOutcomeEventKey = {
  CsUnpaidPayment: 'CS_UNPAID_PAYMENT'
} as const;

export type CsExperimentOutcomeEventKey = typeof CsExperimentOutcomeEventKey[keyof typeof CsExperimentOutcomeEventKey];
export interface CsExperimentPageInput {
  cursor?: InputMaybe<Scalars['String']['input']>;
  experimentType?: InputMaybe<CsExperimentTypeFilter>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  shopId?: InputMaybe<Scalars['ID']['input']>;
  view: CsExperimentPageView;
}

export interface CsExperimentPageResult {
  asOf: Scalars['DateTimeISO']['output'];
  items: Array<CsExperimentListItemView>;
  nextCursor?: Maybe<Scalars['String']['output']>;
}

export const CsExperimentPageView = {
  History: 'HISTORY',
  Realtime: 'REALTIME'
} as const;

export type CsExperimentPageView = typeof CsExperimentPageView[keyof typeof CsExperimentPageView];
export interface CsExperimentQualityView {
  assignedUnits: Scalars['Int']['output'];
  calculatedAt: Scalars['DateTimeISO']['output'];
  exposedUnits: Scalars['Int']['output'];
  maturedUnits: Scalars['Int']['output'];
  maxAllocationDeviationBps?: Maybe<Scalars['Int']['output']>;
  nextMaturityAt?: Maybe<Scalars['DateTimeISO']['output']>;
  srmPValue?: Maybe<Scalars['Float']['output']>;
}

export interface CsExperimentTargetView {
  id: Scalars['ID']['output'];
  name?: Maybe<Scalars['String']['output']>;
  region?: Maybe<Scalars['String']['output']>;
}

export interface CsExperimentTimeToEventCurveInput {
  estimator?: InputMaybe<CsExperimentCurveEstimator>;
  eventKey: CsExperimentOutcomeEventKey;
  experimentId: Scalars['ID']['input'];
}

export interface CsExperimentTimeToEventCurvePointView {
  assignedUnits: Scalars['Int']['output'];
  atRiskUnits: Scalars['Int']['output'];
  censoredUnits: Scalars['Int']['output'];
  confidenceIntervalHigh: Scalars['Float']['output'];
  confidenceIntervalLow: Scalars['Float']['output'];
  coverageRate: Scalars['Float']['output'];
  cumulativeCancelledUnits: Scalars['Int']['output'];
  cumulativePaidUnits: Scalars['Int']['output'];
  elapsedMinutes: Scalars['Int']['output'];
  estimate: Scalars['Float']['output'];
  observedThroughUnits: Scalars['Int']['output'];
}

export interface CsExperimentTimeToEventCurveSeriesView {
  action: ExperimentVariantAction;
  label: Scalars['String']['output'];
  points: Array<CsExperimentTimeToEventCurvePointView>;
  seriesKey: Scalars['String']['output'];
  seriesRole: CsExperimentCurveSeriesRole;
  stages: Array<CsExperimentTimeToEventCurveStageView>;
}

export interface CsExperimentTimeToEventCurveStageView {
  delayMinutes: Scalars['Int']['output'];
  stageIndex: Scalars['Int']['output'];
}

export interface CsExperimentTimeToEventCurveView {
  asOf: Scalars['DateTimeISO']['output'];
  assignedUnits: Scalars['Int']['output'];
  dataStatus: CsExperimentDataStatus;
  estimator: CsExperimentCurveEstimator;
  eventKey: CsExperimentOutcomeEventKey;
  excludedUnits: Scalars['Int']['output'];
  experimentId: Scalars['ID']['output'];
  maxElapsedMinutes: Scalars['Int']['output'];
  series: Array<CsExperimentTimeToEventCurveSeriesView>;
}

export interface CsExperimentTrendInput {
  experimentId: Scalars['ID']['input'];
  metricKey: CsExperimentMetricKey;
  range: CsExperimentTrendRange;
}

export interface CsExperimentTrendPointView {
  bucketStart: Scalars['DateTimeISO']['output'];
  dimensionKey: Scalars['String']['output'];
  dimensionValue: Scalars['String']['output'];
  eligibleUnits: Scalars['Int']['output'];
  observedUnits: Scalars['Int']['output'];
  value?: Maybe<Scalars['Float']['output']>;
  variantKey: Scalars['String']['output'];
}

export const CsExperimentTrendRange = {
  Daily_30D: 'DAILY_30D',
  Daily_90D: 'DAILY_90D',
  Realtime_6H: 'REALTIME_6H',
  Realtime_24H: 'REALTIME_24H',
  Realtime_72H: 'REALTIME_72H'
} as const;

export type CsExperimentTrendRange = typeof CsExperimentTrendRange[keyof typeof CsExperimentTrendRange];
export interface CsExperimentTrendView {
  asOf: Scalars['DateTimeISO']['output'];
  bucketMinutes: Scalars['Int']['output'];
  dataStatus: CsExperimentDataStatus;
  experimentId: Scalars['ID']['output'];
  metricKey: CsExperimentMetricKey;
  points: Array<CsExperimentTrendPointView>;
  range: CsExperimentTrendRange;
}

export const CsExperimentTypeFilter = {
  Config: 'CONFIG',
  Holdout: 'HOLDOUT'
} as const;

export type CsExperimentTypeFilter = typeof CsExperimentTypeFilter[keyof typeof CsExperimentTypeFilter];
export interface CsExperimentVariantStageView {
  delayMinutes: Scalars['Int']['output'];
  enabled: Scalars['Boolean']['output'];
  messageTemplate?: Maybe<Scalars['String']['output']>;
  stageId: Scalars['String']['output'];
  stageIndex: Scalars['Int']['output'];
  templateHash: Scalars['String']['output'];
}

export interface CsExperimentVariantView {
  action: ExperimentVariantAction;
  label: Scalars['String']['output'];
  stages: Array<CsExperimentVariantStageView>;
  variantKey: Scalars['String']['output'];
  weightBps: Scalars['Int']['output'];
}

/** Filter for open CS escalations awaiting manager or agent completion */
export interface CsOpenEscalationFilterInput {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  /** Case-insensitive search across escalation id, reason, context, conversation id, buyer id, and order id */
  search?: InputMaybe<Scalars['String']['input']>;
  shopIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  statuses?: InputMaybe<Array<CsEscalationStatus>>;
}

/** Paged CS escalation list */
export interface CsOpenEscalationPage {
  items: Array<CsEscalation>;
  limit: Scalars['Int']['output'];
  offset: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
}

export interface CsOrderStatusWebhookInput {
  eventTime: Scalars['String']['input'];
  isOnHoldOrder?: InputMaybe<Scalars['Boolean']['input']>;
  notificationId: Scalars['String']['input'];
  orderId: Scalars['String']['input'];
  orderStatus: Scalars['String']['input'];
  platformShopId: Scalars['String']['input'];
  updateTime: Scalars['String']['input'];
}

export interface CsOrderStatusWebhookResult {
  accepted: Scalars['Boolean']['output'];
  duplicate: Scalars['Boolean']['output'];
  shopId?: Maybe<Scalars['String']['output']>;
}

/** Result returned after a manager responds to a CS escalation */
export interface CsRespondResult {
  error?: Maybe<Scalars['String']['output']>;
  escalationId?: Maybe<Scalars['ID']['output']>;
  ok: Scalars['Boolean']['output'];
  status?: Maybe<CsEscalationStatus>;
  version?: Maybe<Scalars['Int']['output']>;
}

/** Result of getting or creating a CS session */
export interface CsSessionResult {
  isNew: Scalars['Boolean']['output'];
  sessionId: Scalars['String']['output'];
}

export const CsUnpaidAnalyticsStatus = {
  Final: 'FINAL',
  Provisional: 'PROVISIONAL'
} as const;

export type CsUnpaidAnalyticsStatus = typeof CsUnpaidAnalyticsStatus[keyof typeof CsUnpaidAnalyticsStatus];
export interface CsUnpaidOrderConfigExperimentInput {
  expectedExperimentId?: InputMaybe<Scalars['ID']['input']>;
  shopId: Scalars['ID']['input'];
  variants: Array<CsUnpaidOrderConfigVariantInput>;
}

export interface CsUnpaidOrderConfigExperimentView {
  displayStatus: CsUnpaidOrderExperimentDisplayStatus;
  id: Scalars['ID']['output'];
  resultsFinalAt?: Maybe<Scalars['DateTimeISO']['output']>;
  startedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  status: ExperimentStatus;
  stoppedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  variants: Array<CsUnpaidOrderConfigVariantView>;
  version: Scalars['Int']['output'];
}

export interface CsUnpaidOrderConfigStateView {
  draftExperiment?: Maybe<CsUnpaidOrderConfigExperimentView>;
  recentExperiments: Array<CsUnpaidOrderConfigExperimentView>;
  runningExperiment?: Maybe<CsUnpaidOrderConfigExperimentView>;
}

export interface CsUnpaidOrderConfigVariantInput {
  label: Scalars['String']['input'];
  /** Percentage of Treatment traffic. */
  percentage: Scalars['Float']['input'];
  stages: Array<UnpaidOrderReachoutStageInput>;
  variantKey: Scalars['String']['input'];
}

export interface CsUnpaidOrderConfigVariantView {
  label: Scalars['String']['output'];
  percentage: Scalars['Float']['output'];
  stages: Array<UnpaidOrderReachoutStage>;
  variantKey: Scalars['String']['output'];
}

export interface CsUnpaidOrderEvaluationSettingsInput {
  enabled: Scalars['Boolean']['input'];
  holdoutPercent: Scalars['Int']['input'];
}

export interface CsUnpaidOrderEvaluationView {
  config: CsUnpaidOrderConfigStateView;
  configExperiment?: Maybe<CsUnpaidOrderConfigExperimentView>;
  enabled: Scalars['Boolean']['output'];
  holdout: CsUnpaidOrderHoldoutView;
  holdoutPercent: Scalars['Int']['output'];
  locks: CsUnpaidOrderSettingsLocksView;
  reachoutEnabled: Scalars['Boolean']['output'];
  stages: Array<UnpaidOrderReachoutStage>;
}

export const CsUnpaidOrderExperimentDisplayStatus = {
  Archived: 'ARCHIVED',
  Draft: 'DRAFT',
  Final: 'FINAL',
  Running: 'RUNNING',
  StoppedMaturing: 'STOPPED_MATURING'
} as const;

export type CsUnpaidOrderExperimentDisplayStatus = typeof CsUnpaidOrderExperimentDisplayStatus[keyof typeof CsUnpaidOrderExperimentDisplayStatus];
export interface CsUnpaidOrderHoldoutExperimentView {
  displayStatus: CsUnpaidOrderExperimentDisplayStatus;
  id: Scalars['ID']['output'];
  resultsFinalAt?: Maybe<Scalars['DateTimeISO']['output']>;
  startedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  status: ExperimentStatus;
  stoppedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  version: Scalars['Int']['output'];
}

export interface CsUnpaidOrderHoldoutView {
  enabled: Scalars['Boolean']['output'];
  experiment?: Maybe<CsUnpaidOrderHoldoutExperimentView>;
  holdoutPercent: Scalars['Int']['output'];
}

export interface CsUnpaidOrderReachoutPerformanceReport {
  asOf: Scalars['DateTimeISO']['output'];
  byDate: Array<CsUnpaidReachoutPerformanceDateRow>;
  byStage: Array<CsUnpaidReachoutPerformanceStageRow>;
  dataStatus: CsUnpaidAnalyticsStatus;
  endDate: Scalars['String']['output'];
  experiment: CsUnpaidReachoutExperimentResult;
  semanticsNotice: Scalars['String']['output'];
  startDate: Scalars['String']['output'];
  summary: CsUnpaidReachoutPerformanceSummary;
}

export interface CsUnpaidOrderReachoutSettingsInput {
  evaluation?: InputMaybe<CsUnpaidOrderEvaluationSettingsInput>;
  expectedConfigExperimentId?: InputMaybe<Scalars['ID']['input']>;
  expectedHoldoutExperimentId?: InputMaybe<Scalars['ID']['input']>;
  reachoutEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  shopId: Scalars['ID']['input'];
  stages?: InputMaybe<Array<UnpaidOrderReachoutStageInput>>;
}

export const CsUnpaidOrderSettingsLockReason = {
  ConfigExperimentRunning: 'CONFIG_EXPERIMENT_RUNNING',
  EvaluationDisabled: 'EVALUATION_DISABLED',
  FeatureDisabled: 'FEATURE_DISABLED'
} as const;

export type CsUnpaidOrderSettingsLockReason = typeof CsUnpaidOrderSettingsLockReason[keyof typeof CsUnpaidOrderSettingsLockReason];
export interface CsUnpaidOrderSettingsLocksView {
  canEditBaseStages: Scalars['Boolean']['output'];
  canStartConfigExperiment: Scalars['Boolean']['output'];
  reason?: Maybe<CsUnpaidOrderSettingsLockReason>;
}

export interface CsUnpaidReachoutCurrencyGmv {
  amount: Scalars['Float']['output'];
  currency: Scalars['String']['output'];
}

export interface CsUnpaidReachoutExperimentArm {
  assignment: Scalars['String']['output'];
  eligible: Scalars['Int']['output'];
  gmvPerEligible: Array<CsUnpaidReachoutCurrencyGmv>;
  paidOrders: Scalars['Int']['output'];
  paymentRate: Scalars['Float']['output'];
  unitsPerEligible: Scalars['Float']['output'];
}

export interface CsUnpaidReachoutExperimentComparison {
  absoluteEffect?: Maybe<Scalars['Float']['output']>;
  adjustedPValue?: Maybe<Scalars['Float']['output']>;
  baselineVariantKey: Scalars['String']['output'];
  confidenceIntervalHigh?: Maybe<Scalars['Float']['output']>;
  confidenceIntervalLow?: Maybe<Scalars['Float']['output']>;
  correctionMethod: CsExperimentCorrectionMethod;
  pValue?: Maybe<Scalars['Float']['output']>;
  relativeEffect?: Maybe<Scalars['Float']['output']>;
  variantKey: Scalars['String']['output'];
}

export interface CsUnpaidReachoutExperimentResult {
  absolutePaymentRateDifference?: Maybe<Scalars['Float']['output']>;
  arms: Array<CsUnpaidReachoutExperimentArm>;
  asOf?: Maybe<Scalars['DateTimeISO']['output']>;
  comparisons: Array<CsUnpaidReachoutExperimentComparison>;
  confidenceIntervalHigh?: Maybe<Scalars['Float']['output']>;
  confidenceIntervalLow?: Maybe<Scalars['Float']['output']>;
  dataStatus: CsUnpaidAnalyticsStatus;
  experimentId?: Maybe<Scalars['String']['output']>;
  insufficientSample: Scalars['Boolean']['output'];
  relativePaymentRateDifference?: Maybe<Scalars['Float']['output']>;
}

export interface CsUnpaidReachoutPerformanceDateRow {
  associatedConversionRate: Scalars['Float']['output'];
  associatedGmv: Array<CsUnpaidReachoutCurrencyGmv>;
  associatedPaidOrders: Scalars['Int']['output'];
  associatedSalesUnits: Scalars['Int']['output'];
  cohortDate: Scalars['String']['output'];
  eligible: Scalars['Int']['output'];
  reached: Scalars['Int']['output'];
  sentMessages: Scalars['Int']['output'];
}

export interface CsUnpaidReachoutPerformanceStageRow {
  associatedGmv: Array<CsUnpaidReachoutCurrencyGmv>;
  associatedPayments: Scalars['Int']['output'];
  associatedSalesUnits: Scalars['Int']['output'];
  delayMinutes: Scalars['Int']['output'];
  eligible: Scalars['Int']['output'];
  sent: Scalars['Int']['output'];
  stageId: Scalars['String']['output'];
  stageIndex: Scalars['Int']['output'];
}

export interface CsUnpaidReachoutPerformanceSummary {
  associatedConversionRate: Scalars['Float']['output'];
  associatedGmv: Array<CsUnpaidReachoutCurrencyGmv>;
  associatedPaidOrders: Scalars['Int']['output'];
  associatedSalesUnits: Scalars['Int']['output'];
  eligible: Scalars['Int']['output'];
  reached: Scalars['Int']['output'];
  sentMessages: Scalars['Int']['output'];
}

export interface CsUnpaidReachoutRealtimeBucket {
  associatedGmv: Array<CsUnpaidReachoutCurrencyGmv>;
  bucketStart: Scalars['DateTimeISO']['output'];
  dueToSentP50Seconds?: Maybe<Scalars['Int']['output']>;
  dueToSentP95Seconds?: Maybe<Scalars['Int']['output']>;
  eligibleOrders: Scalars['Int']['output'];
  failedAttempts: Scalars['Int']['output'];
  reachedOrders: Scalars['Int']['output'];
  sentMessages: Scalars['Int']['output'];
  skippedBuyerEngaged: Scalars['Int']['output'];
  skippedCancelled: Scalars['Int']['output'];
  skippedPaid: Scalars['Int']['output'];
  unpaidOrders: Scalars['Int']['output'];
}

export interface CsUnpaidReachoutRealtimeReport {
  asOf: Scalars['DateTimeISO']['output'];
  buckets: Array<CsUnpaidReachoutRealtimeBucket>;
  dataStatus: CsUnpaidAnalyticsStatus;
}

/** Supported payment currencies */
export const Currency = {
  Cny: 'CNY',
  Usd: 'USD'
} as const;

export type Currency = typeof Currency[keyof typeof Currency];
/** A CS conversation between buyer and seller */
export interface CustomerServiceConversation {
  /** Whether desktop should run the local AI agent for this conversation. */
  aiEnabled?: Maybe<Scalars['Boolean']['output']>;
  /** Whether the seller can send messages in this conversation */
  canSendMessage?: Maybe<Scalars['Boolean']['output']>;
  conversationId: Scalars['String']['output'];
  /** Unix seconds when the conversation was created */
  createTime?: Maybe<Scalars['Int']['output']>;
  /** Current platform customer-service session metadata, when returned by the platform. */
  currentSession?: Maybe<CustomerServiceCurrentSession>;
  /** Current platform customer-service session ID, when returned by the platform. */
  currentSessionId?: Maybe<Scalars['String']['output']>;
  /** Optional transient dispatch hint. Present only when this snapshot should wake the assigned desktop CS agent. */
  dispatchHint?: Maybe<CustomerServiceConversationDispatchHint>;
  /** Backend-normalized platform lifecycle. False means the platform conversation is closed. */
  isOpen?: Maybe<Scalars['Boolean']['output']>;
  /** Unix seconds when the latest pending buyer message arrived. */
  lastPendingAt?: Maybe<Scalars['Int']['output']>;
  latestMessage?: Maybe<CustomerServiceMessagePreview>;
  /** Human-readable preview of the latest materialized message. */
  latestMessagePreview?: Maybe<Scalars['String']['output']>;
  /** Unix seconds of last update */
  latestMessageTime?: Maybe<Scalars['Int']['output']>;
  latestOpenEscalationId?: Maybe<Scalars['String']['output']>;
  latestOpenEscalationStatus?: Maybe<CsEscalationStatus>;
  /** Unix seconds when the latest open escalation was updated. */
  latestOpenEscalationUpdatedAt?: Maybe<Scalars['Int']['output']>;
  /** Number of currently open escalations linked to this conversation. */
  openEscalationCount?: Maybe<Scalars['Int']['output']>;
  /** Associated order ID if any */
  orderId?: Maybe<Scalars['String']['output']>;
  /** Number of participants in the conversation */
  participantCount?: Maybe<Scalars['Int']['output']>;
  participants?: Maybe<Array<CustomerServiceConversationParticipant>>;
  /** Backend-normalized platform conversation lifecycle/status when observed. */
  platformConversationStatus?: Maybe<CustomerServicePlatformConversationStatus>;
  /** Platform shop ID when this conversation is backend-materialized */
  platformShopId?: Maybe<Scalars['String']['output']>;
  /** Recent bad reviews for this buyer, resolved dynamically from product_reviews. */
  recentBadReviews?: Maybe<Array<CustomerServiceProductReviewSummary>>;
  /** Backend-owned customer-service reply state when materialized */
  replyStatus?: Maybe<CustomerServiceConversationStatus>;
  /** Unix seconds when the conversation was last resolved. */
  resolvedAt?: Maybe<Scalars['Int']['output']>;
  /** MongoDB shop ID when this conversation is backend-materialized */
  shopId?: Maybe<Scalars['String']['output']>;
  /** Conversation status per platform */
  status?: Maybe<Scalars['String']['output']>;
  unreadCount?: Maybe<Scalars['Int']['output']>;
  /** Unix seconds of the backend materialized record update time. */
  updatedAt?: Maybe<Scalars['Int']['output']>;
}

/** Conversation details: the full conversation entity plus a normalized buyer participant slice for convenience. */
export interface CustomerServiceConversationDetails {
  /** The buyer participant, if resolvable from the conversation's participant list. */
  buyer?: Maybe<CustomerServiceConversationParticipant>;
  conversation: CustomerServiceConversation;
}

/** Optional dispatch metadata attached to a full CS conversation snapshot. */
export interface CustomerServiceConversationDispatchHint {
  /** Unix seconds when backend emitted this dispatch attempt. Used for Airflow retry idempotency. */
  dispatchEventTime?: Maybe<Scalars['Int']['output']>;
  /** Unix seconds of the event that triggered this dispatch. */
  eventTime?: Maybe<Scalars['Int']['output']>;
  messageId?: Maybe<Scalars['String']['output']>;
  messageIndex?: Maybe<Scalars['String']['output']>;
  /** Optional internal operator instruction to inject into the local CS agent run. */
  operatorInstruction?: Maybe<Scalars['String']['output']>;
  reason: CustomerServiceConversationDispatchReason;
  source: CustomerServiceConversationDispatchSource;
}

/** Reason a customer-service conversation snapshot should wake the local CS agent. */
export const CustomerServiceConversationDispatchReason = {
  BadReviewReachout: 'BAD_REVIEW_REACHOUT',
  ManualStart: 'MANUAL_START',
  PendingBuyerMessage: 'PENDING_BUYER_MESSAGE',
  SessionExpiringCustomerFollowUp: 'SESSION_EXPIRING_CUSTOMER_FOLLOW_UP',
  SessionExpiringEscalationFollowUp: 'SESSION_EXPIRING_ESCALATION_FOLLOW_UP',
  UnpaidOrderFollowUp: 'UNPAID_ORDER_FOLLOW_UP'
} as const;

export type CustomerServiceConversationDispatchReason = typeof CustomerServiceConversationDispatchReason[keyof typeof CustomerServiceConversationDispatchReason];
/** Origin of a customer-service conversation dispatch hint. */
export const CustomerServiceConversationDispatchSource = {
  Airflow: 'AIRFLOW',
  Manual: 'MANUAL',
  Webhook: 'WEBHOOK'
} as const;

export type CustomerServiceConversationDispatchSource = typeof CustomerServiceConversationDispatchSource[keyof typeof CustomerServiceConversationDispatchSource];
/** Backend-materialized escalation state filter for CS conversations. */
export const CustomerServiceConversationEscalationFilter = {
  All: 'ALL',
  None: 'NONE',
  Open: 'OPEN'
} as const;

export type CustomerServiceConversationEscalationFilter = typeof CustomerServiceConversationEscalationFilter[keyof typeof CustomerServiceConversationEscalationFilter];
/** Backend-materialized customer service conversation inbox item. */
export interface CustomerServiceConversationInboxItem {
  aiEnabled: Scalars['Boolean']['output'];
  buyerImUserId?: Maybe<Scalars['String']['output']>;
  buyerNickname?: Maybe<Scalars['String']['output']>;
  buyerUserId?: Maybe<Scalars['String']['output']>;
  conversationId: Scalars['String']['output'];
  /** Current platform customer-service session ID, when returned by the platform. */
  currentSessionId?: Maybe<Scalars['String']['output']>;
  /** Backend-normalized platform lifecycle. False means the platform conversation is closed. */
  isOpen: Scalars['Boolean']['output'];
  /** Unix seconds when the latest pending buyer message arrived. */
  lastPendingAt?: Maybe<Scalars['Int']['output']>;
  latestMessageId?: Maybe<Scalars['String']['output']>;
  latestMessageIndex?: Maybe<Scalars['String']['output']>;
  latestMessagePreview?: Maybe<Scalars['String']['output']>;
  /** Unix seconds of latest materialized message. */
  latestMessageTime?: Maybe<Scalars['Int']['output']>;
  latestMessageType?: Maybe<Scalars['String']['output']>;
  latestOpenEscalationId?: Maybe<Scalars['String']['output']>;
  latestOpenEscalationStatus?: Maybe<CsEscalationStatus>;
  /** Unix seconds when the latest open escalation was updated. */
  latestOpenEscalationUpdatedAt?: Maybe<Scalars['Int']['output']>;
  latestSenderRole?: Maybe<Scalars['String']['output']>;
  /** Number of currently open escalations linked to this conversation. */
  openEscalationCount: Scalars['Int']['output'];
  orderId?: Maybe<Scalars['String']['output']>;
  /** Backend-normalized platform conversation lifecycle/status when observed. */
  platformConversationStatus?: Maybe<CustomerServicePlatformConversationStatus>;
  platformShopId?: Maybe<Scalars['String']['output']>;
  /** Recent bad reviews for this buyer, resolved dynamically from product_reviews. */
  recentBadReviews?: Maybe<Array<CustomerServiceProductReviewSummary>>;
  /** Unix seconds when the conversation was last resolved. */
  resolvedAt?: Maybe<Scalars['Int']['output']>;
  shopId: Scalars['String']['output'];
  status: CustomerServiceConversationStatus;
  /** Unix seconds of the backend record update time. */
  updatedAt?: Maybe<Scalars['Int']['output']>;
}

/** Page of backend-materialized customer service inbox conversations. */
export interface CustomerServiceConversationInboxPage {
  items: Array<CustomerServiceConversationInboxItem>;
  totalCount: Scalars['Int']['output'];
}

/** Participant in a CS conversation */
export interface CustomerServiceConversationParticipant {
  avatar?: Maybe<Scalars['String']['output']>;
  /** IM-specific user ID (may differ from userId on some platforms) */
  imUserId?: Maybe<Scalars['String']['output']>;
  nickname?: Maybe<Scalars['String']['output']>;
  /** BUYER, SELLER, SYSTEM, ROBOT */
  role?: Maybe<Scalars['String']['output']>;
  /** Platform user ID for this participant */
  userId?: Maybe<Scalars['String']['output']>;
}

/** Backend-owned customer-service conversation reply state. */
export const CustomerServiceConversationStatus = {
  Pending: 'PENDING',
  Resolved: 'RESOLVED'
} as const;

export type CustomerServiceConversationStatus = typeof CustomerServiceConversationStatus[keyof typeof CustomerServiceConversationStatus];
/** A customer service conversation, trimmed for agent-facing tool output. */
export interface CustomerServiceConversationSummary {
  /** Display nickname of the buyer (extracted from participants[]) */
  buyerNickname?: Maybe<Scalars['String']['output']>;
  /** Platform user ID of the buyer participant (extracted from participants[]) */
  buyerUserId?: Maybe<Scalars['String']['output']>;
  conversationId: Scalars['String']['output'];
  /** Human-readable preview of the latest message (TEXT unwrapped from JSON wire format) */
  latestMessagePreview?: Maybe<Scalars['String']['output']>;
  /** Unix seconds of last update */
  latestMessageTime?: Maybe<Scalars['Int']['output']>;
  /** Role of the latest message's sender (BUYER / SHOP / CUSTOMER_SERVICE / SYSTEM / ROBOT) */
  latestSenderRole?: Maybe<Scalars['String']['output']>;
  /** Associated order ID if the conversation is anchored to an order */
  orderId?: Maybe<Scalars['String']['output']>;
  unreadCount?: Maybe<Scalars['Int']['output']>;
}

/** Create conversation result */
export interface CustomerServiceCreateConversationResult {
  conversationId: Scalars['String']['output'];
}

/** Current platform customer-service session metadata. */
export interface CustomerServiceCurrentSession {
  /** Current session phase, for example AUTO_REPLY, QUEUED, or ASSIGNED. */
  phase?: Maybe<Scalars['String']['output']>;
  /** Current session ID. */
  sessionId?: Maybe<Scalars['String']['output']>;
}

/** Bounded customer-service conversation delta from a local OpenClaw session anchor through a current inbound message. */
export interface CustomerServiceMessageDelta {
  items: Array<CustomerServiceMessageSummary>;
  meta: ConversationMessageDeltaMeta;
}

/** Preview of the latest message in a conversation */
export interface CustomerServiceMessagePreview {
  /** JSON-stringified message content per message type */
  content?: Maybe<Scalars['String']['output']>;
  /** Unix seconds */
  createTime?: Maybe<Scalars['Int']['output']>;
  /** Opaque platform message index for ordering */
  index?: Maybe<Scalars['String']['output']>;
  messageId?: Maybe<Scalars['String']['output']>;
  sender?: Maybe<CustomerServiceConversationParticipant>;
  /** Message type (TEXT, IMAGE, ...) — see EcomMessageType */
  type?: Maybe<Scalars['String']['output']>;
}

/** Sender of a customer service message */
export interface CustomerServiceMessageSender {
  /** Display name. For shops, the shop name; for CS agents, the agent name; for buyers, their TikTok nickname. */
  nickname?: Maybe<Scalars['String']['output']>;
  /** BUYER, SHOP, CUSTOMER_SERVICE, SYSTEM, ROBOT */
  role?: Maybe<Scalars['String']['output']>;
}

/** A message in a CS conversation, trimmed for agent-facing tool output. */
export interface CustomerServiceMessageSummary {
  /** Unix seconds */
  createTime?: Maybe<Scalars['Int']['output']>;
  /** Platform message index/cursor when available. */
  index?: Maybe<Scalars['String']['output']>;
  /** Platform message ID. */
  messageId?: Maybe<Scalars['String']['output']>;
  sender?: Maybe<CustomerServiceMessageSender>;
  /** Human-readable message body. For TEXT messages the JSON wire content (`{"content":"..."}`) is unwrapped to the inner string. For rich cards (PRODUCT_CARD / ORDER_CARD / LOGISTICS_CARD) this is the platform-provided plaintext summary when available, otherwise the raw content string. */
  text?: Maybe<Scalars['String']['output']>;
  /** Message type (TEXT, IMAGE, PRODUCT_CARD, ORDER_CARD, LOGISTICS_CARD, etc.) */
  type?: Maybe<Scalars['String']['output']>;
}

/** Page of customer service message summaries */
export interface CustomerServiceMessageSummaryPage {
  items: Array<CustomerServiceMessageSummary>;
  /** Pagination cursor — pass back to fetch the next page */
  nextPageToken?: Maybe<Scalars['String']['output']>;
}

/** Scan result of CS conversations needing a seller reply. Not a paginated page — items is the complete scan output, capped by the platform's 24-hour SLA window. */
export interface CustomerServicePendingConversationsResult {
  items: Array<CustomerServiceConversationSummary>;
  /** True when the scan aborted mid-way due to an API error or internal max-page cap. Results returned are still valid but may be incomplete. */
  partial?: Maybe<Scalars['Boolean']['output']>;
}

/** One shop-local date of CS performance metrics */
export interface CustomerServicePerformanceDailyRow {
  /** Conversations with buyer inbound activity */
  activeConversations?: Maybe<Scalars['Int']['output']>;
  /** Average first-response time in seconds */
  avgFirstResponseSecs?: Maybe<Scalars['Float']['output']>;
  /** Mature TikTok-attributed CS-guided GMV as a decimal string. Dates within the latest seven full shop-local days are excluded and return null. */
  csGuidedGmv?: Maybe<Scalars['String']['output']>;
  /** Complete seven-day rolling average of mature TikTok-attributed CS-guided GMV. The query reads the six preceding dates before the requested range; null unless all seven consecutive shop-local dates are available in one currency. */
  csGuidedGmv7dAverage?: Maybe<Scalars['String']['output']>;
  /** Currency for csGuidedGmv7dAverage. Null when no complete single-currency seven-day window is available. */
  csGuidedGmv7dAverageCurrency?: Maybe<Scalars['String']['output']>;
  /** Currency for csGuidedGmv. Null when the value is immature or the selected scope contains multiple currencies. */
  csGuidedGmvCurrency?: Maybe<Scalars['String']['output']>;
  /** Report date (YYYY-MM-DD) */
  dateKey: Scalars['String']['output'];
  /** Aborted or superseded dispatches */
  dispatchAborted?: Maybe<Scalars['Int']['output']>;
  /** Accepted dispatches */
  dispatchAccepted?: Maybe<Scalars['Int']['output']>;
  /** Dispatch attempts */
  dispatchAttempts?: Maybe<Scalars['Int']['output']>;
  /** Failed dispatches */
  dispatchFailed?: Maybe<Scalars['Int']['output']>;
  /** Failed dispatches / dispatch attempts */
  dispatchFailureRate?: Maybe<Scalars['Float']['output']>;
  /** Skipped dispatches */
  dispatchSkipped?: Maybe<Scalars['Int']['output']>;
  /** Exclusive end of the date window (YYYY-MM-DD) */
  endDate: Scalars['String']['output'];
  /** Messages present when successful end-session operations completed */
  endedMessageCount?: Maybe<Scalars['Int']['output']>;
  /** Customer-service error events */
  errorCount?: Maybe<Scalars['Int']['output']>;
  /** Error events / active conversations */
  errorsPerConversation?: Maybe<Scalars['Float']['output']>;
  /** Active conversations that escalated */
  escalateConversations?: Maybe<Scalars['Int']['output']>;
  /** Escalated active conversations / active conversations */
  escalationRatio?: Maybe<Scalars['Float']['output']>;
  /** Resolved escalations / escalated conversations */
  escalationResolveRate?: Maybe<Scalars['Float']['output']>;
  /** Escalations resolved by human operators */
  escalationResolved?: Maybe<Scalars['Int']['output']>;
  /** Number of conversations with a first-response measurement */
  firstResponseCount?: Maybe<Scalars['Int']['output']>;
  /** Nearest-rank P50 first-response time in seconds */
  firstResponseP50Secs?: Maybe<Scalars['Float']['output']>;
  /** Nearest-rank P90 first-response time in seconds */
  firstResponseP90Secs?: Maybe<Scalars['Float']['output']>;
  /** Inbound buyer messages */
  inboundMessages?: Maybe<Scalars['Int']['output']>;
  /** Input tokens used by CS runs */
  inputTokens?: Maybe<Scalars['Int']['output']>;
  /** Conversations first seen in the period */
  newConversations?: Maybe<Scalars['Int']['output']>;
  /** Terminal platform support sessions grouped by begin_time date */
  newSessionCount?: Maybe<Scalars['Int']['output']>;
  /** Outbound seller or AI messages */
  outboundMessages?: Maybe<Scalars['Int']['output']>;
  /** Output tokens used by CS runs */
  outputTokens?: Maybe<Scalars['Int']['output']>;
  /** Support sessions with satisfaction ratings */
  ratedSessions?: Maybe<Scalars['Int']['output']>;
  /** Conversations reopened after prior inactivity */
  reopenedConversations?: Maybe<Scalars['Int']['output']>;
  /** Satisfied rated sessions / rated sessions */
  satisfactionRate?: Maybe<Scalars['Float']['output']>;
  /** Rated sessions considered satisfied */
  satisfiedSessions?: Maybe<Scalars['Int']['output']>;
  /** Start of the date window (YYYY-MM-DD) */
  startDate: Scalars['String']['output'];
  /** Terminal support sessions in the platform session fact */
  supportSessionCount?: Maybe<Scalars['Int']['output']>;
  /** Input + output tokens / active conversations */
  tokensPerConversation?: Maybe<Scalars['Float']['output']>;
  /** Input + output tokens used by CS runs */
  totalTokens?: Maybe<Scalars['Int']['output']>;
}

/** Calculated CS performance metrics for a report scope */
export interface CustomerServicePerformanceMetrics {
  /** Conversations with buyer inbound activity */
  activeConversations?: Maybe<Scalars['Int']['output']>;
  /** Average first-response time in seconds */
  avgFirstResponseSecs?: Maybe<Scalars['Float']['output']>;
  /** Mature TikTok-attributed CS-guided GMV as a decimal string. Dates within the latest seven full shop-local days are excluded and return null. */
  csGuidedGmv?: Maybe<Scalars['String']['output']>;
  /** Complete seven-day rolling average of mature TikTok-attributed CS-guided GMV. The query reads the six preceding dates before the requested range; null unless all seven consecutive shop-local dates are available in one currency. */
  csGuidedGmv7dAverage?: Maybe<Scalars['String']['output']>;
  /** Currency for csGuidedGmv7dAverage. Null when no complete single-currency seven-day window is available. */
  csGuidedGmv7dAverageCurrency?: Maybe<Scalars['String']['output']>;
  /** Currency for csGuidedGmv. Null when the value is immature or the selected scope contains multiple currencies. */
  csGuidedGmvCurrency?: Maybe<Scalars['String']['output']>;
  /** Aborted or superseded dispatches */
  dispatchAborted?: Maybe<Scalars['Int']['output']>;
  /** Accepted dispatches */
  dispatchAccepted?: Maybe<Scalars['Int']['output']>;
  /** Dispatch attempts */
  dispatchAttempts?: Maybe<Scalars['Int']['output']>;
  /** Failed dispatches */
  dispatchFailed?: Maybe<Scalars['Int']['output']>;
  /** Failed dispatches / dispatch attempts */
  dispatchFailureRate?: Maybe<Scalars['Float']['output']>;
  /** Skipped dispatches */
  dispatchSkipped?: Maybe<Scalars['Int']['output']>;
  /** Messages present when successful end-session operations completed */
  endedMessageCount?: Maybe<Scalars['Int']['output']>;
  /** Customer-service error events */
  errorCount?: Maybe<Scalars['Int']['output']>;
  /** Error events / active conversations */
  errorsPerConversation?: Maybe<Scalars['Float']['output']>;
  /** Active conversations that escalated */
  escalateConversations?: Maybe<Scalars['Int']['output']>;
  /** Escalated active conversations / active conversations */
  escalationRatio?: Maybe<Scalars['Float']['output']>;
  /** Resolved escalations / escalated conversations */
  escalationResolveRate?: Maybe<Scalars['Float']['output']>;
  /** Escalations resolved by human operators */
  escalationResolved?: Maybe<Scalars['Int']['output']>;
  /** Number of conversations with a first-response measurement */
  firstResponseCount?: Maybe<Scalars['Int']['output']>;
  /** Nearest-rank P50 first-response time in seconds */
  firstResponseP50Secs?: Maybe<Scalars['Float']['output']>;
  /** Nearest-rank P90 first-response time in seconds */
  firstResponseP90Secs?: Maybe<Scalars['Float']['output']>;
  /** Inbound buyer messages */
  inboundMessages?: Maybe<Scalars['Int']['output']>;
  /** Input tokens used by CS runs */
  inputTokens?: Maybe<Scalars['Int']['output']>;
  /** Conversations first seen in the period */
  newConversations?: Maybe<Scalars['Int']['output']>;
  /** Terminal platform support sessions grouped by begin_time date */
  newSessionCount?: Maybe<Scalars['Int']['output']>;
  /** Outbound seller or AI messages */
  outboundMessages?: Maybe<Scalars['Int']['output']>;
  /** Output tokens used by CS runs */
  outputTokens?: Maybe<Scalars['Int']['output']>;
  /** Support sessions with satisfaction ratings */
  ratedSessions?: Maybe<Scalars['Int']['output']>;
  /** Conversations reopened after prior inactivity */
  reopenedConversations?: Maybe<Scalars['Int']['output']>;
  /** Satisfied rated sessions / rated sessions */
  satisfactionRate?: Maybe<Scalars['Float']['output']>;
  /** Rated sessions considered satisfied */
  satisfiedSessions?: Maybe<Scalars['Int']['output']>;
  /** Terminal support sessions in the platform session fact */
  supportSessionCount?: Maybe<Scalars['Int']['output']>;
  /** Input + output tokens / active conversations */
  tokensPerConversation?: Maybe<Scalars['Float']['output']>;
  /** Input + output tokens used by CS runs */
  totalTokens?: Maybe<Scalars['Int']['output']>;
}

/** Comprehensive customer-service performance report */
export interface CustomerServicePerformanceReport {
  byDate: Array<CustomerServicePerformanceDailyRow>;
  scope: CustomerServicePerformanceScope;
  summary: CustomerServicePerformanceMetrics;
}

/** Scope and date range used for a CS performance report */
export interface CustomerServicePerformanceScope {
  /** End date exclusive (YYYY-MM-DD) */
  endDate: Scalars['String']['output'];
  /** Number of shops included in the report */
  shopCount?: Maybe<Scalars['Int']['output']>;
  /** Shop ID when the report is scoped to one shop */
  shopId?: Maybe<Scalars['String']['output']>;
  /** Start date inclusive (YYYY-MM-DD) */
  startDate: Scalars['String']['output'];
}

/** Backend-normalized platform lifecycle for a CS conversation. */
export const CustomerServicePlatformConversationStatus = {
  Closed: 'CLOSED',
  Ended: 'ENDED',
  Open: 'OPEN',
  SessionTimeoutAssumed: 'SESSION_TIMEOUT_ASSUMED'
} as const;

export type CustomerServicePlatformConversationStatus = typeof CustomerServicePlatformConversationStatus[keyof typeof CustomerServicePlatformConversationStatus];
/** Recent bad product review context linked to a customer-service buyer. */
export interface CustomerServiceProductReviewSummary {
  content?: Maybe<Scalars['String']['output']>;
  followUpStatus: ProductReviewFollowUpStatus;
  /** MongoDB product review ID. */
  id: Scalars['ID']['output'];
  orderId?: Maybe<Scalars['String']['output']>;
  /** Platform review ID from TikTok Shop. */
  platformReviewId: Scalars['String']['output'];
  productId?: Maybe<Scalars['String']['output']>;
  rating?: Maybe<Scalars['Int']['output']>;
  /** Unix seconds when the review was created. */
  reviewCreateTime?: Maybe<Scalars['Int']['output']>;
  /** Unix seconds when the review was last updated. */
  reviewUpdateTime?: Maybe<Scalars['Int']['output']>;
  sellerSkus?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
}

/** One 5-minute bucket of realtime customer-service performance metrics */
export interface CustomerServiceRealtimePerformancePoint {
  /** Active customer-service conversations */
  activeConversations: Scalars['Int']['output'];
  /** Accepted customer-service agent rounds in this 5-minute bucket */
  agentRoundCount: Scalars['Int']['output'];
  /** Successful CS end-session tool calls in this 5-minute bucket */
  endedSessionCount: Scalars['Int']['output'];
  /** Active conversations with open escalations */
  escalatedConversations: Scalars['Int']['output'];
  /** Durable escalations created in this 5-minute bucket */
  escalationCreatedCount: Scalars['Int']['output'];
  /** Durable escalations resolved in this 5-minute bucket */
  escalationResolvedCount: Scalars['Int']['output'];
  /** Nearest-rank P50 first-response time in seconds for the realtime window */
  firstResponseP50Secs?: Maybe<Scalars['Float']['output']>;
  /** Average pending age in seconds for AI-enabled pending conversations */
  pendingAgeSecs?: Maybe<Scalars['Float']['output']>;
  /** AI-enabled conversations pending seller response */
  pendingConversations: Scalars['Int']['output'];
  /** AI-enabled pending conversations older than 5 minutes */
  pendingOver5m: Scalars['Int']['output'];
  /** AI-enabled pending conversations older than 15 minutes */
  pendingOver15m: Scalars['Int']['output'];
  /** AI-enabled pending conversations older than 30 minutes */
  pendingOver30m: Scalars['Int']['output'];
  /** UTC sampled timestamp for this realtime bucket */
  sampledAt: Scalars['String']['output'];
}

/** Near-real-time customer-service performance report */
export interface CustomerServiceRealtimePerformanceReport {
  points: Array<CustomerServiceRealtimePerformancePoint>;
  scope: CustomerServiceRealtimePerformanceScope;
}

/** Scope and time window used for a realtime CS performance report */
export interface CustomerServiceRealtimePerformanceScope {
  /** Realtime bucket size in minutes */
  bucketMinutes: Scalars['Int']['output'];
  /** UTC end timestamp of the realtime window */
  endTime: Scalars['String']['output'];
  /** Requested trailing realtime window in hours */
  hours: Scalars['Int']['output'];
  /** Number of shops included in the report */
  shopCount?: Maybe<Scalars['Int']['output']>;
  /** Shop ID when the report is scoped to one shop */
  shopId?: Maybe<Scalars['String']['output']>;
  /** UTC start timestamp of the realtime window */
  startTime: Scalars['String']['output'];
}

/** Send message result */
export interface CustomerServiceSendMessageResult {
  /** Platform message ID of the sent message, if returned */
  messageId?: Maybe<Scalars['String']['output']>;
}

/** Customer service support session */
export interface CustomerServiceSession {
  /** Unix seconds when the session began */
  beginTime?: Maybe<Scalars['Int']['output']>;
  /** Buyer's nickname */
  buyerNickname?: Maybe<Scalars['String']['output']>;
  /** Chat tags such as AfterSale, Logistics, or Presale */
  chatTags?: Maybe<Array<Scalars['String']['output']>>;
  /** Associated conversation ID */
  conversationId?: Maybe<Scalars['String']['output']>;
  /** Reason for low satisfaction, localized by the request locale */
  dissatisfactionReason?: Maybe<Scalars['String']['output']>;
  /** Unix seconds when the session ended */
  endTime?: Maybe<Scalars['Int']['output']>;
  /** Customer satisfaction score (for example 1-5) */
  satisfactionScore?: Maybe<Scalars['Int']['output']>;
  sessionId: Scalars['String']['output'];
}

/** Page of customer service support sessions */
export interface CustomerServiceSessionPage {
  items: Array<CustomerServiceSession>;
  nextPageToken?: Maybe<Scalars['String']['output']>;
}

/** Customer service settings per shop (user-configurable) */
export interface CustomerServiceSettings {
  businessPrompt?: Maybe<Scalars['String']['output']>;
  csDeviceId?: Maybe<Scalars['String']['output']>;
  /** LLM model override for CS sessions (e.g. 'glm-5'). Null = use default model. */
  csModelOverride?: Maybe<Scalars['String']['output']>;
  /** LLM provider override for CS sessions (e.g. 'zhipu'). Null = use default provider. */
  csProviderOverride?: Maybe<Scalars['String']['output']>;
  enabled: Scalars['Boolean']['output'];
  /** Channel ID for escalation messages. Null = not configured. */
  escalationChannelId?: Maybe<Scalars['String']['output']>;
  /** Recipient ID for escalation messages. Null = not configured. */
  escalationRecipientId?: Maybe<Scalars['String']['output']>;
  /** Platform-managed CS system prompt (same for all shops on this backend version; versioned by EasyClaw operators). Returns null when no platform prompt is configured. Clients compose this with `businessPrompt` locally via the shared `assembleCsPrompt` helper. */
  platformSystemPrompt?: Maybe<Scalars['String']['output']>;
  reviewOptimization: ReviewOptimizationSettings;
  /** RunProfile ID for CS agent sessions */
  runProfileId?: Maybe<Scalars['String']['output']>;
  /** Whether CS should proactively reach out for eligible unpaid orders. */
  unpaidOrderReachoutEnabled: Scalars['Boolean']['output'];
  unpaidOrderReachoutExperiment: UnpaidOrderReachoutExperiment;
  unpaidOrderReachoutStages: Array<UnpaidOrderReachoutStage>;
}

/** Full CS settings including device-level fields (Panel/backend use) */
export interface CustomerServiceSettingsInput {
  /** Store instructions. Omit or pass null to keep, empty string to clear. */
  businessPrompt?: InputMaybe<Scalars['String']['input']>;
  /** Device ID (machine fingerprint) of the desktop instance handling CS. Set by desktop app via Panel UI. Omit or pass null to keep, empty string to clear. */
  csDeviceId?: InputMaybe<Scalars['String']['input']>;
  /** CS model override. Omit or pass null to keep, empty string to clear. */
  csModelOverride?: InputMaybe<Scalars['String']['input']>;
  /** CS provider override. Omit or pass null to keep, empty string to clear. */
  csProviderOverride?: InputMaybe<Scalars['String']['input']>;
  /** CS enabled flag. Omit or pass null to keep, true/false to set. */
  enabled?: InputMaybe<Scalars['Boolean']['input']>;
  /** Escalation channel ID. Omit or pass null to keep, empty string to clear. */
  escalationChannelId?: InputMaybe<Scalars['String']['input']>;
  /** Escalation recipient ID. Omit or pass null to keep, empty string to clear. */
  escalationRecipientId?: InputMaybe<Scalars['String']['input']>;
  /** Optimistic concurrency token for an active configuration experiment. Required when disabling reachout/evaluation would stop that experiment. */
  expectedConfigExperimentId?: InputMaybe<Scalars['ID']['input']>;
  /** Optimistic concurrency token for an active holdout experiment. Required when a requested settings change can replace or stop that experiment. */
  expectedHoldoutExperimentId?: InputMaybe<Scalars['ID']['input']>;
  /** Review optimization settings. Omit or pass null to keep. */
  reviewOptimization?: InputMaybe<ReviewOptimizationSettingsInput>;
  /** RunProfile ID for CS. Omit or pass null to keep, empty string to clear. */
  runProfileId?: InputMaybe<Scalars['String']['input']>;
  /** Nested configuration optimization within holdout Treatment traffic. Variant A is always the current production configuration. */
  unpaidOrderConfigExperiment?: InputMaybe<AgentUnpaidOrderConfigExperimentInput>;
  /** Unpaid-order evaluation patch. Omit/null to keep. Read the current evaluation first and pass the active experiment IDs when changing it. */
  unpaidOrderEvaluation?: InputMaybe<AgentUnpaidOrderEvaluationInput>;
  /** Unpaid-order proactive reachout flag. Omit or pass null to keep, true/false to set. */
  unpaidOrderReachoutEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  /** Backend/internal holdout settings patch. Agent callers must use unpaidOrderEvaluation instead. */
  unpaidOrderReachoutExperiment?: InputMaybe<UnpaidOrderReachoutExperimentInput>;
  /** Full replacement for unpaid-order reminder stages. Omit/null to keep. Maximum 3 stages. */
  unpaidOrderReachoutStages?: InputMaybe<Array<UnpaidOrderReachoutStageInput>>;
}

export interface DecideActionProposalInput {
  /** CreatorRelationship workspace for BD proposals. Omit for shop-operations proposals, which are authorized by focusShopId. */
  creatorRelationshipId?: InputMaybe<Scalars['ID']['input']>;
  decision?: InputMaybe<ActionProposalDecisionSnapshotInput>;
  id: Scalars['ID']['input'];
  status: ActionProposalStatus;
}

export interface DeleteAffiliateCampaignDraftInput {
  campaignId: Scalars['ID']['input'];
}

/** Public Google sign-in configuration for native desktop clients. */
export interface DesktopGoogleAuthConfig {
  clientId?: Maybe<Scalars['String']['output']>;
  enabled: Scalars['Boolean']['output'];
}

/** One-time native Google authorization-code exchange. */
export interface DesktopGoogleCodeExchangeInput {
  code: Scalars['String']['input'];
  codeVerifier: Scalars['String']['input'];
  redirectUri: Scalars['String']['input'];
}

export interface DesktopToWebLoginStart {
  authorizationUrl: Scalars['String']['output'];
  expiresAt: Scalars['DateTimeISO']['output'];
}

export interface DuplicateAffiliateCampaignInput {
  campaignId: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
}

/** Affiliate category chain */
export interface EcomAffiliateCategoryChain {
  id?: Maybe<Scalars['String']['output']>;
  isLeaf?: Maybe<Scalars['Boolean']['output']>;
  localName?: Maybe<Scalars['String']['output']>;
  parentId?: Maybe<Scalars['String']['output']>;
}

/** Affiliate commission information */
export interface EcomAffiliateCommission {
  amount?: Maybe<Scalars['Float']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  effectiveTime?: Maybe<Scalars['Int']['output']>;
  endTime?: Maybe<Scalars['Int']['output']>;
  maximumAmount?: Maybe<Scalars['Float']['output']>;
  minimumAmount?: Maybe<Scalars['Float']['output']>;
  rate?: Maybe<Scalars['Int']['output']>;
  shopAdsCommissionRate?: Maybe<Scalars['Int']['output']>;
  startTime?: Maybe<Scalars['Int']['output']>;
}

/** Affiliate product summary */
export interface EcomAffiliateProduct {
  categoryChains?: Maybe<Array<EcomAffiliateCategoryChain>>;
  collaborationStatus?: Maybe<Scalars['String']['output']>;
  commission?: Maybe<EcomAffiliateCommission>;
  commissionEffectiveStatus?: Maybe<Scalars['String']['output']>;
  detailLink?: Maybe<Scalars['String']['output']>;
  hasInventory?: Maybe<Scalars['Boolean']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  imageUrl?: Maybe<Scalars['String']['output']>;
  inventory?: Maybe<Scalars['Int']['output']>;
  mainImageUrl?: Maybe<Scalars['String']['output']>;
  originalPrice?: Maybe<EcomNumericMoneyRange>;
  productId?: Maybe<Scalars['String']['output']>;
  saleRegion?: Maybe<Scalars['String']['output']>;
  salesPrice?: Maybe<EcomNumericMoneyRange>;
  shop?: Maybe<EcomAffiliateShop>;
  skuId?: Maybe<Scalars['String']['output']>;
  skuImageUrl?: Maybe<Scalars['String']['output']>;
  skuName?: Maybe<Scalars['String']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
  unitsSold?: Maybe<Scalars['Int']['output']>;
}

/** Affiliate seller shop summary */
export interface EcomAffiliateShop {
  name?: Maybe<Scalars['String']['output']>;
}

/** Aftersale eligibility for an order */
export interface EcomAftersaleEligibility {
  skuEligibility?: Maybe<Array<EcomAftersaleSkuEligibility>>;
}

/** Eligibility for a single request type on a SKU */
export interface EcomAftersaleLineItemEligibility {
  eligible?: Maybe<Scalars['Boolean']['output']>;
  ineligibleCode?: Maybe<Scalars['Int']['output']>;
  ineligibleReason?: Maybe<Scalars['String']['output']>;
  orderLineItemIds?: Maybe<Array<Scalars['String']['output']>>;
  /** RETURN_AND_REFUND, REFUND, CANCEL */
  requestType?: Maybe<Scalars['String']['output']>;
}

/** Per-SKU eligibility matrix for an order */
export interface EcomAftersaleSkuEligibility {
  lineItemEligibility?: Maybe<Array<EcomAftersaleLineItemEligibility>>;
  skuId?: Maybe<Scalars['String']['output']>;
}

/** Money value used by ecommerce analytics metrics */
export interface EcomAnalyticsMoney {
  amount?: Maybe<Scalars['String']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
}

/** Decision for approving a refund request */
export const EcomApproveRefundDecision = {
  ApproveRefund: 'APPROVE_REFUND',
  IssueReplacementRefund: 'ISSUE_REPLACEMENT_REFUND',
  OfferPartialRefund: 'OFFER_PARTIAL_REFUND'
} as const;

export type EcomApproveRefundDecision = typeof EcomApproveRefundDecision[keyof typeof EcomApproveRefundDecision];
/** Decision for approving a return request */
export const EcomApproveReturnDecision = {
  ApproveReceivedPackage: 'APPROVE_RECEIVED_PACKAGE',
  ApproveReplacement: 'APPROVE_REPLACEMENT',
  ApproveReturn: 'APPROVE_RETURN'
} as const;

export type EcomApproveReturnDecision = typeof EcomApproveReturnDecision[keyof typeof EcomApproveReturnDecision];
/** Auto add product settings */
export interface EcomAutoAddProductSetting {
  commissionRate?: Maybe<Scalars['Int']['output']>;
  enable?: Maybe<Scalars['Boolean']['output']>;
}

/** Warehouse-backed and live ecommerce BI dataset identifiers. */
export const EcomBiDatasetId = {
  AdsGmvCampaignDaily: 'ADS_GMV_CAMPAIGN_DAILY',
  AdsGmvCampaignSummaryDaily: 'ADS_GMV_CAMPAIGN_SUMMARY_DAILY',
  AdsGmvCreativeDaily: 'ADS_GMV_CREATIVE_DAILY',
  AdsGmvCreativeProductDaily: 'ADS_GMV_CREATIVE_PRODUCT_DAILY',
  AdsGmvProductDaily: 'ADS_GMV_PRODUCT_DAILY',
  AffiliateOrderExportLine: 'AFFILIATE_ORDER_EXPORT_LINE',
  CsDailySummary: 'CS_DAILY_SUMMARY',
  FinanceIncomeExportLine: 'FINANCE_INCOME_EXPORT_LINE',
  FinancePaymentExportLine: 'FINANCE_PAYMENT_EXPORT_LINE',
  FinanceStatementDaily: 'FINANCE_STATEMENT_DAILY',
  OrderProductDaily: 'ORDER_PRODUCT_DAILY',
  OrderShopDaily: 'ORDER_SHOP_DAILY',
  OrderSkuDaily: 'ORDER_SKU_DAILY',
  OrderSkuExportLine: 'ORDER_SKU_EXPORT_LINE',
  ShopSpsMetricCurrent: 'SHOP_SPS_METRIC_CURRENT',
  ShopSpsMetricDiagnosisCurrent: 'SHOP_SPS_METRIC_DIAGNOSIS_CURRENT',
  ShopSpsOverviewCurrent: 'SHOP_SPS_OVERVIEW_CURRENT',
  ShopSpsTopItemCurrent: 'SHOP_SPS_TOP_ITEM_CURRENT',
  WmsCurrentStock: 'WMS_CURRENT_STOCK'
} as const;

export type EcomBiDatasetId = typeof EcomBiDatasetId[keyof typeof EcomBiDatasetId];
/** BI dataset metadata. */
export interface EcomBiDatasetMetadata {
  dateRangeRequirement: EcomBiDateRangeRequirement;
  defaultDimensions: Array<EcomBiDimension>;
  defaultMetrics: Array<EcomBiMetric>;
  description: Scalars['String']['output'];
  dimensions: Array<EcomBiDimensionMetadata>;
  grain: Scalars['String']['output'];
  id: EcomBiDatasetId;
  label: Scalars['String']['output'];
  metrics: Array<EcomBiMetricMetadata>;
  scopeTypes: Array<EcomBiScopeType>;
  supportedGranularities: Array<EcomBiGranularity>;
}

/** Whether a BI dataset uses startDateGe/endDateLt. */
export const EcomBiDateRangeRequirement = {
  Optional: 'OPTIONAL',
  Required: 'REQUIRED',
  Unused: 'UNUSED'
} as const;

export type EcomBiDateRangeRequirement = typeof EcomBiDateRangeRequirement[keyof typeof EcomBiDateRangeRequirement];
/** Allowed BI dimensions. Dataset metadata declares which are valid per dataset. */
export const EcomBiDimension = {
  AdjustmentReason: 'ADJUSTMENT_REASON',
  AdvertiserId: 'ADVERTISER_ID',
  AdvertiserName: 'ADVERTISER_NAME',
  AdvertiserTimezone: 'ADVERTISER_TIMEZONE',
  AffiliateOrderAttributionKey: 'AFFILIATE_ORDER_ATTRIBUTION_KEY',
  BankAccountMasked: 'BANK_ACCOUNT_MASKED',
  BuyerMessage: 'BUYER_MESSAGE',
  BuyerUsername: 'BUYER_USERNAME',
  CampaignBudgetMode: 'CAMPAIGN_BUDGET_MODE',
  CampaignId: 'CAMPAIGN_ID',
  CampaignName: 'CAMPAIGN_NAME',
  CampaignObjectiveType: 'CAMPAIGN_OBJECTIVE_TYPE',
  CampaignOperationStatus: 'CAMPAIGN_OPERATION_STATUS',
  CampaignPrimaryStatus: 'CAMPAIGN_PRIMARY_STATUS',
  CampaignProductSource: 'CAMPAIGN_PRODUCT_SOURCE',
  CampaignSalesDestination: 'CAMPAIGN_SALES_DESTINATION',
  CampaignType: 'CAMPAIGN_TYPE',
  CancellationReturnType: 'CANCELLATION_RETURN_TYPE',
  CancelledTime: 'CANCELLED_TIME',
  CancelBy: 'CANCEL_BY',
  CancelReason: 'CANCEL_REASON',
  City: 'CITY',
  CollectionMethods: 'COLLECTION_METHODS',
  CommissionModel: 'COMMISSION_MODEL',
  ContentId: 'CONTENT_ID',
  ContentType: 'CONTENT_TYPE',
  Country: 'COUNTRY',
  CreatedTime: 'CREATED_TIME',
  CreativeAssetType: 'CREATIVE_ASSET_TYPE',
  CreativeDeliveryStatus: 'CREATIVE_DELIVERY_STATUS',
  CreativePostedTime: 'CREATIVE_POSTED_TIME',
  CreativeReviewStatus: 'CREATIVE_REVIEW_STATUS',
  CreativeTitle: 'CREATIVE_TITLE',
  CreativeType: 'CREATIVE_TYPE',
  CreatorUsername: 'CREATOR_USERNAME',
  Currency: 'CURRENCY',
  CurrentOptimizations: 'CURRENT_OPTIMIZATIONS',
  Date: 'DATE',
  DeliveredTime: 'DELIVERED_TIME',
  DeliveryInstruction: 'DELIVERY_INSTRUCTION',
  DeliveryOption: 'DELIVERY_OPTION',
  DeliveryOptionType: 'DELIVERY_OPTION_TYPE',
  District: 'DISTRICT',
  Email: 'EMAIL',
  FinanceLineKey: 'FINANCE_LINE_KEY',
  FinanceOrderCreatedTime: 'FINANCE_ORDER_CREATED_TIME',
  FinanceOrderDeliveryTime: 'FINANCE_ORDER_DELIVERY_TIME',
  FinanceStatus: 'FINANCE_STATUS',
  FulfillmentType: 'FULFILLMENT_TYPE',
  FullyReturnedOrRefunded: 'FULLY_RETURNED_OR_REFUNDED',
  GmvModule: 'GMV_MODULE',
  HouseNameOrNumber: 'HOUSE_NAME_OR_NUMBER',
  LineItemSkuType: 'LINE_ITEM_SKU_TYPE',
  NormalOrPreorder: 'NORMAL_OR_PREORDER',
  ObservedAt: 'OBSERVED_AT',
  OrderAdjustmentId: 'ORDER_ADJUSTMENT_ID',
  OrderDeliveryTime: 'ORDER_DELIVERY_TIME',
  OrderId: 'ORDER_ID',
  OrderLineKey: 'ORDER_LINE_KEY',
  OrderStatus: 'ORDER_STATUS',
  OrderSubstatus: 'ORDER_SUBSTATUS',
  OrderType: 'ORDER_TYPE',
  PackageId: 'PACKAGE_ID',
  PaidTime: 'PAID_TIME',
  PaymentMethod: 'PAYMENT_METHOD',
  PaymentTime: 'PAYMENT_TIME',
  PayoutCompletionTime: 'PAYOUT_COMPLETION_TIME',
  PayoutId: 'PAYOUT_ID',
  PayoutInitiationTime: 'PAYOUT_INITIATION_TIME',
  PayoutNotes: 'PAYOUT_NOTES',
  PhoneNumber: 'PHONE_NUMBER',
  Platform: 'PLATFORM',
  ProductBrandId: 'PRODUCT_BRAND_ID',
  ProductBrandName: 'PRODUCT_BRAND_NAME',
  ProductCategory: 'PRODUCT_CATEGORY',
  ProductCategoryId: 'PRODUCT_CATEGORY_ID',
  ProductCategoryName: 'PRODUCT_CATEGORY_NAME',
  ProductId: 'PRODUCT_ID',
  ProductName: 'PRODUCT_NAME',
  ProductStatus: 'PRODUCT_STATUS',
  Recipient: 'RECIPIENT',
  RelatedOrderId: 'RELATED_ORDER_ID',
  RoiProtection: 'ROI_PROTECTION',
  RtsTime: 'RTS_TIME',
  SellerNote: 'SELLER_NOTE',
  SellerSku: 'SELLER_SKU',
  ShippedTime: 'SHIPPED_TIME',
  ShippingDiscountMode: 'SHIPPING_DISCOUNT_MODE',
  ShippingInformation: 'SHIPPING_INFORMATION',
  ShippingProviderName: 'SHIPPING_PROVIDER_NAME',
  ShopAdsCommissionRate: 'SHOP_ADS_COMMISSION_RATE',
  ShopAlias: 'SHOP_ALIAS',
  ShopId: 'SHOP_ID',
  ShopName: 'SHOP_NAME',
  ShopOrderStatus: 'SHOP_ORDER_STATUS',
  ShopRegion: 'SHOP_REGION',
  SkuId: 'SKU_ID',
  SkuName: 'SKU_NAME',
  SkuStatus: 'SKU_STATUS',
  SourceCreativeId: 'SOURCE_CREATIVE_ID',
  SourceCreativeIdType: 'SOURCE_CREATIVE_ID_TYPE',
  SpsAftersalesType: 'SPS_AFTERSALES_TYPE',
  SpsCalculationDenominatorLabel: 'SPS_CALCULATION_DENOMINATOR_LABEL',
  SpsCalculationNumeratorLabel: 'SPS_CALCULATION_NUMERATOR_LABEL',
  SpsDiagnosisDetails: 'SPS_DIAGNOSIS_DETAILS',
  SpsDiagnosisSummaries: 'SPS_DIAGNOSIS_SUMMARIES',
  SpsDimension: 'SPS_DIMENSION',
  SpsEvaluationEndTime: 'SPS_EVALUATION_END_TIME',
  SpsEvaluationStartTime: 'SPS_EVALUATION_START_TIME',
  SpsItemType: 'SPS_ITEM_TYPE',
  SpsLogisticsProvider: 'SPS_LOGISTICS_PROVIDER',
  SpsMetricCode: 'SPS_METRIC_CODE',
  SpsMetricName: 'SPS_METRIC_NAME',
  SpsPrimaryCategoryId: 'SPS_PRIMARY_CATEGORY_ID',
  SpsPrimaryCategoryName: 'SPS_PRIMARY_CATEGORY_NAME',
  SpsProductImageUrl: 'SPS_PRODUCT_IMAGE_URL',
  SpsSourceUpdateTime: 'SPS_SOURCE_UPDATE_TIME',
  SpsStatus: 'SPS_STATUS',
  SpsStatusText: 'SPS_STATUS_TEXT',
  SpsTier: 'SPS_TIER',
  SpsTierText: 'SPS_TIER_TEXT',
  SpsTopIssueCodes: 'SPS_TOP_ISSUE_CODES',
  SpsTopIssueSummary: 'SPS_TOP_ISSUE_SUMMARY',
  SpsTopReasons: 'SPS_TOP_REASONS',
  SpsTopReasonText: 'SPS_TOP_REASON_TEXT',
  SpsTrendRecordDate: 'SPS_TREND_RECORD_DATE',
  SpsUnlockedBenefitNames: 'SPS_UNLOCKED_BENEFIT_NAMES',
  SpsValueUnit: 'SPS_VALUE_UNIT',
  StandardCommissionRate: 'STANDARD_COMMISSION_RATE',
  State: 'STATE',
  StatementId: 'STATEMENT_ID',
  StoreId: 'STORE_ID',
  StoreName: 'STORE_NAME',
  StreetName: 'STREET_NAME',
  TiktokAccountAuthorizationType: 'TIKTOK_ACCOUNT_AUTHORIZATION_TYPE',
  TiktokAccountName: 'TIKTOK_ACCOUNT_NAME',
  TimeCommissionPaid: 'TIME_COMMISSION_PAID',
  TimeCreated: 'TIME_CREATED',
  TrackingId: 'TRACKING_ID',
  TransactionType: 'TRANSACTION_TYPE',
  Variation: 'VARIATION',
  VideoSource: 'VIDEO_SOURCE',
  WarehouseCode: 'WAREHOUSE_CODE',
  WarehouseExternalId: 'WAREHOUSE_EXTERNAL_ID',
  WarehouseId: 'WAREHOUSE_ID',
  WarehouseName: 'WAREHOUSE_NAME',
  WmsAccountId: 'WMS_ACCOUNT_ID',
  WmsAccountLabel: 'WMS_ACCOUNT_LABEL',
  WmsProvider: 'WMS_PROVIDER',
  Zipcode: 'ZIPCODE'
} as const;

export type EcomBiDimension = typeof EcomBiDimension[keyof typeof EcomBiDimension];
/** Expected BI dimension cardinality for grouping and filtering guidance. */
export const EcomBiDimensionCardinality = {
  High: 'HIGH',
  Low: 'LOW',
  Medium: 'MEDIUM'
} as const;

export type EcomBiDimensionCardinality = typeof EcomBiDimensionCardinality[keyof typeof EcomBiDimensionCardinality];
/** Business entity described by a BI dimension. */
export const EcomBiDimensionEntity = {
  Advertiser: 'ADVERTISER',
  AffiliateOrder: 'AFFILIATE_ORDER',
  Campaign: 'CAMPAIGN',
  Creative: 'CREATIVE',
  CustomerService: 'CUSTOMER_SERVICE',
  Date: 'DATE',
  Finance: 'FINANCE',
  Order: 'ORDER',
  Product: 'PRODUCT',
  Shop: 'SHOP',
  Sku: 'SKU',
  Store: 'STORE',
  Warehouse: 'WAREHOUSE',
  WmsAccount: 'WMS_ACCOUNT'
} as const;

export type EcomBiDimensionEntity = typeof EcomBiDimensionEntity[keyof typeof EcomBiDimensionEntity];
/** BI dimension metadata. */
export interface EcomBiDimensionMetadata {
  cardinality: EcomBiDimensionCardinality;
  description: Scalars['String']['output'];
  entity: EcomBiDimensionEntity;
  filterOperators: Array<EcomBiFilterOperator>;
  filterable: Scalars['Boolean']['output'];
  groupable: Scalars['Boolean']['output'];
  id: EcomBiDimension;
  label: Scalars['String']['output'];
  requiredDimensions: Array<EcomBiDimension>;
  source: EcomBiDimensionSource;
  valueType: EcomBiValueType;
}

/** Where a BI dimension value is resolved from. */
export const EcomBiDimensionSource = {
  Derived: 'DERIVED',
  Dimension: 'DIMENSION',
  Fact: 'FACT'
} as const;

export type EcomBiDimensionSource = typeof EcomBiDimensionSource[keyof typeof EcomBiDimensionSource];
/** Whether a BI output column is a dimension or metric. */
export const EcomBiFieldRole = {
  Dimension: 'DIMENSION',
  Metric: 'METRIC'
} as const;

export type EcomBiFieldRole = typeof EcomBiFieldRole[keyof typeof EcomBiFieldRole];
/** A BI dimension filter. */
export interface EcomBiFilterInput {
  /** Filterable dimension. */
  dimension: EcomBiDimension;
  /** Filter operator. */
  operator: EcomBiFilterOperator;
  /** Filter values. Empty lists are invalid. */
  values: Array<Scalars['String']['input']>;
}

/** Allowed BI filter operators. */
export const EcomBiFilterOperator = {
  In: 'IN',
  NotIn: 'NOT_IN'
} as const;

export type EcomBiFilterOperator = typeof EcomBiFilterOperator[keyof typeof EcomBiFilterOperator];
/** Supported BI date granularities. The first Ads GMV Max catalogs are daily. */
export const EcomBiGranularity = {
  Daily: 'DAILY'
} as const;

export type EcomBiGranularity = typeof EcomBiGranularity[keyof typeof EcomBiGranularity];
/** Allowed BI metrics. Dataset metadata declares which are valid per dataset. */
export const EcomBiMetric = {
  ActiveConversations: 'ACTIVE_CONVERSATIONS',
  ActualCofundedCreatorBonus: 'ACTUAL_COFUNDED_CREATOR_BONUS',
  ActualCommissionBase: 'ACTUAL_COMMISSION_BASE',
  ActualCommissionPayment: 'ACTUAL_COMMISSION_PAYMENT',
  ActualReturnShippingFeeAmount: 'ACTUAL_RETURN_SHIPPING_FEE_AMOUNT',
  ActualShopAdsCommissionPayment: 'ACTUAL_SHOP_ADS_COMMISSION_PAYMENT',
  AdClickRate: 'AD_CLICK_RATE',
  AdConversionRate: 'AD_CONVERSION_RATE',
  AdVideoViewRate_2S: 'AD_VIDEO_VIEW_RATE_2S',
  AdVideoViewRate_6S: 'AD_VIDEO_VIEW_RATE_6S',
  AdVideoViewRate_25P: 'AD_VIDEO_VIEW_RATE_25P',
  AdVideoViewRate_50P: 'AD_VIDEO_VIEW_RATE_50P',
  AdVideoViewRate_75P: 'AD_VIDEO_VIEW_RATE_75P',
  AdVideoViewRate_100P: 'AD_VIDEO_VIEW_RATE_100P',
  AffiliateCommissionAmount: 'AFFILIATE_COMMISSION_AMOUNT',
  AffiliateCommissionDepositAmount: 'AFFILIATE_COMMISSION_DEPOSIT_AMOUNT',
  AffiliateCommissionRefundAmount: 'AFFILIATE_COMMISSION_REFUND_AMOUNT',
  AffiliatePartnerCommissionAmount: 'AFFILIATE_PARTNER_COMMISSION_AMOUNT',
  AffiliatePartnerShopAdsCommissionAmount: 'AFFILIATE_PARTNER_SHOP_ADS_COMMISSION_AMOUNT',
  AffiliateShopAdsCommissionAmount: 'AFFILIATE_SHOP_ADS_COMMISSION_AMOUNT',
  AvgFirstResponseSecs: 'AVG_FIRST_RESPONSE_SECS',
  CampaignResourceFeeAmount: 'CAMPAIGN_RESOURCE_FEE_AMOUNT',
  CampaignServiceFeeAmount: 'CAMPAIGN_SERVICE_FEE_AMOUNT',
  CancelledGmv: 'CANCELLED_GMV',
  CancelledOrderCount: 'CANCELLED_ORDER_COUNT',
  CancelledUnits: 'CANCELLED_UNITS',
  ChargeablePackageWeight: 'CHARGEABLE_PACKAGE_WEIGHT',
  CofundedCampaignPeriodFeeAmount: 'COFUNDED_CAMPAIGN_PERIOD_FEE_AMOUNT',
  CofundedCampaignPeriodFeeTaxAmount: 'COFUNDED_CAMPAIGN_PERIOD_FEE_TAX_AMOUNT',
  CofundedPromotionSellerFundedAmount: 'COFUNDED_PROMOTION_SELLER_FUNDED_AMOUNT',
  CompletedGmv: 'COMPLETED_GMV',
  CompletedOrderCount: 'COMPLETED_ORDER_COUNT',
  CompletedUnits: 'COMPLETED_UNITS',
  CostAmount: 'COST_AMOUNT',
  CostPerOrderAmount: 'COST_PER_ORDER_AMOUNT',
  CsGuidedGmv: 'CS_GUIDED_GMV',
  CsGuidedGmv_7DAverage: 'CS_GUIDED_GMV_7D_AVERAGE',
  CurrentBudgetAmount: 'CURRENT_BUDGET_AMOUNT',
  CustomerPaymentAmount: 'CUSTOMER_PAYMENT_AMOUNT',
  CustomerRefundAmount: 'CUSTOMER_REFUND_AMOUNT',
  CustomerShippingBeforeDiscountsAmount: 'CUSTOMER_SHIPPING_BEFORE_DISCOUNTS_AMOUNT',
  CustomerShippingFeeAmount: 'CUSTOMER_SHIPPING_FEE_AMOUNT',
  DepositPfandAmount: 'DEPOSIT_PFAND_AMOUNT',
  EffectiveGmv: 'EFFECTIVE_GMV',
  EffectiveOrderCount: 'EFFECTIVE_ORDER_COUNT',
  EffectiveUnits: 'EFFECTIVE_UNITS',
  EprPayOnBehalfFeeAmount: 'EPR_PAY_ON_BEHALF_FEE_AMOUNT',
  EscalateConversations: 'ESCALATE_CONVERSATIONS',
  EscalationRatio: 'ESCALATION_RATIO',
  EscalationResolved: 'ESCALATION_RESOLVED',
  EscalationResolveRate: 'ESCALATION_RESOLVE_RATE',
  EstimatedChargeablePackageWeight: 'ESTIMATED_CHARGEABLE_PACKAGE_WEIGHT',
  EstimatedCofundedCreatorBonus: 'ESTIMATED_COFUNDED_CREATOR_BONUS',
  EstimatedCommissionBase: 'ESTIMATED_COMMISSION_BASE',
  EstimatedShopAdsCommissionPayment: 'ESTIMATED_SHOP_ADS_COMMISSION_PAYMENT',
  EstimatedStandardCommissionPayment: 'ESTIMATED_STANDARD_COMMISSION_PAYMENT',
  FinanceAdjustmentAmount: 'FINANCE_ADJUSTMENT_AMOUNT',
  FinanceFeesAmount: 'FINANCE_FEES_AMOUNT',
  FinanceRevenueAmount: 'FINANCE_REVENUE_AMOUNT',
  FinanceShippingAmount: 'FINANCE_SHIPPING_AMOUNT',
  FinanceShippingFeeDiscountAmount: 'FINANCE_SHIPPING_FEE_DISCOUNT_AMOUNT',
  FirstResponseCount: 'FIRST_RESPONSE_COUNT',
  FulfilledByTiktokShippingFeeAmount: 'FULFILLED_BY_TIKTOK_SHIPPING_FEE_AMOUNT',
  GmvMaxAdFeeAmount: 'GMV_MAX_AD_FEE_AMOUNT',
  GrossGmv: 'GROSS_GMV',
  GrossOrderCount: 'GROSS_ORDER_COUNT',
  GrossRevenueAmount: 'GROSS_REVENUE_AMOUNT',
  GrossUnits: 'GROSS_UNITS',
  InboundMessages: 'INBOUND_MESSAGES',
  InTransitQuantity: 'IN_TRANSIT_QUANTITY',
  LockedQuantity: 'LOCKED_QUANTITY',
  ManagedServicePlanPerOrderFeeAmount: 'MANAGED_SERVICE_PLAN_PER_ORDER_FEE_AMOUNT',
  ManagedServicePlanSalesTaxAmount: 'MANAGED_SERVICE_PLAN_SALES_TAX_AMOUNT',
  NetCostAmount: 'NET_COST_AMOUNT',
  NetSalesAmount: 'NET_SALES_AMOUNT',
  NewConversations: 'NEW_CONVERSATIONS',
  OfflineQuantity: 'OFFLINE_QUANTITY',
  Orders: 'ORDERS',
  OrderAmount: 'ORDER_AMOUNT',
  OrderRefundAmount: 'ORDER_REFUND_AMOUNT',
  OriginalShippingFee: 'ORIGINAL_SHIPPING_FEE',
  OutboundMessages: 'OUTBOUND_MESSAGES',
  PaymentAmount: 'PAYMENT_AMOUNT',
  PaymentPlatformDiscount: 'PAYMENT_PLATFORM_DISCOUNT',
  PayoutAmount: 'PAYOUT_AMOUNT',
  PayoutExchangeRate: 'PAYOUT_EXCHANGE_RATE',
  PlatformCofundedVoucherDiscountsAmount: 'PLATFORM_COFUNDED_VOUCHER_DISCOUNTS_AMOUNT',
  PlatformCofundedVoucherDiscountsRefundAmount: 'PLATFORM_COFUNDED_VOUCHER_DISCOUNTS_REFUND_AMOUNT',
  PlatformDiscountsAmount: 'PLATFORM_DISCOUNTS_AMOUNT',
  PlatformDiscountsRefundAmount: 'PLATFORM_DISCOUNTS_REFUND_AMOUNT',
  PriceAmount: 'PRICE_AMOUNT',
  ProductClicks: 'PRODUCT_CLICKS',
  ProductClickRate: 'PRODUCT_CLICK_RATE',
  ProductImpressions: 'PRODUCT_IMPRESSIONS',
  Quantity: 'QUANTITY',
  RatedSessions: 'RATED_SESSIONS',
  RefundedCustomerShippingFeeAmount: 'REFUNDED_CUSTOMER_SHIPPING_FEE_AMOUNT',
  RefundSellerDiscountsAmount: 'REFUND_SELLER_DISCOUNTS_AMOUNT',
  RefundSubtotalBeforeSellerDiscountsAmount: 'REFUND_SUBTOTAL_BEFORE_SELLER_DISCOUNTS_AMOUNT',
  ReopenedConversations: 'REOPENED_CONVERSATIONS',
  RetailDeliveryFee: 'RETAIL_DELIVERY_FEE',
  ReturnShippingFeeReimbursementAmount: 'RETURN_SHIPPING_FEE_REIMBURSEMENT_AMOUNT',
  ReturnShippingLabelFeeAmount: 'RETURN_SHIPPING_LABEL_FEE_AMOUNT',
  RoasBid: 'ROAS_BID',
  Roi: 'ROI',
  SatisfactionRate: 'SATISFACTION_RATE',
  SatisfiedSessions: 'SATISFIED_SESSIONS',
  SellerCofundedVoucherDiscountAmount: 'SELLER_COFUNDED_VOUCHER_DISCOUNT_AMOUNT',
  SellerCofundedVoucherDiscountRefundAmount: 'SELLER_COFUNDED_VOUCHER_DISCOUNT_REFUND_AMOUNT',
  SellerDiscountsAmount: 'SELLER_DISCOUNTS_AMOUNT',
  SellerShippingFeeDiscountAmount: 'SELLER_SHIPPING_FEE_DISCOUNT_AMOUNT',
  ShippingFeeAfterDiscount: 'SHIPPING_FEE_AFTER_DISCOUNT',
  ShippingFeePlatformDiscount: 'SHIPPING_FEE_PLATFORM_DISCOUNT',
  ShippingFeeSellerDiscount: 'SHIPPING_FEE_SELLER_DISCOUNT',
  ShippingSubsidyAmount: 'SHIPPING_SUBSIDY_AMOUNT',
  SkuPlatformDiscount: 'SKU_PLATFORM_DISCOUNT',
  SkuReturnQuantity: 'SKU_RETURN_QUANTITY',
  SkuSellerDiscount: 'SKU_SELLER_DISCOUNT',
  SkuSubtotalAfterDiscount: 'SKU_SUBTOTAL_AFTER_DISCOUNT',
  SkuSubtotalBeforeDiscount: 'SKU_SUBTOTAL_BEFORE_DISCOUNT',
  SkuUnitOriginalPrice: 'SKU_UNIT_ORIGINAL_PRICE',
  SmartPromotionCampaignPeriodFeeAmount: 'SMART_PROMOTION_CAMPAIGN_PERIOD_FEE_AMOUNT',
  SmartPromotionCampaignPeriodFeeTaxAmount: 'SMART_PROMOTION_CAMPAIGN_PERIOD_FEE_TAX_AMOUNT',
  SmartPromotionFeeAmount: 'SMART_PROMOTION_FEE_AMOUNT',
  SmartPromotionFeeTaxAmount: 'SMART_PROMOTION_FEE_TAX_AMOUNT',
  SpsBenefitCount: 'SPS_BENEFIT_COUNT',
  SpsCalculationDenominatorValue: 'SPS_CALCULATION_DENOMINATOR_VALUE',
  SpsCalculationNumeratorValue: 'SPS_CALCULATION_NUMERATOR_VALUE',
  SpsDeliveredOrderCount: 'SPS_DELIVERED_ORDER_COUNT',
  SpsEvaluateDurationDays: 'SPS_EVALUATE_DURATION_DAYS',
  SpsExcellentThreshold: 'SPS_EXCELLENT_THRESHOLD',
  SpsHandleDurationHours: 'SPS_HANDLE_DURATION_HOURS',
  SpsMetricScore: 'SPS_METRIC_SCORE',
  SpsMetricValue: 'SPS_METRIC_VALUE',
  SpsNegativeOrderCount: 'SPS_NEGATIVE_ORDER_COUNT',
  SpsOnTimeDeliverOrderCount: 'SPS_ON_TIME_DELIVER_ORDER_COUNT',
  SpsOnTimeDeliverRate: 'SPS_ON_TIME_DELIVER_RATE',
  SpsPeerPercentile: 'SPS_PEER_PERCENTILE',
  SpsPoorThreshold: 'SPS_POOR_THRESHOLD',
  SpsReturnOrderCount: 'SPS_RETURN_ORDER_COUNT',
  SpsScore: 'SPS_SCORE',
  SpsTopIssueCount: 'SPS_TOP_ISSUE_COUNT',
  SpsTopItemPosition: 'SPS_TOP_ITEM_POSITION',
  SpsTopItemTotalCount: 'SPS_TOP_ITEM_TOTAL_COUNT',
  SpsTopReasonOrderCount: 'SPS_TOP_REASON_ORDER_COUNT',
  SpsTopTypeOrderCount: 'SPS_TOP_TYPE_ORDER_COUNT',
  SpsTrendValue: 'SPS_TREND_VALUE',
  SpsUnlockedBenefitCount: 'SPS_UNLOCKED_BENEFIT_COUNT',
  StockQuantity: 'STOCK_QUANTITY',
  SubtotalBeforeDiscountsAmount: 'SUBTOTAL_BEFORE_DISCOUNTS_AMOUNT',
  SupportSessionCount: 'SUPPORT_SESSION_COUNT',
  TaxAndDutyAmount: 'TAX_AND_DUTY_AMOUNT',
  TiktokShippingFeeDiscountCustomerAmount: 'TIKTOK_SHIPPING_FEE_DISCOUNT_CUSTOMER_AMOUNT',
  TiktokShopCommissionFeeAmount: 'TIKTOK_SHOP_COMMISSION_FEE_AMOUNT',
  TiktokShopShippingFeeAmount: 'TIKTOK_SHOP_SHIPPING_FEE_AMOUNT',
  TiktokShopShippingIncentiveAmount: 'TIKTOK_SHOP_SHIPPING_INCENTIVE_AMOUNT',
  TiktokShopShippingIncentiveRefundAmount: 'TIKTOK_SHOP_SHIPPING_INCENTIVE_REFUND_AMOUNT',
  TotalInTransitQuantity: 'TOTAL_IN_TRANSIT_QUANTITY',
  TotalSettlementAmount: 'TOTAL_SETTLEMENT_AMOUNT',
  TotalStockQuantity: 'TOTAL_STOCK_QUANTITY',
  WeightKg: 'WEIGHT_KG'
} as const;

export type EcomBiMetric = typeof EcomBiMetric[keyof typeof EcomBiMetric];
/** BI metric metadata. */
export interface EcomBiMetricMetadata {
  description: Scalars['String']['output'];
  id: EcomBiMetric;
  label: Scalars['String']['output'];
  note?: Maybe<Scalars['String']['output']>;
  valueType: EcomBiValueType;
}

/** BI query sort field. */
export interface EcomBiOrderByInput {
  /** Sort by a selected dimension. Use exactly one of dimension or metric. */
  dimension?: InputMaybe<EcomBiDimension>;
  /** Sort direction. Defaults to ASC. */
  direction?: InputMaybe<EcomSortOrder>;
  /** Sort by a selected metric. Use exactly one of dimension or metric. */
  metric?: InputMaybe<EcomBiMetric>;
}

/** BI query pagination and result-size metadata. */
export interface EcomBiPageInfo {
  /** Backend effective row page size after applying safety caps. */
  effectiveLimit: Scalars['Int']['output'];
  /** Whether another backend page exists for the same query window. */
  hasMore: Scalars['Boolean']['output'];
  /** Offset for the next page, or null when hasMore is false. */
  nextOffset?: Maybe<Scalars['Int']['output']>;
  /** Requested starting offset used by this backend page. */
  offset: Scalars['Int']['output'];
  /** Requested row window from offset. Null means unlimited rows from offset. */
  requestedLimit?: Maybe<Scalars['Int']['output']>;
  /** Rows returned in this response. */
  returnedRows: Scalars['Int']['output'];
}

/** Ecommerce data query. Date range and scope requirements depend on dataset metadata from getEcommerceBiCatalog. */
export interface EcomBiQueryInput {
  /** Reserved for future advertiser-document scoping; current Ads BI datasets do not use this field. Filter current Ads datasets with the ADVERTISER_ID and/or STORE_ID dimensions instead. */
  advertiserIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  /** Dataset to query. */
  datasetId: EcomBiDatasetId;
  /** Dimensions to group by. Defaults are declared by dataset metadata. */
  dimensions?: InputMaybe<Array<EcomBiDimension>>;
  /** End date exclusive in YYYY-MM-DD format when the dataset uses dates. */
  endDateLt?: InputMaybe<Scalars['String']['input']>;
  /** Optional filters over dataset-supported dimensions. */
  filters?: InputMaybe<Array<EcomBiFilterInput>>;
  /** Date granularity. The current Ads GMV Max datasets support DAILY only. */
  granularity?: InputMaybe<EcomBiGranularity>;
  /** Maximum rows requested from offset. Defaults to 500 for inline calls. With persistResult=true, limit=0 asks the server to prepare one uncapped export; use a positive limit only for explicit sampling or capped exports. */
  limit?: InputMaybe<Scalars['Int']['input']>;
  /** Metrics to return. Defaults are declared by dataset metadata. */
  metrics?: InputMaybe<Array<EcomBiMetric>>;
  /** Rows to skip before returning data. For persisted exports this is the starting offset of the server-prepared result. */
  offset?: InputMaybe<Scalars['Int']['input']>;
  /** Optional sort order. Each item must set exactly one of dimension or metric, and that field must be selected in dimensions or metrics. */
  orderBy?: InputMaybe<Array<EcomBiOrderByInput>>;
  /** Onboarded Shop Mongo IDs copied exactly from ecom_list_shops.id. Use either shopIds or shopRegions, not both. Order, Finance, CS, and live SPS datasets require one of these Shop scopes. SPS accepts at most 50 owned AUTHORIZED US shops with data.shop_analytics.public.read. Usually omit both Shop scopes for Ads so authorized advertiser stores without onboarded Shops remain included; supplying either scope restricts Ads results to the owned onboarded Shop subset and enforces Shop analytics entitlement. */
  shopIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  /** Current-user Shop regions to expand server-side into every onboarded Shop Mongo ID in those regions. Use this instead of shopIds when the user asks for all of their shops in one or more regions. Cannot be combined with shopIds. Ownership and per-Shop analytics entitlement checks still apply; SPS also retains its 50-Shop and US-only limits. */
  shopRegions?: InputMaybe<Array<ShopRegion>>;
  /** Start date inclusive in YYYY-MM-DD format when the dataset uses dates. */
  startDateGe?: InputMaybe<Scalars['String']['input']>;
  /** Canonical warehouse Mongo IDs for warehouse-scoped live inventory datasets. */
  warehouseIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  /** WMS account Mongo IDs for WMS-account-scoped live inventory datasets. */
  wmsAccountIds?: InputMaybe<Array<Scalars['ID']['input']>>;
}

/** BI query result. */
export interface EcomBiQueryResult {
  columns: Array<EcomBiResultColumn>;
  datasetId: EcomBiDatasetId;
  granularity: EcomBiGranularity;
  pageInfo: EcomBiPageInfo;
  rows: Array<Scalars['JSONObject']['output']>;
  totalCount: Scalars['Int']['output'];
}

/** BI query output column. */
export interface EcomBiResultColumn {
  dimension?: Maybe<EcomBiDimension>;
  key: Scalars['String']['output'];
  label: Scalars['String']['output'];
  metric?: Maybe<EcomBiMetric>;
  role: EcomBiFieldRole;
  valueType: EcomBiValueType;
}

/** Business entity types that may scope a BI dataset query. */
export const EcomBiScopeType = {
  Advertiser: 'ADVERTISER',
  Shop: 'SHOP',
  Warehouse: 'WAREHOUSE',
  WmsAccount: 'WMS_ACCOUNT'
} as const;

export type EcomBiScopeType = typeof EcomBiScopeType[keyof typeof EcomBiScopeType];
/** Logical value type for BI fields. */
export const EcomBiValueType = {
  Boolean: 'BOOLEAN',
  Date: 'DATE',
  Decimal: 'DECIMAL',
  Integer: 'INTEGER',
  Money: 'MONEY',
  String: 'STRING'
} as const;

export type EcomBiValueType = typeof EcomBiValueType[keyof typeof EcomBiValueType];
/** Cancellation status filter for searching cancellations */
export const EcomCancelStatusFilter = {
  All: 'ALL',
  CancellationRequestCancel: 'CANCELLATION_REQUEST_CANCEL',
  CancellationRequestComplete: 'CANCELLATION_REQUEST_COMPLETE',
  CancellationRequestPending: 'CANCELLATION_REQUEST_PENDING',
  CancellationRequestSuccess: 'CANCELLATION_REQUEST_SUCCESS'
} as const;

export type EcomCancelStatusFilter = typeof EcomCancelStatusFilter[keyof typeof EcomCancelStatusFilter];
/** Cancellation type filter for searching cancellations */
export const EcomCancelTypeFilter = {
  All: 'ALL',
  BuyerCancel: 'BUYER_CANCEL',
  Cancel: 'CANCEL'
} as const;

export type EcomCancelTypeFilter = typeof EcomCancelTypeFilter[keyof typeof EcomCancelTypeFilter];
/** Buyer- or system-initiated order cancellation request */
export interface EcomCancellation {
  cancelId: Scalars['String']['output'];
  cancelReason?: Maybe<Scalars['String']['output']>;
  cancelReasonText?: Maybe<Scalars['String']['output']>;
  cancelStatus?: Maybe<Scalars['String']['output']>;
  /** BUYER_CANCEL, CANCEL */
  cancelType?: Maybe<Scalars['String']['output']>;
  /** Unix seconds */
  createTime?: Maybe<Scalars['Int']['output']>;
  lineItems?: Maybe<Array<EcomCancellationLineItem>>;
  orderId?: Maybe<Scalars['String']['output']>;
  refundAmount?: Maybe<EcomRefundAmount>;
  role?: Maybe<Scalars['String']['output']>;
  shouldReplenishStock?: Maybe<Scalars['Boolean']['output']>;
  /** Unix seconds */
  updateTime?: Maybe<Scalars['Int']['output']>;
}

/** Cancellation line item */
export interface EcomCancellationLineItem {
  cancelLineItemId?: Maybe<Scalars['String']['output']>;
  orderLineItemId?: Maybe<Scalars['String']['output']>;
  productImage?: Maybe<EcomImage>;
  productName?: Maybe<Scalars['String']['output']>;
  refundAmount?: Maybe<EcomRefundAmount>;
  sellerSku?: Maybe<Scalars['String']['output']>;
  skuId?: Maybe<Scalars['String']['output']>;
  skuName?: Maybe<Scalars['String']['output']>;
}

/** Target collaboration create result */
export interface EcomCreateTargetCollaborationResult {
  invalidOpenIdList?: Maybe<Array<Scalars['String']['output']>>;
  invalidProductIdList?: Maybe<Array<Scalars['String']['output']>>;
  targetCollaborationConflicts?: Maybe<Array<EcomTargetCollaborationConflict>>;
  targetCollaborationId?: Maybe<Scalars['String']['output']>;
}

/** Shipping document format */
export const EcomDocumentFormat = {
  Pdf: 'PDF',
  Zpl: 'ZPL'
} as const;

export type EcomDocumentFormat = typeof EcomDocumentFormat[keyof typeof EcomDocumentFormat];
/** Shipping document size */
export const EcomDocumentSize = {
  A5: 'A5',
  A6: 'A6'
} as const;

export type EcomDocumentSize = typeof EcomDocumentSize[keyof typeof EcomDocumentSize];
/** Shipping document type */
export const EcomDocumentType = {
  HazmatLabel: 'HAZMAT_LABEL',
  InvoiceLabel: 'INVOICE_LABEL',
  PackingSlip: 'PACKING_SLIP',
  ShippingLabel: 'SHIPPING_LABEL',
  ShippingLabelAndPackingSlip: 'SHIPPING_LABEL_AND_PACKING_SLIP',
  ShippingLabelPicture: 'SHIPPING_LABEL_PICTURE'
} as const;

export type EcomDocumentType = typeof EcomDocumentType[keyof typeof EcomDocumentType];
/** Whether a Fulfilled by TikTok read succeeded. Anything other than OK means the returned FBT facts are incomplete and absent stock must not be interpreted as zero stock. */
export const EcomFbtReadState = {
  AccessDenied: 'ACCESS_DENIED',
  CapabilityUnavailable: 'CAPABILITY_UNAVAILABLE',
  Ok: 'OK',
  UnsupportedRegion: 'UNSUPPORTED_REGION'
} as const;

export type EcomFbtReadState = typeof EcomFbtReadState[keyof typeof EcomFbtReadState];
/** Free sample rule */
export interface EcomFreeSampleRule {
  hasFreeSample?: Maybe<Scalars['Boolean']['output']>;
  isSampleApprovalExempt?: Maybe<Scalars['Boolean']['output']>;
}

/** Image with dimensions */
export interface EcomImage {
  height?: Maybe<Scalars['Int']['output']>;
  url?: Maybe<Scalars['String']['output']>;
  width?: Maybe<Scalars['Int']['output']>;
}

/** Message content type for CS conversations */
export const EcomMessageType = {
  CouponCard: 'COUPON_CARD',
  Image: 'IMAGE',
  LogisticsCard: 'LOGISTICS_CARD',
  OrderCard: 'ORDER_CARD',
  ProductCard: 'PRODUCT_CARD',
  Text: 'TEXT',
  Video: 'VIDEO'
} as const;

export type EcomMessageType = typeof EcomMessageType[keyof typeof EcomMessageType];
/** Numeric money range */
export interface EcomNumericMoneyRange {
  currency?: Maybe<Scalars['String']['output']>;
  formattedRange?: Maybe<Scalars['String']['output']>;
  maximumAmount?: Maybe<Scalars['Float']['output']>;
  minimumAmount?: Maybe<Scalars['Float']['output']>;
}

/** Open collaboration sample rule */
export interface EcomOpenCollaborationSampleRule {
  availableQuantity?: Maybe<Scalars['Int']['output']>;
  endTime?: Maybe<Scalars['Int']['output']>;
  isSampleTimeUnlimited?: Maybe<Scalars['Boolean']['output']>;
  productId?: Maybe<Scalars['String']['output']>;
  sampleQuota?: Maybe<Scalars['Int']['output']>;
  startTime?: Maybe<Scalars['Int']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  thresholds?: Maybe<EcomOpenCollaborationSampleThresholds>;
}

/** Open collaboration sample thresholds */
export interface EcomOpenCollaborationSampleThresholds {
  avgEcVideoViews?: Maybe<Scalars['Int']['output']>;
  categoryIds?: Maybe<Array<Scalars['String']['output']>>;
  minimumFollowerCount?: Maybe<Scalars['Int']['output']>;
  minimumGmv?: Maybe<Scalars['Int']['output']>;
  predictedFulfillmentRank?: Maybe<Scalars['String']['output']>;
}

/** Open collaboration settings */
export interface EcomOpenCollaborationSettings {
  autoAddProduct?: Maybe<EcomAutoAddProductSetting>;
}

/** Order */
export interface EcomOrder {
  /** Platform buyer user ID */
  buyerUserId?: Maybe<Scalars['String']['output']>;
  /** Unix seconds when the order changed to CANCELLED */
  cancelTime?: Maybe<Scalars['Int']['output']>;
  /** Unix seconds when the order must be collected by */
  collectionDueTime?: Maybe<Scalars['Int']['output']>;
  /** Unix seconds when the order changed to IN_TRANSIT */
  collectionTime?: Maybe<Scalars['Int']['output']>;
  /** Unix seconds */
  createTime?: Maybe<Scalars['Int']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  /** Unix seconds when the order must be delivered by */
  deliveryDueTime?: Maybe<Scalars['Int']['output']>;
  /** Unix seconds for the delivery option required delivery time */
  deliveryOptionRequiredDeliveryTime?: Maybe<Scalars['Int']['output']>;
  /** Unix seconds when the order changed to DELIVERED */
  deliveryTime?: Maybe<Scalars['Int']['output']>;
  lineItems?: Maybe<Array<EcomOrderLineItem>>;
  orderId: Scalars['String']['output'];
  /** Unix seconds */
  paidTime?: Maybe<Scalars['Int']['output']>;
  paymentMethodName?: Maybe<Scalars['String']['output']>;
  recipientAddress?: Maybe<EcomRecipientAddress>;
  /** Unix seconds when the seller shipped the order */
  rtsTime?: Maybe<Scalars['Int']['output']>;
  /** Unix seconds when the order must be shipped by */
  shippingDueTime?: Maybe<Scalars['Int']['output']>;
  shippingProvider?: Maybe<Scalars['String']['output']>;
  /** Raw platform order status (e.g. AWAITING_SHIPMENT) */
  status?: Maybe<Scalars['String']['output']>;
  totalAmount?: Maybe<Scalars['String']['output']>;
  trackingNumber?: Maybe<Scalars['String']['output']>;
  /** Unix seconds */
  updateTime?: Maybe<Scalars['Int']['output']>;
}

/** Line item on an order */
export interface EcomOrderLineItem {
  currency?: Maybe<Scalars['String']['output']>;
  /** Per-line item status */
  displayStatus?: Maybe<Scalars['String']['output']>;
  /** Unique ID of this order line item */
  orderLineItemId?: Maybe<Scalars['String']['output']>;
  originalPrice?: Maybe<Scalars['String']['output']>;
  packageId?: Maybe<Scalars['String']['output']>;
  /** Raw platform package status for this line item */
  packageStatus?: Maybe<Scalars['String']['output']>;
  productId?: Maybe<Scalars['String']['output']>;
  productName?: Maybe<Scalars['String']['output']>;
  quantity?: Maybe<Scalars['Int']['output']>;
  /** Unix seconds when the seller shipped the line item */
  rtsTime?: Maybe<Scalars['Int']['output']>;
  salePrice?: Maybe<Scalars['String']['output']>;
  sellerSku?: Maybe<Scalars['String']['output']>;
  skuId?: Maybe<Scalars['String']['output']>;
  skuImage?: Maybe<Scalars['String']['output']>;
  skuName?: Maybe<Scalars['String']['output']>;
  /** Raw TikTok Shop line item sku_type enum */
  skuType?: Maybe<Scalars['String']['output']>;
  trackingNumber?: Maybe<Scalars['String']['output']>;
}

/** Definitions for interpreting order-derived ecommerce sales statistics. */
export interface EcomOrderSalesStatsDefinitions {
  /** Definition of cancelled_* metrics. */
  cancelled: Scalars['String']['output'];
  /** Definition of completed_* metrics. */
  completed: Scalars['String']['output'];
  /** Business date definition used by DAILY rows. */
  dateKey: Scalars['String']['output'];
  /** Definition of effective_* metrics. */
  effective: Scalars['String']['output'];
  /** Definition of *_gmv metrics. */
  gmv: Scalars['String']['output'];
  /** How row grain is selected. */
  grain: Scalars['String']['output'];
  /** Definition of gross_* metrics. */
  gross: Scalars['String']['output'];
  /** Definition of *_order_count metrics. */
  orderCount: Scalars['String']['output'];
  /** Whether return/refund events are excluded. */
  returnsRefunds: Scalars['String']['output'];
  /** Definition of *_units metrics. */
  units: Scalars['String']['output'];
}

/** Read order-derived sales statistics for one or more shops at shop, product, or SKU level. endDateLt is exclusive. */
export interface EcomOrderSalesStatsInput {
  /** End date exclusive in shop-local analytics date format (YYYY-MM-DD). */
  endDateLt: Scalars['String']['input'];
  /** Aggregation level to query: SHOP, PRODUCT, or SKU. */
  level: EcomOrderSalesStatsLevel;
  /** Maximum number of rows to return. Leave empty or use 0 to return all matching rows. */
  limit?: InputMaybe<Scalars['Int']['input']>;
  /** Optional product IDs. Supported for PRODUCT and SKU level reads. */
  productIds?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Optional exact seller SKUs. Supported for SKU level reads. */
  sellerSkus?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Shop Mongo IDs (the id field from ecommerce_list_shops). */
  shopIds: Array<Scalars['ID']['input']>;
  /** Optional SKU IDs. Supported for SKU level reads. */
  skuIds?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Optional sort field. Defaults to DATE_KEY for DAILY reads and EFFECTIVE_GMV for TOTAL reads. */
  sortBy?: InputMaybe<EcomOrderSalesStatsSortField>;
  /** Optional sort order. Defaults to ASC for DAILY reads and DESC for TOTAL reads. */
  sortOrder?: InputMaybe<EcomSortOrder>;
  /** Start date inclusive in shop-local analytics date format (YYYY-MM-DD). */
  startDateGe: Scalars['String']['input'];
  /** Return daily rows or one aggregated row per selected entity over the full date range. Defaults to DAILY. */
  timeGrouping?: InputMaybe<EcomOrderSalesStatsTimeGrouping>;
}

/** Ecommerce sales statistics aggregation level. */
export const EcomOrderSalesStatsLevel = {
  Product: 'PRODUCT',
  Shop: 'SHOP',
  Sku: 'SKU'
} as const;

export type EcomOrderSalesStatsLevel = typeof EcomOrderSalesStatsLevel[keyof typeof EcomOrderSalesStatsLevel];
/** Fixed order-derived metric bundle for a shop, product, or SKU row. */
export interface EcomOrderSalesStatsMetrics {
  /** Cancelled GMV. */
  cancelledGmv?: Maybe<EcomAnalyticsMoney>;
  /** Cancelled order count. */
  cancelledOrderCount: Scalars['Int']['output'];
  /** Cancelled units. */
  cancelledUnits: Scalars['Int']['output'];
  /** Completed GMV. */
  completedGmv?: Maybe<EcomAnalyticsMoney>;
  /** Completed order count. */
  completedOrderCount: Scalars['Int']['output'];
  /** Completed units. */
  completedUnits: Scalars['Int']['output'];
  /** Effective GMV. */
  effectiveGmv?: Maybe<EcomAnalyticsMoney>;
  /** Effective order count. */
  effectiveOrderCount: Scalars['Int']['output'];
  /** Effective units. */
  effectiveUnits: Scalars['Int']['output'];
  /** Gross GMV. */
  grossGmv?: Maybe<EcomAnalyticsMoney>;
  /** Gross order count. */
  grossOrderCount: Scalars['Int']['output'];
  /** Gross units. */
  grossUnits: Scalars['Int']['output'];
}

/** Order-derived ecommerce sales statistics result. */
export interface EcomOrderSalesStatsResult {
  /** Metric and date definitions for interpreting this result. */
  definitions: EcomOrderSalesStatsDefinitions;
  /** Sales statistics rows. */
  items: Array<EcomOrderSalesStatsRow>;
  /** Number of rows returned by this query. */
  totalCount: Scalars['Int']['output'];
}

/** One fixed-shape ecommerce sales statistics row. Product and SKU fields are nullable depending on the requested level. */
export interface EcomOrderSalesStatsRow {
  /** Currency for monetary metrics when available. */
  currency?: Maybe<Scalars['String']['output']>;
  /** Business date for DAILY rows; see definitions.dateKey. */
  dateKey?: Maybe<Scalars['String']['output']>;
  /** Aggregation level represented by this row. */
  level: EcomOrderSalesStatsLevel;
  /** Order-derived metric bundle. */
  metrics: EcomOrderSalesStatsMetrics;
  /** End date exclusive for this row's metric period (YYYY-MM-DD). */
  periodEnd: Scalars['String']['output'];
  /** Start date inclusive for this row's metric period (YYYY-MM-DD). */
  periodStart: Scalars['String']['output'];
  /** Product ID. Populated for PRODUCT and SKU level rows. */
  productId?: Maybe<Scalars['String']['output']>;
  /** Product display name when available. */
  productName?: Maybe<Scalars['String']['output']>;
  /** Seller SKU when available. */
  sellerSku?: Maybe<Scalars['String']['output']>;
  /** Shop Mongo ID. */
  shopId: Scalars['ID']['output'];
  /** Shop display name when available. */
  shopName?: Maybe<Scalars['String']['output']>;
  /** SKU ID. Populated for SKU level rows. */
  skuId?: Maybe<Scalars['String']['output']>;
  /** SKU display name when available. */
  skuName?: Maybe<Scalars['String']['output']>;
}

/** Sort field for ecommerce order-derived sales statistics. */
export const EcomOrderSalesStatsSortField = {
  CancelledGmv: 'CANCELLED_GMV',
  CancelledOrderCount: 'CANCELLED_ORDER_COUNT',
  CancelledUnits: 'CANCELLED_UNITS',
  CompletedGmv: 'COMPLETED_GMV',
  CompletedOrderCount: 'COMPLETED_ORDER_COUNT',
  CompletedUnits: 'COMPLETED_UNITS',
  DateKey: 'DATE_KEY',
  EffectiveGmv: 'EFFECTIVE_GMV',
  EffectiveOrderCount: 'EFFECTIVE_ORDER_COUNT',
  EffectiveUnits: 'EFFECTIVE_UNITS',
  GrossGmv: 'GROSS_GMV',
  GrossOrderCount: 'GROSS_ORDER_COUNT',
  GrossUnits: 'GROSS_UNITS',
  ProductId: 'PRODUCT_ID',
  ShopId: 'SHOP_ID',
  SkuId: 'SKU_ID'
} as const;

export type EcomOrderSalesStatsSortField = typeof EcomOrderSalesStatsSortField[keyof typeof EcomOrderSalesStatsSortField];
/** Whether ecommerce sales statistics are returned per day or aggregated over the full date range. */
export const EcomOrderSalesStatsTimeGrouping = {
  Daily: 'DAILY',
  Total: 'TOTAL'
} as const;

export type EcomOrderSalesStatsTimeGrouping = typeof EcomOrderSalesStatsTimeGrouping[keyof typeof EcomOrderSalesStatsTimeGrouping];
/** Order status filter. Use ALL to return all statuses. */
export const EcomOrderStatus = {
  All: 'ALL',
  AwaitingCollection: 'AWAITING_COLLECTION',
  AwaitingShipment: 'AWAITING_SHIPMENT',
  Cancelled: 'CANCELLED',
  Completed: 'COMPLETED',
  Delivered: 'DELIVERED',
  InTransit: 'IN_TRANSIT',
  OnHold: 'ON_HOLD',
  PartiallyShipping: 'PARTIALLY_SHIPPING',
  Unpaid: 'UNPAID'
} as const;

export type EcomOrderStatus = typeof EcomOrderStatus[keyof typeof EcomOrderStatus];
/** Trimmed order summary for list endpoints. Use ecommerceGetOrder for full details including recipient address and line items. */
export interface EcomOrderSummary {
  /** Platform buyer user ID */
  buyerUserId?: Maybe<Scalars['String']['output']>;
  /** Unix seconds */
  createTime?: Maybe<Scalars['Int']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  orderId: Scalars['String']['output'];
  /** Unix seconds */
  paidTime?: Maybe<Scalars['Int']['output']>;
  shippingProvider?: Maybe<Scalars['String']['output']>;
  /** Raw platform order status (e.g. AWAITING_SHIPMENT) */
  status?: Maybe<Scalars['String']['output']>;
  totalAmount?: Maybe<Scalars['String']['output']>;
  trackingNumber?: Maybe<Scalars['String']['output']>;
}

/** Tracking info for an order */
export interface EcomOrderTracking {
  events?: Maybe<Array<EcomTrackingEvent>>;
  /** Human-readable description of the most recent tracking event — the `description` of the entry with the greatest `updateTimeMillis` in `events`. This is free-form carrier text (e.g. "Order packed and ready for pickup."), not a standardized status enum. TikTok does not expose a separate status enum on either tracking endpoint. */
  latestEventDescription?: Maybe<Scalars['String']['output']>;
  orderId?: Maybe<Scalars['String']['output']>;
  /** Name of the shipping carrier (e.g. 'USPS', 'FedEx'). Sourced from the order record (Get Order) and composed in at Layer 2. */
  shippingProvider?: Maybe<Scalars['String']['output']>;
  /** Carrier tracking number. Sourced from the order record (Get Order) and composed into this tracking payload at Layer 2 — the TikTok Get Tracking endpoint does not return it. */
  trackingNumber?: Maybe<Scalars['String']['output']>;
}

/** Fulfillment package (search hit) */
export interface EcomPackage {
  /** Unix seconds */
  createTime?: Maybe<Scalars['Int']['output']>;
  /** Order IDs contained in this package */
  orderIds?: Maybe<Array<Scalars['String']['output']>>;
  packageId: Scalars['String']['output'];
  /** Raw platform package status */
  packageStatus?: Maybe<Scalars['String']['output']>;
  shippingProvider?: Maybe<Scalars['String']['output']>;
  trackingNumber?: Maybe<Scalars['String']['output']>;
  /** Unix seconds */
  updateTime?: Maybe<Scalars['Int']['output']>;
}

/** Detailed package info */
export interface EcomPackageDetail {
  hasMultiSkus?: Maybe<Scalars['Boolean']['output']>;
  orders?: Maybe<Array<EcomPackageOrder>>;
  packageId: Scalars['String']['output'];
  packageStatus?: Maybe<Scalars['String']['output']>;
  packageSubStatus?: Maybe<Scalars['String']['output']>;
  splitAndCombineTag?: Maybe<Scalars['String']['output']>;
}

/** Order contained in a package */
export interface EcomPackageOrder {
  /** Unique ID of this order */
  orderId: Scalars['String']['output'];
  skus?: Maybe<Array<EcomPackageSku>>;
}

/** SKU contained in a package */
export interface EcomPackageSku {
  name?: Maybe<Scalars['String']['output']>;
  quantity?: Maybe<Scalars['Int']['output']>;
  /** Unique ID of this SKU */
  skuId?: Maybe<Scalars['String']['output']>;
}

/** Package status filter. Use ALL to return all statuses. */
export const EcomPackageStatus = {
  All: 'ALL',
  Cancelled: 'CANCELLED',
  Completed: 'COMPLETED',
  Fulfilling: 'FULFILLING',
  Processing: 'PROCESSING'
} as const;

export type EcomPackageStatus = typeof EcomPackageStatus[keyof typeof EcomPackageStatus];
/** Product */
export interface EcomProduct {
  brand?: Maybe<EcomProductBrand>;
  categoryChains?: Maybe<Array<EcomProductCategory>>;
  /** Unix seconds */
  createTime?: Maybe<Scalars['Int']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  images?: Maybe<Array<EcomImage>>;
  /** Package weight unit returned by the platform product detail API. */
  packageWeightUnit?: Maybe<Scalars['String']['output']>;
  /** Package weight value returned by the platform product detail API. */
  packageWeightValue?: Maybe<Scalars['String']['output']>;
  productId: Scalars['String']['output'];
  /** Active merchant-authored Product Knowledge. Returned only when an eligible resolver explicitly requests it. */
  productKnowledge?: Maybe<ProductKnowledgeContent>;
  productTypes?: Maybe<Array<Scalars['String']['output']>>;
  /** Exact shop resolved for this Affiliate product lookup. */
  resolvedShopId?: Maybe<Scalars['ID']['output']>;
  /** How the Affiliate product lookup resolved the exact shop. */
  shopResolutionSource?: Maybe<Scalars['String']['output']>;
  skus?: Maybe<Array<EcomProductSku>>;
  status?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
  /** Unix seconds */
  updateTime?: Maybe<Scalars['Int']['output']>;
}

/** Product brand metadata */
export interface EcomProductBrand {
  id?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
}

/** Product category node in the platform category hierarchy */
export interface EcomProductCategory {
  id?: Maybe<Scalars['String']['output']>;
  isLeaf?: Maybe<Scalars['Boolean']['output']>;
  localName?: Maybe<Scalars['String']['output']>;
  parentId?: Maybe<Scalars['String']['output']>;
}

/** Product SKU */
export interface EcomProductSku {
  externalListPrices?: Maybe<Array<EcomProductSkuExternalListPrice>>;
  fees?: Maybe<Array<EcomProductSkuFee>>;
  /** Unique ID of this SKU */
  id: Scalars['String']['output'];
  inventory?: Maybe<Array<EcomProductSkuInventory>>;
  listPrice?: Maybe<EcomProductSkuMoney>;
  preSale?: Maybe<EcomProductSkuPreSale>;
  price?: Maybe<EcomProductSkuPrice>;
  sellerSku?: Maybe<Scalars['String']['output']>;
  /** SKU package weight normalized to kilograms when the unit is supported. */
  skuWeightKg?: Maybe<Scalars['String']['output']>;
  /** SKU package weight unit returned by TikTok Product detail. */
  skuWeightUnit?: Maybe<Scalars['String']['output']>;
  /** SKU package weight value returned by TikTok Product detail. */
  skuWeightValue?: Maybe<Scalars['String']['output']>;
  statusInfo?: Maybe<EcomProductSkuStatusInfo>;
  /** Current total available quantity across all warehouses, hydrated from the platform inventory endpoint. */
  totalAvailableQuantity?: Maybe<Scalars['Int']['output']>;
}

/** Currency used by TikTok Shop product SKU pricing fields. */
export const EcomProductSkuCurrency = {
  Brl: 'BRL',
  Eur: 'EUR',
  Gbp: 'GBP',
  Idr: 'IDR',
  Jpy: 'JPY',
  Mxn: 'MXN',
  Myr: 'MYR',
  Php: 'PHP',
  Sgd: 'SGD',
  Thb: 'THB',
  Usd: 'USD',
  Vnd: 'VND'
} as const;

export type EcomProductSkuCurrency = typeof EcomProductSkuCurrency[keyof typeof EcomProductSkuCurrency];
/** Source that deactivated a product SKU. */
export const EcomProductSkuDeactivationSource = {
  ComboRelation: 'COMBO_RELATION',
  Platform: 'PLATFORM',
  Seller: 'SELLER'
} as const;

export type EcomProductSkuDeactivationSource = typeof EcomProductSkuDeactivationSource[keyof typeof EcomProductSkuDeactivationSource];
/** External list price attached to a product SKU */
export interface EcomProductSkuExternalListPrice {
  amount?: Maybe<Scalars['String']['output']>;
  currency?: Maybe<EcomProductSkuCurrency>;
  source?: Maybe<EcomProductSkuExternalListPriceSource>;
}

/** External platform source for a SKU external list price. */
export const EcomProductSkuExternalListPriceSource = {
  ShopifyCompareAtPrice: 'SHOPIFY_COMPARE_AT_PRICE'
} as const;

export type EcomProductSkuExternalListPriceSource = typeof EcomProductSkuExternalListPriceSource[keyof typeof EcomProductSkuExternalListPriceSource];
/** Platform fee attached to a product SKU */
export interface EcomProductSkuFee {
  additionalAttribute?: Maybe<EcomProductSkuFeeAdditionalAttribute>;
  amount?: Maybe<Scalars['String']['output']>;
  type?: Maybe<EcomProductSkuFeeType>;
}

/** Additional attribute for a product SKU fee. */
export const EcomProductSkuFeeAdditionalAttribute = {
  NotApplicable: 'NOT_APPLICABLE',
  Reusable: 'REUSABLE',
  SingleUse: 'SINGLE_USE'
} as const;

export type EcomProductSkuFeeAdditionalAttribute = typeof EcomProductSkuFeeAdditionalAttribute[keyof typeof EcomProductSkuFeeAdditionalAttribute];
/** Fee type attached to a product SKU. */
export const EcomProductSkuFeeType = {
  Pfand: 'PFAND'
} as const;

export type EcomProductSkuFeeType = typeof EcomProductSkuFeeType[keyof typeof EcomProductSkuFeeType];
/** Inventory entry for a product SKU in a warehouse */
export interface EcomProductSkuInventory {
  backorderQuantity?: Maybe<Scalars['Int']['output']>;
  handlingTime?: Maybe<Scalars['Int']['output']>;
  quantity?: Maybe<Scalars['Int']['output']>;
  warehouseId?: Maybe<Scalars['String']['output']>;
}

/** Price-like amount with currency for product SKU fields */
export interface EcomProductSkuMoney {
  amount?: Maybe<Scalars['String']['output']>;
  currency?: Maybe<EcomProductSkuCurrency>;
}

/** Pre-sale settings for a product SKU */
export interface EcomProductSkuPreSale {
  fulfillmentType?: Maybe<EcomProductSkuPreSaleFulfillmentType>;
  type?: Maybe<EcomProductSkuPreSaleType>;
}

/** Pre-sale fulfillment settings for a product SKU */
export interface EcomProductSkuPreSaleFulfillmentType {
  handlingDurationDays?: Maybe<Scalars['Int']['output']>;
  /** Unix seconds */
  releaseDate?: Maybe<Scalars['Int']['output']>;
}

/** Pre-sale type for a product SKU. */
export const EcomProductSkuPreSaleType = {
  Custom: 'CUSTOM',
  MadeToOrder: 'MADE_TO_ORDER',
  PreOrder: 'PRE_ORDER'
} as const;

export type EcomProductSkuPreSaleType = typeof EcomProductSkuPreSaleType[keyof typeof EcomProductSkuPreSaleType];
/** Detailed price breakdown for a product SKU */
export interface EcomProductSkuPrice {
  currency?: Maybe<EcomProductSkuCurrency>;
  salePrice?: Maybe<Scalars['String']['output']>;
  taxExclusivePrice?: Maybe<Scalars['String']['output']>;
}

/** Lifecycle status for a product SKU. */
export const EcomProductSkuStatus = {
  Deactivated: 'DEACTIVATED',
  Normal: 'NORMAL'
} as const;

export type EcomProductSkuStatus = typeof EcomProductSkuStatus[keyof typeof EcomProductSkuStatus];
/** Status metadata for a product SKU */
export interface EcomProductSkuStatusInfo {
  deactivationSource?: Maybe<EcomProductSkuDeactivationSource>;
  status?: Maybe<EcomProductSkuStatus>;
}

/** Trimmed product SKU summary for list endpoints. Use ecommerceGetProduct for the full product payload. */
export interface EcomProductSkuSummary {
  currency?: Maybe<EcomProductSkuCurrency>;
  price?: Maybe<Scalars['String']['output']>;
  sellerSku?: Maybe<Scalars['String']['output']>;
  /** Unique ID of this SKU */
  skuId: Scalars['String']['output'];
  /** Summary label for the SKU. Derived from sellerSku for list/search output. */
  skuName?: Maybe<Scalars['String']['output']>;
}

/** Product status filter. Use ALL to return all statuses. */
export const EcomProductStatus = {
  Activate: 'ACTIVATE',
  All: 'ALL',
  Deleted: 'DELETED',
  Draft: 'DRAFT',
  Failed: 'FAILED',
  Freeze: 'FREEZE',
  Pending: 'PENDING',
  PlatformDeactivated: 'PLATFORM_DEACTIVATED',
  SellerDeactivated: 'SELLER_DEACTIVATED'
} as const;

export type EcomProductStatus = typeof EcomProductStatus[keyof typeof EcomProductStatus];
/** Trimmed product summary for list endpoints. Use ecommerceGetProduct for full details including images. */
export interface EcomProductSummary {
  /** URL of the first product image (the listing cover). Derived from images[0].url — use ecommerceGetProduct for the full image set. */
  coverImage?: Maybe<Scalars['String']['output']>;
  /** Unix seconds */
  createTime?: Maybe<Scalars['Int']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  /** Highest SKU price across the product's variants, formatted to two decimals (e.g. '29.00'). Omitted when no SKU has a numeric price. */
  priceMax?: Maybe<Scalars['String']['output']>;
  /** Lowest SKU price across the product's variants, formatted to two decimals (e.g. '10.00'). Omitted when no SKU has a numeric price. When only one SKU exists, priceMin === priceMax. */
  priceMin?: Maybe<Scalars['String']['output']>;
  productId: Scalars['String']['output'];
  skus?: Maybe<Array<EcomProductSkuSummary>>;
  status?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
  /** Unix seconds */
  updateTime?: Maybe<Scalars['Int']['output']>;
}

/** Shipping address on an order */
export interface EcomRecipientAddress {
  city?: Maybe<Scalars['String']['output']>;
  district?: Maybe<Scalars['String']['output']>;
  fullAddress?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  phone?: Maybe<Scalars['String']['output']>;
  postalCode?: Maybe<Scalars['String']['output']>;
  region?: Maybe<Scalars['String']['output']>;
}

/** Refund amount breakdown */
export interface EcomRefundAmount {
  currency?: Maybe<Scalars['String']['output']>;
  refundShippingFee?: Maybe<Scalars['String']['output']>;
  refundSubtotal?: Maybe<Scalars['String']['output']>;
  refundTax?: Maybe<Scalars['String']['output']>;
  refundTotal?: Maybe<Scalars['String']['output']>;
}

/** A reject reason option for a return / cancellation */
export interface EcomRejectReason {
  reasonId?: Maybe<Scalars['String']['output']>;
  reasonText?: Maybe<Scalars['String']['output']>;
}

/** Buyer-initiated return / refund / replacement request */
export interface EcomReturn {
  /** Unix seconds */
  createTime?: Maybe<Scalars['Int']['output']>;
  handoverMethod?: Maybe<Scalars['String']['output']>;
  isQuickRefund?: Maybe<Scalars['Boolean']['output']>;
  lineItems?: Maybe<Array<EcomReturnLineItem>>;
  orderId?: Maybe<Scalars['String']['output']>;
  refundAmount?: Maybe<EcomRefundAmount>;
  returnId: Scalars['String']['output'];
  returnMethod?: Maybe<Scalars['String']['output']>;
  returnReason?: Maybe<Scalars['String']['output']>;
  returnReasonText?: Maybe<Scalars['String']['output']>;
  /** e.g. AWAITING_BUYER_SHIP */
  returnStatus?: Maybe<Scalars['String']['output']>;
  returnTrackingNumber?: Maybe<Scalars['String']['output']>;
  /** RETURN_AND_REFUND, REFUND_ONLY, REPLACE */
  returnType?: Maybe<Scalars['String']['output']>;
  /** Who filed the request: BUYER / SELLER / SYSTEM */
  role?: Maybe<Scalars['String']['output']>;
  /** Unix seconds */
  updateTime?: Maybe<Scalars['Int']['output']>;
}

/** Return line item (the SKUs the buyer is returning) */
export interface EcomReturnLineItem {
  orderLineItemId?: Maybe<Scalars['String']['output']>;
  productImage?: Maybe<EcomImage>;
  productName?: Maybe<Scalars['String']['output']>;
  refundAmount?: Maybe<EcomRefundAmount>;
  returnLineItemId?: Maybe<Scalars['String']['output']>;
  sellerSku?: Maybe<Scalars['String']['output']>;
  skuId?: Maybe<Scalars['String']['output']>;
  skuName?: Maybe<Scalars['String']['output']>;
}

/** Return audit event */
export interface EcomReturnRecord {
  /** Unix seconds */
  createTime?: Maybe<Scalars['Int']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  /** ORDER_RETURN, SELLER_AGGREE_RETURN, BUYER_RETURN_SHIPPED_TIMEOUT, ... */
  event?: Maybe<Scalars['String']['output']>;
  /** Free-text note left by the actor */
  note?: Maybe<Scalars['String']['output']>;
  reasonText?: Maybe<Scalars['String']['output']>;
  /** BUYER, SELLER, SYSTEM */
  role?: Maybe<Scalars['String']['output']>;
}

/** Return status filter for searching returns */
export const EcomReturnStatusFilter = {
  All: 'ALL',
  AwaitingBuyerResponse: 'AWAITING_BUYER_RESPONSE',
  AwaitingBuyerShip: 'AWAITING_BUYER_SHIP',
  BuyerShippedItem: 'BUYER_SHIPPED_ITEM',
  RefundOrReturnRequestReject: 'REFUND_OR_RETURN_REQUEST_REJECT',
  RejectReceivePackage: 'REJECT_RECEIVE_PACKAGE',
  ReturnOrRefundRequestCancel: 'RETURN_OR_REFUND_REQUEST_CANCEL',
  ReturnOrRefundRequestComplete: 'RETURN_OR_REFUND_REQUEST_COMPLETE',
  ReturnOrRefundRequestPending: 'RETURN_OR_REFUND_REQUEST_PENDING',
  ReturnOrRefundRequestSuccess: 'RETURN_OR_REFUND_REQUEST_SUCCESS'
} as const;

export type EcomReturnStatusFilter = typeof EcomReturnStatusFilter[keyof typeof EcomReturnStatusFilter];
/** Return type filter for searching returns */
export const EcomReturnTypeFilter = {
  All: 'ALL',
  Refund: 'REFUND',
  Replacement: 'REPLACEMENT',
  ReturnAndRefund: 'RETURN_AND_REFUND'
} as const;

export type EcomReturnTypeFilter = typeof EcomReturnTypeFilter[keyof typeof EcomReturnTypeFilter];
/** Seller contact information */
export interface EcomSellerContactInfo {
  email?: Maybe<Scalars['String']['output']>;
  line?: Maybe<Scalars['String']['output']>;
  phoneNumber?: Maybe<Scalars['String']['output']>;
  telegram?: Maybe<Scalars['String']['output']>;
  whatsapp?: Maybe<Scalars['String']['output']>;
}

/** Shipping document URL */
export interface EcomShippingDocument {
  /** URL of the document (label, packing slip, etc.) */
  docUrl?: Maybe<Scalars['String']['output']>;
  trackingNumber?: Maybe<Scalars['String']['output']>;
}

/** Inventory updates for one shop */
export interface EcomShopUpdateInventoryInput {
  /** Shop ID (the 'id' field from ecommerce_list_shops) */
  shopId: Scalars['String']['input'];
  /** SKU inventory updates to apply to this shop. */
  updates: Array<EcomUpdateInventoryInput>;
}

/** Order-derived per-SKU demand metrics for shop analytics */
export interface EcomSkuPerformance {
  /** Shop-local date for this SKU demand row (YYYY-MM-DD) */
  dateKey?: Maybe<Scalars['String']['output']>;
  /** Overall GMV for the SKU */
  gmv?: Maybe<EcomAnalyticsMoney>;
  /** Product ID that owns the SKU */
  productId?: Maybe<Scalars['String']['output']>;
  /** Product name captured from order facts */
  productName?: Maybe<Scalars['String']['output']>;
  /** Seller SKU captured from order facts */
  sellerSku?: Maybe<Scalars['String']['output']>;
  /** SKU ID */
  skuId: Scalars['String']['output'];
  /** SKU display name captured from order facts */
  skuName?: Maybe<Scalars['String']['output']>;
  /** Total orders for the SKU */
  skuOrders?: Maybe<Scalars['Int']['output']>;
  /** Total units sold for the SKU */
  unitsSold?: Maybe<Scalars['Int']['output']>;
}

/** Flat order-derived SKU demand result. Serving reads return one row per shop-local date and SKU. */
export interface EcomSkuPerformanceResult {
  /** Per-day per-SKU demand rows */
  items: Array<EcomSkuPerformance>;
  /** Latest date in shop local timezone where platform analytics data is ready (ISO 8601). Only populated for direct platform reads. */
  latestAvailableDate?: Maybe<Scalars['String']['output']>;
  /** Number of rows returned by this query */
  totalCount?: Maybe<Scalars['Int']['output']>;
}

/** Sort field for package search */
export const EcomSortField = {
  CreateTime: 'CREATE_TIME',
  OrderPayTime: 'ORDER_PAY_TIME',
  UpdateTime: 'UPDATE_TIME'
} as const;

export type EcomSortField = typeof EcomSortField[keyof typeof EcomSortField];
/** Sort order */
export const EcomSortOrder = {
  Asc: 'ASC',
  Desc: 'DESC'
} as const;

export type EcomSortOrder = typeof EcomSortOrder[keyof typeof EcomSortOrder];
/** Target collaboration conflict */
export interface EcomTargetCollaborationConflict {
  creatorUserOpenId?: Maybe<Scalars['String']['output']>;
  productId?: Maybe<Scalars['String']['output']>;
}

/** Target collaboration creator */
export interface EcomTargetCollaborationCreator {
  avatar?: Maybe<EcomImage>;
  collaborationStatus?: Maybe<Scalars['String']['output']>;
  contentProductCount?: Maybe<Scalars['Int']['output']>;
  creatorOpenId?: Maybe<Scalars['String']['output']>;
  nickname?: Maybe<Scalars['String']['output']>;
  productEffectiveStatus?: Maybe<Scalars['String']['output']>;
  selectionRegion?: Maybe<Scalars['String']['output']>;
  showcaseProductCount?: Maybe<Scalars['Int']['output']>;
  username?: Maybe<Scalars['String']['output']>;
}

/** Target collaboration product failure */
export interface EcomTargetCollaborationProductFailure {
  commissionRate?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['String']['output']>;
  productId?: Maybe<Scalars['String']['output']>;
}

/** Target collaboration update failures */
export interface EcomTargetCollaborationUpdateFailed {
  addCreatorOpenIds?: Maybe<Array<Scalars['String']['output']>>;
  addProducts?: Maybe<Array<EcomTargetCollaborationProductFailure>>;
  changeCommissions?: Maybe<Array<EcomTargetCollaborationProductFailure>>;
  endTime?: Maybe<Scalars['Int']['output']>;
  invalidOpenIdList?: Maybe<Array<Scalars['String']['output']>>;
  invalidProductIdList?: Maybe<Array<Scalars['String']['output']>>;
  name?: Maybe<Scalars['String']['output']>;
  removeCreatorOpenIds?: Maybe<Array<Scalars['String']['output']>>;
  removeProductIds?: Maybe<Array<Scalars['String']['output']>>;
  sellerContactInfo?: Maybe<EcomSellerContactInfo>;
}

/** Tracking event */
export interface EcomTrackingEvent {
  description?: Maybe<Scalars['String']['output']>;
  /** Update time in Unix milliseconds (TikTok returns `update_time_millis`; preserved as-is). Float because millis exceed 32-bit Int range. */
  updateTimeMillis?: Maybe<Scalars['Float']['output']>;
}

/** Per-SKU inventory update failure returned by the platform */
export interface EcomUpdateInventoryFailure {
  code?: Maybe<Scalars['Int']['output']>;
  /** Human-readable failure reason returned by the platform. */
  reason?: Maybe<Scalars['String']['output']>;
  skuId?: Maybe<Scalars['String']['output']>;
  warehouseFailures?: Maybe<Array<EcomUpdateInventoryWarehouseFailure>>;
}

/** Inventory update request for one SKU */
export interface EcomUpdateInventoryInput {
  /** Warehouse-level inventory rows for this SKU. For multi-warehouse SKUs, include every assigned warehouse with its desired quantity. */
  inventory: Array<EcomUpdateInventoryWarehouseInput>;
  /** Product ID that owns this SKU. TikTok's update inventory endpoint is product-scoped. */
  productId: Scalars['String']['input'];
  /** SKU ID to update */
  skuId: Scalars['String']['input'];
}

/** Result of updating product inventory */
export interface EcomUpdateInventoryResult {
  /** Only SKU updates that failed, with platform failure reasons. */
  failures?: Maybe<Array<EcomUpdateInventoryFailure>>;
  /** Shop ID that this result belongs to, when returned from the multi-shop resolver. */
  shopId?: Maybe<Scalars['String']['output']>;
  /** True when the platform returned no SKU-scoped failures for this shop. */
  success: Scalars['Boolean']['output'];
}

/** Warehouse-level inventory update failure returned by the platform */
export interface EcomUpdateInventoryWarehouseFailure {
  code?: Maybe<Scalars['Int']['output']>;
  /** Human-readable failure reason returned by the platform. */
  reason?: Maybe<Scalars['String']['output']>;
  warehouseId?: Maybe<Scalars['String']['output']>;
}

/** Warehouse-level inventory update for one SKU */
export interface EcomUpdateInventoryWarehouseInput {
  /** Optional backorder quantity for this warehouse. Omit to keep TikTok's existing value. */
  backorderQuantity?: InputMaybe<Scalars['Int']['input']>;
  /** Optional backorder handling time in working days. TikTok requires the same handling time across warehouses for a SKU. */
  handlingTime?: InputMaybe<Scalars['Int']['input']>;
  /** Desired in-stock quantity for this SKU in this warehouse. TikTok requires an integer between 1 and 99,999. */
  quantity: Scalars['Int']['input'];
  /** Warehouse ID to update. TikTok allows this to be omitted only when the SKU is assigned to exactly one warehouse. */
  warehouseId?: InputMaybe<Scalars['String']['input']>;
}

/** Target collaboration update result */
export interface EcomUpdateTargetCollaborationResult {
  targetCollaborationConflicts?: Maybe<Array<EcomTargetCollaborationConflict>>;
  updateFailed?: Maybe<EcomTargetCollaborationUpdateFailed>;
}

/** Result of updating a shop through the agent-facing resolver */
export interface EcommerceUpdateShopResult {
  /** Human-readable confirmation message */
  message?: Maybe<Scalars['String']['output']>;
  /** Shop ID that was updated */
  shopId: Scalars['String']['output'];
}

export interface EditAffiliateOpenCollaborationSampleRuleInput {
  activateStatus: AffiliateOpenSampleRuleActivation;
  collaborationId: Scalars['ID']['input'];
  sampleRule?: InputMaybe<AffiliateOpenCollaborationSampleRuleInput>;
  shopId: Scalars['ID']['input'];
  thresholds?: InputMaybe<AffiliateOpenCollaborationSampleThresholdsInput>;
}

export interface EditAffiliateOpenCollaborationSampleRulePayload {
  collaboration: AffiliateCollaboration;
  sampleRule?: Maybe<EcomOpenCollaborationSampleRule>;
}

export interface EditAffiliateOpenCollaborationSettingsInput {
  autoAddProduct: AffiliateOpenAutoAddProductInput;
  shopId: Scalars['ID']['input'];
}

export interface EditAffiliateOpenCollaborationSettingsPayload {
  settings: EcomOpenCollaborationSettings;
}

/** Seller-level email account binding for affiliate outreach */
export interface EmailAccountBinding {
  accessTokenExpiresAt?: Maybe<Scalars['DateTimeISO']['output']>;
  businessDeveloperAssignedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  businessDeveloperId?: Maybe<Scalars['ID']['output']>;
  createdAt: Scalars['DateTimeISO']['output'];
  displayName?: Maybe<Scalars['String']['output']>;
  emailAddress: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lastError?: Maybe<Scalars['String']['output']>;
  lastSyncAt?: Maybe<Scalars['DateTimeISO']['output']>;
  mailboxType: EmailMailboxType;
  microsoftUserId?: Maybe<Scalars['String']['output']>;
  provider: EmailProvider;
  sharedMailboxAddress?: Maybe<Scalars['String']['output']>;
  status: EmailAccountStatus;
  subscriptionExpiresAt?: Maybe<Scalars['DateTimeISO']['output']>;
  subscriptionId?: Maybe<Scalars['String']['output']>;
  tenantId?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['ID']['output'];
}

/** Lifecycle state for a seller email account binding */
export const EmailAccountStatus = {
  Connected: 'CONNECTED',
  Disconnected: 'DISCONNECTED',
  Error: 'ERROR',
  Revoked: 'REVOKED'
} as const;

export type EmailAccountStatus = typeof EmailAccountStatus[keyof typeof EmailAccountStatus];
/** Count of email account bindings by lifecycle status */
export interface EmailAccountStatusCount {
  count: Scalars['Float']['output'];
  status: EmailAccountStatus;
}

/** Mailbox ownership mode for email account bindings */
export const EmailMailboxType = {
  Personal: 'PERSONAL',
  Shared: 'SHARED'
} as const;

export type EmailMailboxType = typeof EmailMailboxType[keyof typeof EmailMailboxType];
/** Backend connector provider for email account bindings */
export const EmailProvider = {
  MicrosoftGraph: 'MICROSOFT_GRAPH'
} as const;

export type EmailProvider = typeof EmailProvider[keyof typeof EmailProvider];
export interface EnsureAffiliateBusinessDeveloperEntryInput {
  action: AffiliateBusinessDeveloperProvisionAction;
  clientKey: Scalars['String']['input'];
  displayName: Scalars['String']['input'];
}

export interface EnsureAffiliateBusinessDevelopersInput {
  entries: Array<EnsureAffiliateBusinessDeveloperEntryInput>;
  idempotencyKey: Scalars['String']['input'];
}

export interface EnsureAffiliateBusinessDevelopersPayload {
  completed: Scalars['Boolean']['output'];
  idempotencyKey: Scalars['String']['output'];
  results: Array<AffiliateBusinessDeveloperProvisionResult>;
}

export const EntitlementDecisionCode = {
  Allowed: 'ALLOWED',
  FeatureDisabled: 'FEATURE_DISABLED',
  PastDue: 'PAST_DUE',
  PaymentRequired: 'PAYMENT_REQUIRED',
  QuotaExceeded: 'QUOTA_EXCEEDED',
  TrialExpired: 'TRIAL_EXPIRED'
} as const;

export type EntitlementDecisionCode = typeof EntitlementDecisionCode[keyof typeof EntitlementDecisionCode];
/** A local entitlement grant projected from billing, trial, promotion, or operator action. */
export interface EntitlementGrant {
  createdAt: Scalars['DateTimeISO']['output'];
  entitlementKeys: Array<EntitlementKey>;
  id: Scalars['ID']['output'];
  ownerUserId: Scalars['String']['output'];
  product: BillableProduct;
  scopeId: Scalars['String']['output'];
  scopeType: BillingScopeType;
  source: EntitlementGrantSource;
  sourceId?: Maybe<Scalars['String']['output']>;
  status: EntitlementGrantStatus;
  updatedAt: Scalars['DateTimeISO']['output'];
  usagePolicies: Array<UsagePolicy>;
  validFrom: Scalars['DateTimeISO']['output'];
  validUntil?: Maybe<Scalars['DateTimeISO']['output']>;
}

export const EntitlementGrantSource = {
  Manual: 'MANUAL',
  Promotion: 'PROMOTION',
  Subscription: 'SUBSCRIPTION',
  Trial: 'TRIAL'
} as const;

export type EntitlementGrantSource = typeof EntitlementGrantSource[keyof typeof EntitlementGrantSource];
export const EntitlementGrantStatus = {
  Active: 'ACTIVE',
  Expired: 'EXPIRED',
  Revoked: 'REVOKED'
} as const;

export type EntitlementGrantStatus = typeof EntitlementGrantStatus[keyof typeof EntitlementGrantStatus];
/** Feature entitlement identifiers */
export const EntitlementKey = {
  EcomAffiliateManagement: 'ECOM_AFFILIATE_MANAGEMENT',
  EcomAnalyticsRead: 'ECOM_ANALYTICS_READ',
  EcomCsEscalationRead: 'ECOM_CS_ESCALATION_READ',
  EcomCsEscalationWrite: 'ECOM_CS_ESCALATION_WRITE',
  EcomCsRead: 'ECOM_CS_READ',
  EcomCsWrite: 'ECOM_CS_WRITE',
  EcomFulfillmentRead: 'ECOM_FULFILLMENT_READ',
  EcomInventoryManagement: 'ECOM_INVENTORY_MANAGEMENT',
  EcomProductRead: 'ECOM_PRODUCT_READ',
  EcomProductWrite: 'ECOM_PRODUCT_WRITE',
  EcomReturnRefundRead: 'ECOM_RETURN_REFUND_READ',
  EcomReturnRefundWrite: 'ECOM_RETURN_REFUND_WRITE'
} as const;

export type EntitlementKey = typeof EntitlementKey[keyof typeof EntitlementKey];
export interface ExperimentAnalyticsView {
  assignments: Array<ExperimentAssignmentDailyView>;
  experimentId: Scalars['ID']['output'];
  metrics: Array<ExperimentMetricDailyView>;
  quality?: Maybe<ExperimentQualitySnapshotView>;
}

export interface ExperimentAssignmentDailyView {
  assignedDate: Scalars['String']['output'];
  assignedUnits: Scalars['Float']['output'];
  expectedWeightBps: Scalars['Int']['output'];
  exposedUnits: Scalars['Float']['output'];
  maturedUnits: Scalars['Float']['output'];
  variantKey: Scalars['String']['output'];
}

export interface ExperimentMetricDailyView {
  cohortDate: Scalars['String']['output'];
  denominatorSum?: Maybe<Scalars['Float']['output']>;
  dimensionKey: Scalars['String']['output'];
  dimensionValue: Scalars['String']['output'];
  eligibleUnits: Scalars['Float']['output'];
  metricKey: Scalars['String']['output'];
  numeratorSum?: Maybe<Scalars['Float']['output']>;
  observedUnits: Scalars['Float']['output'];
  sumSquares?: Maybe<Scalars['Float']['output']>;
  sumValue?: Maybe<Scalars['Float']['output']>;
  variantKey: Scalars['String']['output'];
}

export interface ExperimentQualitySnapshotView {
  assignedUnits: Scalars['Float']['output'];
  calculatedAt: Scalars['DateTimeISO']['output'];
  chiSquareStatistic?: Maybe<Scalars['Float']['output']>;
  exposedUnits: Scalars['Float']['output'];
  maturedUnits: Scalars['Float']['output'];
  maxAllocationDeviationBps?: Maybe<Scalars['Int']['output']>;
  srmPValue?: Maybe<Scalars['Float']['output']>;
}

export const ExperimentStatus = {
  Archived: 'ARCHIVED',
  Draft: 'DRAFT',
  Running: 'RUNNING',
  Stopped: 'STOPPED'
} as const;

export type ExperimentStatus = typeof ExperimentStatus[keyof typeof ExperimentStatus];
export const ExperimentType = {
  ConfigVariant: 'CONFIG_VARIANT',
  Holdout: 'HOLDOUT'
} as const;

export type ExperimentType = typeof ExperimentType[keyof typeof ExperimentType];
export const ExperimentVariantAction = {
  ApplyConfig: 'APPLY_CONFIG',
  Continue: 'CONTINUE',
  NoReachout: 'NO_REACHOUT'
} as const;

export type ExperimentVariantAction = typeof ExperimentVariantAction[keyof typeof ExperimentVariantAction];
export interface ExpertConversation {
  createdAt: Scalars['DateTimeISO']['output'];
  deletedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  id: Scalars['ID']['output'];
  lastMessageAt: Scalars['DateTimeISO']['output'];
  purgeAt?: Maybe<Scalars['DateTimeISO']['output']>;
  status: ExpertConversationStatus;
  summary?: Maybe<Scalars['String']['output']>;
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['String']['output'];
}

export interface ExpertConversationDetail {
  conversation: ExpertConversation;
  messages: Array<ExpertMessage>;
  recommendations: Array<ExpertRecommendation>;
}

export interface ExpertConversationPage {
  items: Array<ExpertConversation>;
  nextCursor?: Maybe<Scalars['String']['output']>;
}

export const ExpertConversationStatus = {
  Active: 'ACTIVE',
  Archived: 'ARCHIVED',
  Deleted: 'DELETED'
} as const;

export type ExpertConversationStatus = typeof ExpertConversationStatus[keyof typeof ExpertConversationStatus];
export interface ExpertDispatchResult {
  run: ExpertRun;
  usage: ExpertUsageStatus;
}

export interface ExpertKnowledgeRelease {
  artifactDigest: Scalars['String']['output'];
  artifactUrl: Scalars['String']['output'];
  createdAt: Scalars['DateTimeISO']['output'];
  evaluationSummary?: Maybe<Scalars['JSONObject']['output']>;
  id: Scalars['ID']['output'];
  publishedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  releaseNotes?: Maybe<Scalars['String']['output']>;
  sourceCommit?: Maybe<Scalars['String']['output']>;
  status: ExpertKnowledgeReleaseStatus;
  updatedAt: Scalars['DateTimeISO']['output'];
  version: Scalars['String']['output'];
}

export const ExpertKnowledgeReleaseStatus = {
  Candidate: 'CANDIDATE',
  Retired: 'RETIRED',
  Stable: 'STABLE'
} as const;

export type ExpertKnowledgeReleaseStatus = typeof ExpertKnowledgeReleaseStatus[keyof typeof ExpertKnowledgeReleaseStatus];
export interface ExpertMessage {
  content: Scalars['String']['output'];
  conversationId: Scalars['String']['output'];
  createdAt: Scalars['DateTimeISO']['output'];
  editedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  expertRunId?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  imageAssets: Array<ImageAsset>;
  role: ExpertMessageRole;
  structuredPayload?: Maybe<Scalars['JSONObject']['output']>;
  suggestedQuestions: Array<Scalars['String']['output']>;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['String']['output'];
}

export const ExpertMessageRole = {
  Assistant: 'ASSISTANT',
  System: 'SYSTEM',
  User: 'USER'
} as const;

export type ExpertMessageRole = typeof ExpertMessageRole[keyof typeof ExpertMessageRole];
export interface ExpertProfile {
  capitalBand?: Maybe<Scalars['String']['output']>;
  constraints: Array<Scalars['String']['output']>;
  createdAt: Scalars['DateTimeISO']['output'];
  experience?: Maybe<Scalars['String']['output']>;
  goals: Array<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  locale: Scalars['String']['output'];
  profileVersion: Scalars['Float']['output'];
  sellerTypes: Array<ExpertSellerType>;
  stage: Scalars['String']['output'];
  targetMarkets: Array<Scalars['String']['output']>;
  targetTimeline?: Maybe<Scalars['String']['output']>;
  teamCapacity?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['String']['output'];
}

export interface ExpertRecommendation {
  assumptions: Array<Scalars['String']['output']>;
  conversationId: Scalars['String']['output'];
  createdAt: Scalars['DateTimeISO']['output'];
  expertRunId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  recommendation: Scalars['String']['output'];
  risks: Array<Scalars['String']['output']>;
  topic: Scalars['String']['output'];
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['String']['output'];
  validationSteps: Array<Scalars['String']['output']>;
}

export interface ExpertRun {
  artifactDigest: Scalars['String']['output'];
  completedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  conversationId: Scalars['String']['output'];
  createdAt: Scalars['DateTimeISO']['output'];
  failureCode?: Maybe<Scalars['String']['output']>;
  failureMessage?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  idempotencyKey: Scalars['String']['output'];
  inputTokens: Scalars['Int']['output'];
  knowledgeReleaseId?: Maybe<Scalars['String']['output']>;
  modelAlias: Scalars['String']['output'];
  nextEventSequence: Scalars['Int']['output'];
  outputTokens: Scalars['Int']['output'];
  skillVersion: Scalars['String']['output'];
  sourceCommit: Scalars['String']['output'];
  startedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  status: ExpertRunStatus;
  updatedAt: Scalars['DateTimeISO']['output'];
  upstreamModel: Scalars['String']['output'];
  usageMode: ExpertUsageMode;
  userId: Scalars['String']['output'];
}

export interface ExpertRunEvent {
  errorCode?: Maybe<Scalars['String']['output']>;
  occurredAt: Scalars['DateTimeISO']['output'];
  recommendationId?: Maybe<Scalars['String']['output']>;
  runId: Scalars['ID']['output'];
  sequence: Scalars['Int']['output'];
  suggestedQuestions?: Maybe<Array<Scalars['String']['output']>>;
  text?: Maybe<Scalars['String']['output']>;
  toolName?: Maybe<Scalars['String']['output']>;
  type: ExpertRunEventType;
}

export const ExpertRunEventType = {
  AnswerDelta: 'ANSWER_DELTA',
  Cancelled: 'CANCELLED',
  Completed: 'COMPLETED',
  Failed: 'FAILED',
  RecommendationCommitted: 'RECOMMENDATION_COMMITTED',
  Started: 'STARTED',
  ToolCompleted: 'TOOL_COMPLETED',
  ToolStarted: 'TOOL_STARTED'
} as const;

export type ExpertRunEventType = typeof ExpertRunEventType[keyof typeof ExpertRunEventType];
export const ExpertRunStatus = {
  Cancelled: 'CANCELLED',
  Completed: 'COMPLETED',
  Failed: 'FAILED',
  Queued: 'QUEUED',
  Running: 'RUNNING'
} as const;

export type ExpertRunStatus = typeof ExpertRunStatus[keyof typeof ExpertRunStatus];
export const ExpertSellerType = {
  CrossBorder: 'CROSS_BORDER',
  Local: 'LOCAL'
} as const;

export type ExpertSellerType = typeof ExpertSellerType[keyof typeof ExpertSellerType];
export const ExpertUsageMode = {
  FreeDaily: 'FREE_DAILY',
  LlmSubscription: 'LLM_SUBSCRIPTION'
} as const;

export type ExpertUsageMode = typeof ExpertUsageMode[keyof typeof ExpertUsageMode];
export interface ExpertUsageStatus {
  fiveHourTokenRemaining?: Maybe<Scalars['Int']['output']>;
  freeLimit?: Maybe<Scalars['Int']['output']>;
  freeRemaining?: Maybe<Scalars['Int']['output']>;
  freeUsed?: Maybe<Scalars['Int']['output']>;
  mode: ExpertUsageMode;
  resetsAt: Scalars['DateTimeISO']['output'];
  weeklyTokenRemaining?: Maybe<Scalars['Int']['output']>;
}

export interface GenerateAffiliateCampaignMessageTemplateInput {
  guidance?: InputMaybe<Scalars['String']['input']>;
  mode: AffiliateCampaignTemplateGenerationMode;
  previousDraft?: InputMaybe<Scalars['String']['input']>;
  productId: Scalars['String']['input'];
  shopId: Scalars['ID']['input'];
}

export interface GeneratePairingResult {
  code: Scalars['String']['output'];
  qrUrl?: Maybe<Scalars['String']['output']>;
}

/** Google ID token and optional existing-account link proof. */
export interface GoogleLoginInput {
  /** Whether Google may create a new TK Copilot account. */
  allowRegistration?: InputMaybe<Scalars['Boolean']['input']>;
  /** Optional acquisition attribution applied only when Google creates a new user. */
  attribution?: InputMaybe<MarketingAttributionInput>;
  idToken: Scalars['String']['input'];
  /** Optional six-character agent invite code for a new user. */
  inviteCode?: InputMaybe<Scalars['String']['input']>;
  link?: InputMaybe<GooglePasswordLinkInput>;
  /** OIDC nonce generated by a trusted native client. */
  nonce?: InputMaybe<Scalars['String']['input']>;
}

/** Existing-account proof used to link a Google identity. */
export interface GooglePasswordLinkInput {
  captchaAnswer: Scalars['String']['input'];
  captchaToken: Scalars['String']['input'];
  password: Scalars['String']['input'];
}

export interface GrantBillingPromotionInput {
  /** Number of complimentary billing months to add. Allowed range: 1-24. */
  months: Scalars['Int']['input'];
  /** Target owner user ID. */
  ownerUserId: Scalars['String']['input'];
  planId: BillingPlanId;
  reason?: InputMaybe<Scalars['String']['input']>;
  /** User ID for account-scoped plans, shop ID for shop-scoped plans. */
  scopeId: Scalars['String']['input'];
  scopeType: BillingScopeType;
}

/** Image file metadata stored in object storage */
export interface ImageAsset {
  bucket: Scalars['String']['output'];
  createdAt: Scalars['DateTimeISO']['output'];
  deletedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  expiresAt?: Maybe<Scalars['DateTimeISO']['output']>;
  extension: Scalars['String']['output'];
  height?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  linkedEntityId?: Maybe<Scalars['String']['output']>;
  linkedEntityType?: Maybe<Scalars['String']['output']>;
  mimeType: Scalars['String']['output'];
  objectKey: Scalars['String']['output'];
  publicUrl?: Maybe<Scalars['String']['output']>;
  references: Array<ImageAssetReference>;
  sha256: Scalars['String']['output'];
  sizeBytes: Scalars['Int']['output'];
  status: ImageAssetStatus;
  updatedAt: Scalars['DateTimeISO']['output'];
  uri: Scalars['String']['output'];
  userId: Scalars['String']['output'];
  width?: Maybe<Scalars['Int']['output']>;
}

/** Entity reference that currently uses an image asset */
export interface ImageAssetReference {
  entityId: Scalars['String']['output'];
  entityType: Scalars['String']['output'];
  linkedAt: Scalars['DateTimeISO']['output'];
}

/** Lifecycle state for a user-uploaded image asset */
export const ImageAssetStatus = {
  Deleted: 'DELETED',
  Permanent: 'PERMANENT',
  Temporary: 'TEMPORARY'
} as const;

export type ImageAssetStatus = typeof ImageAssetStatus[keyof typeof ImageAssetStatus];
export interface ImportAffiliateCreatorProtectionEntryInput {
  businessDeveloperId?: InputMaybe<Scalars['ID']['input']>;
  creatorOpenId?: InputMaybe<Scalars['String']['input']>;
  note?: InputMaybe<Scalars['String']['input']>;
  platform: ShopPlatform;
  username?: InputMaybe<Scalars['String']['input']>;
}

export interface ImportAffiliateCreatorProtectionsInput {
  entries: Array<ImportAffiliateCreatorProtectionEntryInput>;
  importBatchId?: InputMaybe<Scalars['String']['input']>;
}

export interface ImportAffiliateCreatorProtectionsPayload {
  createdCount: Scalars['Int']['output'];
  rejectedRows: Array<AffiliateCreatorProtectionRejectedRow>;
  resolvedCount: Scalars['Int']['output'];
  unresolvedCount: Scalars['Int']['output'];
  updatedCount: Scalars['Int']['output'];
}

/** Ads OAuth initiation response with authorization URL */
export interface InitiateAdsOAuthResponse {
  authUrl: Scalars['String']['output'];
  state: Scalars['String']['output'];
}

/** OAuth initiation response with authorization URL */
export interface InitiateOAuthResponse {
  authUrl: Scalars['String']['output'];
  state: Scalars['String']['output'];
}

/** One shop listing bound to a Fulfilled by TikTok goods pool. A goods pool can bind listings in several shops of the same seller, so this is the many-to-many bridge between a goods pool and the shops that sell out of it. */
export interface InventoryAnalysisFbtBoundListing {
  /** This listing's allocation of the pool inside this warehouse, taken from the shop platform's per-listing warehouse inventory. Allocations of all bound listings sum to roughly the pool available quantity. Null when the FBT warehouse is not mapped to a shop platform warehouse or the listing carries no inventory row for it. */
  allocatedQuantity?: Maybe<Scalars['Int']['output']>;
  /** Shop platform product ID resolved from our own shop product catalog. Null when the bound listing is not present in the catalog, for example a paused listing. */
  productId?: Maybe<Scalars['String']['output']>;
  /** Shop alias/name. */
  shopAlias?: Maybe<Scalars['String']['output']>;
  /** Shop Mongo ID that owns this listing. */
  shopId: Scalars['ID']['output'];
  /** Shop platform SKU ID bound to the goods pool. */
  skuId: Scalars['String']['output'];
}

/** Authoritative Fulfilled by TikTok stock pool for one (goodsId, fbtWarehouseId) pair. TikTok returns a byte-identical copy of this pool to every shop of the seller that can see the goods, so it is counted exactly once here no matter how many shops reported it. Pool quantities are additive over distinct (goodsId, fbtWarehouseId) pairs only. */
export interface InventoryAnalysisFbtGoodsStock {
  /** Units available to sell. Null means unread, zero means really zero. */
  availableQuantity?: Maybe<Scalars['Int']['output']>;
  /** Shop listings bound to this goods pool. Empty when the goods binds no listing we can resolve, for example a paused goods that still holds stock. */
  boundListings: Array<InventoryAnalysisFbtBoundListing>;
  /** TikTok-global Fulfilled by TikTok warehouse ID. It is not scoped to a shop, and it is NOT the id used for inventory writes — see platformWarehouseId. */
  fbtWarehouseId: Scalars['String']['output'];
  /** Fulfilled by TikTok goods ID. */
  goodsId: Scalars['ID']['output'];
  /** Goods display name reported by TikTok. May differ from referenceCode, for example when the seller suffixed it to mark the goods as paused. */
  goodsName?: Maybe<Scalars['String']['output']>;
  /** Units in transit toward this warehouse for this goods. Goods-level, not per shop. Null means unread, zero means really zero. */
  inTransitQuantity?: Maybe<Scalars['Int']['output']>;
  /** Shop-facing platform warehouse ID for this FBT warehouse, used for inventory writes and for joining this pool to the officialPlatformWarehouses rows of the same physical warehouse. It is a different id from fbtWarehouseId. Resolved from our own ShopWarehouse mappings, not from the FBT response; null when no visible shop has mapped the warehouse. */
  platformWarehouseId?: Maybe<Scalars['String']['output']>;
  /** Goods reference code, which is the seller SKU. */
  referenceCode: Scalars['String']['output'];
  /** Units reserved against open orders. Null means unread, zero means really zero. */
  reservedQuantity?: Maybe<Scalars['Int']['output']>;
  /** Total units of this goods held in this warehouse. Null means the quantity could not be read; zero means the pool is really empty. */
  totalQuantity?: Maybe<Scalars['Int']['output']>;
  /** Units held as unfulfillable. Null means unread, zero means really zero. */
  unfulfillableQuantity?: Maybe<Scalars['Int']['output']>;
  /** Every shop whose API returned this goods record. A shop can see the record without binding any listing to it, so presence here is visibility, not ownership. TikTok exposes no owner or seller field, so a shared pool cannot be attributed to one shop. */
  visibleToShopIds: Array<Scalars['ID']['output']>;
  /** Warehouse display name resolved from our own Warehouse documents. Null when the FBT warehouse has not been mapped yet. */
  warehouseName?: Maybe<Scalars['String']['output']>;
}

/** Whether Fulfilled by TikTok facts could be read for one shop. Anything other than OK means this shop contributed no FBT records because the read was refused, not because it has no FBT stock. */
export interface InventoryAnalysisFbtShopRead {
  /** Outcome of this shop's FBT read. */
  readState: EcomFbtReadState;
  /** Shop alias/name. */
  shopAlias?: Maybe<Scalars['String']['output']>;
  /** Shop Mongo ID. */
  shopId: Scalars['ID']['output'];
}

/** Shop backend's observed inventory quantity for a third-party WMS warehouse mapping. */
export interface InventoryAnalysisInShopWarehouseQuantity {
  /** Shop platform warehouse ID used for inventory updates, copied from ShopWarehouse.platformWarehouseId. */
  platformWarehouseId?: Maybe<Scalars['String']['output']>;
  /** Shop platform product ID for this seller SKU when available. */
  productId?: Maybe<Scalars['String']['output']>;
  /** Quantity recorded in the shop backend for this platform warehouse mapping. */
  quantity: Scalars['Int']['output'];
  /** Shop alias/name. */
  shopAlias?: Maybe<Scalars['String']['output']>;
  /** Shop Mongo ID. */
  shopId: Scalars['ID']['output'];
  /** Shop platform SKU ID for this seller SKU when available. */
  skuId?: Maybe<Scalars['String']['output']>;
}

/** Full current inventory facts for one seller SKU. Summation rule: pool quantities in fbtGoodsStocks sum over distinct (goodsId, fbtWarehouseId) pairs; allocation quantities in officialPlatformWarehouses and fbtGoodsStocks[].boundListings sum over listings. The two families measure the same physical units from different sides and must never be added together. */
export interface InventoryAnalysisInventoryFacts {
  /** Authoritative Fulfilled by TikTok stock pools for this seller SKU, one entry per distinct (goodsId, fbtWarehouseId) pair, counted once across all shops that can see it. */
  fbtGoodsStocks: Array<InventoryAnalysisFbtGoodsStock>;
  /** Per-shop-listing allocations inside platform official/seller warehouses, as reported by the shop platform. Not the warehouse pool. */
  officialPlatformWarehouses: Array<InventoryAnalysisOfficialPlatformWarehouseStock>;
  /** Third-party WMS warehouse quantities plus mapped shop backend observations. */
  thirdPartyWmsWarehouses: Array<InventoryAnalysisThirdPartyWmsWarehouseStock>;
}

/** One shop listing's inventory allocation inside a platform warehouse, as the shop platform reports it for that listing. This is listing-level, not warehouse-level: for Fulfilled by TikTok warehouses a single goods pool can be shared by listings in several shops, and each row carries only this shop's share. Sum these rows over listings only. The authoritative warehouse pool lives in InventoryAnalysisInventoryFacts.fbtGoodsStocks; never add a pool quantity to an allocation quantity. */
export interface InventoryAnalysisOfficialPlatformWarehouseStock {
  /** Shop platform warehouse ID used for inventory updates, copied from ShopWarehouse.platformWarehouseId. */
  platformWarehouseId?: Maybe<Scalars['String']['output']>;
  /** Shop platform product ID for this seller SKU when available. */
  productId?: Maybe<Scalars['String']['output']>;
  /** This shop listing's on-hand allocation for this platform warehouse, as reported by the shop platform. It equals the warehouse total only when the underlying goods is not shared with listings in other shops; when it is shared, the allocations of all bound listings sum to the warehouse pool. See InventoryAnalysisInventoryFacts.fbtGoodsStocks for the authoritative pool. */
  quantity: Scalars['Int']['output'];
  /** Shop alias/name. */
  shopAlias?: Maybe<Scalars['String']['output']>;
  /** Shop Mongo ID. */
  shopId: Scalars['ID']['output'];
  /** Shop platform SKU ID for this seller SKU when available. */
  skuId?: Maybe<Scalars['String']['output']>;
  /** Source system label, such as TIKTOK_FBT or TIKTOK_SHOP. */
  sourceSystem: Scalars['String']['output'];
  /** Warehouse display name when available. */
  warehouseName?: Maybe<Scalars['String']['output']>;
}

/** Source-of-truth inventory and performance bundle for desktop agent analysis. */
export interface InventoryAnalysisPayload {
  /** Per-shop Fulfilled by TikTok read outcome, one entry per requested shop. Check this before concluding that a shop has no FBT stock: a refused read contributes no records at all. */
  fbtReads: Array<InventoryAnalysisFbtShopRead>;
  /** One row per seller SKU / canonical InventoryGood identity. */
  rows: Array<InventoryAnalysisRow>;
  /** Number of seller SKU rows returned. */
  totalCount: Scalars['Int']['output'];
}

/** One seller SKU inventory analysis row. */
export interface InventoryAnalysisRow {
  /** Current inventory facts grouped for agent-side analysis. */
  inventory: InventoryAnalysisInventoryFacts;
  /** Best available display name for this seller SKU. */
  name?: Maybe<Scalars['String']['output']>;
  /** Exact seller SKU / canonical merchant SKU for this row. */
  sellerSku: Scalars['String']['output'];
  /** Concrete shop SKUs/listings connected to this inventory row. Present even when there is no performance in the requested date range. */
  shopSkus: Array<InventoryAnalysisShopSku>;
}

/** Concrete shop product SKU/listing connected to one inventory analysis row. */
export interface InventoryAnalysisShopSku {
  /** Historical order-derived SKU demand facts for this concrete shop SKU. */
  performance: InventoryAnalysisShopSkuPerformanceFacts;
  /** Shop platform product ID. */
  productId: Scalars['String']['output'];
  /** Product lifecycle status on the shop platform. */
  productStatus?: Maybe<Scalars['String']['output']>;
  /** Product title on the shop platform. */
  productTitle?: Maybe<Scalars['String']['output']>;
  /** Exact seller SKU on the shop SKU/listing. */
  sellerSku: Scalars['String']['output'];
  /** Shop alias/name. */
  shopAlias?: Maybe<Scalars['String']['output']>;
  /** Shop Mongo ID. */
  shopId: Scalars['ID']['output'];
  /** Shop platform SKU ID. */
  skuId: Scalars['String']['output'];
  /** Shop SKU display label, usually sellerSku. */
  skuName?: Maybe<Scalars['String']['output']>;
  /** SKU lifecycle status on the shop platform. */
  skuStatus?: Maybe<Scalars['String']['output']>;
}

/** Daily order-derived performance facts for one concrete shop SKU. */
export interface InventoryAnalysisShopSkuDatePerformance {
  /** Shop-local analytics date (YYYY-MM-DD). */
  dateKey: Scalars['String']['output'];
  /** GMV for this shop/date/SKU row. */
  gmv?: Maybe<EcomAnalyticsMoney>;
  /** Orders for this shop/date/SKU row. */
  skuOrders?: Maybe<Scalars['Int']['output']>;
  /** Units sold for this shop/date/SKU row. */
  unitsSold?: Maybe<Scalars['Int']['output']>;
}

/** Order-derived performance facts for one concrete shop SKU. */
export interface InventoryAnalysisShopSkuPerformanceFacts {
  /** Raw daily demand facts for this shop SKU. */
  byDate: Array<InventoryAnalysisShopSkuDatePerformance>;
  /** End date exclusive in shop-local analytics date format (YYYY-MM-DD). */
  endDateLt: Scalars['String']['output'];
  /** Start date inclusive in shop-local analytics date format (YYYY-MM-DD). */
  startDateGe: Scalars['String']['output'];
}

/** Inventory quantity for a third-party WMS warehouse. When sourceSystem or wmsAccountId is null, the shop warehouse has not been mapped to a canonical WMS warehouse yet, so only inShopQuantities are available from the shop platform's displayed inventory. */
export interface InventoryAnalysisThirdPartyWmsWarehouseStock {
  /** Shop backend observations mapped to this WMS warehouse. For unmapped third-party shop warehouses, this is the only available inventory signal and represents the platform-displayed quantity, not physical WMS stock. */
  inShopQuantities: Array<InventoryAnalysisInShopWarehouseQuantity>;
  /** Units currently in transit to this WMS warehouse when available. */
  inTransitQuantity?: Maybe<Scalars['Int']['output']>;
  /** Whether the linked canonical inventory_good is ACTIVE in MongoDB. */
  isActive: Scalars['Boolean']['output'];
  /** Authoritative WMS warehouse quantity when available. */
  quantity?: Maybe<Scalars['Int']['output']>;
  /** Source system label, such as YEJOIN_WMS. Null means this third-party shop warehouse is not mapped yet. */
  sourceSystem?: Maybe<Scalars['String']['output']>;
  /** Warehouse display name when available. */
  warehouseName?: Maybe<Scalars['String']['output']>;
  /** WMS account Mongo ID. Null means this third-party shop warehouse is not mapped yet. */
  wmsAccountId?: Maybe<Scalars['ID']['output']>;
  /** WMS account label. */
  wmsAccountLabel?: Maybe<Scalars['String']['output']>;
}

/** ISO 3166-1 alpha-2 country code for inventory goods */
export const InventoryCountryCode = {
  Au: 'AU',
  Ca: 'CA',
  Cn: 'CN',
  De: 'DE',
  Fr: 'FR',
  Gb: 'GB',
  Jp: 'JP',
  Us: 'US',
  Vn: 'VN'
} as const;

export type InventoryCountryCode = typeof InventoryCountryCode[keyof typeof InventoryCountryCode];
/** Dimension unit for inventory goods */
export const InventoryDimensionUnit = {
  Cm: 'CM',
  In: 'IN'
} as const;

export type InventoryDimensionUnit = typeof InventoryDimensionUnit[keyof typeof InventoryDimensionUnit];
/** Canonical merchant-owned stockable inventory item */
export interface InventoryGood {
  barcode?: Maybe<Scalars['String']['output']>;
  countryOfOrigin?: Maybe<InventoryCountryCode>;
  createdAt: Scalars['DateTimeISO']['output'];
  declaredValue?: Maybe<Scalars['Float']['output']>;
  declaredValueCurrency?: Maybe<Currency>;
  dimensionUnit?: Maybe<InventoryDimensionUnit>;
  gtin?: Maybe<Scalars['String']['output']>;
  heightValue?: Maybe<Scalars['Float']['output']>;
  hsCode?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  imageAssetId?: Maybe<Scalars['ID']['output']>;
  imageUri?: Maybe<Scalars['String']['output']>;
  isBattery?: Maybe<Scalars['Boolean']['output']>;
  isHazmat?: Maybe<Scalars['Boolean']['output']>;
  lengthValue?: Maybe<Scalars['Float']['output']>;
  name: Scalars['String']['output'];
  /** Merchant-owned stockable SKU. This is matched exactly; the backend does not normalize it. */
  sku: Scalars['String']['output'];
  status: InventoryGoodStatus;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['String']['output'];
  weightUnit?: Maybe<InventoryWeightUnit>;
  weightValue?: Maybe<Scalars['Float']['output']>;
  widthValue?: Maybe<Scalars['Float']['output']>;
}

/** Resolution result for an external source SKU against canonical InventoryGood identity */
export interface InventoryGoodIdentityResolution {
  canWrite: Scalars['Boolean']['output'];
  inventoryGood?: Maybe<InventoryGood>;
  mapping?: Maybe<InventoryGoodMapping>;
  reason?: Maybe<Scalars['String']['output']>;
  resolutionType: InventoryGoodIdentityResolutionType;
  sellerSku: Scalars['String']['output'];
  sourceId: Scalars['ID']['output'];
  sourceSystem: InventoryGoodMappingSourceSystem;
}

/** How an external SKU was resolved to a canonical InventoryGood */
export const InventoryGoodIdentityResolutionType = {
  DefaultSku: 'DEFAULT_SKU',
  ExplicitMapping: 'EXPLICIT_MAPPING',
  MappingTargetInvalid: 'MAPPING_TARGET_INVALID',
  NotFound: 'NOT_FOUND',
  UnverifiedMapping: 'UNVERIFIED_MAPPING'
} as const;

export type InventoryGoodIdentityResolutionType = typeof InventoryGoodIdentityResolutionType[keyof typeof InventoryGoodIdentityResolutionType];
/** Sparse override mapping from an external source SKU/unit to a canonical InventoryGood */
export interface InventoryGoodMapping {
  createdAt: Scalars['DateTimeISO']['output'];
  id: Scalars['ID']['output'];
  inventoryGoodId: Scalars['ID']['output'];
  lastSeenAt?: Maybe<Scalars['DateTimeISO']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  /** External seller SKU or warehouse goods SKU. This is matched exactly; the backend does not normalize it. */
  sellerSku: Scalars['String']['output'];
  /** System-local Mongo ID for the external source connection, such as Shop._id or a WMS connection ID. */
  sourceId: Scalars['ID']['output'];
  sourceSystem: InventoryGoodMappingSourceSystem;
  status: InventoryGoodMappingStatus;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['String']['output'];
  verificationStatus: InventoryGoodMappingVerificationStatus;
}

/** External inventory/catalog source system */
export const InventoryGoodMappingSourceSystem = {
  Lingxing: 'LINGXING',
  TiktokFbt: 'TIKTOK_FBT',
  TiktokShop: 'TIKTOK_SHOP',
  Xlwms: 'XLWMS',
  YejoinWms: 'YEJOIN_WMS'
} as const;

export type InventoryGoodMappingSourceSystem = typeof InventoryGoodMappingSourceSystem[keyof typeof InventoryGoodMappingSourceSystem];
/** Lifecycle state of an external SKU to InventoryGood identity mapping */
export const InventoryGoodMappingStatus = {
  Active: 'ACTIVE',
  Archived: 'ARCHIVED'
} as const;

export type InventoryGoodMappingStatus = typeof InventoryGoodMappingStatus[keyof typeof InventoryGoodMappingStatus];
/** Confidence state for an external SKU identity mapping */
export const InventoryGoodMappingVerificationStatus = {
  AutoMatched: 'AUTO_MATCHED',
  Unverified: 'UNVERIFIED',
  UserConfirmed: 'USER_CONFIRMED'
} as const;

export type InventoryGoodMappingVerificationStatus = typeof InventoryGoodMappingVerificationStatus[keyof typeof InventoryGoodMappingVerificationStatus];
/** Lifecycle state of a canonical stockable inventory item */
export const InventoryGoodStatus = {
  Active: 'ACTIVE',
  Archived: 'ARCHIVED'
} as const;

export type InventoryGoodStatus = typeof InventoryGoodStatus[keyof typeof InventoryGoodStatus];
/** ISO 3166-1 alpha-2 country or region code used by inventory warehouse metadata */
export const InventoryRegionCode = {
  Au: 'AU',
  Be: 'BE',
  Ca: 'CA',
  Cn: 'CN',
  Cz: 'CZ',
  De: 'DE',
  Es: 'ES',
  Fr: 'FR',
  Gb: 'GB',
  Gr: 'GR',
  Hu: 'HU',
  Id: 'ID',
  It: 'IT',
  Jp: 'JP',
  My: 'MY',
  Nl: 'NL',
  Ph: 'PH',
  Pt: 'PT',
  Sg: 'SG',
  Th: 'TH',
  Us: 'US',
  Vn: 'VN'
} as const;

export type InventoryRegionCode = typeof InventoryRegionCode[keyof typeof InventoryRegionCode];
/** Weight unit for inventory goods */
export const InventoryWeightUnit = {
  G: 'G',
  Kg: 'KG',
  Lb: 'LB',
  Oz: 'OZ'
} as const;

export type InventoryWeightUnit = typeof InventoryWeightUnit[keyof typeof InventoryWeightUnit];
export interface LinkProductsToKnowledgeInput {
  productKnowledgeId: Scalars['ID']['input'];
  products: Array<ProductKnowledgeProductReferenceInput>;
}

export interface LinkProductsToKnowledgePayload {
  failures: Array<ProductKnowledgeLinkFailure>;
  linked: Array<ProductKnowledgeBinding>;
}

export interface ListAffiliateEmailAccountsInput {
  shopId: Scalars['ID']['input'];
  status?: InputMaybe<EmailAccountStatus>;
}

export interface ListAffiliateWhatsAppAccountsInput {
  shopId: Scalars['ID']['input'];
  status?: InputMaybe<WhatsAppAccountStatus>;
}

/** LLM proxy API key issued by RivonClaw Cloud. The key value is returned to authenticated subscription users so desktop can sync across devices. */
export interface LlmApiKey {
  createdAt: Scalars['DateTimeISO']['output'];
  id: Scalars['ID']['output'];
  /** Original API key value used by desktop and the LLM proxy. */
  key: Scalars['String']['output'];
  keyPrefix: Scalars['String']['output'];
  lastUsedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  status: LlmApiKeyStatus;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['String']['output'];
}

export const LlmApiKeyStatus = {
  Active: 'ACTIVE',
  Revoked: 'REVOKED'
} as const;

export type LlmApiKeyStatus = typeof LlmApiKeyStatus[keyof typeof LlmApiKeyStatus];
/** Login input */
export interface LoginInput {
  captchaAnswer: Scalars['String']['input'];
  captchaToken: Scalars['String']['input'];
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
}

export interface ManageAffiliateOpenCollaborationInput {
  activateStatus?: InputMaybe<AffiliateOpenSampleRuleActivation>;
  autoAddProduct?: InputMaybe<AffiliateOpenAutoAddProductInput>;
  collaborationId?: InputMaybe<Scalars['ID']['input']>;
  commissionRateBps?: InputMaybe<Scalars['Int']['input']>;
  operation: AffiliateOpenCollaborationOperation;
  operatorSummary: Scalars['String']['input'];
  productId?: InputMaybe<Scalars['String']['input']>;
  sampleRule?: InputMaybe<AffiliateOpenCollaborationSampleRuleInput>;
  shopId: Scalars['ID']['input'];
  thresholds?: InputMaybe<AffiliateOpenCollaborationSampleThresholdsInput>;
}

export interface ManageAffiliateTargetCollaborationInput {
  collaborationId?: InputMaybe<Scalars['ID']['input']>;
  createProducts?: InputMaybe<Array<AffiliateTargetCollaborationCreateProductInput>>;
  creatorOpenIds?: InputMaybe<Array<Scalars['String']['input']>>;
  endTime?: InputMaybe<Scalars['DateTimeISO']['input']>;
  freeSampleRule?: InputMaybe<AffiliateFreeSampleRuleInput>;
  message?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  operation: AffiliateTargetCollaborationOperation;
  operatorSummary: Scalars['String']['input'];
  sellerContactInfo?: InputMaybe<AffiliateSellerContactInfoInput>;
  shopId: Scalars['ID']['input'];
  updateProducts?: InputMaybe<Array<AffiliateTargetCollaborationUpdateProductInput>>;
}

/** Anonymous first-party attribution captured by the public website and transferred through the desktop deep link. */
export interface MarketingAttributionInput {
  attributionId: Scalars['String']['input'];
  firstTouch: MarketingTouchInput;
  lastTouch: MarketingTouchInput;
  version: Scalars['Int']['input'];
}

/** Normalized first- or last-touch marketing campaign. */
export interface MarketingTouchInput {
  campaign?: InputMaybe<Scalars['String']['input']>;
  capturedAt: Scalars['String']['input'];
  content?: InputMaybe<Scalars['String']['input']>;
  landingPage: Scalars['String']['input'];
  medium: Scalars['String']['input'];
  referrerDomain?: InputMaybe<Scalars['String']['input']>;
  source: Scalars['String']['input'];
  term?: InputMaybe<Scalars['String']['input']>;
}

/** Current user profile */
export interface MeResponse {
  agent?: Maybe<UserAgentProfile>;
  createdAt: Scalars['DateTimeISO']['output'];
  defaultRunProfileId?: Maybe<Scalars['String']['output']>;
  email: Scalars['String']['output'];
  enrolledModules: Array<ModuleId>;
  entitlementKeys: Array<EntitlementKey>;
  name?: Maybe<Scalars['String']['output']>;
  support?: Maybe<UserSupport>;
  userId: Scalars['String']['output'];
}

/** Cached proxy URL for an external media object */
export interface MediaCachedProxy {
  canonicalUrl: Scalars['String']['output'];
  createdAt: Scalars['DateTimeISO']['output'];
  expiresAt?: Maybe<Scalars['DateTimeISO']['output']>;
  extension?: Maybe<MediaCachedProxyExtension>;
  id: Scalars['ID']['output'];
  lastError?: Maybe<Scalars['String']['output']>;
  mimeType?: Maybe<MediaCachedProxyMimeType>;
  proxyUrl?: Maybe<Scalars['String']['output']>;
  sha256?: Maybe<Scalars['String']['output']>;
  sizeBytes?: Maybe<Scalars['Int']['output']>;
  status: MediaCachedProxyStatus;
  updatedAt: Scalars['DateTimeISO']['output'];
}

/** File extension used for cached external media objects */
export const MediaCachedProxyExtension = {
  Gif: 'GIF',
  Jpg: 'JPG',
  Mov: 'MOV',
  Mp4: 'MP4',
  Png: 'PNG',
  Webm: 'WEBM',
  Webp: 'WEBP'
} as const;

export type MediaCachedProxyExtension = typeof MediaCachedProxyExtension[keyof typeof MediaCachedProxyExtension];
/** Allowed MIME type for cached external media */
export const MediaCachedProxyMimeType = {
  Gif: 'GIF',
  Jpeg: 'JPEG',
  Mp4: 'MP4',
  Png: 'PNG',
  Quicktime: 'QUICKTIME',
  Webm: 'WEBM',
  Webp: 'WEBP'
} as const;

export type MediaCachedProxyMimeType = typeof MediaCachedProxyMimeType[keyof typeof MediaCachedProxyMimeType];
/** Lifecycle state for a cached external media proxy object */
export const MediaCachedProxyStatus = {
  Deleted: 'DELETED',
  Failed: 'FAILED',
  Fetching: 'FETCHING',
  Ready: 'READY'
} as const;

export type MediaCachedProxyStatus = typeof MediaCachedProxyStatus[keyof typeof MediaCachedProxyStatus];
/** Microsoft Graph connector configuration and subscription health */
export interface MicrosoftGraphConnectorStatus {
  accountCounts: Array<EmailAccountStatusCount>;
  configured: Scalars['Boolean']['output'];
  message?: Maybe<Scalars['String']['output']>;
  oauthConfigured: Scalars['Boolean']['output'];
  ready: Scalars['Boolean']['output'];
  subscriptionCounts: Array<MicrosoftGraphSubscriptionHealthCount>;
  webhookConfigured: Scalars['Boolean']['output'];
}

/** Operational health bucket for Microsoft Graph change notifications */
export const MicrosoftGraphSubscriptionHealth = {
  Active: 'ACTIVE',
  Error: 'ERROR',
  Expired: 'EXPIRED',
  ExpiringSoon: 'EXPIRING_SOON',
  Missing: 'MISSING'
} as const;

export type MicrosoftGraphSubscriptionHealth = typeof MicrosoftGraphSubscriptionHealth[keyof typeof MicrosoftGraphSubscriptionHealth];
/** Count of Microsoft Graph subscriptions by health bucket */
export interface MicrosoftGraphSubscriptionHealthCount {
  count: Scalars['Float']['output'];
  health: MicrosoftGraphSubscriptionHealth;
}

export interface ModelPricing {
  displayName: Scalars['String']['output'];
  inputPricePerMillion: Scalars['String']['output'];
  modelId: Scalars['String']['output'];
  note?: Maybe<Scalars['String']['output']>;
  outputPricePerMillion: Scalars['String']['output'];
}

/** Product module identifiers */
export const ModuleId = {
  GlobalEcommerceSeller: 'GLOBAL_ECOMMERCE_SELLER'
} as const;

export type ModuleId = typeof ModuleId[keyof typeof ModuleId];
export interface Mutation {
  activateExpertKnowledgeRelease: ExpertKnowledgeRelease;
  /** Admin-only: probe the target user's currently online desktop clients. The backend publishes a short-lived request over GraphQL subscriptions and returns devices that respond before timeoutMs. */
  adminProbeUserDevices: AdminUserDevicesProbeResult;
  /** Admin-only: request a selected online desktop device to upload its current local log. Call adminProbeUserDevices first and pass one returned deviceId. */
  adminRequestClientLogUpload: ClientLogUploadRequestPayload;
  /** Admin-only: point the relay debugging channel at one desktop device, or clear that relay target. Desktop clients configure their debug proxy account automatically after login; this mutation only changes the relay target. */
  adminSetDebugChannel: AdminDebugChannelResult;
  /** Publish an ephemeral affiliate signal to active desktop subscribers. This does not persist conversation, creator, or order data. */
  affiliatePublishRelationshipSignal: AffiliateRelationshipSignal;
  /** Apply a shop-scoped tag inside a user-level creator relation. */
  applyCreatorTag: AffiliateCreatorRelationship;
  approveBrowserToDesktopLogin: BrowserToDesktopLoginApproval;
  archiveAffiliateBusinessDeveloper: AffiliateBusinessDeveloper;
  archiveProductKnowledge: ProductKnowledge;
  assignAffiliateBusinessDeveloper: AffiliateCreatorRelationship;
  assignAffiliateEmailAccount: EmailAccountBinding;
  assignAffiliateWhatsAppAccount: WhatsAppAccountBinding;
  /** Assign a manual subscription for testing or operator-driven activation. */
  assignManualBillingSubscription: BillingSubscription;
  /** Admin-only: assign or adjust the account-level onboarding trial window. This marker does not directly grant entitlements; newly onboarded shops receive shop/seller trials with the remaining window. */
  assignOnboardingTrialWindow: BillingSubscription;
  /** Cancel an active subscription at the end of its current billing period. */
  cancelBillingSubscriptionAtPeriodEnd: BillingSubscription;
  cancelExpertRun: ExpertRun;
  /** Check a creator phone number through Evolution API and optionally persist the result. */
  checkAffiliateCreatorWhatsApp: CheckCreatorWhatsAppContactPayload;
  claimAffiliateCampaignSearchPlanGeneration: AffiliateCampaignSearchPlanGenerationContext;
  claimPendingTikTokShops: TikTokShopClaimResult;
  completeAffiliateOperationalOnboarding: AffiliateOperationalSettings;
  /** Complete Outlook/Microsoft Graph OAuth onboarding for a seller mailbox. */
  completeMicrosoftEmailOAuth: EmailAccountBinding;
  /** Complete TikTok Ads OAuth from the public callback using the one-time auth_code and CSRF state. */
  completeTikTokAdsOAuth: CompleteTikTokAdsOAuthResponse;
  /** Complete TikTok OAuth from a public website callback using the one-time OAuth code and CSRF state. */
  completeTikTokOAuth: CompleteTikTokOAuthResponse;
  consumeDesktopToWebLogin: WebAuthPayload;
  consumeTikTokOAuthBrowserStart: TikTokOAuthBrowserStart;
  consumeWebSessionTransfer: WebAuthPayload;
  /** Enable one product for TikTok Open Collaboration and immediately project it. */
  createAffiliateOpenCollaboration: CreateAffiliateOpenCollaborationPayload;
  /** Create a TikTok Target Collaboration and immediately project its Provider detail. */
  createAffiliateTargetCollaboration: CreateAffiliateTargetCollaborationPayload;
  createDesktopToWebLogin: DesktopToWebLoginStart;
  createExpertConversation: ExpertConversation;
  /** Create an additional original LLM proxy API key for the current user. Requires an active RivonClaw AI subscription. Most clients should use provisionLlmApiKey instead. */
  createLlmApiKey: CreatedLlmApiKeyPayload;
  /** Create a payment through Stripe or Lakala. */
  createPayment: Payment;
  createProductKnowledge: ProductKnowledge;
  /** Create a new run profile */
  createRunProfile: RunProfile;
  /** Create a temporary Stripe Customer Portal session for the current user's active Stripe subscription. Use this for changing cards, viewing invoices, or Stripe-hosted subscription management. */
  createStripeBillingPortalSession: StripeBillingPortalSessionPayload;
  /** Create a new surface */
  createSurface: Surface;
  /** Create a seller-level WhatsApp account binding before QR onboarding. */
  createWhatsAppAccountBinding: WhatsAppAccountBinding;
  /** Create a user-owned WhatsApp egress proxy for Evolution API instances. */
  createWhatsAppProxy: WhatsAppProxy;
  /** Acknowledge success/failure after executing a local CS escalation side-effect */
  csAckEscalationEvent?: Maybe<CsEscalationEventDelivery>;
  /** Acknowledge that the desktop agent handled the exact pending buyer message without sending a buyer-facing reply */
  csAcknowledgeConversationHandled: Scalars['Boolean']['output'];
  /** Claim a CS escalation side-effect event for exactly-once local execution */
  csClaimEscalationEvent?: Maybe<CsEscalationEventDelivery>;
  /** Dismiss all open CS escalations for a conversation without queueing desktop agent side-effect events */
  csDismissConversationEscalations: CustomerServiceConversationInboxItem;
  /** Dismiss one CS escalation without queueing a desktop agent side-effect event */
  csDismissEscalation: CsRespondResult;
  /** Manually end an active platform CS session from the operator customer-service UI */
  csEndCustomerServiceSession: Scalars['Boolean']['output'];
  /** End an active platform CS session and mark the local billing record ended */
  csEndSession: Scalars['Boolean']['output'];
  /** Create or update the active cloud CS escalation and queue a local manager-notification side-effect event */
  csEscalate: CsEscalateResult;
  /** Get an existing CS session or create a new one for a conversation */
  csGetOrCreateSession: CsSessionResult;
  csIngestOrderStatusWebhook: CsOrderStatusWebhookResult;
  /** Publish a CS conversation signal. Buyer-message and unread-detected signals also mark the conversation pending. */
  csPublishConversationSignal: CsConversationSignal;
  /** Admin/Airflow hook: re-publish failed CS escalation side-effect events to active GraphQL subscribers. Only the latest event per escalation is considered; older failed events are ignored once a newer event exists. */
  csPublishFailedEscalationEvents: Scalars['Int']['output'];
  /** Admin/Airflow hook: re-publish failed CS escalation side-effect events to active GraphQL subscribers. Only the latest event per escalation is considered; older failed events are ignored once a newer event exists. */
  csPublishPendingEscalationEvents: Scalars['Int']['output'];
  /** Write a manager response to a CS escalation and queue a local CS-agent wake event */
  csRespond: CsRespondResult;
  /** Publish a manual CS conversation signal that asks the assigned desktop to start a CS agent session */
  csStartSession: CsConversationSignal;
  /** Record a proposal decision. APPROVED executes the frozen intent; REJECTED reverses exactly one pure Sample Application review and is unsupported for multi-action or mixed proposals; REVISION_REQUESTED requires a concrete note. */
  decideActionProposal: ActionProposal;
  /** Delete an affiliate approval interception policy. */
  deleteAffiliateApprovalPolicy: Scalars['Boolean']['output'];
  /** Delete an empty draft Campaign that has no execution, Creator, or delivery history. */
  deleteAffiliateCampaignDraft: Scalars['Boolean']['output'];
  deleteExpertConversation: Scalars['Boolean']['output'];
  /** Delete a run profile */
  deleteRunProfile: Scalars['Boolean']['output'];
  /** Disconnect a shop (soft delete) */
  deleteShop: Scalars['Boolean']['output'];
  /** Delete a surface */
  deleteSurface: Scalars['Boolean']['output'];
  /** Disconnect one advertising account for the authenticated user. */
  disconnectAdsAdvertiser: Scalars['Boolean']['output'];
  dispatchExpertMessage: ExpertDispatchResult;
  /** Copy Campaign configuration and its immutable product snapshot into a new draft. */
  duplicateAffiliateCampaign: AffiliateCampaign;
  ecommerceApplyCSUnpaidOrderConfigVariantToBase: CsUnpaidOrderEvaluationView;
  /** Approve a cancellation request. Returns true on success. */
  ecommerceApproveCancellation: Scalars['Boolean']['output'];
  /** Approve a refund request. Returns true on success. */
  ecommerceApproveRefund: Scalars['Boolean']['output'];
  /** Approve a return/replacement request. Returns true on success. */
  ecommerceApproveReturn: Scalars['Boolean']['output'];
  ecommerceArchiveCSUnpaidOrderConfigExperimentDraft: CsUnpaidOrderConfigExperimentView;
  ecommerceCreateCSUnpaidOrderConfigExperimentDraft: CsUnpaidOrderConfigExperimentView;
  /** Create a new conversation with a buyer */
  ecommerceCreateConversation: CustomerServiceCreateConversationResult;
  /** Mark a conversation as read. Returns true on success. */
  ecommerceMarkConversationRead: Scalars['Boolean']['output'];
  ecommerceReplaceCSUnpaidOrderConfigExperiment: CsUnpaidOrderConfigExperimentView;
  /** Send a manual text reply in a CS conversation without waking or requiring an AI session. */
  ecommerceSendCustomerServiceTextReply: CustomerServiceSendMessageResult;
  /** Send a rich card (order, product, or logistics) in a CS conversation. */
  ecommerceSendMessage: CustomerServiceSendMessageResult;
  /** Enable or disable AI automation for one backend-materialized CS conversation. */
  ecommerceSetCustomerServiceConversationAiEnabled: CustomerServiceConversationInboxItem;
  ecommerceStartCSUnpaidOrderConfigExperiment: CsUnpaidOrderConfigExperimentView;
  ecommerceStopCSUnpaidOrderConfigExperiment: CsUnpaidOrderConfigExperimentView;
  ecommerceUpdateCSUnpaidOrderConfigExperimentDraft: CsUnpaidOrderConfigExperimentView;
  ecommerceUpdateCSUnpaidOrderReachoutSettings: CsUnpaidOrderEvaluationView;
  /** Update inventory for one or more shops. Each input item contains shopId and its SKU inventory updates. */
  ecommerceUpdateInventory: Array<EcomUpdateInventoryResult>;
  /** Update shop settings (agent-facing, flat params) */
  ecommerceUpdateShop: EcommerceUpdateShopResult;
  /** Activate, edit, or deactivate a product-level Open Collaboration sample rule. */
  editAffiliateOpenCollaborationSampleRule: EditAffiliateOpenCollaborationSampleRulePayload;
  /** Edit shop-wide TikTok Open Collaboration auto-add settings. */
  editAffiliateOpenCollaborationSettings: EditAffiliateOpenCollaborationSettingsPayload;
  /** Enroll in a product module */
  enrollModule: MeResponse;
  ensureAffiliateBusinessDevelopers: EnsureAffiliateBusinessDevelopersPayload;
  exchangeBrowserToDesktopLoginCode: AuthPayload;
  /** Exchange a native Google authorization code without exposing the client secret */
  exchangeDesktopGoogleCode: Scalars['String']['output'];
  /** Generate or retrieve a cached proxy URL for an external image/video URL. Requires login. */
  genOrGetCachedProxyUrl: MediaCachedProxy;
  /**
   * Legacy compatibility endpoint. Campaign AI generation now runs on the user's Desktop default model.
   * @deprecated Use the Desktop Campaign AI endpoint and validateAffiliateCampaignMessageTemplateSuggestion.
   */
  generateAffiliateCampaignMessageTemplate: AffiliateCampaignMessageTemplateSuggestion;
  /** Generate a 6-character pairing code for QR display */
  generatePairingCode: GeneratePairingResult;
  /** Authenticate a desktop client with Google and return a TK Copilot token pair */
  googleLogin: AuthPayload;
  /** Admin-only: grant complimentary service time. Stripe subscriptions are extended through Stripe trial_end; prepaid/manual subscriptions are extended locally. */
  grantBillingPromotion: BillingSubscription;
  importAffiliateCreatorProtections: ImportAffiliateCreatorProtectionsPayload;
  /** Generate a TikTok Ads OAuth authorization URL for the authenticated user. */
  initiateTikTokAdsOAuth: InitiateAdsOAuthResponse;
  /** Generate TikTok OAuth authorization URL */
  initiateTikTokOAuth: InitiateOAuthResponse;
  linkProductsToKnowledge: LinkProductsToKnowledgePayload;
  /** Log in with email and password */
  login: AuthPayload;
  /** Log out (revoke the provided refresh token) */
  logout: Scalars['Boolean']['output'];
  manageAffiliateOpenCollaboration: AffiliateShopOperationProposalPayload;
  manageAffiliateTargetCollaboration: AffiliateShopOperationProposalPayload;
  /** Promote a temporary uploaded image into permanent object storage and link it to an entity. Pass the assetId returned by POST /api/uploads/images; imageUri is accepted as a fallback. */
  promoteImageAsset: ImageAsset;
  protectAffiliateCreatorRelationship: AffiliateCreatorProtection;
  /** Return the current user's active original LLM API key for desktop sync. Requires an active RivonClaw AI subscription. If the user has no active key yet, one is created. */
  provisionLlmApiKey: LlmApiKey;
  /** Publish an official preset skill invalidation signal to connected desktop clients (admin only). */
  publishPresetSkillsChanged: PresetSkillsChangedPayload;
  /** Publish a ToolSpecs invalidation signal to connected desktop clients (admin only). */
  publishToolSpecsChanged: ToolSpecsChangedPayload;
  /** Publish an update notification to all connected clients (admin only) */
  publishUpdate: Scalars['Boolean']['output'];
  /** Record an impression, dismissal, or action click for a server-driven announcement. */
  recordAnnouncementEvent: Scalars['Boolean']['output'];
  /** Query the provider and refresh a payment's status. */
  refreshPayment: Payment;
  /** Refresh an expired access token */
  refreshToken: AuthPayload;
  /** Refresh connection state for a WhatsApp account binding from Evolution API. */
  refreshWhatsAppAccountBinding: WhatsAppAccountBinding;
  /** Refund a Stripe or Lakala payment. */
  refundPayment: Payment;
  /** Register a new user account */
  register: AuthPayload;
  registerExpertKnowledgeRelease: ExpertKnowledgeRelease;
  removeAffiliateCreatorProtection: AffiliateCreatorProtectionRemovalPayload;
  removeAffiliateCreatorRelationshipProtection: AffiliateCreatorProtectionRemovalPayload;
  /** Disable one product's TikTok Open Collaboration and immediately mark it terminating. */
  removeAffiliateOpenCollaboration: RemoveAffiliateOpenCollaborationPayload;
  /** Remove a TikTok Target Collaboration and immediately mark it terminating. */
  removeAffiliateTargetCollaboration: RemoveAffiliateTargetCollaborationPayload;
  /** Remove a shop-scoped tag from a user-level creator relation. */
  removeCreatorTag: AffiliateCreatorRelationship;
  renameExpertConversation: ExpertConversation;
  reportAffiliateCampaignSearchPlanGenerationFailure: AffiliateCampaignSearchPlan;
  /** Desktop-only: report that this authenticated desktop client is online for an admin device probe. */
  reportDevicePresenceProbe: Scalars['Boolean']['output'];
  /** Request a new captcha challenge */
  requestCaptcha: CaptchaResponse;
  /** Request one user's authenticated desktop client to upload its current local log (admin only) */
  requestClientLogUpload: ClientLogUploadRequestPayload;
  /** Request/create TikTok GMV Max exclusive authorization for an advertiser-store access row. */
  requestTikTokGmvMaxAuthorization: AdsStoreAccess;
  /** Resolve one affiliate work item. Every completed REQUEST_ACTION or NO_ACTION_NEEDED result is persisted as an ActionProposal work bundle; policy and evidence review decide whether it waits for staff or executes automatically. */
  resolveAffiliateWorkItem: ResolveAffiliateWorkItemPayload;
  restoreProductKnowledge: ProductKnowledge;
  /** Retry a deterministic Affiliate Agent failure. This clears only the relationship-level Agent failure marker, recomputes the authoritative working agenda, and republishes eligible work. */
  retryAffiliateAgentFailure: AffiliateCreatorRelationshipStatePayload;
  retryAffiliateCampaignSearchPlanGeneration: AffiliateCampaignSearchPlan;
  /** Revoke all sessions for the current user (remote logout) */
  revokeAllSessions: Scalars['Int']['output'];
  /** Revoke an Outlook/Microsoft Graph email account binding. */
  revokeEmailAccountBinding: EmailAccountBinding;
  /** Logout or delete a WhatsApp account binding and mark it revoked. */
  revokeWhatsAppAccountBinding: WhatsAppAccountBinding;
  /** Send a human-authored affiliate creator message from the CreatorRelationship workspace. */
  sendAffiliateCreatorMessage: SendAffiliateCreatorMessagePayload;
  setAffiliateBusinessDeveloperPreferredAccount: AffiliateBusinessDeveloper;
  /** Activate, pause, complete, or archive an Affiliate Campaign. */
  setAffiliateCampaignStatus: AffiliateCampaign;
  /** Attach or update a creator email contact on an affiliate creator relationship. */
  setAffiliateCreatorEmail: AffiliateCreatorRelationship;
  /** Attach or update a creator WhatsApp contact on an affiliate creator relationship. */
  setAffiliateCreatorWhatsApp: AffiliateCreatorRelationship;
  /** Admin-only: enable or disable an agent invite code for a user by email. */
  setAgentInvite: MeResponse;
  /** Set or clear the default RunProfile for the current user */
  setDefaultRunProfile: MeResponse;
  /** Single frontend entry point for paid billing. The backend decides whether to create a Stripe Checkout, resume a scheduled Stripe cancellation, return ALREADY_ACTIVE, create a Stripe trial that starts after existing free/prepaid access ends, process a Stripe upgrade, or create a Lakala prepaid QR payment. */
  startBillingSubscription: StartBillingSubscriptionResult;
  startBrowserToDesktopLogin: BrowserToDesktopLoginStart;
  /** Start the one-time 7-day / 100 conversation customer-service trial for a shop. */
  startCustomerServiceTrial: EntitlementGrant;
  /** Start Outlook/Microsoft Graph OAuth onboarding for a seller mailbox. */
  startMicrosoftEmailOAuth: StartMicrosoftEmailOAuthPayload;
  startWebSessionTransfer: WebSessionTransferStart;
  /** Create/connect the Evolution instance and return WhatsApp QR onboarding data. */
  startWhatsAppQrOnboarding: StartWhatsAppQrOnboardingPayload;
  submitAffiliateCampaignSearchPlan: AffiliateCampaignSearchPlan;
  /** Queue an Airflow refresh of stores/shops visible to a connected TikTok Ads advertiser and return the current snapshot. */
  syncAdsStoreAccesses: Array<AdsStoreAccess>;
  /** Pull platform warehouse lists for one shop and auto-map official fulfillment warehouses when possible. */
  syncShopWarehouses: ShopWarehouseSyncPayload;
  /** Import inventory goods from a WMS account into canonical InventoryGood. When overrideExisting is false or omitted, existing InventoryGood rows win and are preserved. When true, WMS attributes overwrite existing rows with the same SKU. */
  syncWmsInventoryGoods: SyncWmsInventoryGoodsPayload;
  /** Pull warehouses from one WMS account and upsert canonical Warehouse records. */
  syncWmsWarehouses: WmsWarehouseSyncPayload;
  tiktokIngestSellerDeauthorizationWebhook: TikTokSellerDeauthorizationWebhookResult;
  unassignAffiliateEmailAccount: EmailAccountBinding;
  unassignAffiliateWhatsAppAccount: WhatsAppAccountBinding;
  /** Unenroll from a product module */
  unenrollModule: MeResponse;
  unlinkProductKnowledgeBinding: Scalars['Boolean']['output'];
  updateAffiliateCreatorChannelContact: AffiliateCreatorChannelContact;
  /** Patch a TikTok Target Collaboration without clearing unspecified Provider fields. */
  updateAffiliateTargetCollaboration: UpdateAffiliateTargetCollaborationPayload;
  updateExpertMessage: ExpertMessage;
  updateProductKnowledge: ProductKnowledge;
  /** Update an existing run profile */
  updateRunProfile?: Maybe<RunProfile>;
  /** Update an existing shop */
  updateShop?: Maybe<Shop>;
  /** Update an existing surface */
  updateSurface?: Maybe<Surface>;
  /** Update a user-owned WhatsApp egress proxy. */
  updateWhatsAppProxy: WhatsAppProxy;
  upsertExpertProfile: ExpertProfile;
  /** Strictly validate a Desktop-local AI first-touch template against Campaign safety rules. */
  validateAffiliateCampaignMessageTemplateSuggestion: AffiliateCampaignMessageTemplateSuggestion;
  /** Verify a pairing code from mobile and create relay token */
  verifyPairingCode: VerifyPairingResult;
  /** Authenticate a browser with Google and store the refresh token in an HttpOnly cookie */
  webGoogleLogin: WebAuthPayload;
  /** Log in from a browser and store the rotating refresh token in an HttpOnly cookie */
  webLogin: WebAuthPayload;
  /** Revoke and clear the browser refresh cookie */
  webLogout: Scalars['Boolean']['output'];
  /** Rotate the browser refresh cookie and return a new in-memory access token */
  webRefresh: WebAuthPayload;
  /** Register in a browser and store the rotating refresh token in an HttpOnly cookie */
  webRegister: WebAuthPayload;
  /** Create or update an affiliate approval interception policy. */
  writeAffiliateApprovalPolicy: AffiliateApprovalPolicy;
  writeAffiliateBusinessDeveloper: AffiliateBusinessDeveloper;
  /** Create or update an affiliate campaign. */
  writeAffiliateCampaign: AffiliateCampaign;
  writeAffiliateCreatorChannelContact: AffiliateCreatorChannelContact;
  /** Create or update a campaign product setup row. */
  writeCampaignProduct: CampaignProduct;
  /** Create or update a concrete creator marketplace search run. This is platform/search audit state, not workflow planning state. */
  writeCreatorSearchRun: CreatorSearchRun;
  /** Create or update a creator tag. */
  writeCreatorTag: CreatorTag;
  /** Write external SKU to InventoryGood mappings in batch. Omit id to locate by sourceSystem + sourceId + sellerSku or create a new mapping. */
  writeInventoryGoodMappings: Array<InventoryGoodMapping>;
  /** Write canonical stockable inventory goods in batch. Omit id to locate by exact sku or create a new good. */
  writeInventoryGoods: Array<InventoryGood>;
  /** Write shop warehouse mappings in batch. Use this after AI or user confirms platform warehouse to canonical warehouse matches. */
  writeShopWarehouseMappings: Array<ShopWarehouse>;
  /** Write canonical warehouses in batch. Omit input.id to create; pass input.id to update. */
  writeWarehouses: Array<Warehouse>;
  /** Write WMS accounts in batch. New accounts and endpoint/apiToken changes automatically sync warehouses. apiToken is write-only. */
  writeWmsAccounts: Array<WriteWmsAccountPayload>;
}


export interface MutationActivateExpertKnowledgeReleaseArgs {
  releaseId: Scalars['ID']['input'];
}


export interface MutationAdminProbeUserDevicesArgs {
  email: Scalars['String']['input'];
  timeoutMs?: InputMaybe<Scalars['Int']['input']>;
}


export interface MutationAdminRequestClientLogUploadArgs {
  deviceId: Scalars['String']['input'];
  email: Scalars['String']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
}


export interface MutationAdminSetDebugChannelArgs {
  deviceId: Scalars['String']['input'];
  email: Scalars['String']['input'];
  enabled: Scalars['Boolean']['input'];
}


export interface MutationAffiliatePublishRelationshipSignalArgs {
  input: PublishAffiliateRelationshipSignalInput;
}


export interface MutationApplyCreatorTagArgs {
  input: ApplyCreatorTagInput;
}


export interface MutationApproveBrowserToDesktopLoginArgs {
  ticket: Scalars['String']['input'];
}


export interface MutationArchiveAffiliateBusinessDeveloperArgs {
  id: Scalars['ID']['input'];
}


export interface MutationArchiveProductKnowledgeArgs {
  expectedRevision: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
}


export interface MutationAssignAffiliateBusinessDeveloperArgs {
  input: AssignAffiliateBusinessDeveloperInput;
}


export interface MutationAssignAffiliateEmailAccountArgs {
  accountBindingId: Scalars['ID']['input'];
  businessDeveloperId: Scalars['ID']['input'];
}


export interface MutationAssignAffiliateWhatsAppAccountArgs {
  accountBindingId: Scalars['ID']['input'];
  businessDeveloperId: Scalars['ID']['input'];
}


export interface MutationAssignManualBillingSubscriptionArgs {
  ownerUserId?: InputMaybe<Scalars['String']['input']>;
  planId: BillingPlanId;
  scopeId: Scalars['String']['input'];
  scopeType: BillingScopeType;
}


export interface MutationAssignOnboardingTrialWindowArgs {
  ownerUserId: Scalars['String']['input'];
  validUntil: Scalars['DateTimeISO']['input'];
}


export interface MutationCancelBillingSubscriptionAtPeriodEndArgs {
  input: CancelBillingSubscriptionInput;
}


export interface MutationCancelExpertRunArgs {
  runId: Scalars['ID']['input'];
}


export interface MutationCheckAffiliateCreatorWhatsAppArgs {
  input: CheckCreatorWhatsAppContactInput;
}


export interface MutationClaimAffiliateCampaignSearchPlanGenerationArgs {
  input: ClaimAffiliateCampaignSearchPlanGenerationInput;
}


export interface MutationCompleteMicrosoftEmailOAuthArgs {
  input: CompleteMicrosoftEmailOAuthInput;
}


export interface MutationCompleteTikTokAdsOAuthArgs {
  authCode: Scalars['String']['input'];
  state: Scalars['String']['input'];
}


export interface MutationCompleteTikTokOAuthArgs {
  code: Scalars['String']['input'];
  serviceId?: InputMaybe<Scalars['String']['input']>;
  state?: InputMaybe<Scalars['String']['input']>;
}


export interface MutationConsumeDesktopToWebLoginArgs {
  ticket: Scalars['String']['input'];
}


export interface MutationConsumeTikTokOAuthBrowserStartArgs {
  ticket: Scalars['String']['input'];
}


export interface MutationConsumeWebSessionTransferArgs {
  ticket: Scalars['String']['input'];
}


export interface MutationCreateAffiliateOpenCollaborationArgs {
  input: CreateAffiliateOpenCollaborationInput;
}


export interface MutationCreateAffiliateTargetCollaborationArgs {
  input: CreateAffiliateTargetCollaborationInput;
}


export interface MutationCreateDesktopToWebLoginArgs {
  returnPath: Scalars['String']['input'];
  surface?: InputMaybe<WebAppSurface>;
}


export interface MutationCreatePaymentArgs {
  input: CreatePaymentGraphqlInput;
}


export interface MutationCreateProductKnowledgeArgs {
  input: CreateProductKnowledgeInput;
}


export interface MutationCreateRunProfileArgs {
  input: CreateRunProfileInput;
}


export interface MutationCreateStripeBillingPortalSessionArgs {
  input: CreateStripeBillingPortalSessionInput;
}


export interface MutationCreateSurfaceArgs {
  input: CreateSurfaceInput;
}


export interface MutationCreateWhatsAppAccountBindingArgs {
  proxyId?: InputMaybe<Scalars['ID']['input']>;
}


export interface MutationCreateWhatsAppProxyArgs {
  input: CreateWhatsAppProxyInput;
}


export interface MutationCsAckEscalationEventArgs {
  input: AckCsEscalationEventInput;
}


export interface MutationCsAcknowledgeConversationHandledArgs {
  conversationId: Scalars['String']['input'];
  messageId: Scalars['String']['input'];
  messageIndex?: InputMaybe<Scalars['String']['input']>;
  shopId: Scalars['ID']['input'];
}


export interface MutationCsClaimEscalationEventArgs {
  input: ClaimCsEscalationEventInput;
}


export interface MutationCsDismissConversationEscalationsArgs {
  conversationId: Scalars['String']['input'];
  shopId: Scalars['ID']['input'];
}


export interface MutationCsDismissEscalationArgs {
  escalationId: Scalars['ID']['input'];
}


export interface MutationCsEndCustomerServiceSessionArgs {
  conversationId: Scalars['String']['input'];
  shopId: Scalars['ID']['input'];
}


export interface MutationCsEndSessionArgs {
  conversationId: Scalars['String']['input'];
  followUpMessage?: InputMaybe<Scalars['String']['input']>;
  reviewRequestMessage?: InputMaybe<Scalars['String']['input']>;
  shopId: Scalars['ID']['input'];
}


export interface MutationCsEscalateArgs {
  buyerNickname?: InputMaybe<Scalars['String']['input']>;
  buyerUserId: Scalars['String']['input'];
  context?: InputMaybe<Scalars['String']['input']>;
  conversationId: Scalars['String']['input'];
  orderId?: InputMaybe<Scalars['String']['input']>;
  reason: Scalars['String']['input'];
  shopId: Scalars['ID']['input'];
}


export interface MutationCsGetOrCreateSessionArgs {
  conversationId: Scalars['String']['input'];
  shopId: Scalars['ID']['input'];
}


export interface MutationCsIngestOrderStatusWebhookArgs {
  input: CsOrderStatusWebhookInput;
}


export interface MutationCsPublishConversationSignalArgs {
  input: PublishCsConversationSignalInput;
}


export interface MutationCsPublishFailedEscalationEventsArgs {
  limit?: InputMaybe<Scalars['Int']['input']>;
}


export interface MutationCsPublishPendingEscalationEventsArgs {
  limit?: InputMaybe<Scalars['Int']['input']>;
}


export interface MutationCsRespondArgs {
  decision: Scalars['String']['input'];
  escalationId: Scalars['ID']['input'];
  instructions: Scalars['String']['input'];
  resolved?: Scalars['Boolean']['input'];
}


export interface MutationCsStartSessionArgs {
  buyerUserId?: InputMaybe<Scalars['String']['input']>;
  conversationId?: InputMaybe<Scalars['String']['input']>;
  operatorInstruction?: InputMaybe<Scalars['String']['input']>;
  orderId?: InputMaybe<Scalars['String']['input']>;
  shopId: Scalars['ID']['input'];
}


export interface MutationDecideActionProposalArgs {
  input: DecideActionProposalInput;
}


export interface MutationDeleteAffiliateApprovalPolicyArgs {
  id: Scalars['String']['input'];
}


export interface MutationDeleteAffiliateCampaignDraftArgs {
  input: DeleteAffiliateCampaignDraftInput;
}


export interface MutationDeleteExpertConversationArgs {
  id: Scalars['ID']['input'];
}


export interface MutationDeleteRunProfileArgs {
  id: Scalars['ID']['input'];
}


export interface MutationDeleteShopArgs {
  id: Scalars['ID']['input'];
}


export interface MutationDeleteSurfaceArgs {
  id: Scalars['ID']['input'];
}


export interface MutationDisconnectAdsAdvertiserArgs {
  id: Scalars['ID']['input'];
}


export interface MutationDispatchExpertMessageArgs {
  conversationId: Scalars['ID']['input'];
  idempotencyKey: Scalars['String']['input'];
  imageAssetIds?: Array<Scalars['ID']['input']>;
  replaceMessageId?: InputMaybe<Scalars['ID']['input']>;
  text: Scalars['String']['input'];
}


export interface MutationDuplicateAffiliateCampaignArgs {
  input: DuplicateAffiliateCampaignInput;
}


export interface MutationEcommerceApplyCsUnpaidOrderConfigVariantToBaseArgs {
  experimentId: Scalars['ID']['input'];
  variantKey: Scalars['String']['input'];
}


export interface MutationEcommerceApproveCancellationArgs {
  buyerUserId?: InputMaybe<Scalars['String']['input']>;
  cancelId: Scalars['String']['input'];
  shopId: Scalars['String']['input'];
}


export interface MutationEcommerceApproveRefundArgs {
  amount?: InputMaybe<Scalars['String']['input']>;
  buyerKeepItem?: InputMaybe<Scalars['Boolean']['input']>;
  buyerUserId?: InputMaybe<Scalars['String']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  decision?: InputMaybe<EcomApproveRefundDecision>;
  returnId: Scalars['String']['input'];
  shopId: Scalars['String']['input'];
}


export interface MutationEcommerceApproveReturnArgs {
  buyerUserId?: InputMaybe<Scalars['String']['input']>;
  decision: EcomApproveReturnDecision;
  returnId: Scalars['String']['input'];
  shopId: Scalars['String']['input'];
}


export interface MutationEcommerceArchiveCsUnpaidOrderConfigExperimentDraftArgs {
  experimentId: Scalars['ID']['input'];
}


export interface MutationEcommerceCreateCsUnpaidOrderConfigExperimentDraftArgs {
  input: CsUnpaidOrderConfigExperimentInput;
}


export interface MutationEcommerceCreateConversationArgs {
  buyerUserId: Scalars['String']['input'];
  shopId: Scalars['String']['input'];
}


export interface MutationEcommerceMarkConversationReadArgs {
  conversationId: Scalars['String']['input'];
  shopId: Scalars['String']['input'];
}


export interface MutationEcommerceReplaceCsUnpaidOrderConfigExperimentArgs {
  input: CsUnpaidOrderConfigExperimentInput;
}


export interface MutationEcommerceSendCustomerServiceTextReplyArgs {
  conversationId: Scalars['String']['input'];
  message: Scalars['String']['input'];
  shopId: Scalars['String']['input'];
}


export interface MutationEcommerceSendMessageArgs {
  content: Scalars['String']['input'];
  conversationId: Scalars['String']['input'];
  shopId: Scalars['String']['input'];
  type: EcomMessageType;
}


export interface MutationEcommerceSetCustomerServiceConversationAiEnabledArgs {
  aiEnabled: Scalars['Boolean']['input'];
  conversationId: Scalars['String']['input'];
  shopId: Scalars['String']['input'];
}


export interface MutationEcommerceStartCsUnpaidOrderConfigExperimentArgs {
  expectedRunningExperimentId?: InputMaybe<Scalars['ID']['input']>;
  experimentId: Scalars['ID']['input'];
}


export interface MutationEcommerceStopCsUnpaidOrderConfigExperimentArgs {
  experimentId: Scalars['ID']['input'];
}


export interface MutationEcommerceUpdateCsUnpaidOrderConfigExperimentDraftArgs {
  experimentId: Scalars['ID']['input'];
  input: CsUnpaidOrderConfigExperimentInput;
}


export interface MutationEcommerceUpdateCsUnpaidOrderReachoutSettingsArgs {
  input: CsUnpaidOrderReachoutSettingsInput;
}


export interface MutationEcommerceUpdateInventoryArgs {
  updates: Array<EcomShopUpdateInventoryInput>;
}


export interface MutationEcommerceUpdateShopArgs {
  alias?: InputMaybe<Scalars['String']['input']>;
  customerServiceSettings?: InputMaybe<AgentCsSettingsInput>;
  shopId: Scalars['String']['input'];
  wmsSettings?: InputMaybe<WmsSettingsInput>;
}


export interface MutationEditAffiliateOpenCollaborationSampleRuleArgs {
  input: EditAffiliateOpenCollaborationSampleRuleInput;
}


export interface MutationEditAffiliateOpenCollaborationSettingsArgs {
  input: EditAffiliateOpenCollaborationSettingsInput;
}


export interface MutationEnrollModuleArgs {
  moduleId: ModuleId;
}


export interface MutationEnsureAffiliateBusinessDevelopersArgs {
  input: EnsureAffiliateBusinessDevelopersInput;
}


export interface MutationExchangeBrowserToDesktopLoginCodeArgs {
  input: BrowserToDesktopCodeInput;
}


export interface MutationExchangeDesktopGoogleCodeArgs {
  input: DesktopGoogleCodeExchangeInput;
}


export interface MutationGenOrGetCachedProxyUrlArgs {
  sourceUrl: Scalars['String']['input'];
}


export interface MutationGenerateAffiliateCampaignMessageTemplateArgs {
  input: GenerateAffiliateCampaignMessageTemplateInput;
}


export interface MutationGeneratePairingCodeArgs {
  desktopDeviceId: Scalars['String']['input'];
}


export interface MutationGoogleLoginArgs {
  input: GoogleLoginInput;
}


export interface MutationGrantBillingPromotionArgs {
  input: GrantBillingPromotionInput;
}


export interface MutationImportAffiliateCreatorProtectionsArgs {
  input: ImportAffiliateCreatorProtectionsInput;
}


export interface MutationInitiateTikTokOAuthArgs {
  platformAppId: Scalars['ID']['input'];
}


export interface MutationLinkProductsToKnowledgeArgs {
  input: LinkProductsToKnowledgeInput;
}


export interface MutationLoginArgs {
  input: LoginInput;
}


export interface MutationLogoutArgs {
  refreshToken: Scalars['String']['input'];
}


export interface MutationManageAffiliateOpenCollaborationArgs {
  input: ManageAffiliateOpenCollaborationInput;
}


export interface MutationManageAffiliateTargetCollaborationArgs {
  input: ManageAffiliateTargetCollaborationInput;
}


export interface MutationPromoteImageAssetArgs {
  input: PromoteImageAssetInput;
}


export interface MutationProtectAffiliateCreatorRelationshipArgs {
  input: ProtectAffiliateCreatorRelationshipInput;
}


export interface MutationPublishPresetSkillsChangedArgs {
  reason?: InputMaybe<Scalars['String']['input']>;
}


export interface MutationPublishToolSpecsChangedArgs {
  changeType?: InputMaybe<Scalars['String']['input']>;
  reason?: InputMaybe<Scalars['String']['input']>;
}


export interface MutationPublishUpdateArgs {
  version: Scalars['String']['input'];
}


export interface MutationRecordAnnouncementEventArgs {
  input: RecordAnnouncementEventInput;
}


export interface MutationRefreshPaymentArgs {
  paymentId: Scalars['ID']['input'];
}


export interface MutationRefreshTokenArgs {
  refreshToken: Scalars['String']['input'];
}


export interface MutationRefreshWhatsAppAccountBindingArgs {
  bindingId: Scalars['ID']['input'];
}


export interface MutationRefundPaymentArgs {
  input: RefundPaymentGraphqlInput;
}


export interface MutationRegisterArgs {
  input: RegisterInput;
}


export interface MutationRegisterExpertKnowledgeReleaseArgs {
  input: RegisterExpertKnowledgeReleaseInput;
}


export interface MutationRemoveAffiliateCreatorProtectionArgs {
  id: Scalars['ID']['input'];
}


export interface MutationRemoveAffiliateCreatorRelationshipProtectionArgs {
  creatorRelationshipId: Scalars['ID']['input'];
}


export interface MutationRemoveAffiliateOpenCollaborationArgs {
  input: RemoveAffiliateOpenCollaborationInput;
}


export interface MutationRemoveAffiliateTargetCollaborationArgs {
  input: RemoveAffiliateTargetCollaborationInput;
}


export interface MutationRemoveCreatorTagArgs {
  input: ApplyCreatorTagInput;
}


export interface MutationRenameExpertConversationArgs {
  id: Scalars['ID']['input'];
  title: Scalars['String']['input'];
}


export interface MutationReportAffiliateCampaignSearchPlanGenerationFailureArgs {
  input: ReportAffiliateCampaignSearchPlanGenerationFailureInput;
}


export interface MutationReportDevicePresenceProbeArgs {
  input: AdminDevicePresenceProbeResponseInput;
}


export interface MutationRequestCaptchaArgs {
  deterministicToken?: InputMaybe<Scalars['String']['input']>;
}


export interface MutationRequestClientLogUploadArgs {
  deviceId?: InputMaybe<Scalars['String']['input']>;
  email: Scalars['String']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
}


export interface MutationRequestTikTokGmvMaxAuthorizationArgs {
  adsAdvertiserId: Scalars['ID']['input'];
  adsStoreAccessId: Scalars['ID']['input'];
}


export interface MutationResolveAffiliateWorkItemArgs {
  input: ResolveAffiliateWorkItemInput;
}


export interface MutationRestoreProductKnowledgeArgs {
  expectedRevision: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
}


export interface MutationRetryAffiliateAgentFailureArgs {
  creatorRelationshipId: Scalars['ID']['input'];
}


export interface MutationRetryAffiliateCampaignSearchPlanGenerationArgs {
  campaignId: Scalars['ID']['input'];
}


export interface MutationRevokeEmailAccountBindingArgs {
  bindingId: Scalars['ID']['input'];
}


export interface MutationRevokeWhatsAppAccountBindingArgs {
  bindingId: Scalars['ID']['input'];
  deleteInstance?: InputMaybe<Scalars['Boolean']['input']>;
}


export interface MutationSendAffiliateCreatorMessageArgs {
  input: SendAffiliateCreatorMessageInput;
}


export interface MutationSetAffiliateBusinessDeveloperPreferredAccountArgs {
  input: SetAffiliateBusinessDeveloperPreferredAccountInput;
}


export interface MutationSetAffiliateCampaignStatusArgs {
  input: SetAffiliateCampaignStatusInput;
}


export interface MutationSetAffiliateCreatorEmailArgs {
  input: SetCreatorEmailContactInput;
}


export interface MutationSetAffiliateCreatorWhatsAppArgs {
  input: SetCreatorWhatsAppContactInput;
}


export interface MutationSetAgentInviteArgs {
  active: Scalars['Boolean']['input'];
  email: Scalars['String']['input'];
}


export interface MutationSetDefaultRunProfileArgs {
  runProfileId?: InputMaybe<Scalars['String']['input']>;
}


export interface MutationStartBillingSubscriptionArgs {
  input: StartBillingSubscriptionInput;
}


export interface MutationStartBrowserToDesktopLoginArgs {
  input: BrowserToDesktopLoginInput;
}


export interface MutationStartCustomerServiceTrialArgs {
  shopId: Scalars['ID']['input'];
}


export interface MutationStartMicrosoftEmailOAuthArgs {
  input?: InputMaybe<StartMicrosoftEmailOAuthInput>;
}


export interface MutationStartWebSessionTransferArgs {
  returnPath: Scalars['String']['input'];
  targetSurface: WebAppSurface;
}


export interface MutationStartWhatsAppQrOnboardingArgs {
  input: StartWhatsAppQrOnboardingInput;
}


export interface MutationSubmitAffiliateCampaignSearchPlanArgs {
  input: SubmitAffiliateCampaignSearchPlanInput;
}


export interface MutationSyncAdsStoreAccessesArgs {
  adsAdvertiserId: Scalars['ID']['input'];
}


export interface MutationSyncShopWarehousesArgs {
  shopId: Scalars['ID']['input'];
}


export interface MutationSyncWmsInventoryGoodsArgs {
  overrideExisting?: InputMaybe<Scalars['Boolean']['input']>;
  wmsAccountId: Scalars['ID']['input'];
}


export interface MutationSyncWmsWarehousesArgs {
  wmsAccountId: Scalars['ID']['input'];
}


export interface MutationTiktokIngestSellerDeauthorizationWebhookArgs {
  input: TikTokSellerDeauthorizationWebhookInput;
}


export interface MutationUnassignAffiliateEmailAccountArgs {
  accountBindingId: Scalars['ID']['input'];
}


export interface MutationUnassignAffiliateWhatsAppAccountArgs {
  accountBindingId: Scalars['ID']['input'];
}


export interface MutationUnenrollModuleArgs {
  moduleId: ModuleId;
}


export interface MutationUnlinkProductKnowledgeBindingArgs {
  bindingId: Scalars['ID']['input'];
}


export interface MutationUpdateAffiliateCreatorChannelContactArgs {
  input: UpdateAffiliateCreatorChannelContactInput;
}


export interface MutationUpdateAffiliateTargetCollaborationArgs {
  input: UpdateAffiliateTargetCollaborationInput;
}


export interface MutationUpdateExpertMessageArgs {
  content: Scalars['String']['input'];
  id: Scalars['ID']['input'];
}


export interface MutationUpdateProductKnowledgeArgs {
  input: UpdateProductKnowledgeInput;
}


export interface MutationUpdateRunProfileArgs {
  id: Scalars['ID']['input'];
  input: UpdateRunProfileInput;
}


export interface MutationUpdateShopArgs {
  id: Scalars['ID']['input'];
  input: UpdateShopInput;
}


export interface MutationUpdateSurfaceArgs {
  id: Scalars['ID']['input'];
  input: UpdateSurfaceInput;
}


export interface MutationUpdateWhatsAppProxyArgs {
  input: UpdateWhatsAppProxyInput;
}


export interface MutationUpsertExpertProfileArgs {
  input: UpsertExpertProfileInput;
}


export interface MutationValidateAffiliateCampaignMessageTemplateSuggestionArgs {
  input: ValidateAffiliateCampaignMessageTemplateSuggestionInput;
}


export interface MutationVerifyPairingCodeArgs {
  mobileDeviceId: Scalars['String']['input'];
  pairingCode: Scalars['String']['input'];
}


export interface MutationWebGoogleLoginArgs {
  input: GoogleLoginInput;
}


export interface MutationWebLoginArgs {
  input: LoginInput;
}


export interface MutationWebRegisterArgs {
  input: RegisterInput;
}


export interface MutationWriteAffiliateApprovalPolicyArgs {
  input: WriteAffiliateApprovalPolicyInput;
}


export interface MutationWriteAffiliateBusinessDeveloperArgs {
  input: WriteAffiliateBusinessDeveloperInput;
}


export interface MutationWriteAffiliateCampaignArgs {
  input: WriteAffiliateCampaignInput;
}


export interface MutationWriteAffiliateCreatorChannelContactArgs {
  input: WriteAffiliateCreatorChannelContactInput;
}


export interface MutationWriteCampaignProductArgs {
  input: WriteCampaignProductInput;
}


export interface MutationWriteCreatorSearchRunArgs {
  input: WriteCreatorSearchRunInput;
}


export interface MutationWriteCreatorTagArgs {
  input: WriteCreatorTagInput;
}


export interface MutationWriteInventoryGoodMappingsArgs {
  inputs: Array<WriteInventoryGoodMappingInput>;
}


export interface MutationWriteInventoryGoodsArgs {
  inputs: Array<WriteInventoryGoodInput>;
}


export interface MutationWriteShopWarehouseMappingsArgs {
  inputs: Array<WriteShopWarehouseMappingInput>;
}


export interface MutationWriteWarehousesArgs {
  inputs: Array<WriteWarehouseInput>;
}


export interface MutationWriteWmsAccountsArgs {
  inputs: Array<WriteWmsAccountInput>;
}

/** OAuth flow completed payload (e.g. TikTok shop authorization) */
export interface OAuthCompletePayload {
  platform: Scalars['String']['output'];
  shopId: Scalars['String']['output'];
  shopName: Scalars['String']['output'];
  /** All shops connected by this OAuth callback. */
  shops: Array<Shop>;
}

export interface OAuthShopResponse {
  shopId: Scalars['ID']['output'];
  shopName: Scalars['String']['output'];
}

/** Unified payment record across payment providers. */
export interface Payment {
  /** Amount in the currency minor unit: cents for USD, fen for CNY. */
  amountMinor: Scalars['Int']['output'];
  billingActivatedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  billingPlanId?: Maybe<BillingPlanId>;
  billingProduct?: Maybe<BillableProduct>;
  billingScopeId?: Maybe<Scalars['String']['output']>;
  billingScopeType?: Maybe<BillingScopeType>;
  /** For Stripe subscription checkouts created during an existing free/prepaid entitlement, billing starts after this trial end. */
  billingTrialEnd?: Maybe<Scalars['DateTimeISO']['output']>;
  /** Redirect checkout URL when the provider creates one. */
  checkoutUrl?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTimeISO']['output'];
  currency: Currency;
  description?: Maybe<Scalars['String']['output']>;
  expiresAt?: Maybe<Scalars['DateTimeISO']['output']>;
  id: Scalars['ID']['output'];
  /** Last provider error code or message. */
  lastError?: Maybe<Scalars['String']['output']>;
  lastProviderEventAt?: Maybe<Scalars['DateTimeISO']['output']>;
  /** EasyClaw merchant order ID sent to the provider. */
  merchantOrderId: Scalars['String']['output'];
  method: PaymentMethod;
  paidAt?: Maybe<Scalars['DateTimeISO']['output']>;
  provider: PaymentProviderName;
  /** Provider customer ID, such as a Stripe customer ID. */
  providerCustomerId?: Maybe<Scalars['String']['output']>;
  /** Provider order/transaction ID, such as Lakala transactionId. */
  providerOrderId?: Maybe<Scalars['String']['output']>;
  /** Provider primary payment/session ID, such as Stripe checkout session ID. */
  providerPaymentId?: Maybe<Scalars['String']['output']>;
  /** Provider recurring subscription ID, such as a Stripe subscription ID. */
  providerSubscriptionId?: Maybe<Scalars['String']['output']>;
  /** QR payload the client should encode into a QR image. For Lakala aggregate QR this is a short-lived payment URL, not an image URL. */
  qrCode?: Maybe<Scalars['String']['output']>;
  status: PaymentStatus;
  subject: Scalars['String']['output'];
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['String']['output'];
}

/** Public, limited checkout status for a payment callback page. */
export interface PaymentCheckoutStatus {
  amountMinor: Scalars['Int']['output'];
  currency: Currency;
  method: PaymentMethod;
  paidAt?: Maybe<Scalars['DateTimeISO']['output']>;
  provider: PaymentProviderName;
  status: PaymentStatus;
  subject: Scalars['String']['output'];
  updatedAt?: Maybe<Scalars['DateTimeISO']['output']>;
}

/** Customer-facing payment method family. */
export const PaymentMethod = {
  Card: 'CARD',
  QrCode: 'QR_CODE'
} as const;

export type PaymentMethod = typeof PaymentMethod[keyof typeof PaymentMethod];
/** External payment processor used for a payment. */
export const PaymentProviderName = {
  Lakala: 'LAKALA',
  Stripe: 'STRIPE'
} as const;

export type PaymentProviderName = typeof PaymentProviderName[keyof typeof PaymentProviderName];
/** Unified payment lifecycle state. */
export const PaymentStatus = {
  Canceled: 'CANCELED',
  Expired: 'EXPIRED',
  Failed: 'FAILED',
  PartiallyRefunded: 'PARTIALLY_REFUNDED',
  Pending: 'PENDING',
  Refunded: 'REFUNDED',
  RequiresPayment: 'REQUIRES_PAYMENT',
  Succeeded: 'SUCCEEDED'
} as const;

export type PaymentStatus = typeof PaymentStatus[keyof typeof PaymentStatus];
export const PendingTikTokShopClaimStatus = {
  Claimed: 'CLAIMED',
  Claiming: 'CLAIMING',
  Expired: 'EXPIRED',
  Pending: 'PENDING',
  Revoked: 'REVOKED'
} as const;

export type PendingTikTokShopClaimStatus = typeof PendingTikTokShopClaimStatus[keyof typeof PendingTikTokShopClaimStatus];
export interface PendingTikTokShopClaimView {
  expiresAt: Scalars['DateTimeISO']['output'];
  requiresExistingAccount: Scalars['Boolean']['output'];
  shops: Array<TikTokShopClaimShop>;
  status: PendingTikTokShopClaimStatus;
}

export interface PersistentResultArtifact {
  archiveSha256: Scalars['String']['output'];
  compressedBytes: Scalars['Int']['output'];
  contentType: Scalars['String']['output'];
  entryName: Scalars['String']['output'];
  fileName: Scalars['String']['output'];
  jsonSha256: Scalars['String']['output'];
  rootType: Scalars['String']['output'];
  rowCount?: Maybe<Scalars['Int']['output']>;
  schema: Scalars['String']['output'];
  uncompressedBytes: Scalars['Int']['output'];
  urlExpiresAt: Scalars['DateTimeISO']['output'];
  zipUrl: Scalars['String']['output'];
}

export interface PersistentResultJobPayload {
  artifact?: Maybe<PersistentResultArtifact>;
  error?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  pollAfterMs: Scalars['Int']['output'];
  status: PersistentResultJobStatus;
}

/** Lifecycle status of a remotely prepared persistent tool result */
export const PersistentResultJobStatus = {
  Completed: 'COMPLETED',
  Failed: 'FAILED',
  Queued: 'QUEUED',
  Running: 'RUNNING'
} as const;

export type PersistentResultJobStatus = typeof PersistentResultJobStatus[keyof typeof PersistentResultJobStatus];
export interface Plan {
  currency: Scalars['String']['output'];
  planDetail: Array<PlanDetail>;
  planName: Scalars['String']['output'];
  price: Scalars['String']['output'];
}

export interface PlanDetail {
  modelName: Scalars['String']['output'];
  volume: Scalars['String']['output'];
}

/** ISV application credentials for a platform+market+seller type combination */
export interface PlatformApp {
  apiBaseUrl: Scalars['String']['output'];
  authLinkUrl: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  market: PlatformMarket;
  platform: PlatformType;
  sellerType: PlatformSellerType;
  status: PlatformAppStatus;
}

/** Platform app credentials (admin-only) */
export interface PlatformAppSecretResult {
  /** Application key */
  appKey: Scalars['String']['output'];
  /** Application secret */
  appSecret: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  market: PlatformMarket;
  platform: PlatformType;
  sellerType: PlatformSellerType;
}

/** PlatformApp lifecycle status */
export const PlatformAppStatus = {
  Active: 'ACTIVE',
  Draft: 'DRAFT',
  Suspended: 'SUSPENDED'
} as const;

export type PlatformAppStatus = typeof PlatformAppStatus[keyof typeof PlatformAppStatus];
/** Platform market region */
export const PlatformMarket = {
  Be: 'BE',
  Cz: 'CZ',
  De: 'DE',
  Es: 'ES',
  Fr: 'FR',
  Gb: 'GB',
  Gr: 'GR',
  Hu: 'HU',
  Id: 'ID',
  Ie: 'IE',
  It: 'IT',
  Mx: 'MX',
  My: 'MY',
  Nl: 'NL',
  Ph: 'PH',
  Pt: 'PT',
  Row: 'ROW',
  Sg: 'SG',
  Th: 'TH',
  Us: 'US',
  Vn: 'VN'
} as const;

export type PlatformMarket = typeof PlatformMarket[keyof typeof PlatformMarket];
/** Seller account type supported by a platform application */
export const PlatformSellerType = {
  CrossBorder: 'CROSS_BORDER',
  Local: 'LOCAL'
} as const;

export type PlatformSellerType = typeof PlatformSellerType[keyof typeof PlatformSellerType];
/** Platform type identifier */
export const PlatformType = {
  TiktokShop: 'TIKTOK_SHOP'
} as const;

export type PlatformType = typeof PlatformType[keyof typeof PlatformType];
/** Deprecated client policy for legacy MongoDB-backed official preset skill sync. */
export const PresetSkillAutoUpdatePolicy = {
  Always: 'ALWAYS',
  MissingOnly: 'MISSING_ONLY',
  OfficialOnly: 'OFFICIAL_ONLY'
} as const;

export type PresetSkillAutoUpdatePolicy = typeof PresetSkillAutoUpdatePolicy[keyof typeof PresetSkillAutoUpdatePolicy];
/** Official preset skill metadata used by desktop to sync local templates safely. */
export interface PresetSkillManifestItem {
  /** @deprecated Legacy MongoDB-backed preset skill sync is deprecated. Use the static ZIP manifest at https://www.rivonclaw.com/skills/manifest.json. */
  autoUpdatePolicy: PresetSkillAutoUpdatePolicy;
  /**
   * Hash of the current official SKILL.md content.
   * @deprecated Legacy MongoDB-backed preset skill sync is deprecated. Use the static ZIP manifest at https://www.rivonclaw.com/skills/manifest.json.
   */
  currentHash: Scalars['String']['output'];
  /** Human-readable display name for the preset skill. */
  displayName: Scalars['String']['output'];
  /** Local skill directory slug used by desktop. */
  localSlug: Scalars['String']['output'];
  /**
   * Recent official hashes. If local content matches one, desktop may update automatically.
   * @deprecated Legacy MongoDB-backed preset skill sync is deprecated. Use the static ZIP manifest at https://www.rivonclaw.com/skills/manifest.json.
   */
  previousHashes: Array<Scalars['String']['output']>;
  serviceId: ServiceId;
  /** Preset skill content key. */
  slug: Scalars['String']['output'];
  updatedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  version?: Maybe<Scalars['String']['output']>;
}

/** Signal that official preset skills may have changed; clients should re-run preset skill sync. */
export interface PresetSkillsChangedPayload {
  publishedAt: Scalars['DateTimeISO']['output'];
  reason?: Maybe<Scalars['String']['output']>;
  revision: Scalars['String']['output'];
}

export interface ProductKnowledge {
  archivedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  bindingCount: Scalars['Int']['output'];
  bindings: Array<ProductKnowledgeBinding>;
  createdAt: Scalars['DateTimeISO']['output'];
  creativeCasesMarkdown: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  qaMarkdown: Scalars['String']['output'];
  revision: Scalars['Int']['output'];
  status: ProductKnowledgeStatus;
  updatedAt: Scalars['DateTimeISO']['output'];
  usageInstructionsMarkdown: Scalars['String']['output'];
}

export interface ProductKnowledgeBinding {
  createdAt: Scalars['DateTimeISO']['output'];
  id: Scalars['ID']['output'];
  platformSnapshot: Scalars['String']['output'];
  productCoverImageSnapshot?: Maybe<Scalars['String']['output']>;
  productId: Scalars['String']['output'];
  productKnowledgeId: Scalars['ID']['output'];
  productStatusSnapshot?: Maybe<Scalars['String']['output']>;
  productTitleSnapshot: Scalars['String']['output'];
  sellerSkusSnapshot: Array<Scalars['String']['output']>;
  shopId: Scalars['ID']['output'];
  shopNameSnapshot: Scalars['String']['output'];
  shopRegionSnapshot?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTimeISO']['output'];
}

/** Merchant-authored Product Knowledge attached to one seller product. Markdown is business data, not executable Agent instructions. */
export interface ProductKnowledgeContent {
  creativeCasesMarkdown: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  qaMarkdown: Scalars['String']['output'];
  revision: Scalars['Int']['output'];
  updatedAt: Scalars['DateTimeISO']['output'];
  usageInstructionsMarkdown: Scalars['String']['output'];
}

export interface ProductKnowledgeLinkFailure {
  code: Scalars['String']['output'];
  existingProductKnowledgeId?: Maybe<Scalars['ID']['output']>;
  existingProductKnowledgeName?: Maybe<Scalars['String']['output']>;
  message: Scalars['String']['output'];
  productId: Scalars['String']['output'];
  shopId: Scalars['ID']['output'];
}

export interface ProductKnowledgePage {
  items: Array<ProductKnowledge>;
  limit: Scalars['Int']['output'];
  offset: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
}

export interface ProductKnowledgePageInput {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<ProductKnowledgeStatus>;
}

export interface ProductKnowledgeProductReferenceInput {
  productId: Scalars['String']['input'];
  shopId: Scalars['ID']['input'];
}

export const ProductKnowledgeStatus = {
  Active: 'ACTIVE',
  Archived: 'ARCHIVED'
} as const;

export type ProductKnowledgeStatus = typeof ProductKnowledgeStatus[keyof typeof ProductKnowledgeStatus];
/** System lifecycle state for customer-service review follow-up. */
export const ProductReviewFollowUpStatus = {
  Attached: 'ATTACHED',
  FailedToReachout: 'FAILED_TO_REACHOUT',
  NotRequired: 'NOT_REQUIRED',
  Pending: 'PENDING',
  Resolved: 'RESOLVED',
  Suppressed: 'SUPPRESSED'
} as const;

export type ProductReviewFollowUpStatus = typeof ProductReviewFollowUpStatus[keyof typeof ProductReviewFollowUpStatus];
/** Promote a temporary uploaded image into permanent object storage */
export interface PromoteImageAssetInput {
  /** ImageAsset ID returned by POST /api/uploads/images. Prefer this over imageUri. */
  assetId?: InputMaybe<Scalars['ID']['input']>;
  /** Temporary image URI returned by POST /api/uploads/images. Used only when assetId is unavailable. */
  imageUri?: InputMaybe<Scalars['String']['input']>;
  /** Entity ID that owns this image. May be omitted while creating a new entity. */
  linkedEntityId?: InputMaybe<Scalars['String']['input']>;
  /** Entity type that will own this image, e.g. INVENTORY_GOOD or PRODUCT. */
  linkedEntityType: Scalars['String']['input'];
}

export interface ProtectAffiliateCreatorRelationshipInput {
  businessDeveloperId?: InputMaybe<Scalars['ID']['input']>;
  creatorRelationshipId: Scalars['ID']['input'];
  note?: InputMaybe<Scalars['String']['input']>;
}

export interface ProviderPricing {
  currency: Scalars['String']['output'];
  models: Array<ModelPricing>;
  pricingUrl: Scalars['String']['output'];
  provider: Scalars['String']['output'];
  subscriptions?: Maybe<Array<ProviderSubscription>>;
}

export interface ProviderSubscription {
  id: Scalars['String']['output'];
  label: Scalars['String']['output'];
  models?: Maybe<Array<ModelPricing>>;
  plans: Array<Plan>;
  pricingUrl: Scalars['String']['output'];
}

/** Supported proxy protocols for WhatsApp linked-device sessions */
export const ProxyProtocol = {
  Http: 'HTTP',
  Socks5: 'SOCKS5'
} as const;

export type ProxyProtocol = typeof ProxyProtocol[keyof typeof ProxyProtocol];
/** Operational state for a WhatsApp egress proxy */
export const ProxyStatus = {
  Active: 'ACTIVE',
  Disabled: 'DISABLED',
  Error: 'ERROR'
} as const;

export type ProxyStatus = typeof ProxyStatus[keyof typeof ProxyStatus];
/** Input for publishing an ephemeral affiliate signal */
export interface PublishAffiliateRelationshipSignalInput {
  /** Optional related AffiliateCollaboration platform ID when the publisher already resolved collaboration context. */
  affiliateCollaborationId?: InputMaybe<Scalars['ID']['input']>;
  /** Provider Sample Application approval expiration as Unix seconds. */
  approveExpirationTime?: InputMaybe<Scalars['Int']['input']>;
  /** Sample shipment carrier or logistics provider when available. */
  carrier?: InputMaybe<Scalars['String']['input']>;
  /** Outreach channel where the relationship-level message was observed. */
  channel?: InputMaybe<AffiliateMessageChannel>;
  /** Open or target collaboration type when known. */
  collaborationType?: InputMaybe<AffiliateCollaborationType>;
  /** Sample commission snapshot as a decimal ratio in [0, 1]. */
  commissionRate?: InputMaybe<Scalars['Float']['input']>;
  /** Observed content comment count when available. */
  contentCommentCount?: InputMaybe<Scalars['Float']['input']>;
  /** Observed content description/title when available. */
  contentDescription?: InputMaybe<Scalars['String']['input']>;
  /** Observed content format, e.g. VIDEO or LIVE. */
  contentFormat?: InputMaybe<Scalars['String']['input']>;
  /** Platform content ID if available. */
  contentId?: InputMaybe<Scalars['String']['input']>;
  /** Observed content like count when available. */
  contentLikeCount?: InputMaybe<Scalars['Float']['input']>;
  /** Observed TikTok content page link when available. */
  contentPageLink?: InputMaybe<Scalars['String']['input']>;
  /** Observed paid order count attributed to the content when available. */
  contentPaidOrderCount?: InputMaybe<Scalars['Float']['input']>;
  /** Observed content source URL when available. */
  contentUrl?: InputMaybe<Scalars['String']['input']>;
  /** Observed content view count when available. */
  contentViewCount?: InputMaybe<Scalars['Float']['input']>;
  /** Provider route evidence for message-related signals. This is not the CreatorRelationship workspace key. */
  conversationId?: InputMaybe<Scalars['String']['input']>;
  /** Best-known creator avatar URL from platform sync. */
  creatorAvatarUrl?: InputMaybe<Scalars['String']['input']>;
  /** Sample Application 30-day content count. */
  creatorContentCount30d?: InputMaybe<Scalars['Int']['input']>;
  /** Best-known creator follower count from platform sync. */
  creatorFollowerCount?: InputMaybe<Scalars['Float']['input']>;
  /** Sample Application 30-day GMV amount. */
  creatorGmv30dAmount?: InputMaybe<Scalars['String']['input']>;
  /** ISO 4217 currency for the Sample Application 30-day GMV. */
  creatorGmv30dCurrency?: InputMaybe<Scalars['String']['input']>;
  /** Creator IM user ID if available. */
  creatorImId?: InputMaybe<Scalars['String']['input']>;
  /** Best-known creator display nickname from platform sync. */
  creatorNickname?: InputMaybe<Scalars['String']['input']>;
  /** Creator open ID if available. */
  creatorOpenId?: InputMaybe<Scalars['String']['input']>;
  /** User-level AffiliateCreatorRelationship ID for channel-agnostic affiliate sessions. */
  creatorRelationshipId?: InputMaybe<Scalars['ID']['input']>;
  /** Best-known creator username from platform sync. */
  creatorUsername?: InputMaybe<Scalars['String']['input']>;
  /** Event timestamp as an ISO string. Defaults to server publish time. */
  eventTime?: InputMaybe<Scalars['String']['input']>;
  /** Observed message direction. Relationship message signals require this or sender role evidence. */
  messageDirection?: InputMaybe<AffiliateCreatorMessageDirection>;
  /** Platform message ID for creator message signals. */
  messageId?: InputMaybe<Scalars['String']['input']>;
  /** Platform message index when available. */
  messageIndex?: InputMaybe<Scalars['String']['input']>;
  /** Creator/seller visible message text for materializing relationship-level message facts. Not a provider route identifier. */
  messageText?: InputMaybe<Scalars['String']['input']>;
  /** Platform message type, e.g. TEXT or IMAGE. */
  messageType?: InputMaybe<Scalars['String']['input']>;
  /** Platform notification ID if available. */
  notificationId?: InputMaybe<Scalars['String']['input']>;
  /** Order ID for affiliate order attribution signals. */
  orderId?: InputMaybe<Scalars['String']['input']>;
  /** Platform sample application ID for sample workflow signals. */
  platformApplicationId?: InputMaybe<Scalars['String']['input']>;
  /** Platform collaboration ID normalized across open and target collaborations. */
  platformCollaborationId?: InputMaybe<Scalars['String']['input']>;
  /** Platform content/fulfillment ID if available. */
  platformFulfillmentId?: InputMaybe<Scalars['String']['input']>;
  /** Platform fulfillment status for sample content fulfillment sync. */
  platformFulfillmentStatus?: InputMaybe<TikTokSampleContentFulfillmentPlatformStatus>;
  /** Platform open collaboration ID for open collaboration sample/update signals. */
  platformOpenCollaborationId?: InputMaybe<Scalars['String']['input']>;
  /** Platform affiliate program ID if available. */
  platformProgramId?: InputMaybe<Scalars['String']['input']>;
  /** Platform shop ID. Relay/webhook publishers provide this when they do not know the MongoDB shop ID. */
  platformShopId?: InputMaybe<Scalars['String']['input']>;
  /** Platform status string if available. */
  platformStatus?: InputMaybe<Scalars['String']['input']>;
  /** Platform target collaboration ID for collaboration workflow signals. */
  platformTargetCollaborationId?: InputMaybe<Scalars['String']['input']>;
  /** Product ID if available. */
  productId?: InputMaybe<Scalars['String']['input']>;
  /** Platform sender ID if available. */
  senderId?: InputMaybe<Scalars['String']['input']>;
  /** Sender role from the platform event, e.g. CREATOR. */
  senderRole?: InputMaybe<Scalars['String']['input']>;
  /** MongoDB shop ID. Provide this from authenticated clients when available. */
  shopId?: InputMaybe<Scalars['ID']['input']>;
  /** Origin of the signal. */
  source: AffiliateRelationshipSignalSource;
  /** Sample shipment tracking number when available. */
  trackingNumber?: InputMaybe<Scalars['String']['input']>;
  /** Business signal to publish. */
  type: AffiliateRelationshipSignalType;
}

/** Input for publishing an ephemeral CS conversation signal */
export interface PublishCsConversationSignalInput {
  /** Buyer display nickname if already known. */
  buyerNickname?: InputMaybe<Scalars['String']['input']>;
  /** Platform buyer user ID if available. */
  buyerUserId?: InputMaybe<Scalars['String']['input']>;
  /** Platform conversation/thread ID that desktop should inspect. */
  conversationId: Scalars['String']['input'];
  /** Current platform customer-service session ID if already known. */
  currentSessionId?: InputMaybe<Scalars['String']['input']>;
  /** Dispatch attempt timestamp as an ISO string. Defaults to server publish time. */
  dispatchEventTime?: InputMaybe<Scalars['String']['input']>;
  /** Event timestamp as an ISO string. Defaults to server publish time. */
  eventTime?: InputMaybe<Scalars['String']['input']>;
  /** Platform IM user ID if available. */
  imUserId?: InputMaybe<Scalars['String']['input']>;
  /** Human-readable preview of the latest platform message when available. */
  latestMessagePreview?: InputMaybe<Scalars['String']['input']>;
  /** Platform message ID for MESSAGE_RECEIVED signals. */
  messageId?: InputMaybe<Scalars['String']['input']>;
  /** Platform message index when available for event ordering. */
  messageIndex?: InputMaybe<Scalars['String']['input']>;
  /** Platform message type, e.g. TEXT or IMAGE. */
  messageType?: InputMaybe<Scalars['String']['input']>;
  /** Optional operator instruction/comment to inject into the local CS agent catch-up prompt. */
  operatorInstruction?: InputMaybe<Scalars['String']['input']>;
  /** Related order ID if available. */
  orderId?: InputMaybe<Scalars['String']['input']>;
  /** Platform shop ID. Relay/webhook publishers provide this when they do not know the MongoDB shop ID. */
  platformShopId?: InputMaybe<Scalars['String']['input']>;
  /** Sender role from the platform event, e.g. BUYER. */
  senderRole?: InputMaybe<Scalars['String']['input']>;
  /** MongoDB shop ID. Provide this from authenticated clients when available. */
  shopId?: InputMaybe<Scalars['ID']['input']>;
  /** Origin of the signal. */
  source: CsConversationSignalSource;
  /** Business signal to publish. */
  type: CsConversationSignalType;
}

export interface Query {
  /** Read durable Affiliate Agent work bundles. */
  actionProposals: Array<ActionProposal>;
  /** Read server-driven announcements for the current user, surface, app version, and locale. */
  activeAnnouncements: Array<ActiveAnnouncement>;
  activeExpertKnowledgeRelease?: Maybe<ExpertKnowledgeRelease>;
  /** Admin-only: list uploaded client log files for a customer, optionally narrowed to one device. */
  adminClientLogFiles: Array<AdminClientLogFile>;
  /** Admin-only: read the current Telegram debugging-channel target from the relay and resolve it back to the RivonClaw account/device when possible. */
  adminDebugChannelOverview: AdminDebugChannelOverview;
  /** Get one connected advertising account by ID. */
  adsAdvertiser?: Maybe<AdsAdvertiser>;
  /** List connected advertising accounts for the authenticated user */
  adsAdvertisers: Array<AdsAdvertiser>;
  /** Get one TikTok Ads shop/store access row by ID. */
  adsStoreAccess?: Maybe<AdsStoreAccess>;
  /** List TikTok Ads shop/store accesses visible through connected advertising accounts. */
  adsStoreAccesses: Array<AdsStoreAccess>;
  /** Read bounded proposal events for one CreatorRelationship. Desktop injects this as per-run delta context, not as stable workspace state. */
  affiliateActionProposalDelta: Array<ActionProposal>;
  /** Read a stable cursor page of durable Affiliate Agent work bundles. */
  affiliateActionProposalPage: AffiliateActionProposalPage;
  /** Read affiliate approval interception policies. */
  affiliateApprovalPolicies: Array<AffiliateApprovalPolicy>;
  /** Read tag and campaign condition options across all Affiliate shops owned by the authenticated seller account. */
  affiliateApprovalPolicyContext: AffiliateApprovalPolicyContextPayload;
  /** List paginated user-level Affiliate business developers with workload and channel counts. */
  affiliateBusinessDeveloperPage: AffiliateBusinessDeveloperPage;
  /** List user-level Affiliate business developers. */
  affiliateBusinessDevelopers: Array<AffiliateBusinessDeveloper>;
  /** Cursor-paginated Creator funnel states for one owned Campaign. */
  affiliateCampaignCreatorStates: AffiliateCampaignCreatorStatePage;
  /** Read recent daily execution records for one owned Campaign. */
  affiliateCampaignDailyExecutions: Array<AffiliateCampaignDailyExecution>;
  /** Fetch and normalize one owned-shop product for Campaign review without creating persistent draft state. */
  affiliateCampaignProductPreview: AffiliateCampaignProductPreview;
  affiliateCampaignSearchPlans: AffiliateCampaignSearchPlanPage;
  /** Read whether the Campaign's explicitly selected evaluation strategy can run now. */
  affiliateCampaignSelectionReadiness: AffiliateCampaignSelectionReadiness;
  /** Read operational funnel totals and the latest execution for one Campaign. */
  affiliateCampaignSummary: AffiliateCampaignSummary;
  /** Read affiliate campaigns from Mongo state. */
  affiliateCampaigns: Array<AffiliateCampaign>;
  /** Read one canonical Open or Target platform Collaboration with its linked Creator, Sample Application, and Product context. */
  affiliateCollaborationDetail: AffiliateCollaborationDetailPayload;
  affiliateCollaborationState: AffiliateCollaboration;
  /** Read platform-level affiliate collaborations, normalized across open and target collaborations. */
  affiliateCollaborations: Array<AffiliateCollaboration>;
  /** Prepare checkpoint metadata for one Affiliate Agent dispatch, optionally including legacy event/workspace projections. */
  affiliateContextBuilder: AffiliateContextBuilderPayload;
  affiliateCreatorChannelContacts: AffiliateCreatorChannelContactPage;
  affiliateCreatorCollaborationsForRelationship: AffiliateCreatorCollaborationListPayload;
  /** Read relationship-level creator contact state, including WhatsApp/email contacts and available seller accounts. */
  affiliateCreatorContactState: AffiliateCreatorContactStatePayload;
  /** Read merged relationship-level affiliate creator message history with channel labels. */
  affiliateCreatorMessageHistory: AffiliateCreatorMessageHistoryPayload;
  /** Single authoritative Creator profile read. MongoDB is preferred; missing or stale market data is refreshed through a current-user same-market shop. */
  affiliateCreatorProfile: AffiliateCreatorProfilePayload;
  affiliateCreatorProtections: AffiliateCreatorProtectionPage;
  /** Read the canonical user-level CreatorRelationship summary. Historical Samples, platform Collaborations, Proposals, messages, and lifecycle events remain separate entities. */
  affiliateCreatorRelationshipDetail: AffiliateCreatorRelationshipDetailPayload;
  affiliateCreatorRelationshipState: AffiliateCreatorRelationshipStatePayload;
  affiliateCreatorSampleApplicationsForRelationship: AffiliateCreatorSampleApplicationListPayload;
  /** Read WhatsApp messages on demand from the bound provider for an affiliate creator relationship. */
  affiliateCreatorWhatsAppMessages: Array<AffiliateCreatorMessageHistoryItem>;
  /** Read a server-paginated shop-scoped Creator relationship page with profile, tags, latest collaboration, and attention context. */
  affiliateCreators: AffiliateCreatorManagementPage;
  /** List seller-level Outlook/Microsoft Graph email account bindings available to affiliate workflows. */
  affiliateEmailAccounts: Array<EmailAccountBinding>;
  /** Resolve affiliate prediction subjects against backend-owned affiliate state and proxy expected-sales prediction to the BentoML affiliate-expected-sales service. */
  affiliateExpectedSalesPredictions: AffiliateExpectedSalesPredictionPayload;
  /** Get product details with current aggregate inventory */
  affiliateGetProduct: EcomProduct;
  /** Read the authoritative Marketplace Creator rule capabilities for one owned shop. */
  affiliateMarketplaceCreatorRuleCapabilities: AffiliateMarketplaceCreatorRuleCapabilities;
  /** Read latest affiliate ML evaluation summaries in bulk for the current user and owned shops. */
  affiliateMlInsightSummaries: Array<AffiliateMlModelEfficiencySummary>;
  /** Read latest affiliate ML evaluation summary generated by telemetry training jobs for the current user or one shop. */
  affiliateMlInsights: AffiliateMlInsightsPayload;
  /** Read Affiliate ML availability and shop-specific evaluations for the current user and owned shops in one request. */
  affiliateMlInsightsBulk: AffiliateMlInsightsBulkPayload;
  /** Read shop-wide TikTok Open Collaboration auto-add settings from the Provider. */
  affiliateOpenCollaborationSettings: EcomOpenCollaborationSettings;
  /** Read shop-level Affiliate Collaboration and Sample Application projection readiness. */
  affiliateOperationalProjectionHealth: AffiliateOperationalProjectionHealthPayload;
  affiliateOperationalSettings: AffiliateOperationalSettings;
  /** Summarize seller-level affiliate outreach delivery and inbound message health across WhatsApp and Outlook. */
  affiliateOutreachOperationalStatus: AffiliateOutreachOperationalStatusPayload;
  /** Agent-facing expected-sales fit check for a candidate affiliate creator-product pair. This wraps affiliateExpectedSalesPredictions without mutating collaboration product context. */
  affiliatePredictCreatorProductFit: AffiliateCreatorProductFitPayload;
  /** Read deduplicated Product summaries for Affiliate pages through the authorized shop-scoped Product cache. */
  affiliateProductSummaries: Array<AffiliateRelationshipProductSummary>;
  /** Read Target Collaboration memberships and Sample-referenced Open Collaborations for one CreatorRelationship without creator-level expansion. */
  affiliateRelationshipPlatformCollaborations: AffiliateRelationshipPlatformCollaborationPage;
  /** Read a stable page of canonical Sample Applications for one CreatorRelationship. */
  affiliateRelationshipSampleApplications: AffiliateRelationshipSampleApplicationPage;
  /** Read a Provider-backed CreatorRelationship timeline ordered by business occurredAt. */
  affiliateRelationshipTimeline: AffiliateRelationshipTimelinePayload;
  affiliateSampleApplicationState: AffiliateSampleApplicationStatePayload;
  /** List seller-level WhatsApp account bindings available to affiliate workflows. */
  affiliateWhatsAppAccounts: Array<WhatsAppAccountBinding>;
  /** Read current backend-materialized affiliate work projections. Desktop uses this for initial review/dispatch state; subscriptions keep it fresh. */
  affiliateWorkItems: Array<AffiliateWorkItem>;
  /** Legacy Panel query for aggregated Affiliate management state. It is not exposed as an Agent tool. */
  affiliateWorkspace: AffiliateWorkspacePayload;
  /** Read account- and shop-scoped billing entitlement decisions for the current user. */
  billingOverview: BillingOverview;
  /** List billable product plan definitions. */
  billingPlanDefinitions: Array<BillingPlanDefinition>;
  browserToDesktopLoginAttempt: BrowserToDesktopLoginAttempt;
  /** Read campaign product setup rows from Mongo state. */
  campaignProducts: Array<CampaignProduct>;
  /** Check if a newer version is available (public, no auth required) */
  checkUpdate?: Maybe<UpdatePayload>;
  /** Read creator candidates discovered by search and qualification. Blocked creator relations are filtered out at read time. */
  creatorCandidates: Array<CreatorCandidate>;
  /** Read user-scoped creator relationships for a shop. Commercial lifecycle belongs to collaboration records; protected creators are excluded unless blocked=true. */
  creatorRelationships: Array<AffiliateCreatorRelationship>;
  /** Read concrete creator marketplace search runs from Mongo state. */
  creatorSearchRuns: Array<CreatorSearchRun>;
  /** Read shop-scoped creator tags used by segmentation and approval policies. */
  creatorTags: Array<CreatorTag>;
  /** Read the current cloud status and result for a CS escalation */
  csGetEscalationResult?: Maybe<CsEscalationLookupResult>;
  /** List open CS escalations for the authenticated user, including pending and in-progress items */
  csOpenEscalations: Array<CsEscalation>;
  /** List open CS escalations with total count and pagination metadata */
  csOpenEscalationsPage: CsOpenEscalationPage;
  /** List unhandled CS escalation side-effect events for the authenticated user's desktop actuator */
  csPendingEscalationEvents: Array<CsEscalationEventDelivery>;
  /** Get public Google sign-in configuration for native desktop clients */
  desktopGoogleAuthConfig: DesktopGoogleAuthConfig;
  discoverProductsBySellerSku: SellerSkuProductDiscoveryPayload;
  /** Get aftersale eligibility for an order */
  ecommerceGetAftersaleEligibility: EcomAftersaleEligibility;
  ecommerceGetCSExperimentDetail: CsExperimentDetailView;
  ecommerceGetCSExperimentPage: CsExperimentPageResult;
  ecommerceGetCSExperimentTimeToEventCurve: CsExperimentTimeToEventCurveView;
  ecommerceGetCSExperimentTrend: CsExperimentTrendView;
  /** Get comprehensive customer service performance metrics from the warehouse. */
  ecommerceGetCSPerformance: CustomerServicePerformanceReport;
  /** Get near-real-time customer service performance metrics from the warehouse. */
  ecommerceGetCSRealtimePerformance: CustomerServiceRealtimePerformanceReport;
  ecommerceGetCSUnpaidOrderEvaluation: CsUnpaidOrderEvaluationView;
  ecommerceGetCSUnpaidOrderExperimentAnalysis: CsUnpaidReachoutExperimentResult;
  ecommerceGetCSUnpaidOrderExperimentPerformance: Array<CsUnpaidReachoutExperimentArm>;
  /** Get shop-level observational unpaid-order reachout performance with a compatible holdout summary. */
  ecommerceGetCSUnpaidOrderReachoutPerformance: CsUnpaidOrderReachoutPerformanceReport;
  ecommerceGetCSUnpaidOrderReachoutRealtime: CsUnpaidReachoutRealtimeReport;
  /** Get full conversation details including conversation metadata (unread count, status, participants, latest message preview) and a normalized buyer participant slice. */
  ecommerceGetConversationDetails: CustomerServiceConversationDetails;
  /** Get a bounded customer-service conversation delta from a local OpenClaw-session anchor through the current inbound message. */
  ecommerceGetConversationMessageDelta: CustomerServiceMessageDelta;
  /** Get messages of a conversation */
  ecommerceGetConversationMessages: CustomerServiceMessageSummaryPage;
  /** Get conversations for a shop as a flat summary list. Pagination is handled internally by the backend. */
  ecommerceGetConversations: Array<CustomerServiceConversationSummary>;
  /** List backend-materialized customer-service conversations across one or more owned shops. */
  ecommerceGetCustomerServiceInbox: CustomerServiceConversationInboxPage;
  /** Get fulfillment tracking for an order. Optional buyerUserId for buyer scoping. */
  ecommerceGetFulfillmentTracking: EcomOrderTracking;
  /** Get order details by order ID. Returns null if the order is not found or does not belong to the optional buyerUserId. */
  ecommerceGetOrder?: Maybe<EcomOrder>;
  /** Get order-derived sales statistics from fct_order_shop_daily, fct_order_product_daily, or fct_order_sku_daily. */
  ecommerceGetOrderSalesStats: EcomOrderSalesStatsResult;
  /** List/search orders as a flat summary list. Optional buyerUserId for buyer-scoped queries. Pagination is handled internally by the backend. For full order details use ecommerceGetOrder. */
  ecommerceGetOrders: Array<EcomOrderSummary>;
  /** Get package detail by package ID */
  ecommerceGetPackageDetail: EcomPackageDetail;
  /** Get shipping document for a package */
  ecommerceGetPackageShippingDocument: EcomShippingDocument;
  /** Get conversations pending seller reply */
  ecommerceGetPendingConversations: CustomerServicePendingConversationsResult;
  /** Get product details */
  ecommerceGetProduct: EcomProduct;
  /** Get valid reject reasons for a return or cancellation */
  ecommerceGetRejectReasons: Array<EcomRejectReason>;
  /** Get return event records (audit trail) */
  ecommerceGetReturnRecords: Array<EcomReturnRecord>;
  /** Get order-derived shop SKU demand metrics from the warehouse as one row per shop-local date and SKU. Returns full item fields plus totalCount metadata. */
  ecommerceGetShopSkuPerformanceList: EcomSkuPerformanceResult;
  /** Load the seller SPS analytics page: current SPS overview plus TikTok's live 90-day trend for one selected SPS metric, grouped by market and shop. */
  ecommerceGetSpsAnalytics: SpsAnalyticsView;
  ecommerceListCSUnpaidOrderExperiments: Array<CsUnpaidOrderConfigExperimentView>;
  /** Search customer service sessions for a shop */
  ecommerceSearchCSSessions: CustomerServiceSessionPage;
  /** Search order cancellation requests and return a flat list. Pagination is handled internally by the backend. */
  ecommerceSearchCancellations: Array<EcomCancellation>;
  /** Search fulfillment packages with optional filters and return a flat list. Pagination is handled internally by the backend. */
  ecommerceSearchPackages: Array<EcomPackage>;
  /** Search/list products with optional filters and return a flat summary list. Pagination is handled internally by the backend. For full product details including images use ecommerceGetProduct. */
  ecommerceSearchProducts: Array<EcomProductSummary>;
  /** Search return/refund/replacement requests and return a flat list. Pagination is handled internally by the backend. */
  ecommerceSearchReturns: Array<EcomReturn>;
  /** List Outlook/Microsoft Graph email account bindings for the authenticated seller. */
  emailAccountBindings: Array<EmailAccountBinding>;
  experimentGetAnalytics: ExperimentAnalyticsView;
  expertConversation: ExpertConversationDetail;
  expertConversations: ExpertConversationPage;
  expertProfile?: Maybe<ExpertProfile>;
  expertUsageStatus: ExpertUsageStatus;
  /** List warehouse-backed ecommerce BI datasets and their dimensions/metrics. */
  getEcommerceBiCatalog: Array<EcomBiDatasetMetadata>;
  /** Query typed warehouse-backed ecommerce BI data. */
  getEcommerceBiData: EcomBiQueryResult;
  /** List recent image assets for the authenticated user */
  imageAssets: Array<ImageAsset>;
  /** Get current authenticated user profile */
  me: MeResponse;
  /** Check Microsoft Graph OAuth/webhook readiness and summarize seller Outlook subscription health. */
  microsoftGraphConnectorStatus: MicrosoftGraphConnectorStatus;
  /** Get PWA install URL (base URL without pairing code) */
  mobileInstallUrl: Scalars['String']['output'];
  pendingTikTokShopClaim?: Maybe<PendingTikTokShopClaimView>;
  /** Poll an authenticated user's remote persistent-result preparation job. */
  persistentResultJob: PersistentResultJobPayload;
  /** List all active platform app secrets (admin-only, for relay startup) */
  platformAppSecrets: Array<PlatformAppSecretResult>;
  /** List active PlatformApps (for OAuth target selection) */
  platformApps: Array<PlatformApp>;
  /**
   * Deprecated legacy MongoDB-backed preset skill metadata. New desktops use the static ZIP manifest.
   * @deprecated Legacy MongoDB-backed preset skill sync is deprecated. Use the static ZIP manifest at https://www.rivonclaw.com/skills/manifest.json.
   */
  presetSkillManifest: Array<PresetSkillManifestItem>;
  /**
   * Deprecated legacy MongoDB-backed preset skill payloads. New desktops use the static ZIP manifest.
   * @deprecated Legacy MongoDB-backed preset skill sync is deprecated. Use the static ZIP manifest at https://www.rivonclaw.com/skills/manifest.json.
   */
  presetSkills?: Maybe<Scalars['String']['output']>;
  /** Get pricing for all providers */
  pricing: Array<ProviderPricing>;
  productKnowledge: ProductKnowledge;
  productKnowledges: ProductKnowledgePage;
  /** Read source-of-truth inventory and order-derived SKU demand facts for agent-side inventory and replenishment analysis. */
  readInventoryAnalysis: InventoryAnalysisPayload;
  /** Read external SKU to InventoryGood mappings. Use input.id for one row, or filters for a list. */
  readInventoryGoodMappings: Array<InventoryGoodMapping>;
  /** Read canonical stockable inventory goods. Use input.id for one row, or filters for a list. */
  readInventoryGoods: Array<InventoryGood>;
  /** Read payments for the current user. */
  readPayments: Array<Payment>;
  /** Read active shop SKU coverage against canonical InventoryGood. Returns unrecognized active shop SKUs and active InventoryGoods that this shop does not currently resolve to. */
  readShopInventoryGoodCoverage: ShopInventoryGoodCoveragePayload;
  /** Read shop-scoped platform warehouses. Use input.id for one row, or filters for a list. */
  readShopWarehouses: Array<ShopWarehouse>;
  /** Read a public, limited Stripe Checkout status by Checkout Session ID. */
  readStripeCheckoutStatus?: Maybe<PaymentCheckoutStatus>;
  /** Read canonical warehouses. Use input.id for one row, or filters for a list. */
  readWarehouses: Array<Warehouse>;
  /** Read WMS accounts. Use input.id for one account, or filters for a list. Credentials are never returned. */
  readWmsAccounts: Array<WmsAccount>;
  /** Read WMS goods coverage against canonical InventoryGood without writing data. Use before syncWmsInventoryGoods to show which WMS goods are not yet active InventoryGoods. */
  readWmsInventoryGoodCoverage: WmsInventoryGoodCoveragePayload;
  /** Resolve an external source seller SKU to a canonical InventoryGood for safe inventory writes. */
  resolveInventoryGoodIdentity: InventoryGoodIdentityResolution;
  /** Get a single run profile by ID */
  runProfile?: Maybe<RunProfile>;
  /** List run profiles for the authenticated user, optionally filtered by surface */
  runProfiles: Array<RunProfile>;
  /** Get a single shop by ID */
  shop?: Maybe<Shop>;
  /** Get OAuth token status for a shop */
  shopAuthStatus: ShopAuthStatusResponse;
  /** List shops for the authenticated user */
  shops: Array<Shop>;
  /** Get a single skill by slug */
  skill?: Maybe<Skill>;
  /** Get all skill categories with counts */
  skillCategories: Array<SkillCategoryResult>;
  /** Search and browse marketplace skills */
  skills: SkillConnection;
  /** List advertising platforms supported by this backend. */
  supportedAdsPlatforms: Array<AdsPlatform>;
  /** Get a single surface by ID */
  surface?: Maybe<Surface>;
  /** List surfaces for the authenticated user */
  surfaces: Array<Surface>;
  /** Get system preset run profiles (userId=null), optionally filtered by moduleId */
  systemRunProfiles: Array<RunProfile>;
  /** Get tool specifications for dynamic client-side registration (filtered by enrolled modules) */
  toolSpecs: Array<ToolSpec>;
  /** Batch-verify relay access tokens */
  verifyRelayTokens: Array<RelayTokenResult>;
  /** Verify whether the authenticated user has access to the given shops */
  verifyShopAccess: VerifyShopAccessResult;
  /** Long-poll for pairing completion (30s timeout) */
  waitForPairing: WaitPairingResult;
  /** List WhatsApp account bindings for the authenticated seller account. */
  whatsAppAccountBindings: Array<WhatsAppAccountBinding>;
  /** Check Evolution API connector readiness and summarize seller-visible WhatsApp account/proxy state. */
  whatsAppConnectorStatus: WhatsAppConnectorStatus;
  /** List WhatsApp egress proxies visible to the authenticated seller. Includes user-owned proxies and global proxies. */
  whatsAppProxies: Array<WhatsAppProxy>;
}


export interface QueryActionProposalsArgs {
  input: ReadActionProposalsInput;
}


export interface QueryActiveAnnouncementsArgs {
  appVersion?: InputMaybe<Scalars['String']['input']>;
  deviceId?: InputMaybe<Scalars['String']['input']>;
  locale: Scalars['String']['input'];
  surface: AnnouncementSurface;
}


export interface QueryAdminClientLogFilesArgs {
  deviceId?: InputMaybe<Scalars['String']['input']>;
  email: Scalars['String']['input'];
}


export interface QueryAdsAdvertiserArgs {
  id: Scalars['ID']['input'];
}


export interface QueryAdsAdvertisersArgs {
  status?: InputMaybe<AdsAdvertiserAuthStatus>;
}


export interface QueryAdsStoreAccessArgs {
  id: Scalars['ID']['input'];
}


export interface QueryAdsStoreAccessesArgs {
  adsAdvertiserId?: InputMaybe<Scalars['ID']['input']>;
  advertiserId?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<AdsStoreAccessStatus>;
  storeId?: InputMaybe<Scalars['String']['input']>;
}


export interface QueryAffiliateActionProposalDeltaArgs {
  input: AffiliateActionProposalDeltaInput;
}


export interface QueryAffiliateActionProposalPageArgs {
  input: ReadActionProposalsInput;
}


export interface QueryAffiliateApprovalPoliciesArgs {
  input: ReadAffiliateApprovalPoliciesInput;
}


export interface QueryAffiliateBusinessDeveloperPageArgs {
  input?: InputMaybe<AffiliateBusinessDeveloperPageInput>;
}


export interface QueryAffiliateBusinessDevelopersArgs {
  includeArchived?: InputMaybe<Scalars['Boolean']['input']>;
}


export interface QueryAffiliateCampaignCreatorStatesArgs {
  input: ReadAffiliateCampaignCreatorStatesInput;
}


export interface QueryAffiliateCampaignDailyExecutionsArgs {
  input: ReadAffiliateCampaignDailyExecutionsInput;
}


export interface QueryAffiliateCampaignProductPreviewArgs {
  input: ResolveAffiliateCampaignProductInput;
}


export interface QueryAffiliateCampaignSearchPlansArgs {
  input: ReadAffiliateCampaignSearchPlansInput;
}


export interface QueryAffiliateCampaignSelectionReadinessArgs {
  campaignId: Scalars['ID']['input'];
}


export interface QueryAffiliateCampaignSummaryArgs {
  campaignId: Scalars['ID']['input'];
}


export interface QueryAffiliateCampaignsArgs {
  input: ReadAffiliateCampaignsInput;
}


export interface QueryAffiliateCollaborationDetailArgs {
  input: AffiliateCollaborationDetailInput;
}


export interface QueryAffiliateCollaborationStateArgs {
  affiliateCollaborationId: Scalars['ID']['input'];
  creatorRelationshipId: Scalars['ID']['input'];
}


export interface QueryAffiliateCollaborationsArgs {
  input: ReadAffiliateCollaborationsInput;
}


export interface QueryAffiliateContextBuilderArgs {
  input: AffiliateContextBuilderInput;
}


export interface QueryAffiliateCreatorChannelContactsArgs {
  input: AffiliateCreatorChannelContactPageInput;
}


export interface QueryAffiliateCreatorCollaborationsForRelationshipArgs {
  creatorRelationshipId: Scalars['ID']['input'];
}


export interface QueryAffiliateCreatorContactStateArgs {
  input: AffiliateCreatorContactStateInput;
}


export interface QueryAffiliateCreatorMessageHistoryArgs {
  input: AffiliateCreatorMessageHistoryInput;
}


export interface QueryAffiliateCreatorProfileArgs {
  input: AffiliateCreatorProfileInput;
}


export interface QueryAffiliateCreatorProtectionsArgs {
  input: AffiliateCreatorProtectionPageInput;
}


export interface QueryAffiliateCreatorRelationshipDetailArgs {
  input: AffiliateCreatorRelationshipDetailInput;
}


export interface QueryAffiliateCreatorRelationshipStateArgs {
  creatorRelationshipId: Scalars['ID']['input'];
}


export interface QueryAffiliateCreatorSampleApplicationsForRelationshipArgs {
  creatorRelationshipId: Scalars['ID']['input'];
  includeFulfillments?: InputMaybe<Scalars['Boolean']['input']>;
}


export interface QueryAffiliateCreatorWhatsAppMessagesArgs {
  input: AffiliateWhatsAppMessagesInput;
}


export interface QueryAffiliateCreatorsArgs {
  input: ReadAffiliateCreatorsInput;
}


export interface QueryAffiliateEmailAccountsArgs {
  input: ListAffiliateEmailAccountsInput;
}


export interface QueryAffiliateExpectedSalesPredictionsArgs {
  input: AffiliateExpectedSalesPredictionInput;
}


export interface QueryAffiliateGetProductArgs {
  creatorRelationshipId?: InputMaybe<Scalars['ID']['input']>;
  frozenAgendaProductShopPairsJson?: InputMaybe<Scalars['String']['input']>;
  includeKnowledge?: InputMaybe<Scalars['Boolean']['input']>;
  productId: Scalars['String']['input'];
  shopId?: InputMaybe<Scalars['String']['input']>;
}


export interface QueryAffiliateMarketplaceCreatorRuleCapabilitiesArgs {
  shopId: Scalars['ID']['input'];
}


export interface QueryAffiliateMlInsightSummariesArgs {
  input?: InputMaybe<AffiliateMlInsightSummariesInput>;
}


export interface QueryAffiliateMlInsightsArgs {
  input?: InputMaybe<AffiliateMlInsightsInput>;
}


export interface QueryAffiliateMlInsightsBulkArgs {
  input: AffiliateMlInsightsBulkInput;
}


export interface QueryAffiliateOpenCollaborationSettingsArgs {
  shopId: Scalars['ID']['input'];
}


export interface QueryAffiliateOperationalProjectionHealthArgs {
  shopId: Scalars['ID']['input'];
}


export interface QueryAffiliateOutreachOperationalStatusArgs {
  input: AffiliateOutreachOperationalStatusInput;
}


export interface QueryAffiliatePredictCreatorProductFitArgs {
  input: AffiliateCreatorProductFitInput;
}


export interface QueryAffiliateProductSummariesArgs {
  input: AffiliateProductSummaryBatchInput;
}


export interface QueryAffiliateRelationshipPlatformCollaborationsArgs {
  input: AffiliateRelationshipEntityPageInput;
}


export interface QueryAffiliateRelationshipSampleApplicationsArgs {
  input: AffiliateRelationshipEntityPageInput;
}


export interface QueryAffiliateRelationshipTimelineArgs {
  input: AffiliateRelationshipTimelineInput;
}


export interface QueryAffiliateSampleApplicationStateArgs {
  creatorRelationshipId: Scalars['ID']['input'];
  sampleApplicationRecordId: Scalars['ID']['input'];
}


export interface QueryAffiliateWhatsAppAccountsArgs {
  input: ListAffiliateWhatsAppAccountsInput;
}


export interface QueryAffiliateWorkItemsArgs {
  input?: InputMaybe<ReadAffiliateWorkItemsInput>;
}


export interface QueryAffiliateWorkspaceArgs {
  input: AffiliateWorkspaceInput;
}


export interface QueryBrowserToDesktopLoginAttemptArgs {
  ticket: Scalars['String']['input'];
}


export interface QueryCampaignProductsArgs {
  campaignId: Scalars['String']['input'];
}


export interface QueryCheckUpdateArgs {
  clientVersion: Scalars['String']['input'];
}


export interface QueryCreatorCandidatesArgs {
  input: ReadCreatorCandidatesInput;
}


export interface QueryCreatorRelationshipsArgs {
  input: ReadCreatorRelationsInput;
}


export interface QueryCreatorSearchRunsArgs {
  input: ReadCreatorSearchRunsInput;
}


export interface QueryCreatorTagsArgs {
  shopId: Scalars['String']['input'];
}


export interface QueryCsGetEscalationResultArgs {
  escalationId: Scalars['ID']['input'];
}


export interface QueryCsOpenEscalationsArgs {
  filter?: InputMaybe<CsOpenEscalationFilterInput>;
}


export interface QueryCsOpenEscalationsPageArgs {
  filter?: InputMaybe<CsOpenEscalationFilterInput>;
}


export interface QueryCsPendingEscalationEventsArgs {
  filter?: InputMaybe<CsEscalationEventFilterInput>;
}


export interface QueryDiscoverProductsBySellerSkuArgs {
  sellerSku: Scalars['String']['input'];
}


export interface QueryEcommerceGetAftersaleEligibilityArgs {
  buyerUserId?: InputMaybe<Scalars['String']['input']>;
  orderId: Scalars['String']['input'];
  shopId: Scalars['String']['input'];
}


export interface QueryEcommerceGetCsExperimentDetailArgs {
  experimentId: Scalars['ID']['input'];
}


export interface QueryEcommerceGetCsExperimentPageArgs {
  input: CsExperimentPageInput;
}


export interface QueryEcommerceGetCsExperimentTimeToEventCurveArgs {
  input: CsExperimentTimeToEventCurveInput;
}


export interface QueryEcommerceGetCsExperimentTrendArgs {
  input: CsExperimentTrendInput;
}


export interface QueryEcommerceGetCsPerformanceArgs {
  endTime?: InputMaybe<Scalars['String']['input']>;
  shopId?: InputMaybe<Scalars['String']['input']>;
  startTime?: InputMaybe<Scalars['String']['input']>;
}


export interface QueryEcommerceGetCsRealtimePerformanceArgs {
  hours?: InputMaybe<Scalars['Int']['input']>;
  shopId?: InputMaybe<Scalars['String']['input']>;
}


export interface QueryEcommerceGetCsUnpaidOrderEvaluationArgs {
  shopId: Scalars['ID']['input'];
}


export interface QueryEcommerceGetCsUnpaidOrderExperimentAnalysisArgs {
  experimentId: Scalars['ID']['input'];
}


export interface QueryEcommerceGetCsUnpaidOrderExperimentPerformanceArgs {
  experimentId: Scalars['ID']['input'];
}


export interface QueryEcommerceGetCsUnpaidOrderReachoutPerformanceArgs {
  endTime?: InputMaybe<Scalars['String']['input']>;
  shopId?: InputMaybe<Scalars['String']['input']>;
  startTime?: InputMaybe<Scalars['String']['input']>;
}


export interface QueryEcommerceGetCsUnpaidOrderReachoutRealtimeArgs {
  hours?: InputMaybe<Scalars['Int']['input']>;
  shopId: Scalars['ID']['input'];
}


export interface QueryEcommerceGetConversationDetailsArgs {
  conversationId: Scalars['String']['input'];
  shopId: Scalars['String']['input'];
}


export interface QueryEcommerceGetConversationMessageDeltaArgs {
  anchor?: InputMaybe<ConversationMessageDeltaAnchorInput>;
  conversationId: Scalars['String']['input'];
  currentMessageId: Scalars['String']['input'];
  locale?: InputMaybe<Scalars['String']['input']>;
  maxPages?: InputMaybe<Scalars['Int']['input']>;
  shopId: Scalars['String']['input'];
}


export interface QueryEcommerceGetConversationMessagesArgs {
  conversationId: Scalars['String']['input'];
  locale?: InputMaybe<Scalars['String']['input']>;
  pageSize: Scalars['Float']['input'];
  pageToken?: InputMaybe<Scalars['String']['input']>;
  shopId: Scalars['String']['input'];
}


export interface QueryEcommerceGetConversationsArgs {
  limit?: InputMaybe<Scalars['Int']['input']>;
  locale?: InputMaybe<Scalars['String']['input']>;
  shopId: Scalars['String']['input'];
}


export interface QueryEcommerceGetCustomerServiceInboxArgs {
  aiEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  escalation?: InputMaybe<CustomerServiceConversationEscalationFilter>;
  hasBadReview?: InputMaybe<Scalars['Boolean']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  shopIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  status?: InputMaybe<CustomerServiceConversationStatus>;
}


export interface QueryEcommerceGetFulfillmentTrackingArgs {
  buyerUserId?: InputMaybe<Scalars['String']['input']>;
  orderId: Scalars['String']['input'];
  shopId: Scalars['String']['input'];
}


export interface QueryEcommerceGetOrderArgs {
  buyerUserId?: InputMaybe<Scalars['String']['input']>;
  orderId: Scalars['String']['input'];
  shopId: Scalars['String']['input'];
}


export interface QueryEcommerceGetOrderSalesStatsArgs {
  input: EcomOrderSalesStatsInput;
}


export interface QueryEcommerceGetOrdersArgs {
  buyerUserId?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  shopId: Scalars['String']['input'];
  status?: InputMaybe<EcomOrderStatus>;
}


export interface QueryEcommerceGetPackageDetailArgs {
  buyerUserId?: InputMaybe<Scalars['String']['input']>;
  packageId: Scalars['String']['input'];
  shopId: Scalars['String']['input'];
}


export interface QueryEcommerceGetPackageShippingDocumentArgs {
  buyerUserId?: InputMaybe<Scalars['String']['input']>;
  documentFormat?: InputMaybe<EcomDocumentFormat>;
  documentSize?: InputMaybe<EcomDocumentSize>;
  documentType: EcomDocumentType;
  packageId: Scalars['String']['input'];
  shopId: Scalars['String']['input'];
}


export interface QueryEcommerceGetPendingConversationsArgs {
  shopId: Scalars['String']['input'];
}


export interface QueryEcommerceGetProductArgs {
  productId: Scalars['String']['input'];
  shopId: Scalars['String']['input'];
}


export interface QueryEcommerceGetRejectReasonsArgs {
  returnOrCancelId: Scalars['String']['input'];
  shopId: Scalars['String']['input'];
}


export interface QueryEcommerceGetReturnRecordsArgs {
  buyerUserId?: InputMaybe<Scalars['String']['input']>;
  returnId: Scalars['String']['input'];
  shopId: Scalars['String']['input'];
}


export interface QueryEcommerceGetShopSkuPerformanceListArgs {
  endDateLt: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  productIds?: InputMaybe<Array<Scalars['String']['input']>>;
  shopId: Scalars['String']['input'];
  startDateGe: Scalars['String']['input'];
}


export interface QueryEcommerceGetSpsAnalyticsArgs {
  input: SpsAnalyticsInput;
}


export interface QueryEcommerceListCsUnpaidOrderExperimentsArgs {
  shopId: Scalars['ID']['input'];
}


export interface QueryEcommerceSearchCsSessionsArgs {
  beginTimeGe: Scalars['Float']['input'];
  beginTimeLt: Scalars['Float']['input'];
  buyerNickname?: InputMaybe<Scalars['String']['input']>;
  pageSize: Scalars['Float']['input'];
  pageToken?: InputMaybe<Scalars['String']['input']>;
  shopId: Scalars['String']['input'];
}


export interface QueryEcommerceSearchCancellationsArgs {
  cancelIds?: InputMaybe<Array<Scalars['String']['input']>>;
  cancelStatus?: InputMaybe<Array<EcomCancelStatusFilter>>;
  cancelTypes?: InputMaybe<Array<EcomCancelTypeFilter>>;
  createTimeGe?: InputMaybe<Scalars['Float']['input']>;
  createTimeLt?: InputMaybe<Scalars['Float']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  orderIds?: InputMaybe<Array<Scalars['String']['input']>>;
  shopId: Scalars['String']['input'];
  updateTimeGe?: InputMaybe<Scalars['Float']['input']>;
  updateTimeLt?: InputMaybe<Scalars['Float']['input']>;
}


export interface QueryEcommerceSearchPackagesArgs {
  createTimeGe?: InputMaybe<Scalars['Float']['input']>;
  createTimeLt?: InputMaybe<Scalars['Float']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  packageStatus?: InputMaybe<EcomPackageStatus>;
  shopId: Scalars['String']['input'];
  sortField?: InputMaybe<EcomSortField>;
  sortOrder?: InputMaybe<EcomSortOrder>;
  updateTimeGe?: InputMaybe<Scalars['Float']['input']>;
  updateTimeLt?: InputMaybe<Scalars['Float']['input']>;
}


export interface QueryEcommerceSearchProductsArgs {
  createTimeGe?: InputMaybe<Scalars['Float']['input']>;
  createTimeLe?: InputMaybe<Scalars['Float']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  shopId: Scalars['String']['input'];
  status?: InputMaybe<EcomProductStatus>;
}


export interface QueryEcommerceSearchReturnsArgs {
  createTimeGe?: InputMaybe<Scalars['Float']['input']>;
  createTimeLt?: InputMaybe<Scalars['Float']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  orderIds?: InputMaybe<Array<Scalars['String']['input']>>;
  returnIds?: InputMaybe<Array<Scalars['String']['input']>>;
  returnStatus?: InputMaybe<Array<EcomReturnStatusFilter>>;
  returnTypes?: InputMaybe<Array<EcomReturnTypeFilter>>;
  shopId: Scalars['String']['input'];
  updateTimeGe?: InputMaybe<Scalars['Float']['input']>;
  updateTimeLt?: InputMaybe<Scalars['Float']['input']>;
}


export interface QueryEmailAccountBindingsArgs {
  status?: InputMaybe<EmailAccountStatus>;
}


export interface QueryExperimentGetAnalyticsArgs {
  experimentId: Scalars['ID']['input'];
}


export interface QueryExpertConversationArgs {
  id: Scalars['ID']['input'];
}


export interface QueryExpertConversationsArgs {
  cursor?: InputMaybe<Scalars['String']['input']>;
  limit?: Scalars['Int']['input'];
}


export interface QueryGetEcommerceBiDataArgs {
  input: EcomBiQueryInput;
}


export interface QueryPersistentResultJobArgs {
  id: Scalars['ID']['input'];
}


export interface QueryPresetSkillManifestArgs {
  serviceIds?: InputMaybe<Array<ServiceId>>;
}


export interface QueryPresetSkillsArgs {
  serviceIds?: InputMaybe<Array<ServiceId>>;
}


export interface QueryPricingArgs {
  appVersion?: InputMaybe<Scalars['String']['input']>;
  deviceId?: InputMaybe<Scalars['String']['input']>;
  language?: InputMaybe<Scalars['String']['input']>;
  platform?: InputMaybe<Scalars['String']['input']>;
}


export interface QueryProductKnowledgeArgs {
  id: Scalars['ID']['input'];
}


export interface QueryProductKnowledgesArgs {
  input?: InputMaybe<ProductKnowledgePageInput>;
}


export interface QueryReadInventoryAnalysisArgs {
  input: ReadInventoryAnalysisInput;
}


export interface QueryReadInventoryGoodMappingsArgs {
  input: ReadInventoryGoodMappingsInput;
}


export interface QueryReadInventoryGoodsArgs {
  input: ReadInventoryGoodsInput;
}


export interface QueryReadPaymentsArgs {
  input?: InputMaybe<ReadPaymentsInput>;
}


export interface QueryReadShopInventoryGoodCoverageArgs {
  input: ReadShopInventoryGoodCoverageInput;
}


export interface QueryReadShopWarehousesArgs {
  input: ReadShopWarehousesInput;
}


export interface QueryReadStripeCheckoutStatusArgs {
  sessionId: Scalars['String']['input'];
}


export interface QueryReadWarehousesArgs {
  input: ReadWarehousesInput;
}


export interface QueryReadWmsAccountsArgs {
  input: ReadWmsAccountsInput;
}


export interface QueryReadWmsInventoryGoodCoverageArgs {
  wmsAccountId: Scalars['ID']['input'];
}


export interface QueryResolveInventoryGoodIdentityArgs {
  sellerSku: Scalars['String']['input'];
  sourceId: Scalars['ID']['input'];
  sourceSystem: InventoryGoodMappingSourceSystem;
}


export interface QueryRunProfileArgs {
  id: Scalars['ID']['input'];
}


export interface QueryRunProfilesArgs {
  surfaceId?: InputMaybe<Scalars['ID']['input']>;
}


export interface QueryShopArgs {
  id: Scalars['ID']['input'];
}


export interface QueryShopAuthStatusArgs {
  id: Scalars['ID']['input'];
}


export interface QueryShopsArgs {
  platform?: InputMaybe<ShopPlatform>;
  refreshTokenExpiringBefore?: InputMaybe<Scalars['String']['input']>;
  region?: InputMaybe<ShopRegion>;
}


export interface QuerySkillArgs {
  slug: Scalars['String']['input'];
}


export interface QuerySkillsArgs {
  category?: InputMaybe<Scalars['String']['input']>;
  chinaAvailable?: InputMaybe<Scalars['Boolean']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
  query?: InputMaybe<Scalars['String']['input']>;
}


export interface QuerySurfaceArgs {
  id: Scalars['ID']['input'];
}


export interface QuerySystemRunProfilesArgs {
  moduleId?: InputMaybe<Scalars['String']['input']>;
}


export interface QueryVerifyRelayTokensArgs {
  tokens: Array<Scalars['String']['input']>;
}


export interface QueryVerifyShopAccessArgs {
  shopIds: Array<Scalars['String']['input']>;
}


export interface QueryWaitForPairingArgs {
  code: Scalars['String']['input'];
}


export interface QueryWhatsAppAccountBindingsArgs {
  status?: InputMaybe<WhatsAppAccountStatus>;
}


export interface QueryWhatsAppProxiesArgs {
  status?: InputMaybe<ProxyStatus>;
}

export interface ReadActionProposalsInput {
  affiliateCollaborationId?: InputMaybe<Scalars['ID']['input']>;
  creatorId?: InputMaybe<Scalars['ID']['input']>;
  creatorRelationshipId?: InputMaybe<Scalars['ID']['input']>;
  /** Opaque cursor returned by affiliateActionProposalPage. Cursors are scoped to the current filters. */
  cursor?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  sampleApplicationRecordId?: InputMaybe<Scalars['ID']['input']>;
  shopId?: InputMaybe<Scalars['ID']['input']>;
  status?: InputMaybe<ActionProposalStatus>;
  type?: InputMaybe<ActionProposalType>;
}

export interface ReadAffiliateApprovalPoliciesInput {
  action?: InputMaybe<ActionProposalType>;
  enabled?: InputMaybe<Scalars['Boolean']['input']>;
}

export interface ReadAffiliateCampaignCreatorStatesInput {
  campaignId: Scalars['ID']['input'];
  cursor?: InputMaybe<Scalars['String']['input']>;
  eligibilityCategories?: InputMaybe<Array<AffiliateCampaignEligibilityCategory>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  reasonCodes?: InputMaybe<Array<Scalars['String']['input']>>;
  status?: InputMaybe<AffiliateCampaignCreatorStateStatus>;
  statuses?: InputMaybe<Array<AffiliateCampaignCreatorStateStatus>>;
}

export interface ReadAffiliateCampaignDailyExecutionsInput {
  campaignId: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}

export interface ReadAffiliateCampaignSearchPlansInput {
  campaignId: Scalars['ID']['input'];
  cursor?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
}

export interface ReadAffiliateCampaignsInput {
  id?: InputMaybe<Scalars['ID']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  shopId?: InputMaybe<Scalars['ID']['input']>;
  status?: InputMaybe<AffiliateCampaignStatus>;
  statuses?: InputMaybe<Array<AffiliateCampaignStatus>>;
}

export interface ReadAffiliateCollaborationsInput {
  campaignId?: InputMaybe<Scalars['ID']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  platformCollaborationId?: InputMaybe<Scalars['String']['input']>;
  productId?: InputMaybe<Scalars['String']['input']>;
  shopId?: InputMaybe<Scalars['ID']['input']>;
  status?: InputMaybe<AffiliateCollaborationStatus>;
  type?: InputMaybe<AffiliateCollaborationType>;
}

export interface ReadAffiliateCreatorsInput {
  creatorId?: InputMaybe<Scalars['ID']['input']>;
  lifecycleStage?: InputMaybe<AffiliateLifecycleStage>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  needsAttentionOnly?: InputMaybe<Scalars['Boolean']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  shopId?: InputMaybe<Scalars['ID']['input']>;
  tagIds?: InputMaybe<Array<Scalars['ID']['input']>>;
}

export interface ReadAffiliateWorkItemsInput {
  affiliateCollaborationId?: InputMaybe<Scalars['ID']['input']>;
  agentDispatchRecommended?: InputMaybe<Scalars['Boolean']['input']>;
  creatorRelationshipId?: InputMaybe<Scalars['ID']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  processingStatus?: InputMaybe<AffiliateRelationshipProcessingStatus>;
  shopId?: InputMaybe<Scalars['ID']['input']>;
  staffReviewRequired?: InputMaybe<Scalars['Boolean']['input']>;
  workKind?: InputMaybe<AffiliateWorkKind>;
}

export interface ReadCreatorCandidatesInput {
  campaignId?: InputMaybe<Scalars['ID']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  shopId: Scalars['ID']['input'];
  sourceSearchRunId?: InputMaybe<Scalars['ID']['input']>;
  sourceType?: InputMaybe<CreatorCandidateSourceType>;
  status?: InputMaybe<CreatorCandidateStatus>;
}

export interface ReadCreatorRelationsInput {
  /** When true, return relationships protected for this shop; otherwise protected relationships are excluded. */
  blocked?: InputMaybe<Scalars['Boolean']['input']>;
  creatorId?: InputMaybe<Scalars['ID']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  shopId: Scalars['ID']['input'];
  tagIds?: InputMaybe<Array<Scalars['ID']['input']>>;
}

export interface ReadCreatorSearchRunsInput {
  campaignId?: InputMaybe<Scalars['ID']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  requestedByRunId?: InputMaybe<Scalars['String']['input']>;
  shopId?: InputMaybe<Scalars['ID']['input']>;
  status?: InputMaybe<CreatorSearchRunStatus>;
}

/** Read source-of-truth inventory and order-derived SKU demand rows for inventory analysis. endDateLt is exclusive. */
export interface ReadInventoryAnalysisInput {
  /** End date exclusive in shop-local analytics date format (YYYY-MM-DD). */
  endDateLt: Scalars['String']['input'];
  /** Exact seller SKUs to analyze. Omit or pass an empty list to include active shop SKUs plus seller SKUs that currently have stock or have sales in the requested date range. */
  sellerSkus?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Shop Mongo IDs to include in the analysis. */
  shopIds: Array<Scalars['ID']['input']>;
  /** Start date inclusive in shop-local analytics date format (YYYY-MM-DD). */
  startDateGe: Scalars['String']['input'];
}

/** Read external SKU to InventoryGood mappings. Pass id to read one mapping, or omit id to list by filters. */
export interface ReadInventoryGoodMappingsInput {
  /** InventoryGoodMapping ID. When provided, the result contains zero or one mapping. */
  id?: InputMaybe<Scalars['ID']['input']>;
  /** Canonical InventoryGood ID to find mappings for. */
  inventoryGoodId?: InputMaybe<Scalars['ID']['input']>;
  /** Exact seller SKU or warehouse goods SKU in the external source. */
  sellerSku?: InputMaybe<Scalars['String']['input']>;
  /** Source connection Mongo ID, such as Shop._id or WmsAccount._id. */
  sourceId?: InputMaybe<Scalars['ID']['input']>;
  /** External source system filter, such as TIKTOK_SHOP or YEJOIN_WMS. */
  sourceSystem?: InputMaybe<InventoryGoodMappingSourceSystem>;
  /** Filter by lifecycle status. Defaults to ACTIVE when omitted. */
  status?: InputMaybe<InventoryGoodMappingStatus>;
}

/** Read canonical inventory goods. Pass id to read one good, or omit id to list by filters. */
export interface ReadInventoryGoodsInput {
  /** InventoryGood ID. When provided, the result contains zero or one good. */
  id?: InputMaybe<Scalars['ID']['input']>;
  /** Maximum number of goods to return, capped at 500. */
  limit?: InputMaybe<Scalars['Int']['input']>;
  /** Search by exact sku, barcode, GTIN, or text metadata. */
  search?: InputMaybe<Scalars['String']['input']>;
  /** Filter by lifecycle status. Defaults to ACTIVE when omitted. */
  status?: InputMaybe<InventoryGoodStatus>;
}

/** Read payments by ID, merchant order ID, or list recent payments. */
export interface ReadPaymentsInput {
  id?: InputMaybe<Scalars['ID']['input']>;
  merchantOrderId?: InputMaybe<Scalars['String']['input']>;
}

/** Read active shop SKU coverage against canonical InventoryGood identity. */
export interface ReadShopInventoryGoodCoverageInput {
  /** Shop Mongo ID to audit. */
  shopId: Scalars['ID']['input'];
}

/** Read shop-scoped platform warehouses. Pass id to read one row, or omit id to list by filters. */
export interface ReadShopWarehousesInput {
  /** ShopWarehouse ID. When provided, the result contains zero or one row. */
  id?: InputMaybe<Scalars['ID']['input']>;
  /** Connected Shop ID whose platform warehouses should be listed. */
  shopId?: InputMaybe<Scalars['ID']['input']>;
  /** Filter by lifecycle status. Defaults to ACTIVE when omitted. */
  status?: InputMaybe<ShopWarehouseStatus>;
  /** Canonical Warehouse ID to find platform warehouses mapped to it. */
  warehouseId?: InputMaybe<Scalars['ID']['input']>;
}

/** Read canonical warehouses. Pass id to read one warehouse, or omit id to list by filters. */
export interface ReadWarehousesInput {
  /** Canonical Warehouse ID. When provided, the result contains zero or one warehouse. */
  id?: InputMaybe<Scalars['ID']['input']>;
  /** Filter by provider, such as YEJOIN or TIKTOK_FBT. */
  provider?: InputMaybe<WarehouseProvider>;
  /** Search by warehouse name, code, or external warehouse ID. */
  search?: InputMaybe<Scalars['String']['input']>;
  /** Filter by source connection ID, such as WmsAccount._id or Shop._id. */
  sourceId?: InputMaybe<Scalars['ID']['input']>;
  /** Filter by lifecycle status. Defaults to ACTIVE when omitted. */
  status?: InputMaybe<WarehouseStatus>;
  /** Filter by warehouse type, such as OFFICIAL_PLATFORM or THIRD_PARTY_WMS. */
  warehouseType?: InputMaybe<WarehouseType>;
}

/** Read WMS accounts. Pass id to read one account, or omit id to list by filters. Credentials are never returned. */
export interface ReadWmsAccountsInput {
  /** WmsAccount ID. When provided, the result contains zero or one account. */
  id?: InputMaybe<Scalars['ID']['input']>;
  /** Filter by user-facing WMS account label. */
  label?: InputMaybe<Scalars['String']['input']>;
  /** Filter by WMS provider, such as YEJOIN. */
  provider?: InputMaybe<WmsAccountProvider>;
  /** Filter by lifecycle status. Defaults to ACTIVE when omitted. */
  status?: InputMaybe<WmsAccountStatus>;
}

export interface RecordAnnouncementEventInput {
  appVersion?: InputMaybe<Scalars['String']['input']>;
  deviceId?: InputMaybe<Scalars['String']['input']>;
  eventType: AnnouncementEventType;
  key: Scalars['String']['input'];
  locale?: InputMaybe<Scalars['String']['input']>;
  surface: AnnouncementSurface;
}

/** Refund a provider-backed payment. */
export interface RefundPaymentGraphqlInput {
  /** Refund amount in minor units. Defaults to the full payment amount. */
  amountMinor?: InputMaybe<Scalars['Int']['input']>;
  paymentId: Scalars['ID']['input'];
  /** Optional caller-supplied refund order ID. Must be unique per provider refund. */
  refundOrderId?: InputMaybe<Scalars['String']['input']>;
}

export interface RegisterExpertKnowledgeReleaseInput {
  artifactDigest: Scalars['String']['input'];
  artifactUrl: Scalars['String']['input'];
  releaseNotes?: InputMaybe<Scalars['String']['input']>;
  sourceCommit?: InputMaybe<Scalars['String']['input']>;
  version: Scalars['String']['input'];
}

/** Registration input */
export interface RegisterInput {
  /** Optional anonymous website-to-desktop acquisition attribution. */
  attribution?: InputMaybe<MarketingAttributionInput>;
  captchaAnswer: Scalars['String']['input'];
  captchaToken: Scalars['String']['input'];
  email: Scalars['String']['input'];
  /** Optional six-character agent invite code. */
  inviteCode?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  password: Scalars['String']['input'];
}

export interface RelayTokenResult {
  desktopDeviceId?: Maybe<Scalars['String']['output']>;
  mobileDeviceId?: Maybe<Scalars['String']['output']>;
  pairingId?: Maybe<Scalars['String']['output']>;
  valid: Scalars['Boolean']['output'];
}

export interface RemoveAffiliateOpenCollaborationInput {
  collaborationId: Scalars['ID']['input'];
  shopId: Scalars['ID']['input'];
}

export interface RemoveAffiliateOpenCollaborationPayload {
  collaboration: AffiliateCollaboration;
  terminatedEffectiveTime?: Maybe<Scalars['DateTimeISO']['output']>;
}

export interface RemoveAffiliateTargetCollaborationInput {
  collaborationId: Scalars['ID']['input'];
  shopId: Scalars['ID']['input'];
}

export interface RemoveAffiliateTargetCollaborationPayload {
  collaboration: AffiliateCollaboration;
}

export interface ReportAffiliateCampaignSearchPlanGenerationFailureInput {
  errorCode: Scalars['String']['input'];
  generation: Scalars['Int']['input'];
  leaseToken: Scalars['String']['input'];
  searchPlanId: Scalars['ID']['input'];
}

export interface ResolveAffiliateCampaignProductInput {
  productId: Scalars['String']['input'];
  shopId: Scalars['ID']['input'];
}

/** Agent-authored Target Collaboration details. Creator identity is injected from the trusted Affiliate run context. */
export interface ResolveAffiliateTargetCollaborationIntentInput {
  endTime: Scalars['DateTimeISO']['input'];
  hasFreeSample: Scalars['Boolean']['input'];
  isSampleApprovalExempt: Scalars['Boolean']['input'];
  message?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  products: Array<ActionProposalTargetCollaborationProductIntentInput>;
  sellerContactInfo: ActionProposalSellerContactInfoIntentInput;
  /** Authorized seller shop that should own the new Target Collaboration. This is selected explicitly and is not forced to the trigger shop. */
  shopId: Scalars['ID']['input'];
}

/** One backend-supported Affiliate action. Populate required fields matching type: SEND_MESSAGE -> structured messageIntent.parts, REVIEW_SAMPLE_APPLICATION -> sampleApplicationRecordId + sampleReviewDecision or sampleReviewIntent, CREATE_TARGET_COLLABORATION -> targetCollaborationIntent. */
export interface ResolveAffiliateWorkItemActionInput {
  affiliateCollaborationId?: InputMaybe<Scalars['ID']['input']>;
  expiresAt?: InputMaybe<Scalars['DateTimeISO']['input']>;
  /** Required only when type is SEND_MESSAGE. Supply one to ten ordered parts; attachments must reference staged draft assets. */
  messageIntent?: InputMaybe<ResolveAffiliateWorkItemMessageIntentInput>;
  productId?: InputMaybe<Scalars['String']['input']>;
  /** Structured rejection reason. Required when sampleReviewDecision is REJECT; omit for APPROVE. */
  rejectReason?: InputMaybe<AffiliateSampleRejectReason>;
  /** Free-text explanation for the rejection reason. Required when rejectReason is OTHER; omit for approvals. */
  rejectReasonExplanation?: InputMaybe<Scalars['String']['input']>;
  sampleApplicationRecordId?: InputMaybe<Scalars['ID']['input']>;
  /** Agent-facing shortcut for REVIEW_SAMPLE_APPLICATION. Use APPROVE or REJECT. Backend normalizes this into sampleReviewIntent.decision. */
  sampleReviewDecision?: InputMaybe<AffiliateSampleReviewDecision>;
  /** Required only when type is REVIEW_SAMPLE_APPLICATION unless the agent-facing sample review shortcut fields are provided. Prefer the flat shortcut fields when calling affiliate_resolve_work_item from an agent. */
  sampleReviewIntent?: InputMaybe<ActionProposalSampleReviewIntentInput>;
  /** Required only when type is CREATE_TARGET_COLLABORATION. Creator identity and shop are injected from the trusted run context. */
  targetCollaborationIntent?: InputMaybe<ResolveAffiliateTargetCollaborationIntentInput>;
  /** Supported values are SEND_MESSAGE, REVIEW_SAMPLE_APPLICATION, and CREATE_TARGET_COLLABORATION. Do not invent unsupported seller operations. */
  type: ActionProposalType;
}

export interface ResolveAffiliateWorkItemInput {
  action?: InputMaybe<ResolveAffiliateWorkItemActionInput>;
  /** Ordered action list for bundled affiliate work. If provided, backend evaluates/executes the whole list together. */
  actions?: InputMaybe<Array<ResolveAffiliateWorkItemActionInput>>;
  affiliateCollaborationId?: InputMaybe<Scalars['ID']['input']>;
  /** Committed CreatorRelationship checkpoint used as the base for this agent dispatch. */
  baseCheckpointId?: InputMaybe<Scalars['String']['input']>;
  /** Event cursor represented by baseCheckpointId. */
  baseEventCursor?: InputMaybe<Scalars['Int']['input']>;
  businessDeveloperConfigRevision?: InputMaybe<Scalars['Int']['input']>;
  businessDeveloperIdSnapshot?: InputMaybe<Scalars['ID']['input']>;
  /** Candidate checkpoint id for this agent dispatch. Pending proposals store it; successful execution promotes it. */
  candidateCheckpointId?: InputMaybe<Scalars['String']['input']>;
  creatorRelationshipId: Scalars['ID']['input'];
  /** Choose REQUEST_ACTION for concrete platform actions, NO_ACTION_NEEDED when review completes the work without an action, or FAILED_OR_INCOMPLETE when the run cannot complete the work. */
  decision: AffiliateWorkItemResolutionDecision;
  /** The relationship work boundary timestamp that this decision handled. Used as the ack boundary. */
  handledSignalAt?: InputMaybe<Scalars['DateTimeISO']['input']>;
  /** Optional Agent-requested review of the concrete action bundle. Presence forces an ActionProposal even when no approval policy matches. It never changes Collaboration or Relationship agenda ownership. */
  humanReviewRequest?: InputMaybe<AffiliateHumanReviewRequestInput>;
  operatorSummary: Scalars['String']['input'];
  /** Trusted Working Agenda prediction evidence injected by the Desktop run scaffold. Agents should omit this field. */
  predictionCacheIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  productId?: InputMaybe<Scalars['String']['input']>;
  relationshipOperationalConfigRevision?: InputMaybe<Scalars['Int']['input']>;
  sampleApplicationRecordId?: InputMaybe<Scalars['ID']['input']>;
  /** Latest event cursor included in this agent run context. */
  targetEventCursor?: InputMaybe<Scalars['Int']['input']>;
  /** Trusted trigger-shop provenance. Backend derives each action destination from its relationship-owned record or explicit authorized target shop; this value is not a read boundary. */
  triggerShopId: Scalars['ID']['input'];
}

export interface ResolveAffiliateWorkItemMessageIntentInput {
  creatorId?: InputMaybe<Scalars['ID']['input']>;
  creatorOpenId?: InputMaybe<Scalars['String']['input']>;
  /** Required when starting a new email thread. Ignored for an exact reply to an existing email message. */
  emailSubject?: InputMaybe<Scalars['String']['input']>;
  /** One to ten ordered creator-facing message parts. Use only text, staged draftAssetId attachments, or typed platform-native cards. */
  parts: Array<AffiliateOutboundMessagePartInput>;
  /** Optional explicit outbound channel override. Omit to inherit the trigger channel or relationship default. */
  preferredChannel?: InputMaybe<AffiliateMessageChannel>;
}

export interface ResolveAffiliateWorkItemPayload {
  actionMode?: Maybe<AffiliateActionRequestMode>;
  affiliateCollaboration?: Maybe<AffiliateCollaboration>;
  decision: AffiliateWorkItemResolutionDecision;
  executionResult?: Maybe<ActionProposalExecutionResultSnapshot>;
  proposal?: Maybe<ActionProposal>;
  stale: Scalars['Boolean']['output'];
}

/** Review optimization settings per shop */
export interface ReviewOptimizationSettings {
  badReviewReachout: BadReviewReachoutSettings;
  enabled: Scalars['Boolean']['output'];
}

/** Review optimization settings patch. Omit or pass null to keep. */
export interface ReviewOptimizationSettingsInput {
  /** Bad-review reachout settings. Omit or pass null to keep. */
  badReviewReachout?: InputMaybe<BadReviewReachoutSettingsInput>;
  /** Review optimization enabled flag. Omit or pass null to keep. */
  enabled?: InputMaybe<Scalars['Boolean']['input']>;
}

/** RunProfile entity — defines tool selection for a specific run. userId=null for system presets. */
export interface RunProfile {
  createdAt: Scalars['DateTimeISO']['output'];
  id: Scalars['ID']['output'];
  /** Module this system preset belongs to. Null for user-created profiles. */
  moduleId?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  selectedToolIds: Array<Scalars['String']['output']>;
  surfaceId: Scalars['String']['output'];
  updatedAt: Scalars['DateTimeISO']['output'];
  userId?: Maybe<Scalars['String']['output']>;
}

/** Order snapshot linked from an affiliate sample application. */
export interface SampleApplicationOrderRecord {
  carrier?: Maybe<Scalars['String']['output']>;
  platformOrderId?: Maybe<Scalars['String']['output']>;
  trackingNumber?: Maybe<Scalars['String']['output']>;
}

/** Sample application state from TikTok Shop affiliate workflows. */
export interface SampleApplicationRecord {
  affiliateCollaborationId?: Maybe<Scalars['ID']['output']>;
  approveExpirationAt?: Maybe<Scalars['DateTimeISO']['output']>;
  carrier?: Maybe<Scalars['String']['output']>;
  collaborationLinkBasis?: Maybe<AffiliateSampleCollaborationLinkBasis>;
  collaborationLinkResolvedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  collaborationType?: Maybe<AffiliateCollaborationType>;
  /** Commission terms snapshot as a decimal ratio; 0.15 means 15%. */
  commissionRate?: Maybe<Scalars['Float']['output']>;
  commissionRateObservedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  commissionRateSource?: Maybe<AffiliateSampleCommissionRateSource>;
  creatorId?: Maybe<Scalars['ID']['output']>;
  creatorOpenId?: Maybe<Scalars['String']['output']>;
  creatorRelationshipId: Scalars['ID']['output'];
  deliveredAt?: Maybe<Scalars['DateTimeISO']['output']>;
  firstObservedAt: Scalars['DateTimeISO']['output'];
  /** True when TikTok Shop has confirmed that the Creator already published at least one affiliate work for this Sample Application. */
  hasPublishedContent: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  lastNotificationId?: Maybe<Scalars['String']['output']>;
  lastObservedAt: Scalars['DateTimeISO']['output'];
  lastSyncSource: AffiliateProjectionSyncSource;
  /** Legacy storage name for the Provider publication time of the latest known affiliate work. Prefer latestPublishedContentAt in Agent-facing reads. */
  latestObservedContentAt?: Maybe<Scalars['DateTimeISO']['output']>;
  latestObservedContentFormat?: Maybe<Scalars['String']['output']>;
  latestObservedContentId?: Maybe<Scalars['String']['output']>;
  latestObservedContentPaidOrderCount?: Maybe<Scalars['Int']['output']>;
  latestObservedContentUrl?: Maybe<Scalars['String']['output']>;
  latestObservedContentViewCount?: Maybe<Scalars['Int']['output']>;
  /** Provider publication time of the latest known affiliate work; a non-null value means the work is already published, not merely planned or detected locally. */
  latestPublishedContentAt?: Maybe<Scalars['DateTimeISO']['output']>;
  /** Legacy storage name for the number of Provider-confirmed published affiliate works. Prefer publishedContentCount in Agent-facing reads. */
  observedContentCount: Scalars['Int']['output'];
  order?: Maybe<SampleApplicationOrderRecord>;
  platformApplicationId: Scalars['String']['output'];
  platformCollaborationId?: Maybe<Scalars['String']['output']>;
  platformFulfillmentStatus?: Maybe<Scalars['String']['output']>;
  platformOpenCollaborationId?: Maybe<Scalars['String']['output']>;
  platformStatus?: Maybe<Scalars['String']['output']>;
  platformTargetCollaborationId?: Maybe<Scalars['String']['output']>;
  productId?: Maybe<Scalars['String']['output']>;
  projectionRevision: Scalars['Int']['output'];
  providerEventAt?: Maybe<Scalars['DateTimeISO']['output']>;
  /** Number of TikTok Shop-confirmed affiliate works already published for this Sample Application. */
  publishedContentCount: Scalars['Int']['output'];
  /** RivonClaw-owned sample lifecycle state optimized for agent and operator understanding. */
  sampleWorkStatus: SampleWorkStatus;
  shippedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  shopId: Scalars['ID']['output'];
  trackingNumber?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['ID']['output'];
}

/** RivonClaw-owned, agent-facing sample lifecycle state. Platform raw statuses stay in platformSnapshotJson. */
export const SampleWorkStatus = {
  ApprovedAwaitingShipment: 'APPROVED_AWAITING_SHIPMENT',
  Cancelled: 'CANCELLED',
  ContentObservedReviewing: 'CONTENT_OBSERVED_REVIEWING',
  DeliveredAwaitingContent: 'DELIVERED_AWAITING_CONTENT',
  Expired: 'EXPIRED',
  Fulfilled: 'FULFILLED',
  FulfillmentFailed: 'FULFILLMENT_FAILED',
  PlatformStatusUnknown: 'PLATFORM_STATUS_UNKNOWN',
  RequestPendingReview: 'REQUEST_PENDING_REVIEW',
  ShippedInTransit: 'SHIPPED_IN_TRANSIT'
} as const;

export type SampleWorkStatus = typeof SampleWorkStatus[keyof typeof SampleWorkStatus];
export interface SellerSkuProductCandidate {
  existingProductKnowledgeId?: Maybe<Scalars['ID']['output']>;
  existingProductKnowledgeName?: Maybe<Scalars['String']['output']>;
  existingProductKnowledgeStatus?: Maybe<ProductKnowledgeStatus>;
  matchedSellerSkus: Array<Scalars['String']['output']>;
  platform: Scalars['String']['output'];
  productCoverImage?: Maybe<Scalars['String']['output']>;
  productId: Scalars['String']['output'];
  productStatus?: Maybe<Scalars['String']['output']>;
  productTitle: Scalars['String']['output'];
  sellerSkus: Array<Scalars['String']['output']>;
  shopId: Scalars['ID']['output'];
  shopName: Scalars['String']['output'];
  shopRegion?: Maybe<Scalars['String']['output']>;
}

export interface SellerSkuProductDiscoveryPayload {
  candidates: Array<SellerSkuProductCandidate>;
  searchedShopCount: Scalars['Int']['output'];
  sellerSku: Scalars['String']['output'];
  shopFailures: Array<SellerSkuShopSearchFailure>;
  successfulShopCount: Scalars['Int']['output'];
}

export interface SellerSkuShopSearchFailure {
  message: Scalars['String']['output'];
  shopId: Scalars['ID']['output'];
  shopName: Scalars['String']['output'];
}

export interface SendAffiliateCreatorMessageInput {
  affiliateCollaborationId?: InputMaybe<Scalars['ID']['input']>;
  /** Staff-only exact BD-account-to-Creator contact route override. */
  channelContactId?: InputMaybe<Scalars['ID']['input']>;
  creatorRelationshipId: Scalars['ID']['input'];
  emailSubject?: InputMaybe<Scalars['String']['input']>;
  idempotencyKey?: InputMaybe<Scalars['String']['input']>;
  parts: Array<AffiliateOutboundMessagePartInput>;
  preferredChannel?: InputMaybe<AffiliateMessageChannel>;
  shopId: Scalars['ID']['input'];
}

export interface SendAffiliateCreatorMessagePayload {
  affiliateCollaboration?: Maybe<AffiliateCollaboration>;
  delivery?: Maybe<AffiliateMessageDelivery>;
}

/** Business service type identifiers */
export const ServiceId = {
  AffiliateManagement: 'AFFILIATE_MANAGEMENT',
  CustomerService: 'CUSTOMER_SERVICE',
  EcommerceAnalytics: 'ECOMMERCE_ANALYTICS',
  InventoryManagement: 'INVENTORY_MANAGEMENT',
  OrderManagement: 'ORDER_MANAGEMENT'
} as const;

export type ServiceId = typeof ServiceId[keyof typeof ServiceId];
export interface SetAffiliateBusinessDeveloperPreferredAccountInput {
  accountBindingId?: InputMaybe<Scalars['ID']['input']>;
  businessDeveloperId: Scalars['ID']['input'];
  channel: AffiliateMessageChannel;
}

export interface SetAffiliateCampaignStatusInput {
  campaignId: Scalars['ID']['input'];
  status: AffiliateCampaignStatus;
}

export interface SetCreatorEmailContactInput {
  /** CreatorRelationship is the business boundary for setting creator contact channels. */
  creatorRelationshipId: Scalars['ID']['input'];
  email: Scalars['String']['input'];
}

export interface SetCreatorWhatsAppContactInput {
  creatorPhone: Scalars['String']['input'];
  /** CreatorRelationship is the business boundary for setting creator contact channels. */
  creatorRelationshipId: Scalars['ID']['input'];
}

/** A connected e-commerce shop */
export interface Shop {
  accessTokenExpiresAt?: Maybe<Scalars['DateTimeISO']['output']>;
  alias?: Maybe<Scalars['String']['output']>;
  authStatus: ShopAuthStatus;
  authStatusReason?: Maybe<ShopAuthStatusReason>;
  authorizedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  /** Non-sensitive grouping key shared by shops that belong to the same platform seller. */
  collectionKey: Scalars['String']['output'];
  createdAt: Scalars['DateTimeISO']['output'];
  grantedScopes: Array<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  platform: ShopPlatform;
  platformAppId: Scalars['String']['output'];
  platformShopId: Scalars['String']['output'];
  refreshTokenExpiresAt?: Maybe<Scalars['DateTimeISO']['output']>;
  region?: Maybe<ShopRegion>;
  revokedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  services: ShopServiceConfig;
  shopName: Scalars['String']['output'];
  /** IANA timezone used for shop-local platform analytics dates */
  timezone: Scalars['String']['output'];
  timezoneSource: ShopTimezoneSource;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['String']['output'];
}

/** OAuth authorization status of a connected shop */
export const ShopAuthStatus = {
  Authorized: 'AUTHORIZED',
  Disconnected: 'DISCONNECTED',
  PendingAuth: 'PENDING_AUTH',
  Revoked: 'REVOKED',
  TokenExpired: 'TOKEN_EXPIRED'
} as const;

export type ShopAuthStatus = typeof ShopAuthStatus[keyof typeof ShopAuthStatus];
/** Platform or user action that most recently changed shop authorization */
export const ShopAuthStatusReason = {
  SellerDeauthorizationWebhook: 'SELLER_DEAUTHORIZATION_WEBHOOK'
} as const;

export type ShopAuthStatusReason = typeof ShopAuthStatusReason[keyof typeof ShopAuthStatusReason];
/** Shop auth/token status */
export interface ShopAuthStatusResponse {
  accessTokenExpiresAt?: Maybe<Scalars['DateTimeISO']['output']>;
  hasToken: Scalars['Boolean']['output'];
  refreshTokenExpiresAt?: Maybe<Scalars['DateTimeISO']['output']>;
}

export interface ShopBillingStatus {
  affiliate: BillingEntitlementStatus;
  analytics: BillingEntitlementStatus;
  customerService: BillingEntitlementStatus;
  inventory: BillingEntitlementStatus;
  shopId: Scalars['String']['output'];
  shopName: Scalars['String']['output'];
}

/** Coverage view for active shop SKUs and canonical InventoryGoods. */
export interface ShopInventoryGoodCoveragePayload {
  /** Product status scanned. This audit intentionally only checks active shop products. */
  productStatus: EcomProductStatus;
  /** Number of active shop SKU rows that can be safely resolved to InventoryGood. */
  recognizedShopSkusCount: Scalars['Int']['output'];
  /** Shop Mongo ID that was audited. */
  shopId: Scalars['ID']['output'];
  /** InventoryGoodMapping source ID used for this shop. */
  sourceId: Scalars['ID']['output'];
  /** InventoryGoodMapping source system used for this shop. */
  sourceSystem: InventoryGoodMappingSourceSystem;
  /** Active InventoryGoods that no active shop SKU currently resolves to. */
  unmatchedInventoryGoods: Array<InventoryGood>;
  /** Active shop SKU rows that cannot be safely resolved to InventoryGood. */
  unrecognizedShopSkus: Array<UnrecognizedShopSku>;
}

/** E-commerce platform identifier */
export const ShopPlatform = {
  TiktokShop: 'TIKTOK_SHOP'
} as const;

export type ShopPlatform = typeof ShopPlatform[keyof typeof ShopPlatform];
/** Country/region code for a connected shop */
export const ShopRegion = {
  Be: 'BE',
  Cz: 'CZ',
  De: 'DE',
  Es: 'ES',
  Fr: 'FR',
  Gb: 'GB',
  Gr: 'GR',
  Hu: 'HU',
  Id: 'ID',
  Ie: 'IE',
  It: 'IT',
  Mx: 'MX',
  My: 'MY',
  Nl: 'NL',
  Ph: 'PH',
  Pt: 'PT',
  Sg: 'SG',
  Th: 'TH',
  Us: 'US',
  Vn: 'VN'
} as const;

export type ShopRegion = typeof ShopRegion[keyof typeof ShopRegion];
/** Per-shop service feature toggles */
export interface ShopServiceConfig {
  affiliateService: AffiliateServiceSettings;
  customerService: CustomerServiceSettings;
  wms: WmsSettings;
}

/** Input for updating per-shop service toggles */
export interface ShopServiceConfigInput {
  affiliateService?: InputMaybe<AffiliateServiceSettingsInput>;
  customerService?: InputMaybe<CustomerServiceSettingsInput>;
  wms?: InputMaybe<WmsSettingsInput>;
}

/** How the shop analytics timezone was resolved */
export const ShopTimezoneSource = {
  Manual: 'MANUAL',
  Platform: 'PLATFORM',
  RegionDefault: 'REGION_DEFAULT'
} as const;

export type ShopTimezoneSource = typeof ShopTimezoneSource[keyof typeof ShopTimezoneSource];
/** Warehouse identity exposed by an e-commerce shop platform */
export interface ShopWarehouse {
  address?: Maybe<WarehouseAddress>;
  createdAt: Scalars['DateTimeISO']['output'];
  effectStatus: ShopWarehouseEffectStatus;
  id: Scalars['ID']['output'];
  isDefault: Scalars['Boolean']['output'];
  lastSyncedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  name: Scalars['String']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  /** Platform physical/entity warehouse ID, such as TikTok entity_id. */
  platformEntityId?: Maybe<Scalars['String']['output']>;
  /** Raw platform sub type, such as DOMESTIC_WAREHOUSE or CB_OVERSEA_WAREHOUSE. */
  platformSubType?: Maybe<Scalars['String']['output']>;
  /** Warehouse ID returned by the shop platform, such as TikTok warehouse_id. */
  platformWarehouseId: Scalars['String']['output'];
  regionCode?: Maybe<InventoryRegionCode>;
  shopId: Scalars['ID']['output'];
  status: ShopWarehouseStatus;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['String']['output'];
  /** Canonical Warehouse ID after matching. Null means this platform warehouse is not safely mapped yet. */
  warehouseId?: Maybe<Scalars['ID']['output']>;
  warehouseType: ShopWarehouseType;
}

/** Platform-side availability state of a shop warehouse */
export const ShopWarehouseEffectStatus = {
  Disabled: 'DISABLED',
  Enabled: 'ENABLED',
  Restricted: 'RESTRICTED',
  Unknown: 'UNKNOWN'
} as const;

export type ShopWarehouseEffectStatus = typeof ShopWarehouseEffectStatus[keyof typeof ShopWarehouseEffectStatus];
/** Lifecycle state of a shop-scoped platform warehouse */
export const ShopWarehouseStatus = {
  Active: 'ACTIVE',
  Archived: 'ARCHIVED'
} as const;

export type ShopWarehouseStatus = typeof ShopWarehouseStatus[keyof typeof ShopWarehouseStatus];
/** Result of syncing shop-scoped platform warehouses */
export interface ShopWarehouseSyncPayload {
  /** Official fulfillment warehouse rows auto-mapped through provider APIs such as TikTok FBT. */
  officialFulfillmentWarehouses: Array<ShopWarehouse>;
  /** Platform warehouse rows returned by the shop logistics warehouse API. */
  platformWarehouses: Array<ShopWarehouse>;
}

/** Platform warehouse role in a shop */
export const ShopWarehouseType = {
  Fulfillment: 'FULFILLMENT',
  Return: 'RETURN',
  Sales: 'SALES'
} as const;

export type ShopWarehouseType = typeof ShopWarehouseType[keyof typeof ShopWarehouseType];
export interface Skill {
  author: Scalars['String']['output'];
  chinaAvailable: Scalars['Boolean']['output'];
  desc_en: Scalars['String']['output'];
  desc_zh: Scalars['String']['output'];
  downloads: Scalars['Int']['output'];
  hidden: Scalars['Boolean']['output'];
  labels: Array<SkillLabel>;
  labelsManuallyOverridden: Scalars['Boolean']['output'];
  name_en: Scalars['String']['output'];
  name_zh: Scalars['String']['output'];
  slug: Scalars['String']['output'];
  stars: Scalars['Int']['output'];
  tags: Array<Scalars['String']['output']>;
  version: Scalars['String']['output'];
}

export interface SkillCategoryResult {
  count: Scalars['Int']['output'];
  id: Scalars['String']['output'];
  name_en: Scalars['String']['output'];
  name_zh: Scalars['String']['output'];
}

export interface SkillConnection {
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  skills: Array<Skill>;
  total: Scalars['Int']['output'];
}

/** Editorial labels for skill promotion */
export const SkillLabel = {
  Recommended: 'RECOMMENDED'
} as const;

export type SkillLabel = typeof SkillLabel[keyof typeof SkillLabel];
export const SpsAnalyticsAvailability = {
  Available: 'AVAILABLE',
  MissingScope: 'MISSING_SCOPE',
  NotAuthorized: 'NOT_AUTHORIZED',
  PlatformError: 'PLATFORM_ERROR',
  UnsupportedPlatform: 'UNSUPPORTED_PLATFORM',
  UnsupportedRegion: 'UNSUPPORTED_REGION'
} as const;

export type SpsAnalyticsAvailability = typeof SpsAnalyticsAvailability[keyof typeof SpsAnalyticsAvailability];
export interface SpsAnalyticsDistributionView {
  count?: Maybe<Scalars['Int']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  percent?: Maybe<Scalars['Float']['output']>;
}

export interface SpsAnalyticsInput {
  metricCode: SpsAnalyticsMetricCode;
  /** Optional current-user onboarded Shop Mongo IDs. Omit to load all connected shops. */
  shopIds?: InputMaybe<Array<Scalars['ID']['input']>>;
}

export interface SpsAnalyticsMarketView {
  apiSupported: Scalars['Boolean']['output'];
  market: Scalars['String']['output'];
  shops: Array<SpsAnalyticsShopView>;
}

export const SpsAnalyticsMetricCode = {
  Aht: 'AHT',
  ImDsat: 'IM_DSAT',
  Nbfr: 'NBFR',
  Nrr: 'NRR',
  Otdr: 'OTDR',
  Sfcr: 'SFCR'
} as const;

export type SpsAnalyticsMetricCode = typeof SpsAnalyticsMetricCode[keyof typeof SpsAnalyticsMetricCode];
export interface SpsAnalyticsShopView {
  availability: SpsAnalyticsAvailability;
  calculationDenominatorLabel?: Maybe<Scalars['String']['output']>;
  calculationDenominatorValue?: Maybe<Scalars['Float']['output']>;
  calculationNumeratorLabel?: Maybe<Scalars['String']['output']>;
  calculationNumeratorValue?: Maybe<Scalars['Float']['output']>;
  diagnosisDetails: Array<Scalars['String']['output']>;
  diagnosisSummaries: Array<Scalars['String']['output']>;
  distributionDetails: Array<SpsAnalyticsDistributionView>;
  evaluationDurationDays?: Maybe<Scalars['Int']['output']>;
  excellentThreshold?: Maybe<Scalars['Float']['output']>;
  market: Scalars['String']['output'];
  metricCode: SpsAnalyticsMetricCode;
  metricDimension?: Maybe<Scalars['String']['output']>;
  metricScore?: Maybe<Scalars['Float']['output']>;
  metricStatus?: Maybe<Scalars['String']['output']>;
  metricStatusText?: Maybe<Scalars['String']['output']>;
  metricValue?: Maybe<Scalars['Float']['output']>;
  metricValueUnit?: Maybe<Scalars['String']['output']>;
  observedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  peerPercentile?: Maybe<Scalars['Float']['output']>;
  poorThreshold?: Maybe<Scalars['Float']['output']>;
  primaryCategoryName?: Maybe<Scalars['String']['output']>;
  shopAlias?: Maybe<Scalars['String']['output']>;
  shopId: Scalars['ID']['output'];
  shopName: Scalars['String']['output'];
  sourceUpdatedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  spsScore?: Maybe<Scalars['Float']['output']>;
  spsTier?: Maybe<Scalars['String']['output']>;
  spsTierText?: Maybe<Scalars['String']['output']>;
  topIssueCodes: Array<Scalars['String']['output']>;
  topIssueSummary?: Maybe<Scalars['String']['output']>;
  trend: Array<SpsAnalyticsTrendPointView>;
  unavailableReason?: Maybe<Scalars['String']['output']>;
}

export interface SpsAnalyticsTrendPointView {
  /** TikTok metric observation date in YYYY-MM-DD format. */
  recordDate: Scalars['String']['output'];
  value: Scalars['Float']['output'];
}

export interface SpsAnalyticsView {
  asOf: Scalars['DateTimeISO']['output'];
  markets: Array<SpsAnalyticsMarketView>;
  metricCode: SpsAnalyticsMetricCode;
  supportedMarkets: Array<Scalars['String']['output']>;
  trendDurationDays: Scalars['Int']['output'];
}

export interface StartBillingSubscriptionInput {
  /** Legacy client-supplied Stripe cancel redirect URL. The backend now uses the canonical RivonClaw payment status page for STRIPE checkouts; ignored when an existing Stripe subscription is only resumed. */
  cancelUrl?: InputMaybe<Scalars['String']['input']>;
  /** Commercial plan the user wants to start, resume, renew, or upgrade to. The backend calculates all prices from this plan. */
  planId: BillingPlanId;
  /** Payment rail to use. STRIPE creates or resumes an auto-renewing USD subscription; LAKALA creates a CNY prepaid QR payment. */
  provider: PaymentProviderName;
  /** Target scope ID. Use the current user ID for ACCOUNT-scoped plans, the shop ID for SHOP-scoped e-commerce requests, or an existing seller scope ID for seller-scoped management calls. */
  scopeId: Scalars['String']['input'];
  /** Billing scope for the selected plan. LLM plans are ACCOUNT-scoped. E-commerce clients may pass SHOP + shop ID; the backend canonicalizes seller-scoped services such as customer service and affiliate to SELLER when applicable. */
  scopeType: BillingScopeType;
  /** Legacy client-supplied Stripe success redirect URL. The backend now uses the canonical RivonClaw payment status page for STRIPE checkouts; ignored when an existing Stripe subscription is only resumed. */
  successUrl?: InputMaybe<Scalars['String']['input']>;
}

export interface StartBillingSubscriptionResult {
  /** Backend action taken: CHECKOUT_CREATED means use payment.checkoutUrl for Stripe or render payment.qrCode as a QR payload for Lakala; SUBSCRIPTION_RESUMED means a scheduled Stripe cancellation was removed; ALREADY_ACTIVE means no payment action was needed. */
  action: BillingSubscriptionStartAction;
  /** Created payment or checkout. Present for Stripe Checkout sessions, Stripe upgrade invoices, and Lakala QR payments. */
  payment?: Maybe<Payment>;
  /** Current subscription when the backend resumed or found an already-active Stripe subscription. */
  subscription?: Maybe<BillingSubscription>;
}

/** Input for starting Microsoft Outlook OAuth onboarding */
export interface StartMicrosoftEmailOAuthInput {
  businessDeveloperId?: InputMaybe<Scalars['ID']['input']>;
  mailboxType?: InputMaybe<EmailMailboxType>;
  sharedMailboxAddress?: InputMaybe<Scalars['String']['input']>;
}

/** Microsoft Outlook OAuth onboarding URL */
export interface StartMicrosoftEmailOAuthPayload {
  state: Scalars['String']['output'];
  url: Scalars['String']['output'];
}

/** Input for starting WhatsApp QR onboarding */
export interface StartWhatsAppQrOnboardingInput {
  bindingId: Scalars['ID']['input'];
  webhookEvents?: InputMaybe<Array<Scalars['String']['input']>>;
  webhookSecret?: InputMaybe<Scalars['String']['input']>;
  webhookUrl?: InputMaybe<Scalars['String']['input']>;
}

/** WhatsApp QR onboarding payload */
export interface StartWhatsAppQrOnboardingPayload {
  binding: WhatsAppAccountBinding;
  pairingCode?: Maybe<Scalars['String']['output']>;
  qrBase64?: Maybe<Scalars['String']['output']>;
  qrCode?: Maybe<Scalars['String']['output']>;
}

export interface StripeBillingPortalSessionPayload {
  /** Stripe-hosted Customer Portal URL. The client should open this URL externally; the session is temporary. */
  url: Scalars['String']['output'];
}

export interface SubmitAffiliateCampaignSearchPlanInput {
  configRevision: Scalars['Int']['input'];
  generation: Scalars['Int']['input'];
  guidanceInterpretation: AffiliateCampaignSearchPlanGuidanceInterpretationInput;
  leaseToken: Scalars['String']['input'];
  phrase: AffiliateCampaignSearchPhraseCandidateInput;
  productSnapshotHash: Scalars['String']['input'];
  searchPlanId: Scalars['ID']['input'];
  uiLocale: Scalars['String']['input'];
}

export interface Subscription {
  /** Fires when TikTok Ads OAuth completes so desktop clients can refresh advertiser and store-access data without polling. */
  adsOAuthComplete: AdsOAuthCompletePayload;
  /** Streams affiliate action proposal changes so desktop review tables can update without polling. */
  affiliateActionProposalChanged: AffiliateActionProposalChanged;
  affiliateCampaignSearchPlanRequested: AffiliateCampaignSearchPlanRequest;
  /** Fires when a seller-level affiliate outreach account finishes direct-channel onboarding. */
  affiliateOutreachAccountConnected: AffiliateOutreachAccountConnectedPayload;
  /** Streams ephemeral affiliate signals to desktop clients. Missing signals are recovered by platform sync/check jobs, not by Mongo replay. */
  affiliateRelationshipSignal: AffiliateRelationshipSignal;
  /** Streams backend-materialized affiliate work projections. Desktop should use this as the idempotent source of truth for agent dispatch and review surfaces. */
  affiliateWorkItemChanged: AffiliateWorkItemChanged;
  clientLogUploadRequested: ClientLogUploadRequestPayload;
  /** Streams backend-materialized CS conversation snapshots whenever a conversation changes. Desktop should treat each payload as the latest whole-entity snapshot and only wake the local CS agent when dispatchHint is present. */
  csConversationChanged: CustomerServiceConversation;
  /** Streams CS conversation signals to desktop clients. Missed pending signals are retried from backend state by Airflow. */
  csConversationSignal: CsConversationSignal;
  /** Streams newly-published CS escalation side-effect events to desktop actuators. Missed events are replayed by Airflow/admin publish mutations, not by subscription connect. */
  csEscalationEvent: CsEscalationEventDelivery;
  /** Desktop subscription: receives short-lived admin presence probes for the authenticated user. */
  devicePresenceProbeRequested: AdminDevicePresenceProbeRequest;
  expertRunEvents: ExpertRunEvent;
  /** Fires when an OAuth flow completes (e.g. TikTok shop authorization) */
  oauthComplete: OAuthCompletePayload;
  /** Signals that official preset skills changed; clients should re-run preset skill sync. */
  presetSkillsChanged: PresetSkillsChangedPayload;
  /** Fires when a shop is updated. Only receives updates for shops owned by the authenticated user. */
  shopUpdated: Shop;
  /** Signals that ToolSpecs changed; clients should run ToolSpecsSync to fetch the latest authorized snapshot. */
  toolSpecsChanged: ToolSpecsChangedPayload;
  updateAvailable: UpdatePayload;
}


export interface SubscriptionAffiliateActionProposalChangedArgs {
  shopIds?: InputMaybe<Array<Scalars['ID']['input']>>;
}


export interface SubscriptionAffiliateCampaignSearchPlanRequestedArgs {
  deviceId: Scalars['String']['input'];
}


export interface SubscriptionAffiliateRelationshipSignalArgs {
  shopIds?: InputMaybe<Array<Scalars['ID']['input']>>;
}


export interface SubscriptionAffiliateWorkItemChangedArgs {
  shopIds?: InputMaybe<Array<Scalars['ID']['input']>>;
}


export interface SubscriptionClientLogUploadRequestedArgs {
  deviceId?: InputMaybe<Scalars['String']['input']>;
}


export interface SubscriptionCsConversationChangedArgs {
  shopIds?: InputMaybe<Array<Scalars['ID']['input']>>;
}


export interface SubscriptionCsConversationSignalArgs {
  shopIds?: InputMaybe<Array<Scalars['ID']['input']>>;
}


export interface SubscriptionCsEscalationEventArgs {
  shopIds?: InputMaybe<Array<Scalars['ID']['input']>>;
}


export interface SubscriptionExpertRunEventsArgs {
  afterSequence?: Scalars['Int']['input'];
  runId: Scalars['ID']['input'];
}


export interface SubscriptionUpdateAvailableArgs {
  clientVersion: Scalars['String']['input'];
}

/** Supported IANA timezone identifiers used by analytics date boundaries */
export const SupportedTimezone = {
  AfricaAbidjan: 'AFRICA_ABIDJAN',
  AfricaAccra: 'AFRICA_ACCRA',
  AfricaAddisAbaba: 'AFRICA_ADDIS_ABABA',
  AfricaAlgiers: 'AFRICA_ALGIERS',
  AfricaAsmera: 'AFRICA_ASMERA',
  AfricaBamako: 'AFRICA_BAMAKO',
  AfricaBangui: 'AFRICA_BANGUI',
  AfricaBanjul: 'AFRICA_BANJUL',
  AfricaBissau: 'AFRICA_BISSAU',
  AfricaBlantyre: 'AFRICA_BLANTYRE',
  AfricaBrazzaville: 'AFRICA_BRAZZAVILLE',
  AfricaBujumbura: 'AFRICA_BUJUMBURA',
  AfricaCairo: 'AFRICA_CAIRO',
  AfricaCasablanca: 'AFRICA_CASABLANCA',
  AfricaCeuta: 'AFRICA_CEUTA',
  AfricaConakry: 'AFRICA_CONAKRY',
  AfricaDakar: 'AFRICA_DAKAR',
  AfricaDarEsSalaam: 'AFRICA_DAR_ES_SALAAM',
  AfricaDjibouti: 'AFRICA_DJIBOUTI',
  AfricaDouala: 'AFRICA_DOUALA',
  AfricaElAaiun: 'AFRICA_EL_AAIUN',
  AfricaFreetown: 'AFRICA_FREETOWN',
  AfricaGaborone: 'AFRICA_GABORONE',
  AfricaHarare: 'AFRICA_HARARE',
  AfricaJohannesburg: 'AFRICA_JOHANNESBURG',
  AfricaJuba: 'AFRICA_JUBA',
  AfricaKampala: 'AFRICA_KAMPALA',
  AfricaKhartoum: 'AFRICA_KHARTOUM',
  AfricaKigali: 'AFRICA_KIGALI',
  AfricaKinshasa: 'AFRICA_KINSHASA',
  AfricaLagos: 'AFRICA_LAGOS',
  AfricaLibreville: 'AFRICA_LIBREVILLE',
  AfricaLome: 'AFRICA_LOME',
  AfricaLuanda: 'AFRICA_LUANDA',
  AfricaLubumbashi: 'AFRICA_LUBUMBASHI',
  AfricaLusaka: 'AFRICA_LUSAKA',
  AfricaMalabo: 'AFRICA_MALABO',
  AfricaMaputo: 'AFRICA_MAPUTO',
  AfricaMaseru: 'AFRICA_MASERU',
  AfricaMbabane: 'AFRICA_MBABANE',
  AfricaMogadishu: 'AFRICA_MOGADISHU',
  AfricaMonrovia: 'AFRICA_MONROVIA',
  AfricaNairobi: 'AFRICA_NAIROBI',
  AfricaNdjamena: 'AFRICA_NDJAMENA',
  AfricaNiamey: 'AFRICA_NIAMEY',
  AfricaNouakchott: 'AFRICA_NOUAKCHOTT',
  AfricaOuagadougou: 'AFRICA_OUAGADOUGOU',
  AfricaPortoMinusNovo: 'AFRICA_PORTO_MINUS_NOVO',
  AfricaSaoTome: 'AFRICA_SAO_TOME',
  AfricaTripoli: 'AFRICA_TRIPOLI',
  AfricaTunis: 'AFRICA_TUNIS',
  AfricaWindhoek: 'AFRICA_WINDHOEK',
  AmericaAdak: 'AMERICA_ADAK',
  AmericaAnchorage: 'AMERICA_ANCHORAGE',
  AmericaAnguilla: 'AMERICA_ANGUILLA',
  AmericaAntigua: 'AMERICA_ANTIGUA',
  AmericaAraguaina: 'AMERICA_ARAGUAINA',
  AmericaArgentinaLaRioja: 'AMERICA_ARGENTINA_LA_RIOJA',
  AmericaArgentinaRioGallegos: 'AMERICA_ARGENTINA_RIO_GALLEGOS',
  AmericaArgentinaSalta: 'AMERICA_ARGENTINA_SALTA',
  AmericaArgentinaSanJuan: 'AMERICA_ARGENTINA_SAN_JUAN',
  AmericaArgentinaSanLuis: 'AMERICA_ARGENTINA_SAN_LUIS',
  AmericaArgentinaTucuman: 'AMERICA_ARGENTINA_TUCUMAN',
  AmericaArgentinaUshuaia: 'AMERICA_ARGENTINA_USHUAIA',
  AmericaAruba: 'AMERICA_ARUBA',
  AmericaAsuncion: 'AMERICA_ASUNCION',
  AmericaBahia: 'AMERICA_BAHIA',
  AmericaBahiaBanderas: 'AMERICA_BAHIA_BANDERAS',
  AmericaBarbados: 'AMERICA_BARBADOS',
  AmericaBelem: 'AMERICA_BELEM',
  AmericaBelize: 'AMERICA_BELIZE',
  AmericaBlancMinusSablon: 'AMERICA_BLANC_MINUS_SABLON',
  AmericaBoaVista: 'AMERICA_BOA_VISTA',
  AmericaBogota: 'AMERICA_BOGOTA',
  AmericaBoise: 'AMERICA_BOISE',
  AmericaBuenosAires: 'AMERICA_BUENOS_AIRES',
  AmericaCambridgeBay: 'AMERICA_CAMBRIDGE_BAY',
  AmericaCampoGrande: 'AMERICA_CAMPO_GRANDE',
  AmericaCancun: 'AMERICA_CANCUN',
  AmericaCaracas: 'AMERICA_CARACAS',
  AmericaCatamarca: 'AMERICA_CATAMARCA',
  AmericaCayenne: 'AMERICA_CAYENNE',
  AmericaCayman: 'AMERICA_CAYMAN',
  AmericaChicago: 'AMERICA_CHICAGO',
  AmericaChihuahua: 'AMERICA_CHIHUAHUA',
  AmericaCiudadJuarez: 'AMERICA_CIUDAD_JUAREZ',
  AmericaCoralHarbour: 'AMERICA_CORAL_HARBOUR',
  AmericaCordoba: 'AMERICA_CORDOBA',
  AmericaCostaRica: 'AMERICA_COSTA_RICA',
  AmericaCoyhaique: 'AMERICA_COYHAIQUE',
  AmericaCreston: 'AMERICA_CRESTON',
  AmericaCuiaba: 'AMERICA_CUIABA',
  AmericaCuracao: 'AMERICA_CURACAO',
  AmericaDanmarkshavn: 'AMERICA_DANMARKSHAVN',
  AmericaDawson: 'AMERICA_DAWSON',
  AmericaDawsonCreek: 'AMERICA_DAWSON_CREEK',
  AmericaDenver: 'AMERICA_DENVER',
  AmericaDetroit: 'AMERICA_DETROIT',
  AmericaDominica: 'AMERICA_DOMINICA',
  AmericaEdmonton: 'AMERICA_EDMONTON',
  AmericaEirunepe: 'AMERICA_EIRUNEPE',
  AmericaElSalvador: 'AMERICA_EL_SALVADOR',
  AmericaFortaleza: 'AMERICA_FORTALEZA',
  AmericaFortNelson: 'AMERICA_FORT_NELSON',
  AmericaGlaceBay: 'AMERICA_GLACE_BAY',
  AmericaGodthab: 'AMERICA_GODTHAB',
  AmericaGooseBay: 'AMERICA_GOOSE_BAY',
  AmericaGrandTurk: 'AMERICA_GRAND_TURK',
  AmericaGrenada: 'AMERICA_GRENADA',
  AmericaGuadeloupe: 'AMERICA_GUADELOUPE',
  AmericaGuatemala: 'AMERICA_GUATEMALA',
  AmericaGuayaquil: 'AMERICA_GUAYAQUIL',
  AmericaGuyana: 'AMERICA_GUYANA',
  AmericaHalifax: 'AMERICA_HALIFAX',
  AmericaHavana: 'AMERICA_HAVANA',
  AmericaHermosillo: 'AMERICA_HERMOSILLO',
  AmericaIndianapolis: 'AMERICA_INDIANAPOLIS',
  AmericaIndianaKnox: 'AMERICA_INDIANA_KNOX',
  AmericaIndianaMarengo: 'AMERICA_INDIANA_MARENGO',
  AmericaIndianaPetersburg: 'AMERICA_INDIANA_PETERSBURG',
  AmericaIndianaTellCity: 'AMERICA_INDIANA_TELL_CITY',
  AmericaIndianaVevay: 'AMERICA_INDIANA_VEVAY',
  AmericaIndianaVincennes: 'AMERICA_INDIANA_VINCENNES',
  AmericaIndianaWinamac: 'AMERICA_INDIANA_WINAMAC',
  AmericaInuvik: 'AMERICA_INUVIK',
  AmericaIqaluit: 'AMERICA_IQALUIT',
  AmericaJamaica: 'AMERICA_JAMAICA',
  AmericaJujuy: 'AMERICA_JUJUY',
  AmericaJuneau: 'AMERICA_JUNEAU',
  AmericaKentuckyMonticello: 'AMERICA_KENTUCKY_MONTICELLO',
  AmericaKralendijk: 'AMERICA_KRALENDIJK',
  AmericaLaPaz: 'AMERICA_LA_PAZ',
  AmericaLima: 'AMERICA_LIMA',
  AmericaLosAngeles: 'AMERICA_LOS_ANGELES',
  AmericaLouisville: 'AMERICA_LOUISVILLE',
  AmericaLowerPrinces: 'AMERICA_LOWER_PRINCES',
  AmericaMaceio: 'AMERICA_MACEIO',
  AmericaManagua: 'AMERICA_MANAGUA',
  AmericaManaus: 'AMERICA_MANAUS',
  AmericaMarigot: 'AMERICA_MARIGOT',
  AmericaMartinique: 'AMERICA_MARTINIQUE',
  AmericaMatamoros: 'AMERICA_MATAMOROS',
  AmericaMazatlan: 'AMERICA_MAZATLAN',
  AmericaMendoza: 'AMERICA_MENDOZA',
  AmericaMenominee: 'AMERICA_MENOMINEE',
  AmericaMerida: 'AMERICA_MERIDA',
  AmericaMetlakatla: 'AMERICA_METLAKATLA',
  AmericaMexicoCity: 'AMERICA_MEXICO_CITY',
  AmericaMiquelon: 'AMERICA_MIQUELON',
  AmericaMoncton: 'AMERICA_MONCTON',
  AmericaMonterrey: 'AMERICA_MONTERREY',
  AmericaMontevideo: 'AMERICA_MONTEVIDEO',
  AmericaMontserrat: 'AMERICA_MONTSERRAT',
  AmericaNassau: 'AMERICA_NASSAU',
  AmericaNewYork: 'AMERICA_NEW_YORK',
  AmericaNome: 'AMERICA_NOME',
  AmericaNoronha: 'AMERICA_NORONHA',
  AmericaNorthDakotaBeulah: 'AMERICA_NORTH_DAKOTA_BEULAH',
  AmericaNorthDakotaCenter: 'AMERICA_NORTH_DAKOTA_CENTER',
  AmericaNorthDakotaNewSalem: 'AMERICA_NORTH_DAKOTA_NEW_SALEM',
  AmericaOjinaga: 'AMERICA_OJINAGA',
  AmericaPanama: 'AMERICA_PANAMA',
  AmericaParamaribo: 'AMERICA_PARAMARIBO',
  AmericaPhoenix: 'AMERICA_PHOENIX',
  AmericaPortoVelho: 'AMERICA_PORTO_VELHO',
  AmericaPortMinusAuMinusPrince: 'AMERICA_PORT_MINUS_AU_MINUS_PRINCE',
  AmericaPortOfSpain: 'AMERICA_PORT_OF_SPAIN',
  AmericaPuertoRico: 'AMERICA_PUERTO_RICO',
  AmericaPuntaArenas: 'AMERICA_PUNTA_ARENAS',
  AmericaRankinInlet: 'AMERICA_RANKIN_INLET',
  AmericaRecife: 'AMERICA_RECIFE',
  AmericaRegina: 'AMERICA_REGINA',
  AmericaResolute: 'AMERICA_RESOLUTE',
  AmericaRioBranco: 'AMERICA_RIO_BRANCO',
  AmericaSantarem: 'AMERICA_SANTAREM',
  AmericaSantiago: 'AMERICA_SANTIAGO',
  AmericaSantoDomingo: 'AMERICA_SANTO_DOMINGO',
  AmericaSaoPaulo: 'AMERICA_SAO_PAULO',
  AmericaScoresbysund: 'AMERICA_SCORESBYSUND',
  AmericaSitka: 'AMERICA_SITKA',
  AmericaStBarthelemy: 'AMERICA_ST_BARTHELEMY',
  AmericaStJohns: 'AMERICA_ST_JOHNS',
  AmericaStKitts: 'AMERICA_ST_KITTS',
  AmericaStLucia: 'AMERICA_ST_LUCIA',
  AmericaStThomas: 'AMERICA_ST_THOMAS',
  AmericaStVincent: 'AMERICA_ST_VINCENT',
  AmericaSwiftCurrent: 'AMERICA_SWIFT_CURRENT',
  AmericaTegucigalpa: 'AMERICA_TEGUCIGALPA',
  AmericaThule: 'AMERICA_THULE',
  AmericaTijuana: 'AMERICA_TIJUANA',
  AmericaToronto: 'AMERICA_TORONTO',
  AmericaTortola: 'AMERICA_TORTOLA',
  AmericaVancouver: 'AMERICA_VANCOUVER',
  AmericaWhitehorse: 'AMERICA_WHITEHORSE',
  AmericaWinnipeg: 'AMERICA_WINNIPEG',
  AmericaYakutat: 'AMERICA_YAKUTAT',
  AntarcticaCasey: 'ANTARCTICA_CASEY',
  AntarcticaDavis: 'ANTARCTICA_DAVIS',
  AntarcticaDumontdurville: 'ANTARCTICA_DUMONTDURVILLE',
  AntarcticaMacquarie: 'ANTARCTICA_MACQUARIE',
  AntarcticaMawson: 'ANTARCTICA_MAWSON',
  AntarcticaMcmurdo: 'ANTARCTICA_MCMURDO',
  AntarcticaPalmer: 'ANTARCTICA_PALMER',
  AntarcticaRothera: 'ANTARCTICA_ROTHERA',
  AntarcticaSyowa: 'ANTARCTICA_SYOWA',
  AntarcticaTroll: 'ANTARCTICA_TROLL',
  AntarcticaVostok: 'ANTARCTICA_VOSTOK',
  ArcticLongyearbyen: 'ARCTIC_LONGYEARBYEN',
  AsiaAden: 'ASIA_ADEN',
  AsiaAlmaty: 'ASIA_ALMATY',
  AsiaAmman: 'ASIA_AMMAN',
  AsiaAnadyr: 'ASIA_ANADYR',
  AsiaAqtau: 'ASIA_AQTAU',
  AsiaAqtobe: 'ASIA_AQTOBE',
  AsiaAshgabat: 'ASIA_ASHGABAT',
  AsiaAtyrau: 'ASIA_ATYRAU',
  AsiaBaghdad: 'ASIA_BAGHDAD',
  AsiaBahrain: 'ASIA_BAHRAIN',
  AsiaBaku: 'ASIA_BAKU',
  AsiaBangkok: 'ASIA_BANGKOK',
  AsiaBarnaul: 'ASIA_BARNAUL',
  AsiaBeirut: 'ASIA_BEIRUT',
  AsiaBishkek: 'ASIA_BISHKEK',
  AsiaBrunei: 'ASIA_BRUNEI',
  AsiaCalcutta: 'ASIA_CALCUTTA',
  AsiaChita: 'ASIA_CHITA',
  AsiaColombo: 'ASIA_COLOMBO',
  AsiaDamascus: 'ASIA_DAMASCUS',
  AsiaDhaka: 'ASIA_DHAKA',
  AsiaDili: 'ASIA_DILI',
  AsiaDubai: 'ASIA_DUBAI',
  AsiaDushanbe: 'ASIA_DUSHANBE',
  AsiaFamagusta: 'ASIA_FAMAGUSTA',
  AsiaGaza: 'ASIA_GAZA',
  AsiaHebron: 'ASIA_HEBRON',
  AsiaHongKong: 'ASIA_HONG_KONG',
  AsiaHovd: 'ASIA_HOVD',
  AsiaHoChiMinh: 'ASIA_HO_CHI_MINH',
  AsiaIrkutsk: 'ASIA_IRKUTSK',
  AsiaJakarta: 'ASIA_JAKARTA',
  AsiaJayapura: 'ASIA_JAYAPURA',
  AsiaJerusalem: 'ASIA_JERUSALEM',
  AsiaKabul: 'ASIA_KABUL',
  AsiaKamchatka: 'ASIA_KAMCHATKA',
  AsiaKarachi: 'ASIA_KARACHI',
  AsiaKatmandu: 'ASIA_KATMANDU',
  AsiaKhandyga: 'ASIA_KHANDYGA',
  AsiaKrasnoyarsk: 'ASIA_KRASNOYARSK',
  AsiaKualaLumpur: 'ASIA_KUALA_LUMPUR',
  AsiaKuching: 'ASIA_KUCHING',
  AsiaKuwait: 'ASIA_KUWAIT',
  AsiaMacau: 'ASIA_MACAU',
  AsiaMagadan: 'ASIA_MAGADAN',
  AsiaMakassar: 'ASIA_MAKASSAR',
  AsiaManila: 'ASIA_MANILA',
  AsiaMuscat: 'ASIA_MUSCAT',
  AsiaNicosia: 'ASIA_NICOSIA',
  AsiaNovokuznetsk: 'ASIA_NOVOKUZNETSK',
  AsiaNovosibirsk: 'ASIA_NOVOSIBIRSK',
  AsiaOmsk: 'ASIA_OMSK',
  AsiaOral: 'ASIA_ORAL',
  AsiaPhnomPenh: 'ASIA_PHNOM_PENH',
  AsiaPontianak: 'ASIA_PONTIANAK',
  AsiaPyongyang: 'ASIA_PYONGYANG',
  AsiaQatar: 'ASIA_QATAR',
  AsiaQostanay: 'ASIA_QOSTANAY',
  AsiaQyzylorda: 'ASIA_QYZYLORDA',
  AsiaRangoon: 'ASIA_RANGOON',
  AsiaRiyadh: 'ASIA_RIYADH',
  AsiaSaigon: 'ASIA_SAIGON',
  AsiaSakhalin: 'ASIA_SAKHALIN',
  AsiaSamarkand: 'ASIA_SAMARKAND',
  AsiaSeoul: 'ASIA_SEOUL',
  AsiaShanghai: 'ASIA_SHANGHAI',
  AsiaSingapore: 'ASIA_SINGAPORE',
  AsiaSrednekolymsk: 'ASIA_SREDNEKOLYMSK',
  AsiaTaipei: 'ASIA_TAIPEI',
  AsiaTashkent: 'ASIA_TASHKENT',
  AsiaTbilisi: 'ASIA_TBILISI',
  AsiaTehran: 'ASIA_TEHRAN',
  AsiaThimphu: 'ASIA_THIMPHU',
  AsiaTokyo: 'ASIA_TOKYO',
  AsiaTomsk: 'ASIA_TOMSK',
  AsiaUlaanbaatar: 'ASIA_ULAANBAATAR',
  AsiaUrumqi: 'ASIA_URUMQI',
  AsiaUstMinusNera: 'ASIA_UST_MINUS_NERA',
  AsiaVientiane: 'ASIA_VIENTIANE',
  AsiaVladivostok: 'ASIA_VLADIVOSTOK',
  AsiaYakutsk: 'ASIA_YAKUTSK',
  AsiaYekaterinburg: 'ASIA_YEKATERINBURG',
  AsiaYerevan: 'ASIA_YEREVAN',
  AtlanticAzores: 'ATLANTIC_AZORES',
  AtlanticBermuda: 'ATLANTIC_BERMUDA',
  AtlanticCanary: 'ATLANTIC_CANARY',
  AtlanticCapeVerde: 'ATLANTIC_CAPE_VERDE',
  AtlanticFaeroe: 'ATLANTIC_FAEROE',
  AtlanticMadeira: 'ATLANTIC_MADEIRA',
  AtlanticReykjavik: 'ATLANTIC_REYKJAVIK',
  AtlanticSouthGeorgia: 'ATLANTIC_SOUTH_GEORGIA',
  AtlanticStanley: 'ATLANTIC_STANLEY',
  AtlanticStHelena: 'ATLANTIC_ST_HELENA',
  AustraliaAdelaide: 'AUSTRALIA_ADELAIDE',
  AustraliaBrisbane: 'AUSTRALIA_BRISBANE',
  AustraliaBrokenHill: 'AUSTRALIA_BROKEN_HILL',
  AustraliaDarwin: 'AUSTRALIA_DARWIN',
  AustraliaEucla: 'AUSTRALIA_EUCLA',
  AustraliaHobart: 'AUSTRALIA_HOBART',
  AustraliaLindeman: 'AUSTRALIA_LINDEMAN',
  AustraliaLordHowe: 'AUSTRALIA_LORD_HOWE',
  AustraliaMelbourne: 'AUSTRALIA_MELBOURNE',
  AustraliaPerth: 'AUSTRALIA_PERTH',
  AustraliaSydney: 'AUSTRALIA_SYDNEY',
  EtcGmt: 'ETC_GMT',
  EtcGmtMinus_1: 'ETC_GMT_MINUS_1',
  EtcGmtMinus_2: 'ETC_GMT_MINUS_2',
  EtcGmtMinus_3: 'ETC_GMT_MINUS_3',
  EtcGmtMinus_4: 'ETC_GMT_MINUS_4',
  EtcGmtMinus_5: 'ETC_GMT_MINUS_5',
  EtcGmtMinus_6: 'ETC_GMT_MINUS_6',
  EtcGmtMinus_7: 'ETC_GMT_MINUS_7',
  EtcGmtMinus_8: 'ETC_GMT_MINUS_8',
  EtcGmtMinus_9: 'ETC_GMT_MINUS_9',
  EtcGmtMinus_10: 'ETC_GMT_MINUS_10',
  EtcGmtMinus_11: 'ETC_GMT_MINUS_11',
  EtcGmtMinus_12: 'ETC_GMT_MINUS_12',
  EtcGmtMinus_13: 'ETC_GMT_MINUS_13',
  EtcGmtMinus_14: 'ETC_GMT_MINUS_14',
  EtcGmtPlus_0: 'ETC_GMT_PLUS_0',
  EtcGmtPlus_1: 'ETC_GMT_PLUS_1',
  EtcGmtPlus_2: 'ETC_GMT_PLUS_2',
  EtcGmtPlus_3: 'ETC_GMT_PLUS_3',
  EtcGmtPlus_4: 'ETC_GMT_PLUS_4',
  EtcGmtPlus_5: 'ETC_GMT_PLUS_5',
  EtcGmtPlus_6: 'ETC_GMT_PLUS_6',
  EtcGmtPlus_7: 'ETC_GMT_PLUS_7',
  EtcGmtPlus_8: 'ETC_GMT_PLUS_8',
  EtcGmtPlus_9: 'ETC_GMT_PLUS_9',
  EtcGmtPlus_10: 'ETC_GMT_PLUS_10',
  EtcGmtPlus_11: 'ETC_GMT_PLUS_11',
  EtcGmtPlus_12: 'ETC_GMT_PLUS_12',
  EtcUtc: 'ETC_UTC',
  EuropeAmsterdam: 'EUROPE_AMSTERDAM',
  EuropeAndorra: 'EUROPE_ANDORRA',
  EuropeAstrakhan: 'EUROPE_ASTRAKHAN',
  EuropeAthens: 'EUROPE_ATHENS',
  EuropeBelgrade: 'EUROPE_BELGRADE',
  EuropeBerlin: 'EUROPE_BERLIN',
  EuropeBratislava: 'EUROPE_BRATISLAVA',
  EuropeBrussels: 'EUROPE_BRUSSELS',
  EuropeBucharest: 'EUROPE_BUCHAREST',
  EuropeBudapest: 'EUROPE_BUDAPEST',
  EuropeBusingen: 'EUROPE_BUSINGEN',
  EuropeChisinau: 'EUROPE_CHISINAU',
  EuropeCopenhagen: 'EUROPE_COPENHAGEN',
  EuropeDublin: 'EUROPE_DUBLIN',
  EuropeGibraltar: 'EUROPE_GIBRALTAR',
  EuropeGuernsey: 'EUROPE_GUERNSEY',
  EuropeHelsinki: 'EUROPE_HELSINKI',
  EuropeIsleOfMan: 'EUROPE_ISLE_OF_MAN',
  EuropeIstanbul: 'EUROPE_ISTANBUL',
  EuropeJersey: 'EUROPE_JERSEY',
  EuropeKaliningrad: 'EUROPE_KALININGRAD',
  EuropeKiev: 'EUROPE_KIEV',
  EuropeKirov: 'EUROPE_KIROV',
  EuropeLisbon: 'EUROPE_LISBON',
  EuropeLjubljana: 'EUROPE_LJUBLJANA',
  EuropeLondon: 'EUROPE_LONDON',
  EuropeLuxembourg: 'EUROPE_LUXEMBOURG',
  EuropeMadrid: 'EUROPE_MADRID',
  EuropeMalta: 'EUROPE_MALTA',
  EuropeMariehamn: 'EUROPE_MARIEHAMN',
  EuropeMinsk: 'EUROPE_MINSK',
  EuropeMonaco: 'EUROPE_MONACO',
  EuropeMoscow: 'EUROPE_MOSCOW',
  EuropeOslo: 'EUROPE_OSLO',
  EuropeParis: 'EUROPE_PARIS',
  EuropePodgorica: 'EUROPE_PODGORICA',
  EuropePrague: 'EUROPE_PRAGUE',
  EuropeRiga: 'EUROPE_RIGA',
  EuropeRome: 'EUROPE_ROME',
  EuropeSamara: 'EUROPE_SAMARA',
  EuropeSanMarino: 'EUROPE_SAN_MARINO',
  EuropeSarajevo: 'EUROPE_SARAJEVO',
  EuropeSaratov: 'EUROPE_SARATOV',
  EuropeSimferopol: 'EUROPE_SIMFEROPOL',
  EuropeSkopje: 'EUROPE_SKOPJE',
  EuropeSofia: 'EUROPE_SOFIA',
  EuropeStockholm: 'EUROPE_STOCKHOLM',
  EuropeTallinn: 'EUROPE_TALLINN',
  EuropeTirane: 'EUROPE_TIRANE',
  EuropeUlyanovsk: 'EUROPE_ULYANOVSK',
  EuropeVaduz: 'EUROPE_VADUZ',
  EuropeVatican: 'EUROPE_VATICAN',
  EuropeVienna: 'EUROPE_VIENNA',
  EuropeVilnius: 'EUROPE_VILNIUS',
  EuropeVolgograd: 'EUROPE_VOLGOGRAD',
  EuropeWarsaw: 'EUROPE_WARSAW',
  EuropeZagreb: 'EUROPE_ZAGREB',
  EuropeZurich: 'EUROPE_ZURICH',
  IndianAntananarivo: 'INDIAN_ANTANANARIVO',
  IndianChagos: 'INDIAN_CHAGOS',
  IndianChristmas: 'INDIAN_CHRISTMAS',
  IndianCocos: 'INDIAN_COCOS',
  IndianComoro: 'INDIAN_COMORO',
  IndianKerguelen: 'INDIAN_KERGUELEN',
  IndianMahe: 'INDIAN_MAHE',
  IndianMaldives: 'INDIAN_MALDIVES',
  IndianMauritius: 'INDIAN_MAURITIUS',
  IndianMayotte: 'INDIAN_MAYOTTE',
  IndianReunion: 'INDIAN_REUNION',
  PacificApia: 'PACIFIC_APIA',
  PacificAuckland: 'PACIFIC_AUCKLAND',
  PacificBougainville: 'PACIFIC_BOUGAINVILLE',
  PacificChatham: 'PACIFIC_CHATHAM',
  PacificEaster: 'PACIFIC_EASTER',
  PacificEfate: 'PACIFIC_EFATE',
  PacificEnderbury: 'PACIFIC_ENDERBURY',
  PacificFakaofo: 'PACIFIC_FAKAOFO',
  PacificFiji: 'PACIFIC_FIJI',
  PacificFunafuti: 'PACIFIC_FUNAFUTI',
  PacificGalapagos: 'PACIFIC_GALAPAGOS',
  PacificGambier: 'PACIFIC_GAMBIER',
  PacificGuadalcanal: 'PACIFIC_GUADALCANAL',
  PacificGuam: 'PACIFIC_GUAM',
  PacificHonolulu: 'PACIFIC_HONOLULU',
  PacificKiritimati: 'PACIFIC_KIRITIMATI',
  PacificKosrae: 'PACIFIC_KOSRAE',
  PacificKwajalein: 'PACIFIC_KWAJALEIN',
  PacificMajuro: 'PACIFIC_MAJURO',
  PacificMarquesas: 'PACIFIC_MARQUESAS',
  PacificMidway: 'PACIFIC_MIDWAY',
  PacificNauru: 'PACIFIC_NAURU',
  PacificNiue: 'PACIFIC_NIUE',
  PacificNorfolk: 'PACIFIC_NORFOLK',
  PacificNoumea: 'PACIFIC_NOUMEA',
  PacificPagoPago: 'PACIFIC_PAGO_PAGO',
  PacificPalau: 'PACIFIC_PALAU',
  PacificPitcairn: 'PACIFIC_PITCAIRN',
  PacificPonape: 'PACIFIC_PONAPE',
  PacificPortMoresby: 'PACIFIC_PORT_MORESBY',
  PacificRarotonga: 'PACIFIC_RAROTONGA',
  PacificSaipan: 'PACIFIC_SAIPAN',
  PacificTahiti: 'PACIFIC_TAHITI',
  PacificTarawa: 'PACIFIC_TARAWA',
  PacificTongatapu: 'PACIFIC_TONGATAPU',
  PacificTruk: 'PACIFIC_TRUK',
  PacificWake: 'PACIFIC_WAKE',
  PacificWallis: 'PACIFIC_WALLIS',
  Utc: 'UTC'
} as const;

export type SupportedTimezone = typeof SupportedTimezone[keyof typeof SupportedTimezone];
/** Surface entity — defines tool exposure boundary for a usage scenario. userId=null for system presets. */
export interface Surface {
  allowedToolIds: Array<Scalars['String']['output']>;
  createdAt: Scalars['DateTimeISO']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  updatedAt: Scalars['DateTimeISO']['output'];
  userId?: Maybe<Scalars['String']['output']>;
}

/** One inventory good row that failed during WMS inventory good sync. */
export interface SyncWmsInventoryGoodsError {
  /** Failure message for this row. */
  message: Scalars['String']['output'];
  /** WMS goods SKU that failed, when available. */
  sku?: Maybe<Scalars['String']['output']>;
}

/** Result of importing inventory goods from a WMS account into canonical InventoryGood. */
export interface SyncWmsInventoryGoodsPayload {
  /** Number of InventoryGood rows created. */
  created: Scalars['Int']['output'];
  /** Per-row import errors. */
  errors: Array<SyncWmsInventoryGoodsError>;
  /** Number of WMS goods that could not be imported. */
  failed: Scalars['Int']['output'];
  /** Number of WMS goods read from the source account. */
  fetched: Scalars['Int']['output'];
  /** InventoryGood rows created or updated by this sync. */
  goods: Array<InventoryGood>;
  /** Number of WMS product images that could not be copied. The InventoryGood row may still be synced. */
  imageFailed: Scalars['Int']['output'];
  /** Number of WMS product images copied into permanent object storage. */
  imageImported: Scalars['Int']['output'];
  /** Whether existing InventoryGood rows were overwritten by WMS attributes. */
  overrideExisting: Scalars['Boolean']['output'];
  /** Number of existing InventoryGood rows preserved because overrideExisting was false. */
  skippedExisting: Scalars['Int']['output'];
  /** Number of existing InventoryGood rows updated. */
  updated: Scalars['Int']['output'];
  /** WMS account ID used as the source. */
  wmsAccountId: Scalars['ID']['output'];
}

/** System run profile identifiers declared by tool metadata */
export const SystemRunProfile = {
  AffiliateOperator: 'AFFILIATE_OPERATOR',
  CustomerService: 'CUSTOMER_SERVICE',
  ShopOperations: 'SHOP_OPERATIONS'
} as const;

export type SystemRunProfile = typeof SystemRunProfile[keyof typeof SystemRunProfile];
/** System surface identifiers declared by tool metadata */
export const SystemSurface = {
  EcommerceSeller: 'ECOMMERCE_SELLER'
} as const;

export type SystemSurface = typeof SystemSurface[keyof typeof SystemSurface];
export interface TikTokOAuthBrowserStart {
  authUrl: Scalars['String']['output'];
  expiresAt: Scalars['DateTimeISO']['output'];
}

/** Producer-side classification of a Provider execution failure. UNKNOWN is a real third state meaning the failure matched neither explicit set, never a synonym for NON_RETRYABLE. */
export const TikTokPlatformErrorRetryability = {
  NonRetryable: 'NON_RETRYABLE',
  Retryable: 'RETRYABLE',
  Unknown: 'UNKNOWN'
} as const;

export type TikTokPlatformErrorRetryability = typeof TikTokPlatformErrorRetryability[keyof typeof TikTokPlatformErrorRetryability];
/** Raw TikTok sample content fulfillment status values. */
export const TikTokSampleContentFulfillmentPlatformStatus = {
  Cancelled: 'CANCELLED',
  Exempted: 'EXEMPTED',
  Failed: 'FAILED',
  Ongoing: 'ONGOING',
  Overdue: 'OVERDUE',
  Pending: 'PENDING',
  Succeed: 'SUCCEED',
  Suspend: 'SUSPEND'
} as const;

export type TikTokSampleContentFulfillmentPlatformStatus = typeof TikTokSampleContentFulfillmentPlatformStatus[keyof typeof TikTokSampleContentFulfillmentPlatformStatus];
export interface TikTokSellerDeauthorizationWebhookInput {
  appKey: Scalars['String']['input'];
  eventTime: Scalars['String']['input'];
  notificationId: Scalars['String']['input'];
  platformShopId: Scalars['String']['input'];
}

export interface TikTokSellerDeauthorizationWebhookResult {
  accepted: Scalars['Boolean']['output'];
  duplicate: Scalars['Boolean']['output'];
  ignoredReason?: Maybe<Scalars['String']['output']>;
  shopId?: Maybe<Scalars['String']['output']>;
}

export interface TikTokShopClaimResult {
  shops: Array<TikTokShopClaimShop>;
  status: TikTokShopClaimResultStatus;
}

export const TikTokShopClaimResultStatus = {
  AlreadyClaimed: 'ALREADY_CLAIMED',
  Claimed: 'CLAIMED',
  Expired: 'EXPIRED',
  OwnershipConflict: 'OWNERSHIP_CONFLICT',
  Revoked: 'REVOKED'
} as const;

export type TikTokShopClaimResultStatus = typeof TikTokShopClaimResultStatus[keyof typeof TikTokShopClaimResultStatus];
export interface TikTokShopClaimShop {
  shopId: Scalars['ID']['output'];
  shopName: Scalars['String']['output'];
}

/** Tool functional category */
export const ToolCategory = {
  AffiliateAction: 'AFFILIATE_ACTION',
  AffiliateApproval: 'AFFILIATE_APPROVAL',
  AffiliateRead: 'AFFILIATE_READ',
  AffiliateSearch: 'AFFILIATE_SEARCH',
  EcommerceShopMgmt: 'ECOMMERCE_SHOP_MGMT',
  EcomBi: 'ECOM_BI',
  EcomCs: 'ECOM_CS',
  EcomCsManagement: 'ECOM_CS_MANAGEMENT',
  EcomFulfillment: 'ECOM_FULFILLMENT',
  EcomOps: 'ECOM_OPS',
  EcomOrder: 'ECOM_ORDER',
  EcomProduct: 'ECOM_PRODUCT',
  EcomReturnRefund: 'ECOM_RETURN_REFUND'
} as const;

export type ToolCategory = typeof ToolCategory[keyof typeof ToolCategory];
/** Context binding for auto-injecting parameters from session context */
export interface ToolContextBinding {
  contextField: Scalars['String']['output'];
  paramName: Scalars['String']['output'];
}

/** Agent data boundary: current CreatorRelationship, the authenticated seller's product catalog, or unrestricted seller-wide data. */
export const ToolDataScope = {
  CreatorRelationship: 'CREATOR_RELATIONSHIP',
  SellerCatalog: 'SELLER_CATALOG',
  SellerWide: 'SELLER_WIDE'
} as const;

export type ToolDataScope = typeof ToolDataScope[keyof typeof ToolDataScope];
/** Unique tool identifier */
export const ToolId = {
  AffiliateCheckCreatorWhatsapp: 'AFFILIATE_CHECK_CREATOR_WHATSAPP',
  AffiliateCopyMessageAttachment: 'AFFILIATE_COPY_MESSAGE_ATTACHMENT',
  AffiliateDecideProposal: 'AFFILIATE_DECIDE_PROPOSAL',
  AffiliateGetCollaboration: 'AFFILIATE_GET_COLLABORATION',
  AffiliateGetCreatorContactState: 'AFFILIATE_GET_CREATOR_CONTACT_STATE',
  AffiliateGetCreatorProfile: 'AFFILIATE_GET_CREATOR_PROFILE',
  AffiliateGetCreatorRelationship: 'AFFILIATE_GET_CREATOR_RELATIONSHIP',
  AffiliateGetProduct: 'AFFILIATE_GET_PRODUCT',
  AffiliateGetRelationshipTimeline: 'AFFILIATE_GET_RELATIONSHIP_TIMELINE',
  AffiliateGetSampleApplication: 'AFFILIATE_GET_SAMPLE_APPLICATION',
  AffiliateListCreatorCollaborations: 'AFFILIATE_LIST_CREATOR_COLLABORATIONS',
  AffiliateListCreatorSampleApplications: 'AFFILIATE_LIST_CREATOR_SAMPLE_APPLICATIONS',
  AffiliateListEmailAccounts: 'AFFILIATE_LIST_EMAIL_ACCOUNTS',
  AffiliateListShops: 'AFFILIATE_LIST_SHOPS',
  AffiliateListWhatsappAccounts: 'AFFILIATE_LIST_WHATSAPP_ACCOUNTS',
  AffiliateManageOpenCollaboration: 'AFFILIATE_MANAGE_OPEN_COLLABORATION',
  AffiliateManageTargetCollaboration: 'AFFILIATE_MANAGE_TARGET_COLLABORATION',
  AffiliatePredictCreatorProductFit: 'AFFILIATE_PREDICT_CREATOR_PRODUCT_FIT',
  AffiliateReadMessageAttachment: 'AFFILIATE_READ_MESSAGE_ATTACHMENT',
  AffiliateResolveWorkItem: 'AFFILIATE_RESOLVE_WORK_ITEM',
  AffiliateSearchProducts: 'AFFILIATE_SEARCH_PRODUCTS',
  AffiliateSetCreatorEmail: 'AFFILIATE_SET_CREATOR_EMAIL',
  AffiliateSetCreatorWhatsapp: 'AFFILIATE_SET_CREATOR_WHATSAPP',
  AffiliateUploadDraftAttachment: 'AFFILIATE_UPLOAD_DRAFT_ATTACHMENT',
  CsDismissConversationEscalations: 'CS_DISMISS_CONVERSATION_ESCALATIONS',
  CsEscalate: 'CS_ESCALATE',
  CsGetEscalationResult: 'CS_GET_ESCALATION_RESULT',
  CsRespond: 'CS_RESPOND',
  CsStartSession: 'CS_START_SESSION',
  EcomApproveCancellation: 'ECOM_APPROVE_CANCELLATION',
  EcomApproveRefund: 'ECOM_APPROVE_REFUND',
  EcomApproveReturn: 'ECOM_APPROVE_RETURN',
  EcomCsApproveCancellation: 'ECOM_CS_APPROVE_CANCELLATION',
  EcomCsApproveRefund: 'ECOM_CS_APPROVE_REFUND',
  EcomCsApproveReturn: 'ECOM_CS_APPROVE_RETURN',
  EcomCsEndSession: 'ECOM_CS_END_SESSION',
  EcomCsGetAftersaleEligibility: 'ECOM_CS_GET_AFTERSALE_ELIGIBILITY',
  EcomCsGetConversationDetails: 'ECOM_CS_GET_CONVERSATION_DETAILS',
  EcomCsGetConversationMessages: 'ECOM_CS_GET_CONVERSATION_MESSAGES',
  EcomCsGetFulfillmentTracking: 'ECOM_CS_GET_FULFILLMENT_TRACKING',
  EcomCsGetOrder: 'ECOM_CS_GET_ORDER',
  EcomCsGetPackageDetail: 'ECOM_CS_GET_PACKAGE_DETAIL',
  EcomCsGetProduct: 'ECOM_CS_GET_PRODUCT',
  EcomCsGetRejectReasons: 'ECOM_CS_GET_REJECT_REASONS',
  EcomCsGetReturnRecords: 'ECOM_CS_GET_RETURN_RECORDS',
  EcomCsGetShippingDocument: 'ECOM_CS_GET_SHIPPING_DOCUMENT',
  EcomCsListOrders: 'ECOM_CS_LIST_ORDERS',
  EcomCsRejectCancellation: 'ECOM_CS_REJECT_CANCELLATION',
  EcomCsRejectReturn: 'ECOM_CS_REJECT_RETURN',
  EcomCsSearchCancellations: 'ECOM_CS_SEARCH_CANCELLATIONS',
  EcomCsSearchProducts: 'ECOM_CS_SEARCH_PRODUCTS',
  EcomCsSearchReturns: 'ECOM_CS_SEARCH_RETURNS',
  EcomCsSendCard: 'ECOM_CS_SEND_CARD',
  EcomCsSendMedia: 'ECOM_CS_SEND_MEDIA',
  EcomGetAftersaleEligibility: 'ECOM_GET_AFTERSALE_ELIGIBILITY',
  EcomGetBiCatalog: 'ECOM_GET_BI_CATALOG',
  EcomGetBiData: 'ECOM_GET_BI_DATA',
  EcomGetConversations: 'ECOM_GET_CONVERSATIONS',
  EcomGetConversationMessages: 'ECOM_GET_CONVERSATION_MESSAGES',
  EcomGetCsPerformance: 'ECOM_GET_CS_PERFORMANCE',
  EcomGetCsUnpaidOrderEvaluation: 'ECOM_GET_CS_UNPAID_ORDER_EVALUATION',
  EcomGetFulfillmentTracking: 'ECOM_GET_FULFILLMENT_TRACKING',
  EcomGetInventoryAnalysis: 'ECOM_GET_INVENTORY_ANALYSIS',
  EcomGetOrder: 'ECOM_GET_ORDER',
  EcomGetOrderSalesStats: 'ECOM_GET_ORDER_SALES_STATS',
  EcomGetPackageDetail: 'ECOM_GET_PACKAGE_DETAIL',
  EcomGetPendingConversations: 'ECOM_GET_PENDING_CONVERSATIONS',
  EcomGetProduct: 'ECOM_GET_PRODUCT',
  EcomGetRejectReasons: 'ECOM_GET_REJECT_REASONS',
  EcomGetReturnRecords: 'ECOM_GET_RETURN_RECORDS',
  EcomGetShippingDocument: 'ECOM_GET_SHIPPING_DOCUMENT',
  EcomGetShop: 'ECOM_GET_SHOP',
  EcomGetShopSkuPerformanceList: 'ECOM_GET_SHOP_SKU_PERFORMANCE_LIST',
  EcomListOrders: 'ECOM_LIST_ORDERS',
  EcomListShops: 'ECOM_LIST_SHOPS',
  EcomMarkConversationRead: 'ECOM_MARK_CONVERSATION_READ',
  EcomRejectCancellation: 'ECOM_REJECT_CANCELLATION',
  EcomRejectReturn: 'ECOM_REJECT_RETURN',
  EcomSearchCancellations: 'ECOM_SEARCH_CANCELLATIONS',
  EcomSearchCsSessions: 'ECOM_SEARCH_CS_SESSIONS',
  EcomSearchPackages: 'ECOM_SEARCH_PACKAGES',
  EcomSearchProducts: 'ECOM_SEARCH_PRODUCTS',
  EcomSearchReturns: 'ECOM_SEARCH_RETURNS',
  EcomSetCustomerServiceConversationAiEnabled: 'ECOM_SET_CUSTOMER_SERVICE_CONVERSATION_AI_ENABLED',
  EcomUpdateInventory: 'ECOM_UPDATE_INVENTORY',
  EcomUpdateShop: 'ECOM_UPDATE_SHOP',
  EcomWriteAffiliateCampaign: 'ECOM_WRITE_AFFILIATE_CAMPAIGN'
} as const;

export type ToolId = typeof ToolId[keyof typeof ToolId];
/** Parameter specification for a dynamically registered tool */
export interface ToolParamSpec {
  children?: Maybe<Array<ToolParamSpec>>;
  defaultValue?: Maybe<Scalars['String']['output']>;
  description: Scalars['String']['output'];
  enumValues?: Maybe<Array<Scalars['String']['output']>>;
  graphqlVar: Scalars['String']['output'];
  /** True when the parameter accepts a list/array of values */
  isList?: Maybe<Scalars['Boolean']['output']>;
  name: Scalars['String']['output'];
  /** True when the parameter accepts an explicit null value */
  nullable?: Maybe<Scalars['Boolean']['output']>;
  required: Scalars['Boolean']['output'];
  type: Scalars['String']['output'];
}

/** Complete tool specification for dynamic client-side registration */
export interface ToolSpec {
  category: ToolCategory;
  contextBindings?: Maybe<Array<ToolContextBinding>>;
  /** Declared Agent data boundary for scoped tools */
  dataScope?: Maybe<ToolDataScope>;
  description: Scalars['String']['output'];
  displayName: Scalars['String']['output'];
  /** GraphQL operation string (null for REST tools) */
  graphqlOperation?: Maybe<Scalars['String']['output']>;
  id: ToolId;
  name: Scalars['String']['output'];
  operationType: Scalars['String']['output'];
  parameters: Array<ToolParamSpec>;
  /** Dot-notation field paths hidden from the agent response */
  prune?: Maybe<Array<Scalars['String']['output']>>;
  /** REST content type */
  restContentType?: Maybe<Scalars['String']['output']>;
  /** REST endpoint path (for non-GraphQL tools) */
  restEndpoint?: Maybe<Scalars['String']['output']>;
  /** REST HTTP method */
  restMethod?: Maybe<Scalars['String']['output']>;
  /** Result materialization mode: JSON or MEDIA */
  resultMode?: Maybe<Scalars['String']['output']>;
  /** Agent-facing result contract schema */
  resultSchema?: Maybe<Scalars['String']['output']>;
  runProfiles?: Maybe<Array<SystemRunProfile>>;
  supportedPlatforms?: Maybe<Array<Scalars['String']['output']>>;
  /** True when clients may expose persistResult for this tool */
  supportsPersistResult?: Maybe<Scalars['Boolean']['output']>;
  surfaces?: Maybe<Array<SystemSurface>>;
}

/** Signal that backend ToolSpecs may have changed; clients should re-query ToolSpecsSync. */
export interface ToolSpecsChangedPayload {
  changeType?: Maybe<Scalars['String']['output']>;
  changedToolNames?: Maybe<Array<Scalars['String']['output']>>;
  digest: Scalars['String']['output'];
  publishedAt: Scalars['DateTimeISO']['output'];
  reason?: Maybe<Scalars['String']['output']>;
  revision: Scalars['String']['output'];
}

/** Unpaid-order holdout experiment settings */
export interface UnpaidOrderReachoutExperiment {
  enabled: Scalars['Boolean']['output'];
  experimentId?: Maybe<Scalars['String']['output']>;
  holdoutPercent: Scalars['Int']['output'];
  startedAt?: Maybe<Scalars['DateTimeISO']['output']>;
}

/** Unpaid-order holdout experiment settings patch */
export interface UnpaidOrderReachoutExperimentInput {
  enabled?: InputMaybe<Scalars['Boolean']['input']>;
  /** Holdout percentage. Valid range: 1-20. */
  holdoutPercent?: InputMaybe<Scalars['Int']['input']>;
}

/** One scheduled unpaid-order customer-service reminder stage */
export interface UnpaidOrderReachoutStage {
  /** Minutes after order creation. Valid range: 1-2879. */
  delayMinutes: Scalars['Int']['output'];
  enabled: Scalars['Boolean']['output'];
  id: Scalars['String']['output'];
  /** Deterministic reminder template. */
  messageTemplate: Scalars['String']['output'];
}

/** One unpaid-order reminder stage input */
export interface UnpaidOrderReachoutStageInput {
  /** Minutes after order creation. Valid range: 1-2879. */
  delayMinutes: Scalars['Int']['input'];
  enabled: Scalars['Boolean']['input'];
  /** Stable stage ID. Omit to let Backend generate one. */
  id?: InputMaybe<Scalars['String']['input']>;
  /** Blank/omitted uses the localized stage default. */
  messageTemplate?: InputMaybe<Scalars['String']['input']>;
}

/** One active shop SKU that cannot be safely resolved to canonical InventoryGood. */
export interface UnrecognizedShopSku {
  /** SKU currency, when available from the platform product search response. */
  currency?: Maybe<Scalars['String']['output']>;
  /** SKU sale price, when available from the platform product search response. */
  price?: Maybe<Scalars['String']['output']>;
  /** Platform product ID that owns this SKU. */
  productId: Scalars['String']['output'];
  /** First platform product image URL, when available. */
  productImageUrl?: Maybe<Scalars['String']['output']>;
  /** Platform product title for review context. */
  productTitle?: Maybe<Scalars['String']['output']>;
  /** Why this SKU needs user or AI mapping work before inventory writes are safe. */
  reason: Scalars['String']['output'];
  /** Resolution state produced by exact SKU and explicit mapping rules. */
  resolutionType: InventoryGoodIdentityResolutionType;
  /** Platform seller SKU. Missing when the platform SKU has no seller SKU. */
  sellerSku?: Maybe<Scalars['String']['output']>;
  /** Platform SKU ID. */
  skuId: Scalars['String']['output'];
  /** Total stock quantity across platform inventory rows, when available. */
  stockQuantity?: Maybe<Scalars['Int']['output']>;
}

/** One WMS inventory good that does not exist as an active canonical InventoryGood. */
export interface UnrecognizedWmsInventoryGood {
  barcode?: Maybe<Scalars['String']['output']>;
  countryOfOrigin?: Maybe<InventoryCountryCode>;
  declaredValue?: Maybe<Scalars['Float']['output']>;
  declaredValueCurrency?: Maybe<Currency>;
  dimensionUnit?: Maybe<InventoryDimensionUnit>;
  gtin?: Maybe<Scalars['String']['output']>;
  heightValue?: Maybe<Scalars['Float']['output']>;
  hsCode?: Maybe<Scalars['String']['output']>;
  /** External WMS image URL that can be imported during sync. */
  imageUrl?: Maybe<Scalars['String']['output']>;
  isBattery?: Maybe<Scalars['Boolean']['output']>;
  isHazmat?: Maybe<Scalars['Boolean']['output']>;
  lengthValue?: Maybe<Scalars['Float']['output']>;
  /** WMS goods name. */
  name: Scalars['String']['output'];
  /** Why this WMS good needs InventoryGood sync or review. */
  reason: Scalars['String']['output'];
  /** WMS goods SKU. */
  sku: Scalars['String']['output'];
  weightUnit?: Maybe<InventoryWeightUnit>;
  weightValue?: Maybe<Scalars['Float']['output']>;
  widthValue?: Maybe<Scalars['Float']['output']>;
}

export interface UpdateAffiliateCreatorChannelContactInput {
  customAlias?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  status?: InputMaybe<AffiliateCreatorChannelContactStatus>;
}

export interface UpdateAffiliateTargetCollaborationInput {
  collaborationId: Scalars['ID']['input'];
  creatorOpenIds?: InputMaybe<Array<Scalars['String']['input']>>;
  endTime?: InputMaybe<Scalars['DateTimeISO']['input']>;
  freeSampleRule?: InputMaybe<AffiliateFreeSampleRuleInput>;
  name?: InputMaybe<Scalars['String']['input']>;
  products?: InputMaybe<Array<AffiliateTargetCollaborationUpdateProductInput>>;
  sellerContactInfo?: InputMaybe<AffiliateSellerContactInfoInput>;
  shopId: Scalars['ID']['input'];
}

export interface UpdateAffiliateTargetCollaborationPayload {
  collaboration: AffiliateCollaboration;
  providerResult: EcomUpdateTargetCollaborationResult;
}

/** Update notification payload */
export interface UpdatePayload {
  version: Scalars['String']['output'];
}

export interface UpdateProductKnowledgeInput {
  creativeCasesMarkdown: Scalars['String']['input'];
  expectedRevision: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  name: Scalars['String']['input'];
  qaMarkdown: Scalars['String']['input'];
  usageInstructionsMarkdown: Scalars['String']['input'];
}

/** Input for updating an existing RunProfile */
export interface UpdateRunProfileInput {
  name?: InputMaybe<Scalars['String']['input']>;
  selectedToolIds?: InputMaybe<Array<Scalars['String']['input']>>;
  surfaceId?: InputMaybe<Scalars['String']['input']>;
}

/** Input for updating an existing shop */
export interface UpdateShopInput {
  alias?: InputMaybe<Scalars['String']['input']>;
  authStatus?: InputMaybe<ShopAuthStatus>;
  grantedScopes?: InputMaybe<Array<Scalars['String']['input']>>;
  region?: InputMaybe<ShopRegion>;
  services?: InputMaybe<ShopServiceConfigInput>;
  shopName?: InputMaybe<Scalars['String']['input']>;
  timezone?: InputMaybe<Scalars['String']['input']>;
  timezoneSource?: InputMaybe<ShopTimezoneSource>;
}

/** Input for updating an existing Surface */
export interface UpdateSurfaceInput {
  allowedToolIds?: InputMaybe<Array<Scalars['String']['input']>>;
  description?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
}

export interface UpdateWhatsAppProxyInput {
  host?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  password?: InputMaybe<Scalars['String']['input']>;
  port?: InputMaybe<Scalars['String']['input']>;
  protocol?: InputMaybe<ProxyProtocol>;
  region?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<ProxyStatus>;
  username?: InputMaybe<Scalars['String']['input']>;
}

export interface UpsertExpertProfileInput {
  capitalBand?: InputMaybe<Scalars['String']['input']>;
  constraints: Array<Scalars['String']['input']>;
  experience?: InputMaybe<Scalars['String']['input']>;
  goals: Array<Scalars['String']['input']>;
  locale: Scalars['String']['input'];
  sellerTypes: Array<ExpertSellerType>;
  stage: Scalars['String']['input'];
  targetMarkets: Array<Scalars['String']['input']>;
  targetTimeline?: InputMaybe<Scalars['String']['input']>;
  teamCapacity?: InputMaybe<Scalars['String']['input']>;
}

export const UsageLimitWindow = {
  FiveHours: 'FIVE_HOURS',
  GrantLifetime: 'GRANT_LIFETIME',
  Month: 'MONTH',
  Week: 'WEEK'
} as const;

export type UsageLimitWindow = typeof UsageLimitWindow[keyof typeof UsageLimitWindow];
export const UsageMetric = {
  CsConversationStarted: 'CS_CONVERSATION_STARTED',
  EcomAffiliateAction: 'ECOM_AFFILIATE_ACTION',
  EcomAnalyticsQuery: 'ECOM_ANALYTICS_QUERY',
  EcomInventoryAction: 'ECOM_INVENTORY_ACTION',
  LlmToken: 'LLM_TOKEN'
} as const;

export type UsageMetric = typeof UsageMetric[keyof typeof UsageMetric];
/** A usage rule attached to an entitlement grant. */
export interface UsagePolicy {
  limit: Scalars['Int']['output'];
  metric: UsageMetric;
  window: UsageLimitWindow;
}

export interface UserAgentProfile {
  active: Scalars['Boolean']['output'];
  disabledAt?: Maybe<Scalars['DateTimeISO']['output']>;
  /** Admin user ID that disabled this agent invite code. */
  disabledByUserId?: Maybe<Scalars['String']['output']>;
  enabledAt?: Maybe<Scalars['DateTimeISO']['output']>;
  /** Admin user ID that enabled this agent invite code. */
  enabledByUserId?: Maybe<Scalars['String']['output']>;
  /** Six-character invite code for agent referrals. */
  inviteCode?: Maybe<Scalars['String']['output']>;
}

export interface UserSupport {
  /** Per-user Telegram debug proxy token for RivonClaw support sessions. */
  telegramDebugProxyToken?: Maybe<Scalars['String']['output']>;
}

export interface ValidateAffiliateCampaignMessageTemplateSuggestionInput {
  mode: AffiliateCampaignTemplateGenerationMode;
  previousDraft?: InputMaybe<Scalars['String']['input']>;
  productShortName: Scalars['String']['input'];
  shopId: Scalars['ID']['input'];
  text: Scalars['String']['input'];
}

export interface VerifyPairingResult {
  accessToken: Scalars['String']['output'];
  desktopDeviceId: Scalars['String']['output'];
  pairingId: Scalars['String']['output'];
  relayUrl: Scalars['String']['output'];
}

/** Result of shop access verification */
export interface VerifyShopAccessResult {
  authorized: Array<Scalars['String']['output']>;
  unauthorized: Array<Scalars['String']['output']>;
}

export interface WaitPairingResult {
  accessToken?: Maybe<Scalars['String']['output']>;
  desktopDeviceId?: Maybe<Scalars['String']['output']>;
  mobileDeviceId?: Maybe<Scalars['String']['output']>;
  paired: Scalars['Boolean']['output'];
  pairingId?: Maybe<Scalars['String']['output']>;
  reason?: Maybe<Scalars['String']['output']>;
  relayUrl?: Maybe<Scalars['String']['output']>;
}

/** Canonical warehouse identity used by inventory management */
export interface Warehouse {
  address?: Maybe<WarehouseAddress>;
  /** Merchant or provider-facing warehouse code, such as DYY-NY. */
  code?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTimeISO']['output'];
  /** Provider warehouse ID, such as fbt_warehouse_id or Yejoin storage code. */
  externalWarehouseId?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  lastSyncedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  name: Scalars['String']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  provider: WarehouseProvider;
  regionCode?: Maybe<InventoryRegionCode>;
  /** System-local source Mongo ID, such as WmsAccount._id, Shop._id, or a future persisted EcomProduct source entity ID. */
  sourceId?: Maybe<Scalars['ID']['output']>;
  status: WarehouseStatus;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['String']['output'];
  warehouseType: WarehouseType;
}

/** Warehouse address snapshot */
export interface WarehouseAddress {
  addressLine1?: Maybe<Scalars['String']['output']>;
  addressLine2?: Maybe<Scalars['String']['output']>;
  city?: Maybe<Scalars['String']['output']>;
  district?: Maybe<Scalars['String']['output']>;
  fullAddress?: Maybe<Scalars['String']['output']>;
  postalCode?: Maybe<Scalars['String']['output']>;
  region?: Maybe<Scalars['String']['output']>;
  regionCode?: Maybe<InventoryRegionCode>;
  state?: Maybe<Scalars['String']['output']>;
}

/** Warehouse address patch */
export interface WarehouseAddressInput {
  /** Primary street address line. */
  addressLine1?: InputMaybe<Scalars['String']['input']>;
  /** Secondary address line, suite, unit, or building details. */
  addressLine2?: InputMaybe<Scalars['String']['input']>;
  /** City. */
  city?: InputMaybe<Scalars['String']['input']>;
  /** District, county, or local administrative area. */
  district?: InputMaybe<Scalars['String']['input']>;
  /** Full address string as returned by the source system. */
  fullAddress?: InputMaybe<Scalars['String']['input']>;
  /** Postal or ZIP code. */
  postalCode?: InputMaybe<Scalars['String']['input']>;
  /** Country or region display name returned by the source system. */
  region?: InputMaybe<Scalars['String']['input']>;
  /** Country or region code for the warehouse address. */
  regionCode?: InputMaybe<InventoryRegionCode>;
  /** State or province. */
  state?: InputMaybe<Scalars['String']['input']>;
}

/** System or provider that owns the physical or platform warehouse */
export const WarehouseProvider = {
  AmazonFba: 'AMAZON_FBA',
  Lingxing: 'LINGXING',
  Seller: 'SELLER',
  TiktokFbt: 'TIKTOK_FBT',
  Xlwms: 'XLWMS',
  Yejoin: 'YEJOIN'
} as const;

export type WarehouseProvider = typeof WarehouseProvider[keyof typeof WarehouseProvider];
/** Lifecycle state of a canonical warehouse */
export const WarehouseStatus = {
  Active: 'ACTIVE',
  Archived: 'ARCHIVED'
} as const;

export type WarehouseStatus = typeof WarehouseStatus[keyof typeof WarehouseStatus];
/** Business type of a canonical warehouse */
export const WarehouseType = {
  OfficialPlatform: 'OFFICIAL_PLATFORM',
  SellerManaged: 'SELLER_MANAGED',
  ThirdPartyWms: 'THIRD_PARTY_WMS'
} as const;

export type WarehouseType = typeof WarehouseType[keyof typeof WarehouseType];
/** The first-party browser surface that will receive a host-only session cookie. */
export const WebAppSurface = {
  CnRelay: 'CN_RELAY',
  Global: 'GLOBAL'
} as const;

export type WebAppSurface = typeof WebAppSurface[keyof typeof WebAppSurface];
/** Browser authentication response; refresh token stays in HttpOnly cookie */
export interface WebAuthPayload {
  accessToken: Scalars['String']['output'];
  user: MeResponse;
}

export interface WebSessionTransferStart {
  authorizationUrl: Scalars['String']['output'];
  expiresAt: Scalars['DateTimeISO']['output'];
}

/** Seller-level WhatsApp linked-device account binding */
export interface WhatsAppAccountBinding {
  businessDeveloperAssignedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  businessDeveloperId?: Maybe<Scalars['ID']['output']>;
  createdAt: Scalars['DateTimeISO']['output'];
  displayName?: Maybe<Scalars['String']['output']>;
  evolutionInstanceId?: Maybe<Scalars['String']['output']>;
  evolutionInstanceName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lastConnectedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastDisconnectedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastError?: Maybe<Scalars['String']['output']>;
  lastQrAt?: Maybe<Scalars['DateTimeISO']['output']>;
  outboundSendBlockedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  outboundSendBlockedCode?: Maybe<Scalars['String']['output']>;
  outboundSendBlockedReason?: Maybe<Scalars['String']['output']>;
  outboundSendBlockedUntil?: Maybe<Scalars['DateTimeISO']['output']>;
  phoneNumber?: Maybe<Scalars['String']['output']>;
  profilePicUrl?: Maybe<Scalars['String']['output']>;
  provider: WhatsAppProvider;
  proxyId?: Maybe<Scalars['ID']['output']>;
  status: WhatsAppAccountStatus;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['ID']['output'];
}

/** Lifecycle state for a seller WhatsApp account binding */
export const WhatsAppAccountStatus = {
  Connected: 'CONNECTED',
  Disconnected: 'DISCONNECTED',
  Error: 'ERROR',
  PendingQr: 'PENDING_QR',
  Revoked: 'REVOKED'
} as const;

export type WhatsAppAccountStatus = typeof WhatsAppAccountStatus[keyof typeof WhatsAppAccountStatus];
/** Count of WhatsApp account bindings by lifecycle status */
export interface WhatsAppAccountStatusCount {
  count: Scalars['Float']['output'];
  status: WhatsAppAccountStatus;
}

/** Evolution API connector health and seller-visible WhatsApp counts */
export interface WhatsAppConnectorStatus {
  accountCounts: Array<WhatsAppAccountStatusCount>;
  configured: Scalars['Boolean']['output'];
  httpStatus?: Maybe<Scalars['Float']['output']>;
  licenseRequired: Scalars['Boolean']['output'];
  message?: Maybe<Scalars['String']['output']>;
  proxyCounts: Array<WhatsAppProxyStatusCount>;
  reachable: Scalars['Boolean']['output'];
  ready: Scalars['Boolean']['output'];
}

/** Backend connector provider for WhatsApp account bindings */
export const WhatsAppProvider = {
  EvolutionApi: 'EVOLUTION_API'
} as const;

export type WhatsAppProvider = typeof WhatsAppProvider[keyof typeof WhatsAppProvider];
/** Stable egress proxy assigned to WhatsApp linked-device sessions */
export interface WhatsAppProxy {
  createdAt: Scalars['DateTimeISO']['output'];
  host: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lastCheckedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  lastError?: Maybe<Scalars['String']['output']>;
  port: Scalars['String']['output'];
  protocol: ProxyProtocol;
  region?: Maybe<Scalars['String']['output']>;
  status: ProxyStatus;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId?: Maybe<Scalars['ID']['output']>;
  username?: Maybe<Scalars['String']['output']>;
}

/** Count of WhatsApp proxies by operational status */
export interface WhatsAppProxyStatusCount {
  count: Scalars['Float']['output'];
  status: ProxyStatus;
}

/** Third-party WMS API account connection */
export interface WmsAccount {
  createdAt: Scalars['DateTimeISO']['output'];
  /** Default currency for declared inventory goods values imported from this WMS when the provider does not return a currency. */
  declaredValueCurrency?: Maybe<Currency>;
  endpoint: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  lastSyncError?: Maybe<Scalars['String']['output']>;
  lastSyncedAt?: Maybe<Scalars['DateTimeISO']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  provider: WmsAccountProvider;
  status: WmsAccountStatus;
  updatedAt: Scalars['DateTimeISO']['output'];
  userId: Scalars['String']['output'];
}

/** Third-party WMS provider */
export const WmsAccountProvider = {
  Lingxing: 'LINGXING',
  Xlwms: 'XLWMS',
  Yejoin: 'YEJOIN'
} as const;

export type WmsAccountProvider = typeof WmsAccountProvider[keyof typeof WmsAccountProvider];
/** Lifecycle state of a WMS account connection */
export const WmsAccountStatus = {
  Active: 'ACTIVE',
  Archived: 'ARCHIVED'
} as const;

export type WmsAccountStatus = typeof WmsAccountStatus[keyof typeof WmsAccountStatus];
/** Read-only coverage view for WMS goods against canonical InventoryGoods. */
export interface WmsInventoryGoodCoveragePayload {
  /** WMS provider that produced these goods. */
  provider: WmsAccountProvider;
  /** Number of WMS goods that already have an active InventoryGood with the same SKU. */
  recognizedWmsGoodsCount: Scalars['Int']['output'];
  /** WMS goods that need InventoryGood sync or review. */
  unrecognizedWmsInventoryGoods: Array<UnrecognizedWmsInventoryGood>;
  /** WMS account ID that was scanned. */
  wmsAccountId: Scalars['ID']['output'];
}

/** Warehouse management system settings per shop (user-configurable) */
export interface WmsSettings {
  /** Whether WMS/inventory management is enabled for this shop. */
  enabled: Scalars['Boolean']['output'];
}

/** WMS settings patch. Omit a field or pass null to keep it; pass a value to set it. */
export interface WmsSettingsInput {
  /** WMS/inventory management enabled flag. Omit or pass null to keep, true/false to set. */
  enabled?: InputMaybe<Scalars['Boolean']['input']>;
}

/** Result of syncing warehouses from a WMS account */
export interface WmsWarehouseSyncPayload {
  /** WMS provider that produced the warehouses. */
  provider: WmsAccountProvider;
  /** Number of warehouses read from the WMS and upserted into canonical Warehouse. */
  warehousesSynced: Scalars['Int']['output'];
  /** WMS account ID that was synced. */
  wmsAccountId: Scalars['ID']['output'];
}

export interface WriteAffiliateApprovalPolicyInput {
  action: ActionProposalType;
  campaignIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  creatorTagIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  enabled?: InputMaybe<Scalars['Boolean']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  productIds?: InputMaybe<Array<Scalars['String']['input']>>;
  reason?: InputMaybe<Scalars['String']['input']>;
}

export interface WriteAffiliateBusinessDeveloperInput {
  acceptingCreators?: InputMaybe<Scalars['Boolean']['input']>;
  agentAssistanceMode?: InputMaybe<AffiliateAgentAssistanceMode>;
  businessPrompt?: InputMaybe<Scalars['String']['input']>;
  creatorDisplayName?: InputMaybe<Scalars['String']['input']>;
  displayName?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  regions?: InputMaybe<Array<ShopRegion>>;
}

export interface WriteAffiliateCampaignInput {
  commissionRatePercent: Scalars['Float']['input'];
  dailyOutreachTarget: Scalars['Int']['input'];
  id?: InputMaybe<Scalars['ID']['input']>;
  messageProductName?: InputMaybe<Scalars['String']['input']>;
  messageTemplateSource: AffiliateCampaignMessageTemplateSource;
  messageTemplateText: Scalars['String']['input'];
  name: Scalars['String']['input'];
  primaryProductId: Scalars['String']['input'];
  refreshProductSnapshot?: InputMaybe<Scalars['Boolean']['input']>;
  searchPlanGuidance?: InputMaybe<Scalars['String']['input']>;
  selectionPolicy: AffiliateCampaignSelectionPolicyInput;
  shopId: Scalars['ID']['input'];
  status?: InputMaybe<AffiliateCampaignStatus>;
}

export interface WriteAffiliateCreatorChannelContactInput {
  accountBindingId: Scalars['ID']['input'];
  channel: AffiliateMessageChannel;
  creatorAddress: Scalars['String']['input'];
  creatorRelationshipId: Scalars['ID']['input'];
  customAlias?: InputMaybe<Scalars['String']['input']>;
}

export interface WriteCampaignProductInput {
  campaignId: Scalars['ID']['input'];
  commissionRate?: InputMaybe<Scalars['Float']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  maxCommissionRate?: InputMaybe<Scalars['Float']['input']>;
  productId: Scalars['String']['input'];
  promotionPriority?: InputMaybe<CampaignProductPromotionPriority>;
  sampleOfferMode?: InputMaybe<CampaignProductSampleOfferMode>;
  sampleQuota?: InputMaybe<Scalars['Int']['input']>;
  sampleUnitCostAmount?: InputMaybe<Scalars['Float']['input']>;
  sampleUnitCostCurrency?: InputMaybe<EcomProductSkuCurrency>;
  shopId: Scalars['ID']['input'];
  title?: InputMaybe<Scalars['String']['input']>;
}

export interface WriteCreatorSearchRunInput {
  campaignId?: InputMaybe<Scalars['ID']['input']>;
  completedAt?: InputMaybe<Scalars['DateTimeISO']['input']>;
  createdCandidateIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  errorMessage?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  nextPageToken?: InputMaybe<Scalars['String']['input']>;
  platformRequestId?: InputMaybe<Scalars['String']['input']>;
  requestedByActorId?: InputMaybe<Scalars['String']['input']>;
  requestedByActorType?: InputMaybe<AffiliateLifecycleActorType>;
  requestedByRunId?: InputMaybe<Scalars['String']['input']>;
  resultCount?: InputMaybe<Scalars['Int']['input']>;
  searchParams: CreatorMarketplaceSearchParamsInput;
  shopId: Scalars['ID']['input'];
  status?: InputMaybe<CreatorSearchRunStatus>;
}

export interface WriteCreatorTagInput {
  id?: InputMaybe<Scalars['ID']['input']>;
  name: Scalars['String']['input'];
  sensitive?: InputMaybe<Scalars['Boolean']['input']>;
  shopId: Scalars['ID']['input'];
  systemKey?: InputMaybe<CreatorSystemTagKey>;
  type?: InputMaybe<CreatorTagType>;
}

/** Write a canonical stockable inventory item. Omit id to locate by exact sku or create a new item. */
export interface WriteInventoryGoodInput {
  barcode?: InputMaybe<Scalars['String']['input']>;
  countryOfOrigin?: InputMaybe<InventoryCountryCode>;
  declaredValue?: InputMaybe<Scalars['Float']['input']>;
  declaredValueCurrency?: InputMaybe<Currency>;
  dimensionUnit?: InputMaybe<InventoryDimensionUnit>;
  gtin?: InputMaybe<Scalars['String']['input']>;
  heightValue?: InputMaybe<Scalars['Float']['input']>;
  hsCode?: InputMaybe<Scalars['String']['input']>;
  /** Existing InventoryGood ID to update. Omit to locate by userId + sku. */
  id?: InputMaybe<Scalars['ID']['input']>;
  /** Temporary ImageAsset ID to promote. Pass null to clear the current image. */
  imageAssetId?: InputMaybe<Scalars['ID']['input']>;
  /** Temporary image URI to promote. Used only when imageAssetId is unavailable. */
  imageUri?: InputMaybe<Scalars['String']['input']>;
  isBattery?: InputMaybe<Scalars['Boolean']['input']>;
  isHazmat?: InputMaybe<Scalars['Boolean']['input']>;
  lengthValue?: InputMaybe<Scalars['Float']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  sku?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<InventoryGoodStatus>;
  weightUnit?: InputMaybe<InventoryWeightUnit>;
  weightValue?: InputMaybe<Scalars['Float']['input']>;
  widthValue?: InputMaybe<Scalars['Float']['input']>;
}

/** Write a sparse external SKU to InventoryGood mapping. Omit id to locate by sourceSystem + sourceId + sellerSku. */
export interface WriteInventoryGoodMappingInput {
  /** Existing InventoryGoodMapping ID to update. Omit to locate by natural key. */
  id?: InputMaybe<Scalars['ID']['input']>;
  inventoryGoodId?: InputMaybe<Scalars['ID']['input']>;
  lastSeenAt?: InputMaybe<Scalars['DateTimeISO']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  sellerSku?: InputMaybe<Scalars['String']['input']>;
  sourceId?: InputMaybe<Scalars['ID']['input']>;
  sourceSystem?: InputMaybe<InventoryGoodMappingSourceSystem>;
  status?: InputMaybe<InventoryGoodMappingStatus>;
  verificationStatus?: InputMaybe<InventoryGoodMappingVerificationStatus>;
}

/** Write one shop warehouse to canonical warehouse mapping. Pass warehouseId to confirm a mapping; pass null to clear it. */
export interface WriteShopWarehouseMappingInput {
  /** ShopWarehouse ID to update. */
  shopWarehouseId: Scalars['ID']['input'];
  /** Canonical Warehouse ID. Pass null to clear the mapping. */
  warehouseId?: InputMaybe<Scalars['ID']['input']>;
}

/** Write a canonical warehouse. Omit id to create; pass id to update. */
export interface WriteWarehouseInput {
  /** Warehouse address snapshot. Pass null to clear it. */
  address?: InputMaybe<WarehouseAddressInput>;
  /** Merchant or provider-facing warehouse code, such as DYY-NY. */
  code?: InputMaybe<Scalars['String']['input']>;
  /** Provider warehouse ID, such as Yejoin storage code or TikTok fbt_warehouse_id. */
  externalWarehouseId?: InputMaybe<Scalars['String']['input']>;
  /** Existing Warehouse ID to update. Omit to create a new warehouse. */
  id?: InputMaybe<Scalars['ID']['input']>;
  /** Last successful source sync timestamp. Usually system-managed. */
  lastSyncedAt?: InputMaybe<Scalars['DateTimeISO']['input']>;
  /** Warehouse display name. */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Optional operator notes about this warehouse. */
  notes?: InputMaybe<Scalars['String']['input']>;
  /** Warehouse provider, such as YEJOIN or TIKTOK_FBT. */
  provider?: InputMaybe<WarehouseProvider>;
  /** Country or region code for the warehouse. */
  regionCode?: InputMaybe<InventoryRegionCode>;
  /** System-local source Mongo ID, such as WmsAccount._id, Shop._id, or a future persisted EcomProduct source entity ID. */
  sourceId?: InputMaybe<Scalars['ID']['input']>;
  /** Lifecycle status. Use ARCHIVED instead of hard deleting. */
  status?: InputMaybe<WarehouseStatus>;
  /** Warehouse business type, such as OFFICIAL_PLATFORM or THIRD_PARTY_WMS. */
  warehouseType?: InputMaybe<WarehouseType>;
}

/** Write a WMS account. Omit id to locate by provider + label or create a new account. apiToken is write-only. */
export interface WriteWmsAccountInput {
  /** WMS API token/key. Stored write-only and never exposed by WmsAccount. */
  apiToken?: InputMaybe<Scalars['String']['input']>;
  /** Default currency for declared inventory goods values imported from this WMS when the provider does not return a currency. Pass null to clear. */
  declaredValueCurrency?: InputMaybe<Currency>;
  /** Base API endpoint for this WMS account. */
  endpoint?: InputMaybe<Scalars['String']['input']>;
  /** Existing WmsAccount ID to update. Omit to create a new account. */
  id?: InputMaybe<Scalars['ID']['input']>;
  /** User-facing account label, unique per provider for the user. */
  label?: InputMaybe<Scalars['String']['input']>;
  /** Most recent sync error message, if any. Usually system-managed. */
  lastSyncError?: InputMaybe<Scalars['String']['input']>;
  /** Last successful warehouse sync timestamp. Usually system-managed. */
  lastSyncedAt?: InputMaybe<Scalars['DateTimeISO']['input']>;
  /** Optional operator notes about this WMS connection. */
  notes?: InputMaybe<Scalars['String']['input']>;
  /** WMS provider implementation. Required when creating a new account. */
  provider?: InputMaybe<WmsAccountProvider>;
  /** Lifecycle status. Use ARCHIVED instead of hard deleting. */
  status?: InputMaybe<WmsAccountStatus>;
}

/** Result of writing a WMS account */
export interface WriteWmsAccountPayload {
  /** Created or updated WMS account. apiToken is never returned. */
  account: WmsAccount;
  /** Sync result when the account is new or its endpoint/apiToken changed. */
  sync?: Maybe<WmsWarehouseSyncPayload>;
}
