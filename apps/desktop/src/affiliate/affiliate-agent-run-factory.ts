import { GQL } from "@rivonclaw/core";
import type { StaffLanguage } from "../i18n/locale.js";

export interface AffiliateAgentRunFactoryInput {
  workItem: GQL.AffiliateWorkItem;
  platform: string;
  relationshipMessageUpdate?: string;
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
    case "SAMPLE_REVIEW":
      return buildSampleReviewRun(input);
    case "CREATOR_REPLY":
      return buildCreatorReplyRun(input);
    case "CONTENT_FOLLOW_UP":
    case "CREATOR_FOLLOW_UP":
      return buildCreatorFollowUpRun(input);
    default:
      return null;
  }
}

type AffiliateAgentRunKind = "SAMPLE_REVIEW" | "CREATOR_REPLY" | "CONTENT_FOLLOW_UP" | "CREATOR_FOLLOW_UP";

function resolveAgentRunKind(workItem: GQL.AffiliateWorkItem): AffiliateAgentRunKind | null {
  if (
    workItem.workBundleKind === GQL.AffiliateWorkBundleKind.ContentFollowUp ||
    workItem.workKind === GQL.AffiliateWorkKind.ContentFollowUp
  ) {
    return "CONTENT_FOLLOW_UP";
  }

  if (
    workItem.workBundleKind === GQL.AffiliateWorkBundleKind.CreatorFollowUp ||
    workItem.workKind === GQL.AffiliateWorkKind.CreatorFollowUp
  ) {
    return "CREATOR_FOLLOW_UP";
  }

  if (
    workItem.workBundleKind === GQL.AffiliateWorkBundleKind.CreatorReplyWithSampleReview ||
    workItem.workBundleKind === GQL.AffiliateWorkBundleKind.CreatorReplyOnly ||
    workItem.workKind === GQL.AffiliateWorkKind.InboundMessageTriage ||
    workItem.recommendedActionTypes?.includes(GQL.ActionProposalType.SendMessage) ||
    workItem.context?.recommendedActionTypes?.includes(GQL.ActionProposalType.SendMessage)
  ) {
    return "CREATOR_REPLY";
  }

  switch (workItem.requiredAction) {
    case GQL.AffiliateRelationshipRequiredAction.ReplyToCreator:
      return "CREATOR_REPLY";
    case GQL.AffiliateRelationshipRequiredAction.FollowUpCreator:
    case GQL.AffiliateRelationshipRequiredAction.WaitCreatorResponse:
      return "CREATOR_FOLLOW_UP";
    default:
      break;
  }

  if (isSampleReviewWorkItem(workItem)) {
    return "SAMPLE_REVIEW";
  }

  return null;
}

function buildSampleReviewRun(input: AffiliateAgentRunFactoryInput): AffiliateAgentRunRequest {
  const { workItem, platform } = input;
  const sampleId =
    workItem.sampleApplicationRecord?.id ??
    workItem.sampleApplicationRecord?.platformApplicationId ??
    workItem.collaborationRecordId ??
    workItem.creatorRelationshipId;
  return {
    message: [
      "[Affiliate Work Item: Sample Application Review]",
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
      input.relationshipMessageUpdate
        ?? "Checkpoint-bound relationship context was not available. Use affiliate_get_workspace before deciding.",
      "",
      "## Task",
      "Decide how the seller should handle this sample application.",
      "You must complete this work item by calling affiliate_resolve_work_item exactly once.",
      renderResolveWorkItemToolContract(),
      `Set handledSignalAt to ${workItem.versionAt ?? "null"} so backend can ack this exact work boundary.`,
      "Use the CreatorRelationship workspace as the business boundary. The sample application is one business target inside that relationship, not the owner of the work.",
      "Use affiliate prediction and decision thresholds as non-binding evidence only. They may inform the recommendation, but they must not automatically determine approve/reject by themselves.",
      "Base the sample review on the full available context: merchant instructions, relationship history, creator quality/risk, product/campaign facts, sample status, inventory/fulfillment constraints, and prediction evidence.",
      "If the injected snapshot does not contain enough current sample, product, creator, or policy context, call affiliate_get_workspace with creatorRelationshipId before deciding.",
      "If no prediction cache id is already listed below, call affiliate_predict_creator_product_fit with creatorRelationshipId before submitting a REVIEW_SAMPLE_APPLICATION action. Use scenario SAMPLE_REVIEW and include sampleApplicationRecordId/platformApplicationId when available. Use the returned prediction as evidence, and copy its cacheId into action.predictionCacheIds so backend can snapshot the exact evidence used.",
      "If you can form a concrete sample decision, use decision REQUEST_ACTION with action.type REVIEW_SAMPLE_APPLICATION.",
      "If approval policy allows automatic execution, backend may execute it; if approval is required, backend will create an ActionProposal. Either way, the decision still comes from your full-context judgment.",
      "Use NEEDS_STAFF_REVIEW only when the context is ambiguous or incomplete enough that no concrete APPROVE/REJECT action should be proposed.",
      renderPredictionCacheInstruction(input),
      `Use operatorSummary for the merchant/staff-facing rationale, and write it in ${input.staffLanguage ?? "English"}.`,
      "Do not write merchant/operator summaries as final assistant text. After affiliate_resolve_work_item succeeds, your final assistant response must be exactly NO_REPLY.",
    ].join("\n"),
    idempotencyKey: `affiliate:${platform}:work:${workItem.workKind}:${workItem.id}:${sampleId}:${workItem.versionAt}`,
    abortActive: false,
  };
}

function buildCreatorReplyRun(input: AffiliateAgentRunFactoryInput): AffiliateAgentRunRequest {
  const { workItem, platform } = input;
  const currentMessageId =
    workItem.collaboration?.lastCreatorMessageId ??
    workItem.creatorRelationshipId;
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
      input.relationshipMessageUpdate
        ?? "Relationship message update was not available before dispatch. Use affiliate tools conservatively before proposing any outbound message.",
      "",
      "## Task",
      "Decide whether the creator needs a reply now.",
      "You must complete this work item by calling affiliate_resolve_work_item exactly once.",
      renderResolveWorkItemToolContract(),
      `Set handledSignalAt to ${workItem.versionAt ?? "null"} so backend can ack this exact work boundary.`,
      "If the relationship message update includes Candidate Card Hints, treat them as candidate evidence only. Do not treat a product card as confirmed product context unless Backend Work Context already confirms that product through sample, target collaboration, or product context.",
      "When a candidate productId is available and the decision depends on whether this creator/product is worth pursuing, call affiliate_predict_creator_product_fit with creatorRelationshipId before REQUEST_ACTION. Use its product summary, prediction, and decision thresholds as decision evidence.",
      "If you decide to review a sample application and no prediction cache id is already listed below, call affiliate_predict_creator_product_fit with creatorRelationshipId and scenario SAMPLE_REVIEW first and copy the returned cacheId into action.predictionCacheIds.",
      "When a candidate sample/application id is available and the creator is asking about application approval, rejection, shipment, or sample status, call affiliate_get_workspace with creatorRelationshipId plus the sample/application identity before replying.",
      renderCreatorFacingMessageGuidance("reply"),
      "If a sample application is already terminal (for example cancelled, expired, rejected, or fulfilled), do not propose a REVIEW_SAMPLE_APPLICATION action for it. You may still reply to the creator, but the reply must reflect the business decision and current evidence. Do not invite the creator to resubmit the same sample request unless the merchant context clearly supports continuing with that creator/product.",
      "When the terminal sample state is seller/system rejection or cancellation, avoid passive wording such as \"the request is no longer active\" as the main explanation. Tell the creator plainly and politely that after review we are not moving forward with this sample/collaboration at this time, then add any appropriate future-facing note.",
      "When prediction or merchant thresholds look weak, treat that as cautionary evidence rather than an automatic decline. Politely decline only when the full relationship, creator, product, sample, merchant, and channel context supports not proceeding; otherwise ask a clarifying question, defer, or request staff review.",
      "If a reply is needed, use decision REQUEST_ACTION with action.type SEND_MESSAGE.",
      "If the work item is relationship-level or marks collaboration context ambiguous, do not attach sample-review or collaboration-specific action fields unless Backend Work Context resolves a focus collaboration/sample. Prefer a clarifying SEND_MESSAGE or NEEDS_STAFF_REVIEW.",
      "If Backend Work Context recommends multiple actions, use input.actions as an ordered list instead of input.action so the backend can approve or execute the bundle together.",
      "If Work Bundle Kind is CREATOR_REPLY_WITH_SAMPLE_REVIEW, you must handle the sample review and the creator reply in the same REQUEST_ACTION input.actions bundle. Include both REVIEW_SAMPLE_APPLICATION and SEND_MESSAGE unless the sample is already terminal or no creator-facing reply is appropriate.",
      renderPredictionCacheInstruction(input),
      "For every text reply, set action.messageIntent.parts to [{kind: TEXT, text: <final creator-facing reply>}].",
      "If no reply is needed, use decision NO_ACTION_NEEDED.",
      "If a human should decide, use decision NEEDS_STAFF_REVIEW.",
      "If affiliate_resolve_work_item returns a validation/schema error, do not change the business decision to NEEDS_STAFF_REVIEW just to make the tool call pass. Fix the payload shape and retry the same intended decision.",
      `Use operatorSummary for the merchant/staff-facing rationale, and write it in ${input.staffLanguage ?? "English"}. Content in action.messageIntent.parts is creator-facing.`,
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
      input.relationshipMessageUpdate
        ?? "Checkpoint-bound relationship context was not available. Use affiliate_get_workspace before deciding.",
      "",
      "## Task",
      "A creator-side follow-up timer is due, but Affiliate outreach uses a strict one-outbound-turn policy.",
      "Read Provider history and verify that the creator has responded after the latest seller/agent outbound message before considering any new SEND_MESSAGE.",
      "You must complete this work item by calling affiliate_resolve_work_item exactly once.",
      renderResolveWorkItemToolContract(),
      `Set handledSignalAt to ${workItem.versionAt ?? "null"} so backend can ack this exact work boundary.`,
      "If the follow-up depends on a candidate product from a prior creator card and Backend Work Context does not confirm the product, call affiliate_predict_creator_product_fit with creatorRelationshipId before recommending continued investment or asking the creator to proceed.",
      renderCreatorFacingMessageGuidance("follow-up"),
      "If there is no newer creator response, use decision NO_ACTION_NEEDED and leave the relationship waiting; never switch channels to bypass this boundary.",
      "Only if a newer creator response exists and a reply is appropriate may you use decision REQUEST_ACTION with action.type SEND_MESSAGE.",
      renderPredictionCacheInstruction(input),
      "For every text follow-up, set action.messageIntent.parts to [{kind: TEXT, text: <final creator-facing reply>}].",
      "If no follow-up is needed, use decision NO_ACTION_NEEDED.",
      "Do not add raw provider route identifiers to SEND_MESSAGE. Backend delivery resolves the correct channel route from the creator relationship, shop scope, contact state, and action target.",
      `Use operatorSummary for the merchant/staff-facing rationale, and write it in ${input.staffLanguage ?? "English"}.`,
      "Keep creator-facing TEXT parts concise and respectful. Do not threaten or over-pressure the creator.",
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
    "When REVIEW_SAMPLE_APPLICATION fields are provided below, copy sampleApplicationRecordId and platformApplicationId exactly, then choose sampleReviewDecision from the full workspace context.",
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
      "Only omit SEND_MESSAGE if, after reading the creator relationship history, you decide no creator-facing reply is appropriate; explain that omission in operatorSummary.",
      "Only omit REVIEW_SAMPLE_APPLICATION if the sample application is already terminal or cannot be identified after using affiliate_get_workspace with creatorRelationshipId; explain that omission in operatorSummary.",
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
    "Each action must populate the required fields matching action.type: SEND_MESSAGE uses messageIntent.parts; REVIEW_SAMPLE_APPLICATION uses the flat sample review fields; CREATE_TARGET_COLLABORATION uses targetCollaborationIntent.",
    "When an action targets a specific collaboration from Backend Work Context, put collaborationRecordId on that action. The top-level collaborationRecordId is only the current focus fallback; do not rely on it for every action in a bundled relationship proposal.",
    "When an action creates new collaboration context and no existing collaboration/sample target can identify the shop, put shopId on that action as the business shop scope. Do not use provider route ids for shop/channel routing.",
    "An action that only contains { type: ... } is always invalid. Do not call REQUEST_ACTION until every selected action has the required typed payload.",
    "For REVIEW_SAMPLE_APPLICATION, the action shape must be { type: REVIEW_SAMPLE_APPLICATION, predictionCacheIds: [...], sampleApplicationRecordId, platformApplicationId, sampleReviewDecision, rejectReason? }. Use sampleReviewDecision APPROVE or REJECT. Never send sampleReviewIntent: {}.",
    "For SEND_MESSAGE, include type SEND_MESSAGE and messageIntent.parts with 1-10 ordered parts. A text reply is {kind: TEXT, text: ...}; an attachment must use a draftAssetId returned by a staging tool; platform cards use only their typed internal entity id. Omit preferredChannel to inherit the trigger channel. Set it only when the creator explicitly asks to switch. For proactive EMAIL with no existing thread, emailSubject is required. Never add URLs, provider ids, MinIO keys, base64, or raw HTML.",
    "Use affiliate_read_message_attachment only when attachment contents affect the decision. Use affiliate_copy_message_attachment for exact forwarding without model download/re-upload, and affiliate_upload_draft_attachment for a file generated locally by an authorized tool.",
    "PRODUCT_CARD, TARGET_COLLABORATION_CARD, and FREE_SAMPLE_CARD are PLATFORM_CHAT-only. TikTok ATTACHMENT is image-only. Email INLINE is image-only. If a required file cannot be understood, use NEEDS_STAFF_REVIEW.",
    "The backend never falls back across channels. If the selected channel fails, stop after the tool result and output exactly NO_REPLY so staff can review the recorded failure.",
    "Omit optional fields that are unknown or not needed. Never send empty string for Date, ID, or object fields. Only set nextSellerActionAt for decision DEFERRED, and then it must be a valid ISO timestamp.",
  ].join("\n");
}

function renderCreatorFacingMessageGuidance(kind: "reply" | "follow-up"): string {
  const opening =
    kind === "follow-up"
      ? "For creator follow-ups, first verify a newer creator response after the latest outbound turn. Only then use a concise progress-check posture tied to a confirmed milestone."
      : "For creator messages, choose the posture that fits the visible work context: continue a visible conversation, open a new outreach thread, ask a concise clarification, or follow up on a confirmed collaboration milestone.";
  return [
    opening,
    "Write creator-facing text from confirmed workspace facts and the intended business next step. Match tone to the relationship stage: warm introduction for first outreach, helpful clarification for ambiguous context, operational update for sample/status work, and gentle accountability for overdue content.",
    "Write the final creator-facing message as polished, natural language that could be sent without editing. Use the creator's likely language when clear from context; otherwise use concise English.",
    "For sample/content follow-ups, anchor the message in concrete facts such as the product/sample, approval, shipment, delivery, or content-pending milestone shown in the workspace, then ask for the next update or content plan.",
    "If the available context is too thin to write a credible creator-facing message, choose NEEDS_STAFF_REVIEW and summarize exactly what context staff should check.",
    "When context is thin but outreach still helps the business, use a low-risk opening or clarification that advances the relationship and stays anchored to the facts currently available.",
  ].join(" ");
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
    "Use this as merchant preference evidence when merchant instructions do not provide a more specific rule for the current product, campaign, or creator.",
    "Do not convert this threshold into a deterministic approve/reject rule. A low or high forecast should shape your reasoning, not replace full-context BD judgment.",
    "If expectedSalesUnits is below minExpectedSalesUnits, treat that as cautionary evidence and weigh it against relationship history, creator quality, product strategy, campaign goals, inventory/fulfillment facts, and explicit merchant instructions.",
    "If expectedSalesUnits meets or exceeds minExpectedSalesUnits, treat that as supportive evidence for proceeding, still subject to risk tags, product/sample context, inventory/fulfillment facts, and approval policy.",
    "For existing commitments that already require operational follow-up, use the threshold as background context; do not use it as the only reason to ignore an overdue creator follow-up.",
    "This threshold is a decision aid, not creator-facing copy. If you mention it in operatorSummary, explain it plainly as the shop's minimum expected sales, never as a guaranteed sales outcome.",
  ].join("\n");
}

function renderPredictionCacheInstruction(input: AffiliateAgentRunFactoryInput): string {
  const cacheIds = input.predictionCacheIds?.filter(Boolean) ?? [];
  if (cacheIds.length === 0) {
    return [
      "No affiliate prediction cache id was prefilled for this work item.",
      "When a REQUEST_ACTION step needs prediction evidence, call affiliate_predict_creator_product_fit with creatorRelationshipId yourself and include the returned cacheId in action.predictionCacheIds.",
      "This keeps prediction as an agent decision tool rather than a deterministic pre-dispatch rule.",
    ].join(" ");
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
      "REVIEW_SAMPLE_APPLICATION required fields:",
      "- type: REVIEW_SAMPLE_APPLICATION",
      cacheIds.length
        ? `- predictionCacheIds: ${JSON.stringify(cacheIds)}`
        : "- predictionCacheIds: call affiliate_predict_creator_product_fit with creatorRelationshipId first, then include the returned cacheId",
      `- sampleApplicationRecordId: ${sample.id}`,
      `- platformApplicationId: ${sample.platformApplicationId}`,
      "- sampleReviewDecision: choose APPROVE or REJECT from full-context judgment.",
      "- rejectReason: include only when sampleReviewDecision is REJECT.",
      "Do not treat expected-sales evidence, threshold evidence, or this field list as a default decision.",
      "APPROVE example shape:",
      JSON.stringify({
        type: "REVIEW_SAMPLE_APPLICATION",
        ...baseActionFields,
        sampleApplicationRecordId: sample.id,
        platformApplicationId: sample.platformApplicationId,
        sampleReviewDecision: "APPROVE",
      }, null, 2),
      "REJECT example shape:",
      JSON.stringify({
        type: "REVIEW_SAMPLE_APPLICATION",
        ...baseActionFields,
        sampleApplicationRecordId: sample.id,
        platformApplicationId: sample.platformApplicationId,
        sampleReviewDecision: "REJECT",
        rejectReason: "OTHER",
      }, null, 2),
    ].join("\n"));
  }

  if (recommendedActions.includes(GQL.ActionProposalType.SendMessage)) {
    templates.push([
      "SEND_MESSAGE required fields:",
      `- type: SEND_MESSAGE`,
      cacheIds.length ? `- predictionCacheIds: ${JSON.stringify(cacheIds)}` : "- predictionCacheIds: include only when available",
      "- messageIntent.parts: [{kind: TEXT, text: <complete creator-facing reply>}], ready to send verbatim after approval/execution",
      "If full-context judgment supports declining a low-fit sample, the TEXT part may contain a polite final reply such as: \"Hi Maria, thank you for your interest in working with us. After reviewing this sample request, we are not moving forward with this collaboration at this time, but we appreciate your interest and hope there may be a better fit in the future.\"",
      "Do not copy the example unless it exactly fits the current creator, language, and business context; write the current creator's actual message.",
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
    "If you choose REQUEST_ACTION, use these field requirements to form a complete tool payload. Do not copy explanatory text as field values.",
    "Never submit an action with only a type. If you cannot fill the typed payload, use NEEDS_STAFF_REVIEW instead of REQUEST_ACTION.",
    "Never replace concrete sample review fields with null or {}. The backend expects sampleApplicationRecordId, platformApplicationId, and sampleReviewDecision to stay on the REVIEW_SAMPLE_APPLICATION action.",
    "Every SEND_MESSAGE action must contain the actual message for this creator.",
    "When more than one action is relevant, use input.actions as an ordered array and include every concrete action in the same tool call.",
    ...templates,
    recommendedActions.includes(GQL.ActionProposalType.ReviewSampleApplication) &&
      recommendedActions.includes(GQL.ActionProposalType.SendMessage)
      ? [
        "Combined bundle requirement:",
        "- Use decision REQUEST_ACTION.",
        "- Set handledSignalAt to the current work boundary.",
        "- Use input.actions as an ordered array.",
        "- Include one complete REVIEW_SAMPLE_APPLICATION action when the sample is still actionable.",
        "- Include one complete SEND_MESSAGE action when a creator-facing reply is appropriate.",
        "- Keep the sample decision and message consistent with each other and with the full relationship context.",
        "- If the sample should be approved, send an approval/status reply; if it should be rejected, send a polite rejection/future-fit reply; if context is insufficient, use NEEDS_STAFF_REVIEW instead of a partial bundle.",
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

function isSampleReviewWorkItem(workItem: GQL.AffiliateWorkItem): boolean {
  return workItem.workKind === GQL.AffiliateWorkKind.SampleApplicationDecision ||
    (
      workItem.requiredAction === GQL.AffiliateRelationshipRequiredAction.CompleteCollaborationTask &&
      workItem.processReasons?.includes(GQL.AffiliateCollaborationRecordProcessReason.SamplePendingReview) === true
    );
}

function requiresCreatorReplyAction(workItem: GQL.AffiliateWorkItem): boolean {
  return (
    workItem.workBundleKind === GQL.AffiliateWorkBundleKind.CreatorReplyOnly ||
    workItem.workBundleKind === GQL.AffiliateWorkBundleKind.CreatorReplyWithSampleReview ||
    workItem.requiredAction === GQL.AffiliateRelationshipRequiredAction.ReplyToCreator ||
    workItem.processReasons?.includes(GQL.AffiliateCollaborationRecordProcessReason.CreatorMessageNeedsReply) === true
  );
}

export function renderWorkItemProjection(workItem: GQL.AffiliateWorkItem): string {
  const collaboration = workItem.collaboration;
  const relationship = workItem.creatorRelationship ?? workItem.context?.creatorRelation ?? null;
  const activeCollaborationIds =
    relationship?.activeCollaborationRecordIds ??
    workItem.context?.activeCollaborations?.map((item) => item.id) ??
    (workItem.collaborationRecordId ? [workItem.collaborationRecordId] : []);
  const sample = workItem.sampleApplicationRecord;
  const proposal = workItem.latestPendingProposal;
  const actionableDelta = renderActionableDelta(workItem);
  return [
    "## Backend Actionable Delta",
    ...actionableDelta,
    "",
    "## Backend Relationship Work Projection",
    `- Relationship Work Item ID: ${workItem.id}`,
    `- Subject Type: ${workItem.subjectType}`,
    `- Creator Relationship ID: ${workItem.creatorRelationshipId}`,
    `- Work Kind: ${workItem.workKind}`,
    `- Required Action: ${workItem.requiredAction}`,
    `- Work Bundle Kind: ${workItem.workBundleKind ?? ""}`,
    `- Focus Shop ID: ${workItem.focusShopId}`,
    `- Focus Collaboration Context ID: ${workItem.collaborationRecordId ?? "(none)"}`,
    `- Processing Status: ${workItem.processingStatus}`,
    `- Process Reasons: ${(workItem.processReasons ?? []).join(", ") || "(none)"}`,
    `- Agent Dispatch Recommended: ${workItem.agentDispatchRecommended}`,
    `- Staff Review Required: ${workItem.staffReviewRequired}`,
    `- Version At: ${workItem.versionAt}`,
    "",
    "## Creator Relationship",
    `- Workspace Relationship ID: ${workItem.creatorRelationshipId}`,
    `- Open Agenda Items: ${JSON.stringify(relationship?.agendaItems ?? [])}`,
    `- Work Summary: ${JSON.stringify(relationship?.workSummary ?? null)}`,
    `- Last Inbound At: ${relationship?.lastInboundAt ?? collaboration?.lastCreatorMessageAt ?? ""}`,
    `- Last Outbound At: ${relationship?.lastOutboundAt ?? ""}`,
    `- Last Agent Handled At: ${relationship?.lastAgentHandledAt ?? ""}`,
    `- Next Seller Action At: ${relationship?.workSummary?.nextActionAt ?? collaboration?.nextSellerActionAt ?? ""}`,
    `- Active Collaboration IDs: ${activeCollaborationIds.join(", ") || "(none)"}`,
    `- Pending Proposal ID: ${relationship?.pendingActionProposalId ?? ""}`,
    "",
    "## Focus Business Target / Collaboration Context",
    ...(collaboration ? [
      "- This collaboration is context under the CreatorRelationship; it is not the work owner or Agent memory boundary.",
      `- Product ID: ${collaboration.productId ?? ""}`,
      `- Sample Application Record ID: ${collaboration.sampleApplicationRecordId ?? ""}`,
      `- Lifecycle Stage: ${collaboration.lifecycleStage}`,
      `- Last Creator Message At: ${collaboration.lastCreatorMessageAt ?? ""}`,
      `- Last Signal At: ${collaboration.lastSignalAt ?? ""}`,
      `- Work Handled Until: ${collaboration.workHandledUntil ?? ""}`,
      `- Next Seller Action At: ${collaboration.nextSellerActionAt ?? ""}`,
    ] : ["(none: this creator relationship work item has no resolved focus collaboration context)"]),
    "",
    "## Sample Application",
    ...(sample ? [
      `- Sample Record ID: ${sample.id}`,
      `- Platform Application ID: ${sample.platformApplicationId}`,
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
      `- Creator Relationship ID: ${proposal.creatorRelationshipId ?? ""}`,
      `- Focus Collaboration Context ID: ${proposal.collaborationRecordId ?? "(none)"}`,
    ] : ["(none)"]),
  ].join("\n");
}

function renderActionableDelta(workItem: GQL.AffiliateWorkItem): string[] {
  const sources = inferActionableDeltaSources(workItem);
  const boundary = workItemBoundaryAt(workItem) ?? "";
  const nextSellerActionAt = workItem.creatorRelationship?.workSummary?.nextActionAt ?? workItem.collaboration?.nextSellerActionAt ?? "";
  const lines = [
    `- Sources: ${sources.join(", ") || "STATE"}`,
    `- Boundary At: ${boundary}`,
    `- Work Handled Until: ${workItemHandledUntil(workItem) ?? ""}`,
    `- Last Signal At: ${workItem.collaboration?.lastSignalAt ?? workItem.creatorRelationship?.stateUpdatedAt ?? ""}`,
    `- Next Seller Action At: ${nextSellerActionAt}`,
  ];
  if (sources.includes("TEMPORAL")) {
    lines.push(
      "- Temporal Interpretation: no new platform/creator signal is required; the configured creator-side waiting point is due, so decide whether a follow-up message should be proposed now.",
    );
  }
  if (sources.includes("SIGNAL")) {
    lines.push(
      "- Signal Interpretation: upstream platform or creator observations changed the actionable collaboration state since the handled boundary.",
    );
  }
  if (sources.includes("STATE")) {
    lines.push(
      "- State Interpretation: backend state such as pending approval or staff review makes this collaboration actionable.",
    );
  }
  return lines;
}

function workItemBoundaryAt(workItem: GQL.AffiliateWorkItem): string | null {
  return (
    workItem.versionAt ??
    workItem.collaboration?.lastSignalAt ??
    workItem.creatorRelationship?.stateUpdatedAt ??
    workItem.creatorRelationship?.lastInboundAt ??
    null
  );
}

function workItemHandledUntil(workItem: GQL.AffiliateWorkItem): string | null {
  if (workItem.creatorRelationship != null) {
    return workItem.creatorRelationship.lastAgentHandledAt ?? null;
  }
  return workItem.collaboration?.workHandledUntil ?? null;
}

function inferActionableDeltaSources(workItem: GQL.AffiliateWorkItem): Array<"SIGNAL" | "TEMPORAL" | "STATE"> {
  const sources = new Set<"SIGNAL" | "TEMPORAL" | "STATE">();
  const reasons = workItem.processReasons ?? [];
  if (
    workItem.workKind === GQL.AffiliateWorkKind.ContentFollowUp ||
    workItem.workKind === GQL.AffiliateWorkKind.CreatorFollowUp ||
    workItem.requiredAction === GQL.AffiliateRelationshipRequiredAction.FollowUpCreator ||
    workItem.requiredAction === GQL.AffiliateRelationshipRequiredAction.WaitCreatorResponse ||
    reasons.includes(GQL.AffiliateCollaborationRecordProcessReason.SampleContentFollowUpDue) ||
    reasons.includes(GQL.AffiliateCollaborationRecordProcessReason.CreatorActionFollowUpDue)
  ) {
    sources.add("TEMPORAL");
  }
  if (
    workItem.workKind === GQL.AffiliateWorkKind.InboundMessageTriage ||
    workItem.workKind === GQL.AffiliateWorkKind.SampleApplicationDecision ||
    workItem.workKind === GQL.AffiliateWorkKind.SampleShipment ||
    reasons.includes(GQL.AffiliateCollaborationRecordProcessReason.CreatorMessageNeedsReply) ||
    reasons.includes(GQL.AffiliateCollaborationRecordProcessReason.SamplePendingReview) ||
    reasons.includes(GQL.AffiliateCollaborationRecordProcessReason.SampleAwaitingShipment)
  ) {
    sources.add("SIGNAL");
  }
  if (
    workItem.workKind === GQL.AffiliateWorkKind.ApprovalReview ||
    workItem.staffReviewRequired ||
    workItem.latestPendingProposal != null
  ) {
    sources.add("STATE");
  }
  return [...sources];
}

function renderResolvedContext(workItem: GQL.AffiliateWorkItem): string[] {
  const context = workItem.context;
  if (!context) return ["(none)"];
  const creator = context.creatorProfile;
  const relation = context.creatorRelation;
  const product = context.productContext;
  const relatedSamples = context.relatedSampleApplications ?? [];
  const activeCollaborations = context.activeCollaborations ?? [];
  const ambiguousCandidates = context.ambiguousCollaborationCandidates ?? [];
  const missingContext = context.missingContext ?? [];
  const shopStates = relation?.shopStates ?? [];
  return [
    `- Recommended Actions: ${(workItem.recommendedActionTypes ?? context.recommendedActionTypes ?? []).join(", ") || "(none)"}`,
    creator
      ? `- Creator Profile: ${creator.nickname ?? creator.username ?? "resolved"}`
      : "- Creator Profile: (unresolved)",
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
    context.focusCollaboration
      ? `- Focus Collaboration Context: ${context.focusCollaboration.id} product=${context.focusCollaboration.productId ?? ""} lifecycle=${context.focusCollaboration.lifecycleStage}`
      : "- Focus Collaboration Context: (none)",
    `- Active Collaborations: ${activeCollaborations.length}`,
    ...activeCollaborations.map((collaboration, index) =>
      `  ${index + 1}. contextCollaborationRecordId=${collaboration.id} product=${collaboration.productId ?? ""} sample=${collaboration.sampleApplicationRecordId ?? ""} lifecycle=${collaboration.lifecycleStage} status=${collaboration.processingStatus}`,
    ),
    `- Ambiguous Collaboration Candidates: ${ambiguousCandidates.length ? "" : "(none)"}`,
    ...ambiguousCandidates.map((collaboration, index) =>
      `  ${index + 1}. contextCollaborationRecordId=${collaboration.id} product=${collaboration.productId ?? ""} sample=${collaboration.sampleApplicationRecordId ?? ""} lifecycle=${collaboration.lifecycleStage} status=${collaboration.processingStatus}`,
    ),
    ...(ambiguousCandidates.length
      ? [
          "- Ambiguity Instruction: do not assume the creator's message belongs to one collaboration unless platform-chat evidence or workspace facts clearly identify it. Ask a concise clarification question or request staff review when confidence is low.",
        ]
      : []),
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
