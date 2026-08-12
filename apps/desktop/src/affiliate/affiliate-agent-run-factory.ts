import { GQL } from "@rivonclaw/core";

export interface AffiliateAgentRunFactoryInput {
  workItem: GQL.AffiliateWorkItem;
  platform: string;
}

export interface AffiliateAgentRunRequest {
  message: string;
  idempotencyKey: string;
  abortActive?: boolean;
  predictionCacheIds?: string[];
}

export function buildAffiliateAgentRunRequest(
  input: AffiliateAgentRunFactoryInput,
): AffiliateAgentRunRequest | null {
  const { workItem, platform } = input;
  if (!workItem.agentDispatchRecommended) return null;
  assertFormalSampleAgendaHasPredictionEvidence(workItem);

  const idempotencySuffix = isSampleReviewWorkItem(workItem)
    ? resolveSampleApplicationRecordId(workItem) ??
      workItem.affiliateCollaborationId ??
      workItem.creatorRelationshipId
    : workItem.workKind === GQL.AffiliateWorkKind.InboundMessageTriage
      ? workItem.creatorRelationship?.lastInboundLifecycleEventId ?? workItem.creatorRelationshipId
      : null;

  return {
    message: renderAgentWorkingAgenda(workItem),
    idempotencyKey: [
      "affiliate",
      platform,
      "work",
      workItem.workKind,
      workItem.id,
      idempotencySuffix,
      workItem.versionAt,
    ].filter(Boolean).join(":"),
    abortActive: false,
    predictionCacheIds: collectWorkingAgendaPredictionCacheIds(workItem),
  };
}

function assertFormalSampleAgendaHasPredictionEvidence(
  workItem: GQL.AffiliateWorkItem,
): void {
  const missingEvidence = resolveOpenAgentAgenda(workItem).find(
    (item) => item.sampleApplicationRecordId && !item.predictionEvidence,
  );
  if (missingEvidence) {
    throw new Error(
      `Affiliate Sample Application agenda ${missingEvidence.key} is missing Backend prediction evidence; refuse to start an Agent run until the work item is redispatched.`,
    );
  }
}

export function resolveSampleApplicationRecordId(
  workItem: GQL.AffiliateWorkItem,
): string | null {
  return workItem.sampleApplicationRecord?.id ??
    workItem.context?.primarySampleApplication?.id ??
    workItem.agentWorkingAgendaItems?.find((item) => item.sampleApplicationRecordId)
      ?.sampleApplicationRecordId ??
    workItem.creatorRelationship?.agendaItems?.find((item) => item.sampleApplicationRecordId)
      ?.sampleApplicationRecordId ??
    null;
}

/**
 * The user turn is deliberately a wake-up envelope, not a general business snapshot.
 * IDs below are stable scopes/targets needed to call authoritative tools. Formal Sample
 * Application agenda items additionally carry Backend-generated prediction evidence.
 */
export function renderAgentWorkingAgenda(workItem: GQL.AffiliateWorkItem): string {
  const creatorProfile = workItem.context?.creatorProfile ?? null;
  const creatorId = creatorProfile?.id ?? workItem.creatorRelationship?.creatorId ?? null;
  const openAgentAgenda = resolveOpenAgentAgenda(workItem);
  const agendaItems: GQL.AffiliateRelationshipAgendaItem[] = openAgentAgenda.length > 0
    ? openAgentAgenda
    : [{
        key: `work:${workItem.id}`,
        workKind: workItem.workKind,
        requiredAction: workItem.requiredAction,
        owner: GQL.AffiliateRelationshipAgendaOwner.Agent,
        sourceType: workItem.sampleApplicationRecord
          ? GQL.AffiliateRelationshipAgendaSourceType.SampleApplication
          : GQL.AffiliateRelationshipAgendaSourceType.Relationship,
        updatedAt: workItem.versionAt,
        shopId: workItem.triggerShopId,
        shopRegion: null,
        reasons: workItem.processReasons ?? [],
        affiliateCollaborationId: workItem.affiliateCollaborationId ?? null,
        sampleApplicationRecordId: workItem.sampleApplicationRecord?.id ?? null,
        proposalId: null,
        revisionRequestedProposal: null,
        nextActionAt: workItem.creatorRelationship?.workSummary?.nextActionAt ?? null,
      }];

  const lines = [
    "[Bound Affiliate Run Context]",
    `Trigger Shop ID: ${workItem.triggerShopId}`,
    `Creator Relationship ID: ${workItem.creatorRelationshipId}`,
    `Creator ID: ${creatorId ?? "(unavailable)"}`,
    `TikTok Creator Open ID: ${creatorProfile?.creatorOpenId ?? "(unavailable)"}`,
    "The Creator Relationship and Creator identity are trusted run constants, not a Creator profile snapshot. Read profile or performance facts only through affiliate_get_creator_profile.",
    "The trigger shop is event provenance only; it does not limit relationship history or force every action to use that shop.",
    "",
    "[Agent Working Agenda]",
  ];
  agendaItems.forEach((item, index) => {
    lines.push(
      "",
      `${index + 1}. Agenda Item: ${item.key}`,
      `   Work Kind: ${item.workKind}`,
      `   Required Action: ${item.requiredAction}`,
      `   Shop ID: ${item.shopId ?? workItem.triggerShopId}`,
      `   Shop Region: ${item.shopRegion ?? "(unavailable)"}`,
      `   Product ID: ${item.productId ?? "(unavailable)"}`,
      `   Reasons: ${(item.reasons ?? []).join(", ") || "(none)"}`,
    );
    if (item.campaignId) {
      lines.push(`   Campaign ID: ${item.campaignId}`);
    }
    if (item.affiliateCollaborationId) {
      lines.push(`   Platform Collaboration ID: ${item.affiliateCollaborationId}`);
    }
    if (item.sampleApplicationRecordId) {
      lines.push(`   Sample Application Record ID: ${item.sampleApplicationRecordId}`);
    }
    if (item.predictionEvidence) {
      lines.push(
        "   Backend Prediction Evidence: " +
          JSON.stringify(compactWorkingAgendaPredictionEvidence(item.predictionEvidence)),
        "   Prediction Semantics: Backend computed this evidence before dispatch. Treat Expected Sales as the primary commercial-value estimate, not an automatic approve/reject threshold. Override it only with an explicit shop/BD instruction, seller commitment, operational hard conflict, or material current fact outside the prediction.",
      );
    }
    if (item.proposalId) {
      lines.push(`   Proposal ID: ${item.proposalId}`);
    }
    if (item.revisionRequestedProposal) {
      const revision = item.revisionRequestedProposal;
      lines.push(
        "   Dispatch Source: STAFF_PROPOSAL_REVISION_REQUEST",
        `   Requested Changes: ${revision.decision?.note?.trim() || "(revision note missing)"}`,
        `   Previous Proposal Type: ${revision.type}`,
        `   Previous Proposal Summary: ${revision.operatorSummary}`,
        `   Frozen Proposal To Revise: ${JSON.stringify(frozenRevisionIntent(revision))}`,
      );
    }
    if (item.nextActionAt) {
      lines.push(`   Due At: ${item.nextActionAt}`);
    }
  });
  return lines.join("\n");
}

function collectWorkingAgendaPredictionCacheIds(workItem: GQL.AffiliateWorkItem): string[] {
  return [
    ...new Set(
      resolveOpenAgentAgenda(workItem)
        .map((item) => item.predictionEvidence?.sourceCacheId?.trim())
        .filter((cacheId): cacheId is string => Boolean(cacheId)),
    ),
  ];
}

function resolveOpenAgentAgenda(
  workItem: GQL.AffiliateWorkItem,
): GQL.AffiliateRelationshipAgendaItem[] {
  const projectedAgenda = workItem.agentWorkingAgendaItems ?? [];
  return projectedAgenda.length > 0
    ? projectedAgenda
    : (workItem.creatorRelationship?.agendaItems ?? []).filter(
        (item) => item.owner === GQL.AffiliateRelationshipAgendaOwner.Agent,
      );
}

function compactWorkingAgendaPredictionEvidence(
  evidence: GQL.AffiliateActionProposalPredictionSnapshot,
): Record<string, unknown> {
  const output = asRecord(evidence.output);
  const model = asRecord(evidence.model);
  return compactRecord({
    status: evidence.status,
    scenario: evidence.scenario,
    sampleApplicationRecordId:
      evidence.subject.sampleApplicationRecordId ??
      evidence.resolvedContext?.sampleApplicationRecordId ??
      null,
    productId:
      evidence.subject.productId ?? evidence.resolvedContext?.productId ?? null,
    expectedSalesUnits: output.expectedSalesUnits,
    expectedSalesPercentile: output.expectedSalesPercentile,
    predictionQuality: output.predictionQuality,
    expectedSalesSelection: output.expectedSalesSelection,
    featureTemporalBasis: output.featureTemporalBasis ?? model.featureTemporalBasis,
    modelStage: output.modelStage ?? model.modelStage,
    effectiveTenantScope: output.effectiveTenantScope ?? model.effectiveTenantScope,
    effectiveTenantId: output.effectiveTenantId ?? model.effectiveTenantId,
    modelVersion: model.modelVersion,
    predictedAt: evidence.predictedAt,
    message: evidence.message,
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function compactRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, child]) => child !== undefined && child !== null),
  );
}

function frozenRevisionIntent(
  proposal: GQL.AffiliateRevisionRequestedProposalContext,
): Record<string, unknown> {
  return {
    messageIntent: proposal.messageIntent ?? null,
    targetCollaborationIntent: proposal.targetCollaborationIntent ?? null,
    sampleReviewIntent: proposal.sampleReviewIntent ?? null,
    steps: proposal.steps ?? [],
  };
}

function isSampleReviewWorkItem(workItem: GQL.AffiliateWorkItem): boolean {
  return (
    workItem.workKind === GQL.AffiliateWorkKind.SampleApplicationDecision ||
    (
      workItem.requiredAction === GQL.AffiliateRelationshipRequiredAction.CompleteCollaborationTask &&
      workItem.processReasons?.includes(
        GQL.AffiliateWorkProcessReason.SamplePendingReview,
      ) === true
    )
  );
}
