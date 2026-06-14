import type { GQL } from "@rivonclaw/core";
import type { StaffLanguage } from "../i18n/locale.js";

export interface AffiliateAgentRunFactoryInput {
  workItem: GQL.AffiliateWorkItem;
  platform: string;
  conversationDelta?: string;
  proposalDeltaSection?: string;
  predictionSection?: string;
  predictionCacheIds?: readonly string[];
  businessPrompt?: string | null;
  decisionThresholds?: GQL.AffiliateDecisionThresholds | null;
  decisionThresholdSource?: string | null;
  staffLanguage?: StaffLanguage;
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
      renderProposalDeltaSection(input),
      "",
      renderPredictionSection(input),
      "",
      renderDecisionThresholds(input.decisionThresholds, input.decisionThresholdSource),
      "",
      renderBusinessPrompt(input.businessPrompt),
      "",
      input.conversationDelta
        ?? "Conversation delta was not available before dispatch. Use affiliate tools conservatively before proposing any outbound message.",
      "",
      "## Task",
      "Decide whether the creator needs a reply now.",
      "You must complete this work item by calling affiliate_resolve_work_item exactly once.",
      renderResolveWorkItemToolContract(),
      `Set handledSignalAt to ${workItem.collaboration.lastSignalAt ?? "null"} so backend can ack this exact work boundary.`,
      "If a reply is needed, use decision REQUEST_ACTION with action.type SEND_MESSAGE.",
      "If Backend Work Context recommends multiple actions, use input.actions as an ordered list instead of input.action so the backend can approve or execute the bundle together.",
      renderPredictionCacheInstruction(input),
      "For every text reply, action.messageIntent must include messageType: TEXT and a non-empty text field containing the exact creator-facing message.",
      "If no reply is needed, use decision NO_ACTION_NEEDED.",
      "If a human should decide, use decision NEEDS_STAFF_REVIEW.",
      `Use operatorSummary for the merchant/staff-facing rationale, and write it in ${input.staffLanguage ?? "English"}. The text you write in action.messageIntent.text is the creator-facing message.`,
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
      renderProposalDeltaSection(input),
      "",
      renderPredictionSection(input),
      "",
      renderDecisionThresholds(input.decisionThresholds, input.decisionThresholdSource),
      "",
      renderBusinessPrompt(input.businessPrompt),
      "",
      "## Task",
      "Review the sample request and decide whether the seller should approve it, reject it, or ask a human/operator for more context.",
      "You must complete this work item by calling affiliate_resolve_work_item exactly once.",
      renderResolveWorkItemToolContract(),
      `Set handledSignalAt to ${workItem.collaboration.lastSignalAt ?? "null"} so backend can ack this exact work boundary.`,
      "If the merchant instructions depend on dynamic creator or shop facts, such as follower count, GMV, prior performance, sample cost, inventory, or current fulfillment state, call affiliate_get_workspace with the narrowest available filters before deciding.",
      "If merchant instructions are not configured, do not invent follower-count, GMV, or sales thresholds. Use Affiliate Decision Thresholds when configured, otherwise use the Affiliate Prediction section as the primary decision signal plus concrete workspace facts such as block/risk tags and sample/product context.",
      "For sample review with prediction status OK: compare the predicted sales units with the configured minP50SalesUnits. If the predicted units are below the threshold, generally reject the sample unless stronger merchant instructions or workspace facts justify an exception. If the predicted units meet or exceed the threshold, that can support approving the sample.",
      "Write operatorSummary for a busy ecommerce seller, not a statistician. Explain the business meaning in plain language, for example: \"The model expects this creator to sell around 0 units for this product, below the shop's minimum of 2, so rejecting the sample is recommended.\" Do not include raw model details unless the merchant explicitly asks.",
      "If the approval/rejection decision is clear, use decision REQUEST_ACTION with action.type REVIEW_SAMPLE_APPLICATION.",
      "If a creator-facing message should be sent together with the sample decision, use input.actions as an ordered action list containing one REVIEW_SAMPLE_APPLICATION action and one separate SEND_MESSAGE action.",
      renderPredictionCacheInstruction(input),
      "If you include a creator-facing text message, the SEND_MESSAGE action's messageIntent must include messageType: TEXT and a non-empty text field containing the exact creator-facing message.",
      "If business context is insufficient, use decision NEEDS_STAFF_REVIEW instead of ending with plain text.",
      `Use operatorSummary for staff-facing reasoning in ${input.staffLanguage ?? "English"}. If you need to send text to the creator, put creator-facing copy only in the SEND_MESSAGE action's messageIntent.text.`,
      "Use sampleReviewIntent.sampleApplicationRecordId and sampleReviewIntent.platformApplicationId from the projection; do not invent campaignId.",
      "For REVIEW_SAMPLE_APPLICATION, do not put sampleApplicationRecordId, platformApplicationId, decision, rejectReason, productId, creatorId, or campaignId at the action top level. Keep sample identifiers and review decision inside action.sampleReviewIntent.",
      "For sample approval, set action.sampleReviewIntent.decision to APPROVE.",
      "For sample rejection, set action.sampleReviewIntent.decision to REJECT. If you set rejectReason, it must be exactly one of NOT_MATCH, OFFLINE, OUT_OF_STOCK, or OTHER; use OTHER for seller-specific rules such as follower-count thresholds, and put free-form rationale only in operatorSummary.",
      "Do not include null fields in affiliate_resolve_work_item input. Omit optional fields entirely when they are not needed.",
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
      renderProposalDeltaSection(input),
      "",
      renderPredictionSection(input),
      "",
      renderDecisionThresholds(input.decisionThresholds, input.decisionThresholdSource),
      "",
      renderBusinessPrompt(input.businessPrompt),
      "",
      "## Task",
      "The creator appears to be past the configured follow-up point after sample delivery or content-pending state.",
      "Decide whether to send a gentle creator follow-up now.",
      "You must complete this work item by calling affiliate_resolve_work_item exactly once.",
      renderResolveWorkItemToolContract(),
      `Set handledSignalAt to ${workItem.collaboration.lastSignalAt ?? "null"} so backend can ack this exact work boundary.`,
      "If a follow-up is appropriate, use decision REQUEST_ACTION with action.type SEND_MESSAGE.",
      renderPredictionCacheInstruction(input),
      "For every text follow-up, action.messageIntent must include messageType: TEXT and a non-empty text field containing the exact creator-facing message.",
      "If no follow-up is needed, use decision NO_ACTION_NEEDED.",
      "If Platform Conversation ID is empty, this is a proactive follow-up: omit action.messageIntent.conversationId and the backend will create or reuse the TikTok affiliate conversation from creator identity only after approval/execution.",
      `Use operatorSummary for the merchant/staff-facing rationale, and write it in ${input.staffLanguage ?? "English"}.`,
      "Keep action.messageIntent.text creator-facing, concise, and respectful. Do not threaten or over-pressure the creator.",
      "If the context is incomplete, use decision NEEDS_STAFF_REVIEW.",
      "Do not write merchant/operator summaries as final assistant text. After affiliate_resolve_work_item succeeds, your final assistant response must be exactly NO_REPLY.",
    ].join("\n"),
    idempotencyKey: `affiliate:${platform}:work:${workItem.workKind}:${workItem.id}:${workItem.versionAt}`,
  };
}

function renderPredictionSection(input: AffiliateAgentRunFactoryInput): string {
  return input.predictionSection?.trim() || "## Affiliate Prediction\n(none resolved before dispatch)";
}

function renderResolveWorkItemToolContract(): string {
  return [
    "## affiliate_resolve_work_item Tool Contract",
    "Call this tool exactly once. The only platform action.type values supported by backend are SEND_MESSAGE, REVIEW_SAMPLE_APPLICATION, and CREATE_TARGET_COLLABORATION.",
    "Do not use CHANGE_COMMISSION, CHANGE_RATE, DISCOUNT, TAG_CREATOR, BLOCK_CREATOR, SHIP_SAMPLE, or any other action type. If the seller needs an unsupported action, use decision NEEDS_STAFF_REVIEW and explain it in operatorSummary.",
    "When decision is REQUEST_ACTION, provide either input.action for one action or input.actions for an ordered bundle; do not provide both.",
    "Each action must populate exactly one intent field matching action.type: SEND_MESSAGE uses messageIntent; REVIEW_SAMPLE_APPLICATION uses sampleReviewIntent; CREATE_TARGET_COLLABORATION uses targetCollaborationIntent.",
    "For REVIEW_SAMPLE_APPLICATION, the action shape must be { type: REVIEW_SAMPLE_APPLICATION, predictionCacheIds: [...], sampleReviewIntent: { sampleApplicationRecordId, platformApplicationId, decision, rejectReason? } }. Never put sampleApplicationRecordId, platformApplicationId, decision, or rejectReason at the action top level.",
    "For SEND_MESSAGE, the action shape must be { type: SEND_MESSAGE, predictionCacheIds: [...], messageIntent: { messageType: TEXT, text, conversationId?, creatorId?, productId? } }. The text field is required and must contain the exact creator-facing message. Do not put the intended message only in operatorSummary.",
    "Omit optional fields that are unknown or not needed. Never send empty string for Date, ID, or object fields. Only set nextSellerActionAt for decision DEFERRED, and then it must be a valid ISO timestamp.",
  ].join("\n");
}

function renderProposalDeltaSection(input: AffiliateAgentRunFactoryInput): string {
  return input.proposalDeltaSection?.trim() || "## Proposal Events Since Last Work Boundary\n(none fetched before dispatch)";
}

function renderDecisionThresholds(
  thresholds: GQL.AffiliateDecisionThresholds | null | undefined,
  source: string | null | undefined,
): string {
  const minP50SalesUnits = thresholds?.minP50SalesUnits;
  if (typeof minP50SalesUnits !== "number") {
    return [
      "## Affiliate Decision Thresholds",
      "(none configured)",
      "No default numeric sales threshold is configured for this shop or campaign. Do not invent one. Use merchant instructions, predicted sales units, and concrete workspace facts to decide.",
    ].join("\n");
  }

  return [
    "## Affiliate Decision Thresholds",
    `- Source: ${source ?? "configured threshold"}`,
    `- minP50SalesUnits: ${minP50SalesUnits}`,
    "Use this as the default investment/continuation threshold when merchant instructions do not provide a more specific rule for the current product, campaign, or creator.",
    "If the predicted sales units are below minP50SalesUnits, do not approve, invest in, or continue the collaboration by default unless stronger merchant instructions or workspace facts justify an exception.",
    "If the predicted sales units meet or exceed minP50SalesUnits, that supports proceeding, subject to risk tags, product/sample context, inventory/fulfillment facts, and approval policy.",
    "For existing commitments that already require operational follow-up, use the threshold as background context; do not use it as the only reason to ignore an overdue creator follow-up.",
    "This threshold is a decision aid, not creator-facing copy. If you mention it in operatorSummary, explain it plainly as the shop's minimum expected sales, never as a technical model metric.",
  ].join("\n");
}

function renderPredictionCacheInstruction(input: AffiliateAgentRunFactoryInput): string {
  const cacheIds = input.predictionCacheIds?.filter(Boolean) ?? [];
  if (cacheIds.length === 0) {
    return "No affiliate prediction cache id was provided for this work item.";
  }
  return [
    `For any REQUEST_ACTION decision in this work item, include predictionCacheIds: ${JSON.stringify(cacheIds)} on the typed action payload.`,
    "If you use input.actions, include the same predictionCacheIds on each action that creates, updates, approves, rejects, or messages within this collaboration.",
  ].join(" ");
}

export function renderWorkItemProjection(workItem: GQL.AffiliateWorkItem): string {
  const collaboration = workItem.collaboration;
  const sample = workItem.sampleApplicationRecord;
  const proposal = workItem.latestPendingProposal;
  return [
    "## Backend Work Projection",
    `- Work Item ID: ${workItem.id}`,
    `- Work Kind: ${workItem.workKind}`,
    `- Work Bundle Kind: ${workItem.workBundleKind ?? ""}`,
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
    "## Backend Work Context",
    ...renderResolvedContext(workItem),
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

function renderResolvedContext(workItem: GQL.AffiliateWorkItem): string[] {
  const context = workItem.context;
  if (!context) return ["(none)"];
  const creator = context.creatorProfile;
  const product = context.productContext;
  const relatedSamples = context.relatedSampleApplications ?? [];
  const missingContext = context.missingContext ?? [];
  return [
    `- Recommended Actions: ${(workItem.recommendedActionTypes ?? context.recommendedActionTypes ?? []).join(", ") || "(none)"}`,
    creator
      ? `- Creator: ${creator.nickname ?? creator.username ?? creator.creatorOpenId ?? creator.creatorImId ?? creator.id} (id=${creator.id}, openId=${creator.creatorOpenId ?? ""}, imId=${creator.creatorImId ?? ""})`
      : "- Creator: (unresolved)",
    product
      ? `- Product Context: ${product.productId}${product.title ? ` / ${product.title}` : ""} source=${product.source ?? ""}`
      : "- Product Context: (unresolved)",
    context.affiliateCollaboration
      ? `- Affiliate Collaboration Offer: ${context.affiliateCollaboration.type} ${context.affiliateCollaboration.platformCollaborationId} status=${context.affiliateCollaboration.status}`
      : "- Affiliate Collaboration Offer: (none)",
    `- Related Sample Applications: ${relatedSamples.length}`,
    ...relatedSamples.map((sample, index) =>
      `  ${index + 1}. ${sample.id} platform=${sample.platformApplicationId} status=${sample.sampleWorkStatus} product=${sample.productId ?? ""} contentCount=${sample.observedContentCount}`,
    ),
    `- Missing Context: ${missingContext.length ? "" : "(none)"}`,
    ...missingContext.map(item => `  - ${item.severity} ${item.reason}: ${item.message}`),
  ];
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
