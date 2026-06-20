import { GQL } from "@rivonclaw/core";
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

  switch (resolveAgentRunKind(workItem)) {
    case "CREATOR_REPLY":
      return buildCreatorReplyRun(input);
    case "CREATOR_FOLLOW_UP":
      return buildCreatorFollowUpRun(input);
    default:
      return null;
  }
}

type AffiliateAgentRunKind = "CREATOR_REPLY" | "CREATOR_FOLLOW_UP";

function resolveAgentRunKind(workItem: GQL.AffiliateWorkItem): AffiliateAgentRunKind | null {
  if (
    workItem.workBundleKind === GQL.AffiliateWorkBundleKind.CreatorReplyWithSampleReview ||
    workItem.workBundleKind === GQL.AffiliateWorkBundleKind.CreatorReplyOnly ||
    workItem.workKind === GQL.AffiliateWorkKind.CreatorReplyNeeded ||
    workItem.recommendedActionTypes?.includes(GQL.ActionProposalType.SendMessage) ||
    workItem.context?.recommendedActionTypes?.includes(GQL.ActionProposalType.SendMessage)
  ) {
    return "CREATOR_REPLY";
  }

  if (
    workItem.workBundleKind === GQL.AffiliateWorkBundleKind.CreatorFollowUp ||
    workItem.workKind === GQL.AffiliateWorkKind.CreatorFollowUpDue
  ) {
    return "CREATOR_FOLLOW_UP";
  }

  switch (workItem.requiredAction) {
    case GQL.AffiliateCollaborationRequiredAction.RespondToCreator:
      return "CREATOR_REPLY";
    case GQL.AffiliateCollaborationRequiredAction.FollowUpCreator:
      return "CREATOR_FOLLOW_UP";
    default:
      break;
  }

  return null;
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
      renderRequiredActionBundleInstruction(workItem),
      "",
      renderResolveActionPayloadTemplates(input),
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
      `Set handledSignalAt to ${workItem.versionAt ?? "null"} so backend can ack this exact work boundary.`,
      "If the conversation work package includes Candidate Card Hints, treat them as candidate evidence only. Do not treat a product card as confirmed product context unless Backend Work Context already confirms that product through sample, target collaboration, or product context.",
      "When a candidate productId is available and the decision depends on whether this creator/product is worth pursuing, call affiliate_predict_creator_product_fit before REQUEST_ACTION. Use its product summary, prediction, and decision thresholds as decision evidence.",
      "When a candidate sample/application id is available and the creator is asking about application approval, rejection, shipment, or sample status, call affiliate_get_workspace with the sample/application identity before replying.",
      "If a sample application is already terminal (for example cancelled, expired, rejected, or fulfilled), do not propose a REVIEW_SAMPLE_APPLICATION action for it. You may still reply to the creator, but the reply must reflect the business decision and current evidence. Do not invite the creator to resubmit the same sample request unless the merchant context clearly supports continuing with that creator/product.",
      "When the terminal sample state is seller/system rejection or cancellation, avoid passive wording such as \"the request is no longer active\" as the main explanation. Tell the creator plainly and politely that after review we are not moving forward with this sample/collaboration at this time, then add any appropriate future-facing note.",
      "When prediction or merchant thresholds indicate the creator/product is below the shop's bar, a creator-facing reply should politely decline or leave the door open for better future fit; it should not ask the creator to submit the same application again.",
      "If a reply is needed, use decision REQUEST_ACTION with action.type SEND_MESSAGE.",
      "If Backend Work Context recommends multiple actions, use input.actions as an ordered list instead of input.action so the backend can approve or execute the bundle together.",
      "If Work Bundle Kind is CREATOR_REPLY_WITH_SAMPLE_REVIEW, you must handle the sample review and the creator reply in the same REQUEST_ACTION input.actions bundle. Include both REVIEW_SAMPLE_APPLICATION and SEND_MESSAGE unless the sample is already terminal or no creator-facing reply is appropriate.",
      renderPredictionCacheInstruction(input),
      "For every text reply, set action.messageText to the exact creator-facing message. Backend will normalize it into a typed SEND_MESSAGE intent.",
      "If no reply is needed, use decision NO_ACTION_NEEDED.",
      "If a human should decide, use decision NEEDS_STAFF_REVIEW.",
      "If affiliate_resolve_work_item returns a validation/schema error, do not change the business decision to NEEDS_STAFF_REVIEW just to make the tool call pass. Fix the payload shape and retry the same intended decision.",
      `Use operatorSummary for the merchant/staff-facing rationale, and write it in ${input.staffLanguage ?? "English"}. The text you write in action.messageText is the creator-facing message.`,
      "Do not write merchant/operator summaries as final assistant text. After affiliate_resolve_work_item succeeds, your final assistant response must be exactly NO_REPLY.",
      "If approval is required, stop after the backend creates the ActionProposal and reply exactly NO_REPLY.",
    ].join("\n"),
    idempotencyKey: `affiliate:${platform}:work:${workItem.workKind}:${workItem.id}:${currentMessageId}:${workItem.versionAt}`,
    abortActive: false,
  };
}

function buildCreatorFollowUpRun(input: AffiliateAgentRunFactoryInput): AffiliateAgentRunRequest {
  const { workItem, platform } = input;
  return {
    message: [
      "[Affiliate Work Item: Creator Follow-Up Due]",
      "",
      renderWorkItemProjection(workItem),
      "",
      renderResolveActionPayloadTemplates(input),
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
      "The creator appears to be past a configured creator-side follow-up point. This may be after a target invitation, sample delivery, content-pending state, or another creator-turn workflow.",
      "Decide whether to send a gentle creator follow-up now.",
      "You must complete this work item by calling affiliate_resolve_work_item exactly once.",
      renderResolveWorkItemToolContract(),
      `Set handledSignalAt to ${workItem.versionAt ?? "null"} so backend can ack this exact work boundary.`,
      "If the follow-up depends on a candidate product from a prior creator card and Backend Work Context does not confirm the product, call affiliate_predict_creator_product_fit before recommending continued investment or asking the creator to proceed.",
      "If a follow-up is appropriate, use decision REQUEST_ACTION with action.type SEND_MESSAGE.",
      renderPredictionCacheInstruction(input),
      "For every text follow-up, set action.messageText to the exact creator-facing message. Backend will normalize it into a typed SEND_MESSAGE intent.",
      "If no follow-up is needed, use decision NO_ACTION_NEEDED.",
      "If Platform Conversation ID is empty, this is a proactive follow-up: omit conversationId and the backend will create or reuse the TikTok affiliate conversation from creator identity only after approval/execution.",
      `Use operatorSummary for the merchant/staff-facing rationale, and write it in ${input.staffLanguage ?? "English"}.`,
      "Keep action.messageText creator-facing, concise, and respectful. Do not threaten or over-pressure the creator.",
      "If the context is incomplete, use decision NEEDS_STAFF_REVIEW.",
      "If affiliate_resolve_work_item returns a validation/schema error, do not change the business decision to NEEDS_STAFF_REVIEW just to make the tool call pass. Fix the payload shape and retry the same intended decision.",
      "Do not write merchant/operator summaries as final assistant text. After affiliate_resolve_work_item succeeds, your final assistant response must be exactly NO_REPLY.",
    ].join("\n"),
    idempotencyKey: `affiliate:${platform}:work:${workItem.workKind}:${workItem.id}:${workItem.versionAt}`,
  };
}

function renderPredictionSection(input: AffiliateAgentRunFactoryInput): string {
  return input.predictionSection?.trim() || "## Affiliate Prediction\n(none resolved before dispatch)";
}

function renderRequiredActionBundleInstruction(workItem: GQL.AffiliateWorkItem): string {
  const recommendedActions = recommendedActionTypesForWorkItem(workItem);
  if (recommendedActions.length === 0) {
    return [
      "## Required Action Bundle",
      "(none recommended by backend)",
    ].join("\n");
  }

  const lines = [
    "## Required Action Bundle",
    `Backend recommends handling these platform action types together: ${recommendedActions.join(", ")}.`,
    "If you choose REQUEST_ACTION, your input.actions array must include every recommended action type that is still applicable after checking current workspace facts.",
    "Do not submit a partial action bundle just because one action is easier to fill.",
    "Never submit an action with an empty typed intent object such as sampleReviewIntent: {} or messageIntent: {}.",
    "When a concrete REVIEW_SAMPLE_APPLICATION template is provided below, copy its sampleReviewIntent object exactly and only change decision/rejectReason when your judgment requires it.",
  ];

  if (
    workItem.workBundleKind === GQL.AffiliateWorkBundleKind.CreatorReplyWithSampleReview ||
    (
      recommendedActions.includes(GQL.ActionProposalType.ReviewSampleApplication) &&
      recommendedActions.includes(GQL.ActionProposalType.SendMessage)
    )
  ) {
    lines.push(
      "This is a combined sample-review + creator-reply work item. A normal REQUEST_ACTION should include both REVIEW_SAMPLE_APPLICATION and SEND_MESSAGE in one input.actions array so staff approves or rejects the complete business response together.",
      "Only omit SEND_MESSAGE if, after reading the conversation, you decide no creator-facing reply is appropriate; explain that omission in operatorSummary.",
      "Only omit REVIEW_SAMPLE_APPLICATION if the sample application is already terminal or cannot be identified after using affiliate_get_workspace; explain that omission in operatorSummary.",
    );
  }

  return lines.join("\n");
}

function renderResolveWorkItemToolContract(): string {
  return [
    "## affiliate_resolve_work_item Tool Contract",
    "Call this tool exactly once. The only platform action.type values supported by backend are SEND_MESSAGE, REVIEW_SAMPLE_APPLICATION, and CREATE_TARGET_COLLABORATION.",
    "Important: REQUEST_ACTION does not mean the action will be sent immediately. Backend approval policy may convert REQUEST_ACTION into an ActionProposal for merchant approval. Therefore, use REQUEST_ACTION whenever you can form a concrete platform action, even if a human must approve it before execution.",
    "Use NEEDS_STAFF_REVIEW only when you cannot form a concrete platform action at all. Do not use NEEDS_STAFF_REVIEW merely to ask for approval of a concrete action.",
    "Do not use NEEDS_STAFF_REVIEW to recover from a tool schema error. If the backend/proxy says an action payload is invalid, retry REQUEST_ACTION with the corrected typed intent.",
    "Do not use CHANGE_COMMISSION, CHANGE_RATE, DISCOUNT, TAG_CREATOR, BLOCK_CREATOR, SHIP_SAMPLE, or any other action type. If the seller needs an unsupported action, use decision NEEDS_STAFF_REVIEW and explain it in operatorSummary.",
    "When decision is REQUEST_ACTION, provide either input.action for one action or input.actions for an ordered bundle; do not provide both.",
    "Each action must populate exactly one intent field matching action.type: SEND_MESSAGE uses the typed messageText shortcut; REVIEW_SAMPLE_APPLICATION uses sampleReviewIntent; CREATE_TARGET_COLLABORATION uses targetCollaborationIntent.",
    "An action that only contains { type: ... } is always invalid. Do not call REQUEST_ACTION until every selected action has the required typed payload.",
    "For REVIEW_SAMPLE_APPLICATION, the action shape must be { type: REVIEW_SAMPLE_APPLICATION, predictionCacheIds: [...], sampleReviewIntent: { sampleApplicationRecordId, platformApplicationId, decision, rejectReason? } }. Never put sampleApplicationRecordId, platformApplicationId, decision, or rejectReason at the action top level.",
    "For SEND_MESSAGE, the action shape must be exactly like this minimal payload: { type: SEND_MESSAGE, predictionCacheIds: [...], messageText: \"exact creator-facing message\" }. Add conversationId, creatorId, or productId at the action top level only when known. Never send messageIntent: {}.",
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
  const minExpectedSalesUnits = thresholds?.minExpectedSalesUnits;
  if (typeof minExpectedSalesUnits !== "number") {
    return [
      "## Affiliate Decision Thresholds",
      "(none configured)",
      "No default numeric sales threshold is configured for this shop or campaign. Do not invent one. Use merchant instructions, predicted sales units, and concrete workspace facts to decide.",
    ].join("\n");
  }

  return [
    "## Affiliate Decision Thresholds",
    `- Source: ${source ?? "configured threshold"}`,
    `- minExpectedSalesUnits: ${minExpectedSalesUnits}`,
    "Use this as the default investment/continuation threshold when merchant instructions do not provide a more specific rule for the current product, campaign, or creator.",
    "If expectedSalesUnits is below minExpectedSalesUnits, do not approve, invest in, or continue the collaboration by default unless stronger merchant instructions or workspace facts justify an exception.",
    "If expectedSalesUnits meets or exceeds minExpectedSalesUnits, that supports proceeding, subject to risk tags, product/sample context, inventory/fulfillment facts, and approval policy.",
    "For existing commitments that already require operational follow-up, use the threshold as background context; do not use it as the only reason to ignore an overdue creator follow-up.",
    "This threshold is a decision aid, not creator-facing copy. If you mention it in operatorSummary, explain it plainly as the shop's minimum expected sales, never as a guaranteed sales outcome.",
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

function renderResolveActionPayloadTemplates(input: AffiliateAgentRunFactoryInput): string {
  const { workItem } = input;
  const recommendedActions = recommendedActionTypesForWorkItem(workItem);
  const sample = workItem.sampleApplicationRecord;
  const cacheIds = input.predictionCacheIds?.filter(Boolean) ?? [];
  const baseActionFields = cacheIds.length ? { predictionCacheIds: cacheIds } : {};
  const templates: string[] = [];

  if (recommendedActions.includes(GQL.ActionProposalType.ReviewSampleApplication) && sample) {
    templates.push([
      "REVIEW_SAMPLE_APPLICATION action template:",
      JSON.stringify({
        type: "REVIEW_SAMPLE_APPLICATION",
        ...baseActionFields,
        sampleReviewIntent: {
          sampleApplicationRecordId: sample.id,
          platformApplicationId: sample.platformApplicationId,
          decision: "REJECT",
          rejectReason: "plain merchant-facing reason for rejection",
        },
      }, null, 2),
      "Use decision APPROVE only when the workspace facts and merchant instructions support approving this sample request.",
    ].join("\n"));
  }

  if (recommendedActions.includes(GQL.ActionProposalType.SendMessage)) {
    templates.push([
      "SEND_MESSAGE action template:",
      JSON.stringify({
        type: "SEND_MESSAGE",
        ...baseActionFields,
        messageText: "exact creator-facing message to send",
      }, null, 2),
    ].join("\n"));
  }

  if (templates.length === 0) {
    return [
      "## Valid REQUEST_ACTION Payload Templates",
      "(none: no typed platform action is currently recommended by backend)",
    ].join("\n");
  }

  return [
    "## Valid REQUEST_ACTION Payload Templates",
    "If you choose REQUEST_ACTION, copy these shapes exactly and replace only the decision/reason/message values that require judgment.",
    "Never submit an action with only a type. If you cannot fill the typed payload, use NEEDS_STAFF_REVIEW instead of REQUEST_ACTION.",
    "Never replace a concrete sampleReviewIntent template with null or {}. The backend expects sampleApplicationRecordId and platformApplicationId to stay inside sampleReviewIntent.",
    "When more than one action is relevant, use input.actions as an ordered array and include every concrete action in the same tool call.",
    ...templates,
    recommendedActions.includes(GQL.ActionProposalType.ReviewSampleApplication) &&
      recommendedActions.includes(GQL.ActionProposalType.SendMessage)
      ? [
        "Combined bundle example:",
        JSON.stringify({
          decision: "REQUEST_ACTION",
          handledSignalAt: workItem.versionAt,
          actions: [
            sample ? {
              type: "REVIEW_SAMPLE_APPLICATION",
              ...baseActionFields,
              sampleReviewIntent: {
                sampleApplicationRecordId: sample.id,
                platformApplicationId: sample.platformApplicationId,
                decision: "REJECT",
                rejectReason: "plain merchant-facing reason for rejection",
              },
            } : {
              type: "REVIEW_SAMPLE_APPLICATION",
              ...baseActionFields,
              sampleReviewIntent: {
                sampleApplicationRecordId: "sampleApplicationRecordId from Backend Work Projection",
                platformApplicationId: "platformApplicationId from Backend Work Projection",
                decision: "REJECT",
                rejectReason: "plain merchant-facing reason for rejection",
              },
            },
            {
              type: "SEND_MESSAGE",
              ...baseActionFields,
              messageText: "exact creator-facing message to send",
            },
          ],
          operatorSummary: "staff-facing rationale in the requested staff language",
        }, null, 2),
      ].join("\n")
      : "",
  ].filter(Boolean).join("\n\n");
}

function recommendedActionTypesForWorkItem(workItem: GQL.AffiliateWorkItem): GQL.ActionProposalType[] {
  const actionTypes = new Set<GQL.ActionProposalType>(
    workItem.recommendedActionTypes ?? workItem.context?.recommendedActionTypes ?? [],
  );
  if (requiresCreatorReplyAction(workItem)) {
    actionTypes.add(GQL.ActionProposalType.SendMessage);
  }
  if (
    workItem.workBundleKind === GQL.AffiliateWorkBundleKind.CreatorReplyWithSampleReview ||
    workItem.processReasons?.includes(GQL.AffiliateCollaborationRecordProcessReason.SamplePendingReview)
  ) {
    actionTypes.add(GQL.ActionProposalType.ReviewSampleApplication);
  }
  return [...actionTypes];
}

function requiresCreatorReplyAction(workItem: GQL.AffiliateWorkItem): boolean {
  return (
    workItem.workBundleKind === GQL.AffiliateWorkBundleKind.CreatorReplyOnly ||
    workItem.workBundleKind === GQL.AffiliateWorkBundleKind.CreatorReplyWithSampleReview ||
    workItem.requiredAction === GQL.AffiliateCollaborationRequiredAction.RespondToCreator ||
    workItem.processReasons?.includes(GQL.AffiliateCollaborationRecordProcessReason.CreatorMessageNeedsReply) === true
  );
}

export function renderWorkItemProjection(workItem: GQL.AffiliateWorkItem): string {
  const collaboration = workItem.collaboration;
  const sample = workItem.sampleApplicationRecord;
  const proposal = workItem.latestPendingProposal;
  return [
    "## Backend Work Projection",
    `- Work Item ID: ${workItem.id}`,
    `- Work Kind: ${workItem.workKind}`,
    `- Required Action: ${workItem.requiredAction}`,
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
  const relation = context.creatorRelation;
  const product = context.productContext;
  const relatedSamples = context.relatedSampleApplications ?? [];
  const missingContext = context.missingContext ?? [];
  const shopStates = relation?.shopStates ?? [];
  return [
    `- Recommended Actions: ${(workItem.recommendedActionTypes ?? context.recommendedActionTypes ?? []).join(", ") || "(none)"}`,
    creator
      ? `- Creator: ${creator.nickname ?? creator.username ?? creator.creatorOpenId ?? creator.creatorImId ?? creator.id} (id=${creator.id}, openId=${creator.creatorOpenId ?? ""}, imId=${creator.creatorImId ?? ""})`
      : "- Creator: (unresolved)",
    relation
      ? `- Creator Relation: blocked=${relation.blocked} blockedShopIds=${relation.blockedShopIds.join(", ") || "(none)"}`
      : "- Creator Relation: (none)",
    `- Creator Relation Shop Tags: ${shopStates.length ? "" : "(none)"}`,
    ...shopStates.map((state) =>
      `  - shopId=${state.shopId} lifecycleStage=${state.lifecycleStage} tagIds=${state.tagIds.join(", ") || "(none)"}`,
    ),
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
