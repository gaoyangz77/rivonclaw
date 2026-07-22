import { GQL } from "@rivonclaw/core";

export interface AffiliateAgentRunFactoryInput {
  workItem: GQL.AffiliateWorkItem;
  platform: string;
}

export interface AffiliateAgentRunRequest {
  message: string;
  idempotencyKey: string;
  abortActive?: boolean;
}

export function buildAffiliateAgentRunRequest(
  input: AffiliateAgentRunFactoryInput,
): AffiliateAgentRunRequest | null {
  const { workItem, platform } = input;
  if (!workItem.agentDispatchRecommended) return null;

  const idempotencySuffix = isSampleReviewWorkItem(workItem)
    ? resolveSampleApplicationRecordId(workItem) ??
      workItem.collaborationRecordId ??
      workItem.creatorRelationshipId
    : workItem.workKind === GQL.AffiliateWorkKind.InboundMessageTriage
      ? workItem.collaboration?.lastCreatorMessageId ?? workItem.creatorRelationshipId
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
  };
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
    workItem.collaboration?.sampleApplicationRecordId ??
    null;
}

/**
 * The user turn is deliberately a wake-up envelope, not a business snapshot.
 * IDs below are only stable scopes/targets needed to call the authoritative tools.
 */
export function renderAgentWorkingAgenda(workItem: GQL.AffiliateWorkItem): string {
  const projectedAgentAgenda = workItem.agentWorkingAgendaItems ?? [];
  const openAgentAgenda = projectedAgentAgenda.length > 0
    ? projectedAgentAgenda
    : (workItem.creatorRelationship?.agendaItems ?? []).filter(
        (item) => item.owner === GQL.AffiliateRelationshipAgendaOwner.Agent,
      );
  const agendaItems = openAgentAgenda.length > 0
    ? openAgentAgenda
    : [{
        key: `work:${workItem.id}`,
        workKind: workItem.workKind,
        requiredAction: workItem.requiredAction,
        reasons: workItem.processReasons ?? [],
        collaborationRecordId: workItem.collaborationRecordId ?? null,
        sampleApplicationRecordId: workItem.sampleApplicationRecord?.id ?? null,
        proposalId: null,
        revisionRequestedProposal: null,
        nextActionAt: workItem.creatorRelationship?.workSummary?.nextActionAt ?? null,
      }];

  const lines = [
    "[Agent Working Agenda]",
    `Creator Relationship ID: ${workItem.creatorRelationshipId}`,
    `Shop ID: ${workItem.focusShopId}`,
  ];
  agendaItems.forEach((item, index) => {
    lines.push(
      "",
      `${index + 1}. Agenda Item: ${item.key}`,
      `   Work Kind: ${item.workKind}`,
      `   Required Action: ${item.requiredAction}`,
      `   Reasons: ${(item.reasons ?? []).join(", ") || "(none)"}`,
    );
    if (item.collaborationRecordId) {
      lines.push(`   Collaboration Record ID: ${item.collaborationRecordId}`);
    }
    if (item.sampleApplicationRecordId) {
      lines.push(`   Sample Application Record ID: ${item.sampleApplicationRecordId}`);
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
        GQL.AffiliateCollaborationRecordProcessReason.SamplePendingReview,
      ) === true
    )
  );
}
