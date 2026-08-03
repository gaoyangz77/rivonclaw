import { createClient, type Client } from "graphql-ws/client";
import { getApiBaseUrl, type GQL } from "@rivonclaw/core";
import { isNewerVersion } from "@rivonclaw/updater";
import { createLogger } from "@rivonclaw/logger";
import { proxyNetwork } from "../infra/proxy/proxy-aware-network.js";

const log = createLogger("backend-subscription");

const NON_RETRYABLE_WS_CLOSE_CODES = new Set([
  4004, // BadResponse
  4005, // InternalClientError
  4400, // BadRequest
  4406, // SubprotocolNotAcceptable
  4409, // SubscriberAlreadyExists
  4429, // TooManyInitialisationRequests
]);

const AUTH_WS_CLOSE_CODES = new Set([
  4401, // Unauthorized
  4403, // Forbidden
]);

const UPDATE_SUBSCRIPTION = `
  subscription UpdateAvailable($clientVersion: String!) {
    updateAvailable(clientVersion: $clientVersion) {
      version
    }
  }
`;

export const OAUTH_COMPLETE_SUBSCRIPTION = `
  subscription OAuthComplete {
    oauthComplete {
      shopId
      shopName
      platform
      shops {
        shopName
        __typename
        id
        userId
        platform
        platformAppId
        platformShopId
        collectionKey
        alias
        authStatus
        region
        accessTokenExpiresAt
        refreshTokenExpiresAt
        services {
          customerService {
            enabled
            unpaidOrderReachoutEnabled
            unpaidOrderReachoutStages { id enabled delayMinutes messageTemplate }
            unpaidOrderReachoutExperiment { enabled holdoutPercent experimentId startedAt }
            businessPrompt
            runProfileId
            csDeviceId
            csProviderOverride
            csModelOverride
            escalationChannelId
            escalationRecipientId
            platformSystemPrompt
            reviewOptimization {
              enabled
              badReviewReachout {
                enabled
                stars
                recentDays
              }
            }
          }
          wms {
            enabled
          }
          affiliateService {
            enabled
            runProfileId
            deviceId
            businessPrompt
            decisionThresholds {
              minExpectedSalesUnits
            }
          }
        }
      }
    }
  }
`;

const ADS_OAUTH_COMPLETE_SUBSCRIPTION = `
  subscription AdsOAuthComplete {
    adsOAuthComplete {
      platform
      advertiserIds
      advertiserCount
    }
  }
`;

const AFFILIATE_OUTREACH_ACCOUNT_CONNECTED_SUBSCRIPTION = `
  subscription AffiliateOutreachAccountConnected {
    affiliateOutreachAccountConnected {
      channel
      accountId
      displayName
      address
    }
  }
`;

export const SHOP_UPDATED_SUBSCRIPTION = `
  subscription ShopUpdated {
    shopUpdated {
      __typename
      id
      userId
      platform
      platformAppId
      platformShopId
      collectionKey
      shopName
      alias
      authStatus
      region
      accessTokenExpiresAt
      refreshTokenExpiresAt
      services {
        customerService {
          enabled
          unpaidOrderReachoutEnabled
          unpaidOrderReachoutStages { id enabled delayMinutes messageTemplate }
          unpaidOrderReachoutExperiment { enabled holdoutPercent experimentId startedAt }
          businessPrompt
          runProfileId
          csDeviceId
          csProviderOverride
          csModelOverride
          escalationChannelId
          escalationRecipientId
          platformSystemPrompt
          reviewOptimization {
            enabled
            badReviewReachout {
              enabled
              stars
              recentDays
            }
          }
        }
        wms {
          enabled
        }
        affiliateService {
          enabled
          runProfileId
          deviceId
          businessPrompt
          decisionThresholds {
            minExpectedSalesUnits
          }
        }
      }
    }
  }
`;

const CLIENT_LOG_UPLOAD_REQUESTED_SUBSCRIPTION = `
  subscription ClientLogUploadRequested($deviceId: String) {
    clientLogUploadRequested(deviceId: $deviceId) {
      requestId
      requestedAt
      reason
      deviceId
    }
  }
`;

const DEVICE_PRESENCE_PROBE_REQUESTED_SUBSCRIPTION = `
  subscription DevicePresenceProbeRequested {
    devicePresenceProbeRequested {
      requestId
      requestedAt
    }
  }
`;

const CS_ESCALATION_EVENT_SUBSCRIPTION = `
  subscription CsEscalationEvent {
    csEscalationEvent {
      escalation {
        id
        shopId
        conversationId
        buyerUserId
        buyerNickname
        orderId
        reason
        context
        status
        version
      }
      event {
        id
        type
        status
        decision
        instructions
        createdAt
        updatedAt
      }
    }
  }
`;

const CS_CONVERSATION_SIGNAL_SUBSCRIPTION = `
  subscription CsConversationSignal($shopIds: [ID!]) {
    csConversationSignal(shopIds: $shopIds) {
      type
      source
      shopId
      platformShopId
      conversationId
      messageId
      messageIndex
      imUserId
      buyerUserId
      orderId
      messageType
      senderRole
      aiEnabled
      latestMessagePreview
      operatorInstruction
      dispatchEventTime
      eventTime
    }
  }
`;

const CS_CONVERSATION_CHANGED_SUBSCRIPTION = `
  subscription CsConversationChanged($shopIds: [ID!]) {
    csConversationChanged(shopIds: $shopIds) {
      shopId
      platformShopId
      conversationId
      unreadCount
      status
      replyStatus
      isOpen
      platformConversationStatus
      aiEnabled
      createTime
      latestMessageTime
      latestMessagePreview
      lastPendingAt
      resolvedAt
      updatedAt
      openEscalationCount
      latestOpenEscalationId
      latestOpenEscalationStatus
      latestOpenEscalationUpdatedAt
      dispatchHint {
        reason
        source
        messageId
        messageIndex
        eventTime
        dispatchEventTime
        operatorInstruction
      }
      orderId
      participantCount
      canSendMessage
      participants {
        role
        userId
        imUserId
        nickname
        avatar
      }
      latestMessage {
        messageId
        type
        content
        index
        createTime
        sender {
          role
          userId
          imUserId
          nickname
          avatar
        }
      }
    }
  }
`;

const AFFILIATE_RELATIONSHIP_SIGNAL_SUBSCRIPTION = `
  subscription AffiliateRelationshipSignal {
    affiliateRelationshipSignal {
      type
      source
      workSignal
      affiliateCollaborationId
      creatorRelationshipId
      processingStatus
      requiredAction
      processReasons
      shopId
      platformShopId
      messageId
      messageIndex
      messageType
      messageDirection
      channel
      creatorImId
      senderRole
      senderId
      sampleApplicationRecordId
      platformTargetCollaborationId
      platformStatus
      platformFulfillmentStatus
      platformFulfillmentId
      contentId
      creatorOpenId
      productId
      orderId
      platformProgramId
      notificationId
      eventTime
    }
  }
`;

export const AFFILIATE_WORK_ITEM_CHANGED_SUBSCRIPTION = `
  subscription AffiliateWorkItemChanged {
    affiliateWorkItemChanged {
      workItem {
        id
        triggerShopId
        triggerPlatformShopId
        routingShopIds
        routingPlatformShopIds
        subjectType
        creatorRelationshipId
        affiliateCollaborationId
        workKind
        workBundleKind
        agentWorkingAgendaItems {
          key
          owner
          sourceType
          workKind
          requiredAction
          shopId
          affiliateCollaborationId
          sampleApplicationRecordId
          proposalId
          reasons
          nextActionAt
          boundaryEventCursor
          updatedAt
          revisionRequestedProposal {
            id
            type
            status
            operatorSummary
            decision { note decidedAt actorType actorId }
            messageIntent {
              creatorId
              preferredChannel
              emailSubject
              parts { kind text textHash textLength draftAssetId caption captionHash captionLength emailDisposition fileName mimeType sizeBytes sha256 productId targetCollaborationId sampleApplicationId }
            }
            sampleReviewIntent { sampleApplicationRecordId platformApplicationId projectionRevision lastObservedAt decision rejectReason }
            targetCollaborationIntent {
              name
              message
              endTime
              hasFreeSample
              isSampleApprovalExempt
              creatorIds
              creatorOpenIds
              products { productId targetCommissionRateBps shopAdsCommissionRateBps }
              sellerContactInfo { email phoneNumber whatsapp telegram line }
            }
            steps {
              stepId
              type
              operatorSummary
              messageIntent {
                creatorId
                preferredChannel
                emailSubject
                parts { kind text textHash textLength draftAssetId caption captionHash captionLength emailDisposition fileName mimeType sizeBytes sha256 productId targetCollaborationId sampleApplicationId }
              }
              sampleReviewIntent { sampleApplicationRecordId platformApplicationId projectionRevision lastObservedAt decision rejectReason }
              targetCollaborationIntent {
                name
                message
                endTime
                hasFreeSample
                isSampleApprovalExempt
                creatorIds
                creatorOpenIds
                products { productId targetCommissionRateBps shopAdsCommissionRateBps }
                sellerContactInfo { email phoneNumber whatsapp telegram line }
              }
            }
          }
        }
        recommendedActionTypes
        agentDispatchRecommended
        staffReviewRequired
        processingStatus
        requiredAction
        processReasons
        versionAt
        creatorRelationship {
          id
          creatorId
          blocked
          blockedShopIds
          lastInboundAt
          lastOutboundAt
          lastAgentHandledAt
          committedCheckpointId
          committedCheckpointAt
          committedEventCursor
          lifecycleEventSequence
          activeRunId
          activeRunBaseCheckpointId
          activeRunBaseEventCursor
          agendaItems {
            key
            owner
            sourceType
            workKind
            requiredAction
            shopId
            affiliateCollaborationId
            sampleApplicationRecordId
            proposalId
            reasons
            nextActionAt
            boundaryEventCursor
            updatedAt
          }
          workSummary {
            agentRequiredCount
            staffRequiredCount
            externalWaitingCount
            activeCollaborationCount
            nextActionAt
          }
          stateUpdatedAt
          activeAffiliateCollaborationIds
          shopStates {
            shopId
            tagIds
            lastContactedAt
            lastInvitedAt
            lastQualifiedAt
          }
        }
        affiliateCollaboration {
          id
          userId
          shopId
          campaignId
          type
          platformCollaborationId
          status
          creatorIds
          creatorOpenIds
          productIds
          commissionRate
          effectiveTime
          platformUpdatedAt
          firstObservedAt
          lastObservedAt
          lastSyncSource
          projectionRevision
          createdAt
          updatedAt
        }
        context {
          creatorProfile {
            id
            platform
            creatorOpenId
            creatorImId
          }
          creatorRelation {
            id
            creatorId
            blocked
            blockedShopIds
            shopStates {
              shopId
              tagIds
              lastContactedAt
              lastInvitedAt
              lastQualifiedAt
            }
          }
          affiliateCollaboration {
            id
            type
            campaignId
            platformCollaborationId
            productIds
            status
          }
          activeCollaborations {
            id
            userId
            shopId
            type
            platformCollaborationId
            status
            creatorIds
            creatorOpenIds
            productIds
            lastObservedAt
            updatedAt
          }
          focusCollaboration {
            id
            userId
            shopId
            type
            platformCollaborationId
            status
            creatorIds
            creatorOpenIds
            productIds
            lastObservedAt
            updatedAt
          }
          ambiguousCollaborationCandidates {
            id
            userId
            shopId
            type
            platformCollaborationId
            status
            creatorIds
            creatorOpenIds
            productIds
            lastObservedAt
            updatedAt
          }
          productContext {
            productId
            title
            imageUrl
            source
          }
          primarySampleApplication {
            id
            userId
            platformApplicationId
            creatorId
            creatorOpenId
            productId
            affiliateCollaborationId
            collaborationType
            platformCollaborationId
            platformOpenCollaborationId
            platformTargetCollaborationId
            sampleWorkStatus
            trackingNumber
            carrier
            observedContentCount
            shippedAt
            deliveredAt
            latestObservedContentId
            updatedAt
          }
          relatedSampleApplications {
            id
            userId
            platformApplicationId
            creatorId
            creatorOpenId
            productId
            affiliateCollaborationId
            collaborationType
            platformCollaborationId
            platformOpenCollaborationId
            platformTargetCollaborationId
            sampleWorkStatus
            trackingNumber
            carrier
            observedContentCount
            latestObservedContentAt
            latestObservedContentId
            latestObservedContentUrl
            latestObservedContentFormat
            latestObservedContentPaidOrderCount
            latestObservedContentViewCount
            shippedAt
            deliveredAt
            updatedAt
          }
          sampleApplicationLookup {
            status
            queriedAt
            shopId
            productIds
          }
          missingContext {
            reason
            severity
            message
          }
          recommendedActionTypes
        }
      }
    }
  }
`;

export const AFFILIATE_ACTION_PROPOSAL_CHANGED_SUBSCRIPTION = `
  subscription AffiliateActionProposalChanged {
    affiliateActionProposalChanged {
      proposal {
        id
        userId
        focusShopId
        campaignId
        creatorId
        creatorRelationshipId
        creatorProfile {
          id
          platform
          creatorOpenId
          creatorImId
          username
          nickname
          avatarUrl
          createdAt
          updatedAt
        }
        affiliateCollaborationId
        sampleApplicationRecordId
        productId
        sourceWorkBoundary {
          subjectType
          creatorRelationshipId
          affiliateCollaborationId
          sampleApplicationRecordId
          productId
          workKind
          workBundleKind
          versionAt
          triggerKind
          triggerId
          triggerChannel
          triggerLifecycleEventId
          recommendedActionTypes
        }
        affiliateCollaboration {
          id
          userId
          shopId
          creatorIds
          creatorOpenIds
          productIds
          type
          status
          platformCollaborationId
          campaignId
          commissionRate
          effectiveTime
          platformUpdatedAt
          firstObservedAt
          lastObservedAt
          projectionRevision
          lastSyncSource
          createdAt
          updatedAt
        }
        sampleApplicationRecord {
          id
          platformApplicationId
          creatorId
          creatorOpenId
          productId
          affiliateCollaborationId
          collaborationType
          platformCollaborationId
          sampleWorkStatus
          trackingNumber
          carrier
          shippedAt
          deliveredAt
          observedContentCount
          latestObservedContentAt
          updatedAt
        }
        productSummary {
          productId
          title
          coverImage
          status
          priceMin
          priceMax
          skus {
            skuId
            skuName
            sellerSku
            price
            currency
          }
        }
        type
        status
        operatorSummary
        predictionCacheIds
        predictionSnapshots {
          sourceCacheId
          predictionType
          captureMode
          scenario
          status
          output
          model
          diagnostics
          message
          predictedAt
          capturedAt
          subject {
            sampleApplicationRecordId
            platformApplicationId
            creatorId
            creatorOpenId
            creatorCandidateId
            campaignId
            affiliateCollaborationId
            platformCollaborationId
            productId
          }
          resolvedContext {
            shopId
            campaignId
            affiliateCollaborationId
            platformCollaborationId
            sampleApplicationRecordId
            platformApplicationId
            creatorId
            creatorOpenId
            creatorUsername
            creatorNickname
            productId
            skuId
            productTitle
            source
          }
        }
        steps {
          stepId
          shopId
          campaignId
          affiliateCollaborationId
          sampleApplicationRecordId
          productId
          type
          operatorSummary
          predictionCacheIds
          sampleReviewIntent {
            sampleApplicationRecordId
            platformApplicationId
            decision
            rejectReason
          }
          sampleShipmentIntent {
            sampleApplicationRecordId
            platformApplicationId
            warehouseId
            skuId
            quantity
          }
          messageIntent {
            creatorId
            creatorOpenId
            preferredChannel
            emailSubject
            subjectHash
            subjectLength
            parts { kind text textHash textLength draftAssetId caption captionHash captionLength emailDisposition fileName mimeType sizeBytes sha256 productId targetCollaborationId sampleApplicationId }
          }
        }
        baseCheckpointId
        candidateCheckpointId
        createdAt
        updatedAt
        expiresAt
        policySnapshot {
          action
          requiresApproval
          matchedPolicyIds
          reasons
        }
        reviewSource
        humanReviewRequest {
          reason
          question
        }
        decision {
          note
          decidedAt
          actorType
          actorId
        }
        sampleReviewIntent {
          sampleApplicationRecordId
          platformApplicationId
          decision
          rejectReason
        }
        sampleShipmentIntent {
          sampleApplicationRecordId
          platformApplicationId
          warehouseId
          skuId
          quantity
        }
        messageIntent {
          creatorId
          creatorOpenId
          preferredChannel
          emailSubject
          subjectHash
          subjectLength
          parts { kind text textHash textLength draftAssetId caption captionHash captionLength emailDisposition fileName mimeType sizeBytes sha256 productId targetCollaborationId sampleApplicationId }
        }
        targetCollaborationIntent {
          name
          message
          endTime
          hasFreeSample
          isSampleApprovalExempt
          creatorIds
          creatorOpenIds
          products {
            productId
            targetCommissionRateBps
            shopAdsCommissionRateBps
          }
          sellerContactInfo {
            email
            phoneNumber
            whatsapp
            telegram
            line
          }
        }
        creatorTagIntent {
          creatorId
          tagId
        }
        blockCreatorIntent {
          creatorId
          reason
        }
        campaignProductUpdateIntent {
          campaignId
          campaignProductId
          productId
          commissionRate
          maxCommissionRate
          sampleOfferMode
          sampleQuota
          sampleUnitCostAmount
          sampleUnitCostCurrency
          promotionPriority
        }
        approvalPolicyUpdateIntent {
          policyId
          action
          creatorTagIds
          campaignIds
          productIds
          reason
          enabled
        }
        candidateDecisionIntent {
          candidateIds
          status
          rationale
        }
        executionResult {
          platformObjectId
          domainObjectId
          lifecycleEventIds
          executedAt
          errorMessage
        }
      }
    }
  }
`;

const TOOL_SPECS_CHANGED_SUBSCRIPTION = `
  subscription ToolSpecsChanged {
    toolSpecsChanged {
      revision
      digest
      changedToolNames
      changeType
      reason
      publishedAt
    }
  }
`;

const PRESET_SKILLS_CHANGED_SUBSCRIPTION = `
  subscription PresetSkillsChanged {
    presetSkillsChanged {
      revision
      reason
      publishedAt
    }
  }
`;

export type UpdatePayload = GQL.UpdatePayload;
export type ToolSpecsChangedPayload = GQL.ToolSpecsChangedPayload;
export type PresetSkillsChangedPayload = GQL.PresetSkillsChangedPayload;
export type CsConversationSignalPayload = GQL.CsConversationSignal;
export type CsConversationChangedPayload = GQL.CustomerServiceConversation;
export type AffiliateRelationshipSignalPayload = GQL.AffiliateRelationshipSignal;
export type AffiliateWorkItemPayload = GQL.AffiliateWorkItem;
export type AffiliateActionProposalPayload = GQL.ActionProposal;

export interface ClientLogUploadRequestPayload {
  requestId: string;
  requestedAt: string;
  reason?: string | null;
  deviceId?: string | null;
}

export interface DevicePresenceProbeRequestPayload {
  requestId: string;
  requestedAt: string;
}

export type CsEscalationEventType =
  | "ESCALATION_CREATED"
  | "ESCALATION_UPDATED"
  | "ESCALATION_RESOLVED";

export interface CsEscalationEventPayload {
  id: string;
  type: CsEscalationEventType;
  status: string;
  decision?: string | null;
  instructions?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CsEscalationPayload {
  id: string;
  shopId: string;
  conversationId: string;
  buyerUserId: string;
  buyerNickname?: string | null;
  orderId?: string | null;
  reason: string;
  context?: string | null;
  version: number;
  status: string;
}

export interface CsEscalationEventDeliveryPayload {
  escalation: CsEscalationPayload;
  event: CsEscalationEventPayload;
}

const CHECK_UPDATE_QUERY = `
  query CheckUpdate($clientVersion: String!) {
    checkUpdate(clientVersion: $clientVersion) {
      version
    }
  }
`;

/**
 * One-shot GraphQL query to check for updates (public endpoint, no auth needed).
 * Used at startup before the WebSocket subscription is established.
 *
 * Returns `null` when the backend has no update for this version.
 * Throws on network errors, non-2xx HTTP, or GraphQL-level errors.
 */
export async function queryCheckUpdate(
  locale: string,
  currentVersion: string,
  fetchFn: (url: string | URL, init?: RequestInit) => Promise<Response> = fetch,
): Promise<UpdatePayload | null> {
  const baseUrl = getApiBaseUrl(locale);
  const res = await fetchFn(`${baseUrl}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: CHECK_UPDATE_QUERY,
      variables: { clientVersion: currentVersion },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Update check query failed: HTTP ${res.status}`);
  const body = (await res.json()) as {
    data?: { checkUpdate?: UpdatePayload } | null;
    errors?: Array<{ message?: string }>;
  };
  if (body.errors?.length) {
    const messages = body.errors.map((e) => e.message ?? "(no message)").join("; ");
    throw new Error(`Update check query returned GraphQL errors: ${messages}`);
  }
  return body.data?.checkUpdate ?? null;
}

export interface OAuthCompletePayload {
  shopId: string;
  shopName: string;
  platform: string;
  shops?: Array<Record<string, unknown> & {
    id: string;
    shopName: string;
    platform: string;
  }>;
}

export interface AdsOAuthCompletePayload {
  platform: string;
  advertiserIds: string[];
  advertiserCount: number;
}

export interface AffiliateOutreachAccountConnectedPayload {
  channel: "WHATSAPP" | "EMAIL" | "PLATFORM_CHAT";
  accountId: string;
  displayName?: string | null;
  address?: string | null;
}

/** Subscription config stored as desired state for long-lived operations. */
interface SubscriptionConfig {
  key: string;
  subscribe: (attempt: number) => () => void;
  authRequired?: boolean;
  longLived?: boolean;
}

interface ActiveSubscriptionAttempt {
  attempt: number;
  unsubscribe: () => void;
}

type SubscriptionOperationState = "idle" | "active" | "retry_wait" | "blocked" | "stopped";

type SubscriptionOperationErrorDisposition =
  | { kind: "auth" }
  | { kind: "recoverable"; fingerprint: string }
  | { kind: "unknown"; fingerprint: string }
  | { kind: "permanent"; fingerprint: string };

class LongLivedSubscriptionOperation {
  private state: SubscriptionOperationState = "idle";
  private activeAttempt: ActiveSubscriptionAttempt | null = null;
  private attemptCounter = 0;
  private generation = 0;
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private consecutiveFailures = 0;
  private lastBlockedFingerprint: string | null = null;

  constructor(
    readonly config: SubscriptionConfig,
    private readonly canStart: () => boolean,
  ) {}

  get key(): string {
    return this.config.key;
  }

  get authRequired(): boolean {
    return this.config.authRequired === true;
  }

  get longLived(): boolean {
    return this.config.longLived === true;
  }

  start(reason: string, options?: { preserveFailures?: boolean }): void {
    this.cancelRecovery();
    this.stopActiveAttempt(reason);
    this.generation += 1;

    if (!options?.preserveFailures) {
      this.consecutiveFailures = 0;
      this.lastBlockedFingerprint = null;
    }

    if (!this.canStart()) {
      this.state = "idle";
      return;
    }

    const attempt = ++this.attemptCounter;
    const active: ActiveSubscriptionAttempt = { attempt, unsubscribe: () => {} };
    this.activeAttempt = active;
    this.state = "active";

    log.debug("Starting backend subscription operation", {
      subscription: this.key,
      reason,
      attempt,
      authRequired: this.authRequired,
    });

    const unsubscribe = this.config.subscribe(attempt);
    if (this.activeAttempt === active) {
      active.unsubscribe = unsubscribe;
    } else {
      unsubscribe();
    }
  }

  reconcile(reason: string, options?: { retryBlocked?: boolean }): void {
    if (this.state === "active") return;
    if (this.state === "retry_wait" && !options?.retryBlocked) return;
    if (this.state === "blocked" && !options?.retryBlocked) return;
    this.start(reason, { preserveFailures: this.state === "blocked" });
  }

  pause(reason: string): void {
    this.cancelRecovery();
    this.stopActiveAttempt(reason);
    this.generation += 1;
    this.state = "idle";
  }

  stop(reason: string): void {
    this.cancelRecovery();
    this.stopActiveAttempt(reason);
    this.generation += 1;
    this.state = "stopped";
  }

  noteNext(attempt: number): void {
    if (this.activeAttempt?.attempt !== attempt) return;
    this.consecutiveFailures = 0;
    this.lastBlockedFingerprint = null;
  }

  handleComplete(attempt: number): boolean {
    if (!this.releaseAttempt(attempt)) return false;
    if (!this.longLived) {
      this.state = "idle";
      return true;
    }
    this.scheduleRecovery("operation_complete", "complete", false);
    return true;
  }

  handleError(attempt: number, disposition: SubscriptionOperationErrorDisposition): boolean {
    if (!this.releaseAttempt(attempt, true)) return false;

    if (disposition.kind === "auth") {
      this.state = "idle";
      return true;
    }

    if (disposition.kind === "permanent") {
      return this.block(disposition.fingerprint, "permanent_error");
    }

    return this.scheduleRecovery(
      `operation_${disposition.kind}_error`,
      disposition.fingerprint,
      disposition.kind === "unknown",
    );
  }

  private releaseAttempt(attempt: number, dispose = false): boolean {
    const active = this.activeAttempt;
    if (active?.attempt !== attempt) return false;
    this.activeAttempt = null;
    if (dispose) active.unsubscribe();
    return true;
  }

  private scheduleRecovery(reason: string, fingerprint: string, bounded: boolean): boolean {
    if (!this.longLived || this.state === "stopped") return false;
    this.cancelRecovery();
    this.consecutiveFailures += 1;

    if (bounded && this.consecutiveFailures > 5) {
      return this.block(fingerprint, "unknown_error_retry_limit");
    }

    const delayMs = Math.min(
      1000 * 2 ** Math.min(this.consecutiveFailures - 1, 5),
      30_000,
    );
    const generation = this.generation;
    this.state = "retry_wait";

    log.warn("Scheduling backend subscription operation recovery", {
      subscription: this.key,
      reason,
      recoveryAttempt: this.consecutiveFailures,
      delayMs,
      fingerprint,
    });

    this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null;
      if (this.generation !== generation || this.state !== "retry_wait") return;
      this.start(reason, { preserveFailures: true });
    }, delayMs);
    return true;
  }

  private block(fingerprint: string, reason: string): boolean {
    this.cancelRecovery();
    this.state = "blocked";
    if (this.lastBlockedFingerprint === fingerprint) return false;
    this.lastBlockedFingerprint = fingerprint;
    log.warn("Blocking backend subscription operation until lifecycle changes", {
      subscription: this.key,
      reason,
      fingerprint,
      failureCount: this.consecutiveFailures,
    });
    return true;
  }

  private stopActiveAttempt(reason: string): void {
    const active = this.activeAttempt;
    if (!active) return;
    this.activeAttempt = null;
    log.info("Disposing backend subscription operation", {
      subscription: this.key,
      attempt: active.attempt,
      reason,
    });
    active.unsubscribe();
  }

  private cancelRecovery(): void {
    if (!this.recoveryTimer) return;
    clearTimeout(this.recoveryTimer);
    this.recoveryTimer = null;
  }
}

interface ConnectOptions {
  refreshAuth?: () => Promise<void>;
  onConnectedAfterRetry?: () => void | Promise<void>;
}

type RestartableSocket = {
  readyState: number;
  close: (code?: number, reason?: string) => void;
};

type RestartableClient = Client & {
  restart: () => void;
};

type AuthenticatedSubscriptionState = "disabled" | "active" | "suspended";

/**
 * Unified GraphQL subscription client that manages a single shared
 * graphql-ws connection to the backend and exposes per-topic
 * subscribe methods.
 */
export class BackendSubscriptionClient {
  private client: RestartableClient | null = null;
  private getToken: (() => string | null) | null = null;

  /** Desired and runtime state for every registered subscription operation. */
  private subscriptionOperations = new Map<string, LongLivedSubscriptionOperation>();

  /** Desired/runtime state for authenticated long-lived operations. */
  private authenticatedSubscriptionState: AuthenticatedSubscriptionState = "disabled";

  /** Token used by the current authenticated subscription connection. */
  private authenticatedSubscriptionToken: string | null = null;

  /** Optional auth refresh hook supplied by the app auth runtime. */
  private refreshAuth: (() => Promise<void>) | null = null;

  /** Optional cache recovery hook after a transport reconnect succeeds. */
  private onConnectedAfterRetry: (() => void | Promise<void>) | null = null;

  /** Single-flight recovery for operation-level subscription auth errors. */
  private authRecoveryPromise: Promise<void> | null = null;

  private authRecoveryFailures = 0;

  /** Pong watchdog for graphql-ws keep-alive pings. */
  private pongTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly locale: string) {}

  isConnected(): boolean {
    return this.client !== null;
  }

  connect(getToken: () => string | null, options?: ConnectOptions): void {
    if (this.client) return;
    this.getToken = getToken;
    this.refreshAuth = options?.refreshAuth ?? null;
    this.onConnectedAfterRetry = options?.onConnectedAfterRetry ?? null;
    this.doConnect();
  }

  disconnect(): void {
    for (const operation of this.subscriptionOperations.values()) {
      operation.stop("disconnect");
    }
    this.subscriptionOperations.clear();

    this.client?.dispose();
    this.client = null;
    this.clearPongTimeout();
  }

  reconnect(): void {
    this.restartTransport("manual_reconnect");
  }

  enableAuthenticatedSubscriptions(options?: { forceReconnect?: boolean }): void {
    const token = this.getToken?.() ?? null;
    if (!token) {
      this.disableAuthenticatedSubscriptions();
      return;
    }

    this.applyAuthenticatedCredentials(token, {
      allowEnableFromDisabled: true,
      forceReconnect: options?.forceReconnect,
      reason: options?.forceReconnect ? "auth_force_reconnect" : "auth_enable",
    });
  }

  refreshAuthenticatedSubscriptions(): void {
    const token = this.getToken?.() ?? null;
    if (!token) {
      this.disableAuthenticatedSubscriptions();
      return;
    }

    this.applyAuthenticatedCredentials(token, {
      allowEnableFromDisabled: false,
      reason: "auth_refresh",
    });
  }

  async handleCredentialsChanged(): Promise<void> {
    const token = this.getToken?.() ?? null;
    if (!token) {
      this.disableAuthenticatedSubscriptions();
      return;
    }

    this.applyAuthenticatedCredentials(token, {
      allowEnableFromDisabled: false,
      reason: "credentials_changed",
    });
  }

  disableAuthenticatedSubscriptions(): void {
    if (
      this.authenticatedSubscriptionState === "disabled"
      && !this.authenticatedSubscriptionToken
    ) {
      return;
    }

    const previousState = this.authenticatedSubscriptionState;
    this.authenticatedSubscriptionState = "disabled";
    this.authenticatedSubscriptionToken = null;
    this.authRecoveryFailures = 0;

    if (this.client) {
      this.stopAuthenticatedSubscriptions("auth_disable");
      this.restartTransport("auth_disable");
    }

    log.info("Authenticated backend subscriptions state changed", {
      from: previousState,
      to: this.authenticatedSubscriptionState,
      reason: "auth_disable",
    });
  }

  private suspendAuthenticatedSubscriptions(reason: string): void {
    if (this.authenticatedSubscriptionState !== "active") return;

    const previousState = this.authenticatedSubscriptionState;
    this.authenticatedSubscriptionState = "suspended";

    if (this.client) {
      this.stopAuthenticatedSubscriptions("auth_suspend");
      this.restartTransport("auth_suspend");
    }

    log.warn("Authenticated backend subscriptions state changed", {
      from: previousState,
      to: this.authenticatedSubscriptionState,
      reason,
    });
  }

  private applyAuthenticatedCredentials(
    token: string,
    options: {
      allowEnableFromDisabled: boolean;
      forceReconnect?: boolean;
      reason: string;
    },
  ): void {
    const previousState = this.authenticatedSubscriptionState;
    if (previousState === "disabled" && !options.allowEnableFromDisabled) return;

    const tokenChanged = this.authenticatedSubscriptionToken !== token;
    const shouldResume = previousState === "suspended";
    this.authenticatedSubscriptionState = "active";
    this.authenticatedSubscriptionToken = token;
    this.authRecoveryFailures = 0;

    if (!this.client) {
      this.doConnect();
      this.reconcileSubscriptions(options.reason);
      return;
    }

    if (shouldResume || tokenChanged || options.forceReconnect) {
      this.restartTransport(options.reason);
    }
    this.reconcileSubscriptions(options.reason, {
      retryBlocked: shouldResume || tokenChanged || options.forceReconnect === true,
    });

    if (previousState !== this.authenticatedSubscriptionState || tokenChanged) {
      log.info("Authenticated backend subscriptions state changed", {
        from: previousState,
        to: this.authenticatedSubscriptionState,
        reason: options.reason,
        tokenChanged,
      });
    }
  }

  private stopAuthenticatedSubscriptions(reason: string): void {
    for (const operation of this.subscriptionOperations.values()) {
      if (operation.authRequired) operation.pause(reason);
    }
  }

  private noteSubscriptionNext(key: string, attempt: number): void {
    this.subscriptionOperations.get(key)?.noteNext(attempt);
  }

  private handleSubscriptionComplete(key: string, attempt: number): void {
    const operation = this.subscriptionOperations.get(key);
    if (!operation) return;
    if (!operation.handleComplete(attempt)) return;
    log.warn("Long-lived backend subscription operation completed unexpectedly", {
      subscription: key,
      attempt,
    });
  }

  private formatUnknownError(err: unknown): Record<string, unknown> {
    if (err instanceof Error) {
      return {
        name: err.name,
        message: err.message,
        stack: err.stack,
      };
    }

    if (typeof err === "object" && err !== null) {
      const record = err as Record<string, unknown>;
      return {
        type: err.constructor?.name ?? "object",
        message: typeof record.message === "string" ? record.message : undefined,
        code: record.code,
        reason: record.reason,
        details: JSON.stringify(record),
      };
    }

    return { value: String(err) };
  }

  private collectErrorMessages(err: unknown): string[] {
    if (!err) return [];
    if (err instanceof Error) return [err.message];
    if (Array.isArray(err)) return err.flatMap((item) => this.collectErrorMessages(item));
    if (typeof err === "object") {
      const record = err as Record<string, unknown>;
      const messages: string[] = [];
      if (typeof record.message === "string") messages.push(record.message);
      if (Array.isArray(record.errors)) messages.push(...this.collectErrorMessages(record.errors));
      if (messages.length > 0) return messages;
    }
    return [String(err)];
  }

  private collectErrorCodes(err: unknown): string[] {
    if (!err) return [];
    if (Array.isArray(err)) return err.flatMap((item) => this.collectErrorCodes(item));
    if (typeof err !== "object") return [];

    const record = err as Record<string, unknown>;
    const codes: string[] = [];
    if (typeof record.code === "string") codes.push(record.code);
    if (record.extensions && typeof record.extensions === "object") {
      const extensionCode = (record.extensions as Record<string, unknown>).code;
      if (typeof extensionCode === "string") codes.push(extensionCode);
    }
    if (Array.isArray(record.errors)) codes.push(...this.collectErrorCodes(record.errors));
    return codes;
  }

  private isAuthError(err: unknown): boolean {
    if (this.collectErrorCodes(err).includes("UNAUTHENTICATED")) return true;
    return this.collectErrorMessages(err).some((message) =>
      /^(?:Not authenticated|Authentication required|Invalid token|Token expired|Unauthorized)$/i.test(message.trim())
      || /(?:invalid signature|jwt malformed|jwt expired|\b4401\b)/i.test(message),
    );
  }

  private classifySubscriptionError(err: unknown): SubscriptionOperationErrorDisposition {
    if (this.isAuthError(err)) return { kind: "auth" };

    const codes = this.collectErrorCodes(err).map((code) => code.toUpperCase());
    const messages = this.collectErrorMessages(err)
      .map((message) => message.trim())
      .filter(Boolean);
    const fingerprint = JSON.stringify({
      codes: [...new Set(codes)].sort(),
      messages: [...new Set(messages.map((message) => message.toLowerCase()))].sort(),
    });

    const contractError = codes.some((code) =>
      code === "GRAPHQL_VALIDATION_FAILED"
      || code === "GRAPHQL_PARSE_FAILED"
      || code === "BAD_USER_INPUT"
      || code === "FORBIDDEN"
    ) || messages.some((message) =>
      /Cannot query field|Unknown argument|Unknown type|Variable .* is never used|Variable .* was not provided|Field .* argument .* is required|^Forbidden$|^Access denied$/i.test(message),
    );
    if (contractError) return { kind: "permanent", fingerprint };

    const recoverableError = codes.some((code) =>
      code === "SUBSCRIPTION_SCOPE_STALE"
      || code === "INTERNAL_SERVER_ERROR"
      || code === "SERVICE_UNAVAILABLE"
      || code === "TIMEOUT"
    ) || messages.some((message) =>
      /^Not found$/i.test(message)
      || /(?:502|503|504|ECONNRESET|ETIMEDOUT|network|socket|connection closed)/i.test(message),
    );
    if (recoverableError) return { kind: "recoverable", fingerprint };

    return { kind: "unknown", fingerprint };
  }

  private handleSubscriptionError(key: string, attempt: number, label: string, err: unknown): void {
    const operation = this.subscriptionOperations.get(key);
    if (!operation) return;
    const disposition = this.classifySubscriptionError(err);
    if (!operation.handleError(attempt, disposition)) return;

    if (disposition.kind === "auth") {
      this.recoverAuthenticatedSubscriptions(key);
      return;
    }

    log.warn(label, {
      subscription: key,
      attempt,
      disposition: disposition.kind,
      ...this.formatUnknownError(err),
    });
  }

  private handleConnectionAuthFailure(source: string, err: unknown): void {
    if (this.authenticatedSubscriptionState !== "active") return;
    log.debug("Backend subscription connection auth failure; refreshing auth", {
      source,
      ...this.formatUnknownError(err),
    });
    this.recoverAuthenticatedSubscriptions(source);
  }

  private handleResultErrors(
    key: string,
    attempt: number,
    label: string,
    errors: ReadonlyArray<{ message?: string }> | undefined,
  ): boolean {
    if (!errors?.length) return false;
    if (this.isAuthError(errors)) {
      this.recoverAuthenticatedSubscriptions(key);
      return true;
    }
    log.warn(label, {
      subscription: key,
      attempt,
      errorMessages: errors.map((err) => err.message ?? "(no message)"),
    });
    return false;
  }

  private recoverAuthenticatedSubscriptions(source: string): void {
    if (this.authenticatedSubscriptionState !== "active" || !this.refreshAuth) return;
    if (this.authRecoveryPromise) return;

    this.authRecoveryPromise = (async () => {
      try {
        log.info(`Refreshing auth after subscription auth error: ${source}`);
        await this.refreshAuth!();
        this.authRecoveryFailures = 0;

        if (!this.getToken?.()) {
          this.disableAuthenticatedSubscriptions();
          return;
        }

        // Reconnect with the refreshed token. Auth refresh is intentionally not
        // routed through the full desktop auth lifecycle because it should be a
        // transparent credential maintenance path.
        this.refreshAuthenticatedSubscriptions();
      } catch (err) {
        this.authRecoveryFailures += 1;
        const messages = this.collectErrorMessages(err);
        const reason = messages.find((message) => message.trim()) ?? "unknown";

        if (!this.getToken?.()) {
          const invalidJwt = /invalid signature|jwt malformed|jwt expired|Invalid token|Token expired/i.test(reason);
          log.warn(
            invalidJwt
              ? "JWT invalid for backend subscription; disabling authenticated subscriptions"
              : "Backend subscription auth refresh failed; disabling authenticated subscriptions",
            {
              source,
              failureCount: this.authRecoveryFailures,
              reason,
            },
          );
          this.disableAuthenticatedSubscriptions();
          return;
        }

        log.warn("Backend subscription auth refresh failed; suspending authenticated subscriptions", {
          source,
          failureCount: this.authRecoveryFailures,
          reason,
        });
        this.suspendAuthenticatedSubscriptions(reason);
      } finally {
        this.authRecoveryPromise = null;
      }
    })();
  }

  private shouldRetryConnection(errOrCloseEvent: unknown): boolean {
    const code = typeof errOrCloseEvent === "object" && errOrCloseEvent !== null
      ? (errOrCloseEvent as { code?: unknown }).code
      : undefined;

    if (typeof code === "number" && AUTH_WS_CLOSE_CODES.has(code)) {
      return false;
    }

    if (typeof code === "number" && NON_RETRYABLE_WS_CLOSE_CODES.has(code)) {
      return false;
    }

    // `ws` surfaces failed HTTP upgrades (for example a deployment-window 502)
    // as ErrorEvent objects rather than CloseEvents. graphql-ws does not retry
    // those by default, so treat them as transient unless they carry one of the
    // explicit fatal close codes above.
    return true;
  }

  private logUnexpectedResult(
    key: string,
    attempt: number,
    fieldName: string,
    result: { data?: Record<string, unknown> | null; errors?: Array<{ message?: string }>; extensions?: unknown },
  ): void {
    const dataKeys = result.data ? Object.keys(result.data) : [];
    const errorMessages = result.errors?.map((err) => err.message ?? "(no message)") ?? [];
    const extensionKeys =
      result.extensions && typeof result.extensions === "object"
        ? Object.keys(result.extensions as Record<string, unknown>)
        : [];

    log.warn("Backend subscription next payload missing expected field", {
      subscription: key,
      attempt,
      expectedField: fieldName,
      hasData: !!result.data,
      dataKeys,
      errorMessages,
      extensionKeys,
    });
  }

  private shouldSubscribe(config: SubscriptionConfig): boolean {
    return !config.authRequired || this.authenticatedSubscriptionState === "active";
  }

  private reconcileSubscriptions(reason: string, options?: { retryBlocked?: boolean }): void {
    for (const operation of this.subscriptionOperations.values()) {
      if (!operation.longLived) continue;
      operation.reconcile(reason, options);
    }
  }

  private restartTransport(reason: string): void {
    if (!this.client) return;
    log.info("Restarting backend subscription transport", { reason });
    this.client.restart();
  }

  private clearPongTimeout(): void {
    if (!this.pongTimeout) return;
    clearTimeout(this.pongTimeout);
    this.pongTimeout = null;
  }

  private registerSubscription(config: SubscriptionConfig): () => void {
    const existing = this.subscriptionOperations.get(config.key);
    existing?.stop("replace");

    const operation = new LongLivedSubscriptionOperation(
      config,
      () => !!this.client && this.shouldSubscribe(config),
    );
    this.subscriptionOperations.set(config.key, operation);
    operation.start("register");

    return () => {
      if (this.subscriptionOperations.get(config.key) !== operation) return;
      operation.stop("unregister");
      this.subscriptionOperations.delete(config.key);
    };
  }

  refreshCsConversationSignals(): void {
    this.subscriptionOperations.get("cs-conversation-signals")?.start("explicit_refresh", {
      preserveFailures: true,
    });
  }

  refreshCsConversationChanges(): void {
    this.subscriptionOperations.get("cs-conversation-changes")?.start("explicit_refresh", {
      preserveFailures: true,
    });
  }

  /**
   * Subscribe to update-available events. Returns an unsubscribe function.
   */
  subscribeToUpdates(
    currentVersion: string,
    onUpdate: (payload: UpdatePayload) => void,
    onDismiss?: () => void,
  ): () => void {
    const key = "updates";

    const subscribe = (attempt: number): (() => void) => {
      if (!this.client) return () => {};

      const unsubscribe = this.client.subscribe<{ updateAvailable: UpdatePayload }>(
        {
          query: UPDATE_SUBSCRIPTION,
          variables: { clientVersion: currentVersion },
        },
        {
          next: (result) => {
            this.noteSubscriptionNext(key, attempt);
            if (this.handleResultErrors(key, attempt, "Update subscription next contained GraphQL errors", result.errors)) {
              return;
            }
            if (result.errors?.length) {
              log.warn("Update subscription next contained GraphQL errors", {
                subscription: key,
                attempt,
                errorMessages: result.errors.map((err) => err.message ?? "(no message)"),
              });
            }
            const payload = result.data?.updateAvailable;
            if (!payload) {
              this.logUnexpectedResult(key, attempt, "updateAvailable", result as any);
              return;
            }
            if (!isNewerVersion(currentVersion, payload.version)) {
              onDismiss?.();
              return;
            }
            onUpdate(payload);
          },
          error: (err) => {
            this.handleSubscriptionError(key, attempt, "Update subscription error", err);
          },
          complete: () => this.handleSubscriptionComplete(key, attempt),
        },
      );
      return unsubscribe;
    };

    return this.registerSubscription({ key, subscribe, authRequired: true, longLived: true });
  }

  /**
   * Subscribe to OAuth-complete events. Returns an unsubscribe function.
   */
  subscribeToOAuthComplete(
    onComplete: (payload: OAuthCompletePayload) => void,
  ): () => void {
    const key = "oauth-complete";

    const subscribe = (attempt: number): (() => void) => {
      if (!this.client) return () => {};

      const unsubscribe = this.client.subscribe<{ oauthComplete: OAuthCompletePayload }>(
        {
          query: OAUTH_COMPLETE_SUBSCRIPTION,
        },
        {
          next: (result) => {
            this.noteSubscriptionNext(key, attempt);
            if (this.handleResultErrors(key, attempt, "OAuth subscription next contained GraphQL errors", result.errors)) {
              return;
            }
            if (result.errors?.length) {
              log.warn("OAuth subscription next contained GraphQL errors", {
                subscription: key,
                attempt,
                errorMessages: result.errors.map((err) => err.message ?? "(no message)"),
              });
            }
            const payload = result.data?.oauthComplete;
            if (!payload) {
              this.logUnexpectedResult(key, attempt, "oauthComplete", result as any);
              return;
            }
            onComplete(payload);
          },
          error: (err) => {
            this.handleSubscriptionError(key, attempt, "OAuth subscription error", err);
          },
          complete: () => this.handleSubscriptionComplete(key, attempt),
        },
      );
      return unsubscribe;
    };

    return this.registerSubscription({ key, subscribe, authRequired: true, longLived: true });
  }

  subscribeToAdsOAuthComplete(
    onComplete: (payload: AdsOAuthCompletePayload) => void,
  ): () => void {
    const key = "ads-oauth-complete";

    const subscribe = (attempt: number): (() => void) => {
      if (!this.client) return () => {};

      const unsubscribe = this.client.subscribe<{ adsOAuthComplete: AdsOAuthCompletePayload }>(
        {
          query: ADS_OAUTH_COMPLETE_SUBSCRIPTION,
        },
        {
          next: (result) => {
            this.noteSubscriptionNext(key, attempt);
            if (this.handleResultErrors(key, attempt, "Ads OAuth subscription next contained GraphQL errors", result.errors)) {
              return;
            }
            const payload = result.data?.adsOAuthComplete;
            if (!payload) {
              this.logUnexpectedResult(key, attempt, "adsOAuthComplete", result as any);
              return;
            }
            onComplete(payload);
          },
          error: (err) => {
            this.handleSubscriptionError(key, attempt, "Ads OAuth subscription error", err);
          },
          complete: () => this.handleSubscriptionComplete(key, attempt),
        },
      );
      return unsubscribe;
    };

    return this.registerSubscription({ key, subscribe, authRequired: true, longLived: true });
  }

  subscribeToAffiliateOutreachAccountConnected(
    onConnected: (payload: AffiliateOutreachAccountConnectedPayload) => void,
  ): () => void {
    const key = "affiliate-outreach-account-connected";

    const subscribe = (attempt: number): (() => void) => {
      if (!this.client) return () => {};

      const unsubscribe = this.client.subscribe<{
        affiliateOutreachAccountConnected: AffiliateOutreachAccountConnectedPayload;
      }>(
        {
          query: AFFILIATE_OUTREACH_ACCOUNT_CONNECTED_SUBSCRIPTION,
        },
        {
          next: (result) => {
            this.noteSubscriptionNext(key, attempt);
            if (
              this.handleResultErrors(
                key,
                attempt,
                "Affiliate outreach account subscription next contained GraphQL errors",
                result.errors,
              )
            ) {
              return;
            }
            const payload = result.data?.affiliateOutreachAccountConnected;
            if (!payload) {
              this.logUnexpectedResult(key, attempt, "affiliateOutreachAccountConnected", result as any);
              return;
            }
            onConnected(payload);
          },
          error: (err) => {
            this.handleSubscriptionError(
              key,
              attempt,
              "Affiliate outreach account subscription error",
              err,
            );
          },
          complete: () => this.handleSubscriptionComplete(key, attempt),
        },
      );
      return unsubscribe;
    };

    return this.registerSubscription({ key, subscribe, authRequired: true, longLived: true });
  }

  /**
   * Subscribe to shop-updated events. Returns an unsubscribe function.
   * Payload includes __typename so callers can feed it directly into ingestGraphQLResponse.
   */
  subscribeToShopUpdated(
    onShopUpdated: (data: Record<string, unknown>) => void,
  ): () => void {
    const key = "shop-updated";

    const subscribe = (attempt: number): (() => void) => {
      if (!this.client) return () => {};

      const unsubscribe = this.client.subscribe<{ shopUpdated: Record<string, unknown> }>(
        {
          query: SHOP_UPDATED_SUBSCRIPTION,
        },
        {
          next: (result) => {
            this.noteSubscriptionNext(key, attempt);
            if (this.handleResultErrors(key, attempt, "Shop updated subscription next contained GraphQL errors", result.errors)) {
              return;
            }
            const payload = result.data?.shopUpdated;
            if (!payload) {
              this.logUnexpectedResult(key, attempt, "shopUpdated", result as any);
              return;
            }
            onShopUpdated(payload);
          },
          error: (err) => {
            this.handleSubscriptionError(key, attempt, "Shop updated subscription error", err);
          },
          complete: () => this.handleSubscriptionComplete(key, attempt),
        },
      );
      return unsubscribe;
    };

    return this.registerSubscription({ key, subscribe, authRequired: true, longLived: true });
  }

  subscribeToToolSpecsChanged(
    onChanged: (payload: ToolSpecsChangedPayload) => void,
  ): () => void {
    const key = "tool-specs-changed";

    const subscribe = (attempt: number): (() => void) => {
      if (!this.client) return () => {};

      const unsubscribe = this.client.subscribe<{ toolSpecsChanged: ToolSpecsChangedPayload }>(
        {
          query: TOOL_SPECS_CHANGED_SUBSCRIPTION,
        },
        {
          next: (result) => {
            this.noteSubscriptionNext(key, attempt);
            if (this.handleResultErrors(key, attempt, "ToolSpecs changed subscription next contained GraphQL errors", result.errors)) {
              return;
            }
            const payload = result.data?.toolSpecsChanged;
            if (!payload) {
              this.logUnexpectedResult(key, attempt, "toolSpecsChanged", result as any);
              return;
            }
            onChanged(payload);
          },
          error: (err) => {
            this.handleSubscriptionError(key, attempt, "ToolSpecs changed subscription error", err);
          },
          complete: () => this.handleSubscriptionComplete(key, attempt),
        },
      );
      return unsubscribe;
    };

    return this.registerSubscription({ key, subscribe, authRequired: true, longLived: true });
  }

  subscribeToPresetSkillsChanged(
    onChanged: (payload: PresetSkillsChangedPayload) => void,
  ): () => void {
    const key = "preset-skills-changed";

    const subscribe = (attempt: number): (() => void) => {
      if (!this.client) return () => {};

      const unsubscribe = this.client.subscribe<{ presetSkillsChanged: PresetSkillsChangedPayload }>(
        {
          query: PRESET_SKILLS_CHANGED_SUBSCRIPTION,
        },
        {
          next: (result) => {
            this.noteSubscriptionNext(key, attempt);
            if (this.handleResultErrors(key, attempt, "Preset skills changed subscription next contained GraphQL errors", result.errors)) {
              return;
            }
            const payload = result.data?.presetSkillsChanged;
            if (!payload) {
              this.logUnexpectedResult(key, attempt, "presetSkillsChanged", result as any);
              return;
            }
            onChanged(payload);
          },
          error: (err) => {
            this.handleSubscriptionError(key, attempt, "Preset skills changed subscription error", err);
          },
          complete: () => this.handleSubscriptionComplete(key, attempt),
        },
      );
      return unsubscribe;
    };

    return this.registerSubscription({ key, subscribe, authRequired: true, longLived: true });
  }

  subscribeToClientLogUploadRequests(
    deviceId: string,
    onRequest: (payload: ClientLogUploadRequestPayload) => void,
  ): () => void {
    const key = "client-log-upload-requests";

    const subscribe = (attempt: number): (() => void) => {
      if (!this.client) return () => {};

      const unsubscribe = this.client.subscribe<{ clientLogUploadRequested: ClientLogUploadRequestPayload }>(
        {
          query: CLIENT_LOG_UPLOAD_REQUESTED_SUBSCRIPTION,
          variables: { deviceId },
        },
        {
          next: (result) => {
            this.noteSubscriptionNext(key, attempt);
            if (this.handleResultErrors(key, attempt, "Client log upload subscription next contained GraphQL errors", result.errors)) {
              return;
            }
            const payload = result.data?.clientLogUploadRequested;
            if (!payload) {
              this.logUnexpectedResult(key, attempt, "clientLogUploadRequested", result as any);
              return;
            }
            onRequest(payload);
          },
          error: (err) => {
            this.handleSubscriptionError(key, attempt, "Client log upload subscription error", err);
          },
          complete: () => this.handleSubscriptionComplete(key, attempt),
        },
      );
      return unsubscribe;
    };

    return this.registerSubscription({ key, subscribe, authRequired: true, longLived: true });
  }

  subscribeToDevicePresenceProbeRequests(
    onRequest: (payload: DevicePresenceProbeRequestPayload) => void,
  ): () => void {
    const key = "device-presence-probe-requests";

    const subscribe = (attempt: number): (() => void) => {
      if (!this.client) return () => {};

      const unsubscribe = this.client.subscribe<{ devicePresenceProbeRequested: DevicePresenceProbeRequestPayload }>(
        {
          query: DEVICE_PRESENCE_PROBE_REQUESTED_SUBSCRIPTION,
        },
        {
          next: (result) => {
            this.noteSubscriptionNext(key, attempt);
            if (this.handleResultErrors(key, attempt, "Device presence probe subscription next contained GraphQL errors", result.errors)) {
              return;
            }
            const payload = result.data?.devicePresenceProbeRequested;
            if (!payload) {
              this.logUnexpectedResult(key, attempt, "devicePresenceProbeRequested", result as any);
              return;
            }
            onRequest(payload);
          },
          error: (err) => {
            this.handleSubscriptionError(key, attempt, "Device presence probe subscription error", err);
          },
          complete: () => this.handleSubscriptionComplete(key, attempt),
        },
      );
      return unsubscribe;
    };

    return this.registerSubscription({ key, subscribe, authRequired: true, longLived: true });
  }

  /**
   * Subscribe to CS escalation side-effect events.
   *
   * The backend only streams newly-published events. Airflow/admin publish
   * mutations handle missed-event replay, and callers claim + ack each event
   * before/after executing the local side effect.
   */
  subscribeToCsEscalationEvents(
    onEvent: (delivery: CsEscalationEventDeliveryPayload) => void,
  ): () => void {
    const key = "cs-escalation-events";

    const subscribe = (attempt: number): (() => void) => {
      if (!this.client) return () => {};

      const unsubscribe = this.client.subscribe<{ csEscalationEvent: CsEscalationEventDeliveryPayload }>(
        {
          query: CS_ESCALATION_EVENT_SUBSCRIPTION,
        },
        {
          next: (result) => {
            this.noteSubscriptionNext(key, attempt);
            if (this.handleResultErrors(key, attempt, "CS escalation subscription next contained GraphQL errors", result.errors)) {
              return;
            }
            const payload = result.data?.csEscalationEvent;
            if (!payload) {
              this.logUnexpectedResult(key, attempt, "csEscalationEvent", result as any);
              return;
            }
            onEvent(payload);
          },
          error: (err) => {
            this.handleSubscriptionError(key, attempt, "CS escalation subscription error", err);
          },
          complete: () => this.handleSubscriptionComplete(key, attempt),
        },
      );
      return unsubscribe;
    };

    return this.registerSubscription({ key, subscribe, authRequired: true, longLived: true });
  }

  subscribeToCsConversationSignals(
    onSignal: (signal: CsConversationSignalPayload) => void,
    options?: { getShopIds?: () => string[] },
  ): () => void {
    const key = "cs-conversation-signals";

    const subscribe = (attempt: number): (() => void) => {
      if (!this.client) return () => {};
      const shopIds = Array.from(new Set(options?.getShopIds?.() ?? []))
        .filter((shopId) => typeof shopId === "string" && shopId.length > 0);

      const unsubscribe = this.client.subscribe<{ csConversationSignal: CsConversationSignalPayload }>(
        {
          query: CS_CONVERSATION_SIGNAL_SUBSCRIPTION,
          variables: { shopIds },
        },
        {
          next: (result) => {
            this.noteSubscriptionNext(key, attempt);
            if (this.handleResultErrors(key, attempt, "CS conversation signal subscription next contained GraphQL errors", result.errors)) {
              return;
            }
            const payload = result.data?.csConversationSignal;
            if (!payload) {
              this.logUnexpectedResult(key, attempt, "csConversationSignal", result as any);
              return;
            }
            onSignal(payload);
          },
          error: (err) => {
            this.handleSubscriptionError(key, attempt, "CS conversation signal subscription error", err);
          },
          complete: () => this.handleSubscriptionComplete(key, attempt),
        },
      );
      return unsubscribe;
    };

    return this.registerSubscription({ key, subscribe, authRequired: true, longLived: true });
  }

  subscribeToCsConversationChanges(
    onConversation: (conversation: CsConversationChangedPayload) => void,
    options?: { getShopIds?: () => string[] },
  ): () => void {
    const key = "cs-conversation-changes";

    const subscribe = (attempt: number): (() => void) => {
      if (!this.client) return () => {};
      const shopIds = Array.from(new Set(options?.getShopIds?.() ?? []))
        .filter((shopId) => typeof shopId === "string" && shopId.length > 0);

      const unsubscribe = this.client.subscribe<{ csConversationChanged: CsConversationChangedPayload }>(
        {
          query: CS_CONVERSATION_CHANGED_SUBSCRIPTION,
          variables: { shopIds },
        },
        {
          next: (result) => {
            this.noteSubscriptionNext(key, attempt);
            if (this.handleResultErrors(key, attempt, "CS conversation changed subscription next contained GraphQL errors", result.errors)) {
              return;
            }
            const payload = result.data?.csConversationChanged;
            if (!payload) {
              this.logUnexpectedResult(key, attempt, "csConversationChanged", result as any);
              return;
            }
            onConversation(payload);
          },
          error: (err) => {
            this.handleSubscriptionError(key, attempt, "CS conversation changed subscription error", err);
          },
          complete: () => this.handleSubscriptionComplete(key, attempt),
        },
      );
      return unsubscribe;
    };

    return this.registerSubscription({ key, subscribe, authRequired: true, longLived: true });
  }

  subscribeToAffiliateRelationshipSignals(
    onSignal: (signal: AffiliateRelationshipSignalPayload) => void,
  ): () => void {
    const key = "affiliate-relationship-signals";

    const subscribe = (attempt: number): (() => void) => {
      if (!this.client) return () => {};

      const unsubscribe = this.client.subscribe<{ affiliateRelationshipSignal: AffiliateRelationshipSignalPayload }>(
        { query: AFFILIATE_RELATIONSHIP_SIGNAL_SUBSCRIPTION },
        {
          next: (result) => {
            this.noteSubscriptionNext(key, attempt);
            if (this.handleResultErrors(key, attempt, "Affiliate relationship signal subscription next contained GraphQL errors", result.errors)) {
              return;
            }
            const payload = result.data?.affiliateRelationshipSignal;
            if (!payload) {
              this.logUnexpectedResult(key, attempt, "affiliateRelationshipSignal", result as any);
              return;
            }
            onSignal(payload);
          },
          error: (err) => {
            this.handleSubscriptionError(key, attempt, "Affiliate relationship signal subscription error", err);
          },
          complete: () => this.handleSubscriptionComplete(key, attempt),
        },
      );
      return unsubscribe;
    };

    return this.registerSubscription({ key, subscribe, authRequired: true, longLived: true });
  }

  subscribeToAffiliateWorkItemChanges(
    onWorkItem: (workItem: AffiliateWorkItemPayload) => void,
  ): () => void {
    const key = "affiliate-work-item-changed";

    const subscribe = (attempt: number): (() => void) => {
      if (!this.client) return () => {};

      const unsubscribe = this.client.subscribe<{ affiliateWorkItemChanged: { workItem: AffiliateWorkItemPayload } }>(
        { query: AFFILIATE_WORK_ITEM_CHANGED_SUBSCRIPTION },
        {
          next: (result) => {
            this.noteSubscriptionNext(key, attempt);
            if (this.handleResultErrors(key, attempt, "Affiliate work item subscription next contained GraphQL errors", result.errors)) {
              return;
            }
            if (result.errors?.length) {
              log.warn("Affiliate work item subscription next contained GraphQL errors", {
                subscription: key,
                attempt,
                errorMessages: result.errors.map((err) => err.message ?? "(no message)"),
              });
            }
            const payload = result.data?.affiliateWorkItemChanged?.workItem;
            if (!payload) {
              this.logUnexpectedResult(key, attempt, "affiliateWorkItemChanged.workItem", result as any);
              return;
            }
            onWorkItem(payload);
          },
          error: (err) => {
            this.handleSubscriptionError(key, attempt, "Affiliate work item subscription error", err);
          },
          complete: () => this.handleSubscriptionComplete(key, attempt),
        },
      );
      return unsubscribe;
    };

    return this.registerSubscription({ key, subscribe, authRequired: true, longLived: true });
  }

  subscribeToAffiliateActionProposalChanges(
    onProposal: (proposal: AffiliateActionProposalPayload) => void,
  ): () => void {
    const key = "affiliate-action-proposal-changed";

    const subscribe = (attempt: number): (() => void) => {
      if (!this.client) return () => {};

      const unsubscribe = this.client.subscribe<{ affiliateActionProposalChanged: { proposal: AffiliateActionProposalPayload } }>(
        { query: AFFILIATE_ACTION_PROPOSAL_CHANGED_SUBSCRIPTION },
        {
          next: (result) => {
            this.noteSubscriptionNext(key, attempt);
            if (this.handleResultErrors(key, attempt, "Affiliate action proposal subscription next contained GraphQL errors", result.errors)) {
              return;
            }
            if (result.errors?.length) {
              log.warn("Affiliate action proposal subscription next contained GraphQL errors", {
                subscription: key,
                attempt,
                errorMessages: result.errors.map((err) => err.message ?? "(no message)"),
              });
            }
            const payload = result.data?.affiliateActionProposalChanged?.proposal;
            if (!payload) {
              this.logUnexpectedResult(key, attempt, "affiliateActionProposalChanged.proposal", result as any);
              return;
            }
            onProposal(payload);
          },
          error: (err) => {
            this.handleSubscriptionError(key, attempt, "Affiliate action proposal subscription error", err);
          },
          complete: () => this.handleSubscriptionComplete(key, attempt),
        },
      );
      return unsubscribe;
    };

    return this.registerSubscription({ key, subscribe, authRequired: true, longLived: true });
  }

  private doConnect(): void {
    if (!this.getToken) return;

    const baseUrl = getApiBaseUrl(this.locale);
    const wsUrl = baseUrl.replace(/^http/, "ws") + "/graphql";
    let activeSocket: RestartableSocket | null = null;
    let restartRequested = false;
    const restart = () => {
      if (activeSocket?.readyState === 1) {
        activeSocket.close(4205, "Client Restart");
      } else {
        restartRequested = true;
      }
    };

    const client = createClient({
      url: wsUrl,
      webSocketImpl: proxyNetwork.createProxiedWebSocketClass() as any,
      connectionParams: () => {
        const token = this.getToken?.();
        return token ? { authorization: `Bearer ${token}` } : {};
      },
      retryAttempts: Infinity,
      retryWait: async (retries: number) => {
        const delay = Math.min(1000 * 2 ** retries, 30_000);
        await new Promise((r) => setTimeout(r, delay));
      },
      keepAlive: 30_000,
      shouldRetry: (errOrCloseEvent) => this.shouldRetryConnection(errOrCloseEvent),
      on: {
        opened: (socket) => {
          activeSocket = socket as RestartableSocket;
          if (restartRequested) {
            restartRequested = false;
            restart();
          }
        },
        connected: (_socket, _payload, retrying) => {
          log.info(`Backend subscription WebSocket connected${retrying ? " after retry" : ""}`);
          if (retrying) {
            void (async () => {
              if (this.onConnectedAfterRetry) {
                await this.onConnectedAfterRetry();
              }
              this.reconcileSubscriptions("transport_reconnected", { retryBlocked: true });
            })().catch((err) => {
              log.warn("Backend subscription reconnect recovery hook failed", this.formatUnknownError(err));
              this.reconcileSubscriptions("transport_reconnected_after_hook_error", {
                retryBlocked: true,
              });
            });
          }
        },
        closed: (event) => {
          activeSocket = null;
          this.clearPongTimeout();
          log.info("Backend subscription WebSocket closed", this.formatUnknownError(event));
          const code = typeof event === "object" && event !== null
            ? (event as { code?: unknown }).code
            : undefined;
          if (typeof code === "number" && AUTH_WS_CLOSE_CODES.has(code)) {
            this.handleConnectionAuthFailure(`connection_close_${code}`, event);
          }
        },
        error: (err) => {
          log.warn("Backend subscription WebSocket error (will auto-retry)", this.formatUnknownError(err));
          if (this.isAuthError(err)) {
            this.handleConnectionAuthFailure("connection_error", err);
          }
        },
        ping: (received) => {
          if (received) return;
          this.clearPongTimeout();
          this.pongTimeout = setTimeout(() => {
            log.warn("Backend subscription pong timeout; terminating transport");
            this.client?.terminate();
          }, 10_000);
        },
        pong: (received) => {
          if (received) {
            this.clearPongTimeout();
          }
        },
      },
    });
    this.client = Object.assign(client, { restart });

    // Establish previously registered subscriptions (e.g. after disconnect → connect cycle)
    this.reconcileSubscriptions("transport_connected");
  }
}
