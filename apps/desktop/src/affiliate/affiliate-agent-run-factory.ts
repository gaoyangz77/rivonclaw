import type { GQL } from "@rivonclaw/core";

export interface AffiliateAgentRunFactoryInput {
  workItem: GQL.AffiliateWorkItem;
  platform: string;
  conversationDelta?: string;
  businessPrompt?: string | null;
}

export interface AffiliateAgentRunRequest {
  message: string;
  idempotencyKey: string;
  abortActive?: boolean;
}

export function buildAffiliateAgentRunRequest(
  input: AffiliateAgentRunFactoryInput,
): AffiliateAgentRunRequest | null {
  const { workItem } = input;
  if (!workItem.agentDispatchRecommended) return null;

  switch (workItem.workKind) {
    case "CREATOR_REPLY_NEEDED":
      return buildCreatorReplyRun(input);
    case "SAMPLE_REVIEW_NEEDED":
      return buildSampleReviewRun(input);
    case "CONTENT_FOLLOW_UP_DUE":
      return buildContentFollowUpRun(input);
    default:
      return null;
  }
}

function buildCreatorReplyRun(input: AffiliateAgentRunFactoryInput): AffiliateAgentRunRequest {
  const { workItem, platform } = input;
  const currentMessageId = workItem.collaboration.lastCreatorMessageId ?? workItem.collaborationRecordId;
  return {
    message: [
      "[Affiliate Work Item: Creator Reply Needed]",
      "",
      renderWorkItemProjection(workItem),
      "",
      renderBusinessPrompt(input.businessPrompt),
      "",
      input.conversationDelta
        ?? "Conversation delta was not available before dispatch. Use affiliate tools conservatively before proposing any outbound message.",
      "",
      "## Task",
      "Decide whether the creator needs a reply now.",
      "You must complete this work item by calling affiliate_resolve_work_item exactly once.",
      `Set handledSignalAt to ${workItem.collaboration.lastSignalAt ?? "null"} so backend can ack this exact work boundary.`,
      "If a reply is needed, use decision REQUEST_ACTION with action.type SEND_MESSAGE.",
      "For every text reply, action.messageIntent must include messageType: TEXT.",
      "If no reply is needed, use decision NO_ACTION_NEEDED.",
      "If a human should decide, use decision NEEDS_STAFF_REVIEW.",
      "Use operatorSummary for the merchant/staff-facing rationale. The text you write in action.messageIntent.text is the creator-facing message.",
      "Do not write merchant/operator summaries as final assistant text. After affiliate_resolve_work_item succeeds, your final assistant response must be exactly NO_REPLY.",
      "If approval is required, stop after the backend creates the ActionProposal and reply exactly NO_REPLY.",
    ].join("\n"),
    idempotencyKey: `affiliate:${platform}:work:${workItem.workKind}:${workItem.id}:${currentMessageId}:${workItem.versionAt}`,
    abortActive: false,
  };
}

function buildSampleReviewRun(input: AffiliateAgentRunFactoryInput): AffiliateAgentRunRequest {
  const { workItem, platform } = input;
  const sample = workItem.sampleApplicationRecord;
  return {
    message: [
      "[Affiliate Work Item: Sample Review Needed]",
      "",
      renderWorkItemProjection(workItem),
      "",
      renderBusinessPrompt(input.businessPrompt),
      "",
      "## Task",
      "Review the sample request and decide whether the seller should approve it, reject it, or ask a human/operator for more context.",
      "You must complete this work item by calling affiliate_resolve_work_item exactly once.",
      `Set handledSignalAt to ${workItem.collaboration.lastSignalAt ?? "null"} so backend can ack this exact work boundary.`,
      "If the approval/rejection decision is clear, use decision REQUEST_ACTION with action.type APPROVE_SAMPLE or REJECT_SAMPLE.",
      "If you include a creator-facing text message, action.messageIntent must include messageType: TEXT.",
      "If business context is insufficient, use decision NEEDS_STAFF_REVIEW instead of ending with plain text.",
      "Use operatorSummary for staff-facing reasoning in the desktop language. If you need to send text to the creator, put creator-facing copy only in action.messageIntent.text.",
      "Use action.sampleReviewIntent.sampleApplicationRecordId and platformApplicationId from the projection; do not invent campaignId.",
      "For APPROVE_SAMPLE, set action.sampleReviewIntent.decision to APPROVE. For REJECT_SAMPLE, set action.sampleReviewIntent.decision to REJECT and include rejectReason when known.",
      "Do not write merchant/operator summaries as final assistant text. If approval policy requires review, the backend will create an ActionProposal. Stop there and reply exactly NO_REPLY.",
    ].join("\n"),
    idempotencyKey: `affiliate:${platform}:work:${workItem.workKind}:${workItem.id}:${sample?.id ?? "sample"}:${workItem.versionAt}`,
  };
}

function buildContentFollowUpRun(input: AffiliateAgentRunFactoryInput): AffiliateAgentRunRequest {
  const { workItem, platform } = input;
  return {
    message: [
      "[Affiliate Work Item: Content Follow-Up Due]",
      "",
      renderWorkItemProjection(workItem),
      "",
      renderBusinessPrompt(input.businessPrompt),
      "",
      "## Task",
      "The creator appears to be past the configured follow-up point after sample delivery or content-pending state.",
      "Decide whether to send a gentle creator follow-up now.",
      "You must complete this work item by calling affiliate_resolve_work_item exactly once.",
      `Set handledSignalAt to ${workItem.collaboration.lastSignalAt ?? "null"} so backend can ack this exact work boundary.`,
      "If a follow-up is appropriate, use decision REQUEST_ACTION with action.type SEND_MESSAGE.",
      "For every text follow-up, action.messageIntent must include messageType: TEXT.",
      "If no follow-up is needed, use decision NO_ACTION_NEEDED.",
      "If Platform Conversation ID is empty, this is a proactive follow-up: omit action.messageIntent.conversationId and the backend will create or reuse the TikTok affiliate conversation from creator identity only after approval/execution.",
      "Use operatorSummary for the merchant/staff-facing rationale.",
      "Keep action.messageIntent.text creator-facing, concise, and respectful. Do not threaten or over-pressure the creator.",
      "If the context is incomplete, use decision NEEDS_STAFF_REVIEW.",
      "Do not write merchant/operator summaries as final assistant text. After affiliate_resolve_work_item succeeds, your final assistant response must be exactly NO_REPLY.",
    ].join("\n"),
    idempotencyKey: `affiliate:${platform}:work:${workItem.workKind}:${workItem.id}:${workItem.versionAt}`,
  };
}

export function renderWorkItemProjection(workItem: GQL.AffiliateWorkItem): string {
  const collaboration = workItem.collaboration;
  const sample = workItem.sampleApplicationRecord;
  const proposal = workItem.latestPendingProposal;
  return [
    "## Backend Work Projection",
    `- Work Item ID: ${workItem.id}`,
    `- Work Kind: ${workItem.workKind}`,
    `- Shop ID: ${workItem.shopId}`,
    `- Platform Shop ID: ${workItem.platformShopId}`,
    `- Collaboration ID: ${workItem.collaborationRecordId}`,
    `- Processing Status: ${workItem.processingStatus}`,
    `- Process Reasons: ${(workItem.processReasons ?? []).join(", ") || "(none)"}`,
    `- Agent Dispatch Recommended: ${workItem.agentDispatchRecommended}`,
    `- Staff Review Required: ${workItem.staffReviewRequired}`,
    `- Version At: ${workItem.versionAt}`,
    "",
    "## Collaboration",
    `- Creator ID: ${collaboration.creatorId}`,
    `- Creator IM User ID: ${collaboration.creatorImId ?? ""}`,
    `- Product ID: ${collaboration.productId ?? ""}`,
    `- Sample Application Record ID: ${collaboration.sampleApplicationRecordId ?? ""}`,
    `- Platform Conversation ID: ${collaboration.platformConversationId ?? ""}`,
    `- Lifecycle Stage: ${collaboration.lifecycleStage}`,
    `- Last Creator Message ID: ${collaboration.lastCreatorMessageId ?? ""}`,
    `- Last Creator Message At: ${collaboration.lastCreatorMessageAt ?? ""}`,
    `- Last Signal At: ${collaboration.lastSignalAt ?? ""}`,
    `- Work Handled Until: ${collaboration.workHandledUntil ?? ""}`,
    `- Next Seller Action At: ${collaboration.nextSellerActionAt ?? ""}`,
    "",
    "## Sample Application",
    ...(sample ? [
      `- Sample Record ID: ${sample.id}`,
      `- Platform Application ID: ${sample.platformApplicationId}`,
      `- Creator ID: ${sample.creatorId ?? ""}`,
      `- Product ID: ${sample.productId ?? ""}`,
      `- Sample Work Status: ${sample.sampleWorkStatus}`,
      `- Observed Content Count: ${sample.observedContentCount}`,
      `- Latest Observed Content At: ${sample.latestObservedContentAt ?? ""}`,
      `- Latest Observed Content ID: ${sample.latestObservedContentId ?? ""}`,
      `- Latest Observed Content URL: ${sample.latestObservedContentUrl ?? ""}`,
      `- Latest Observed Content Format: ${sample.latestObservedContentFormat ?? ""}`,
      `- Latest Observed Content Paid Orders: ${sample.latestObservedContentPaidOrderCount ?? ""}`,
      `- Latest Observed Content Views: ${sample.latestObservedContentViewCount ?? ""}`,
      `- Updated At: ${sample.updatedAt}`,
    ] : ["(none)"]),
    "",
    "## Latest Pending Proposal",
    ...(proposal ? [
      `- Proposal ID: ${proposal.id}`,
      `- Type: ${proposal.type}`,
      `- Status: ${proposal.status}`,
      `- Operator Summary: ${proposal.operatorSummary}`,
      `- Creator ID: ${proposal.creatorId ?? ""}`,
      `- Collaboration ID: ${proposal.collaborationRecordId ?? ""}`,
    ] : ["(none)"]),
  ].join("\n");
}

function renderBusinessPrompt(businessPrompt: string | null | undefined): string {
  const prompt = businessPrompt?.trim();
  if (!prompt) {
    return [
      "## Merchant Affiliate Instructions",
      "(none configured)",
    ].join("\n");
  }
  return [
    "## Merchant Affiliate Instructions",
    prompt,
  ].join("\n");
}
