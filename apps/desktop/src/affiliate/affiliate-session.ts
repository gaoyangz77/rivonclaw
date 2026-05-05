import { createLogger } from "@rivonclaw/logger";
import {
  ScopeType,
  type AffiliateNewMessageFrame,
  type AffiliateOrderAttributedFrame,
  type AffiliateSampleApplicationUpdatedFrame,
  type AffiliateTargetCollaborationUpdatedFrame,
} from "@rivonclaw/core";
import { openClawConnector } from "../openclaw/index.js";
import { rootStore } from "../app/store/desktop-store.js";
import { normalizePlatform } from "../utils/platform.js";

const log = createLogger("affiliate-session");

export const DEFAULT_AFFILIATE_RUN_PROFILE_ID = "AFFILIATE_OPERATOR";

export interface AffiliateShopContext {
  /** MongoDB ObjectId used by backend affiliate tools. */
  objectId: string;
  /** Platform shop ID from TikTok webhook shop_id. */
  platformShopId: string;
  shopName: string;
  platform?: string;
  /** RunProfile ID for affiliate sessions. Defaults to AFFILIATE_OPERATOR. */
  runProfileId?: string;
}

export interface AffiliateContext {
  shopId: string;
  platformShopId: string;
  triggerKind: AffiliateTriggerKind;
  triggerId: string;
  conversationId?: string;
  creatorImUserId?: string;
  creatorId?: string | null;
  productId?: string | null;
  sampleApplicationId?: string;
  collaborationId?: string;
  orderId?: string | null;
}

export interface AffiliateDispatchResult {
  runId?: string;
}

export enum AffiliateTriggerKind {
  CREATOR_MESSAGE = "CREATOR_MESSAGE",
  SAMPLE_APPLICATION = "SAMPLE_APPLICATION",
  TARGET_COLLABORATION = "TARGET_COLLABORATION",
  ORDER_ATTRIBUTION = "ORDER_ATTRIBUTION",
}

export class AffiliateSession {
  readonly platform: string;
  readonly scopeKey: string;

  private gatewaySetupReady = false;
  private activeRunId: string | null = null;

  constructor(
    private readonly shop: AffiliateShopContext,
    readonly affiliateContext: AffiliateContext,
  ) {
    this.platform = shop.platform ?? normalizePlatform("TIKTOK_SHOP");
    this.scopeKey = AffiliateSession.buildScopeKey(this.platform, affiliateContext);
  }

  static buildScopeKey(platform: string, context: AffiliateContext): string {
    if (context.triggerKind === AffiliateTriggerKind.CREATOR_MESSAGE && context.conversationId) {
      return `agent:main:affiliate:${platform}:${context.conversationId}`;
    }
    return `agent:main:affiliate:${platform}:${context.triggerKind.toLowerCase()}:${context.triggerId}`;
  }

  get extraSystemPrompt(): string {
    return [
      "## Affiliate / Creator Management Agent",
      "",
      "You are operating an affiliate creator-management workflow for a TikTok Shop seller.",
      "This is not a customer-service conversation. Do not assume your assistant text is sent to the creator.",
      "",
      "## Operating Model",
      "- Use backend affiliate tools as the source of truth for campaigns, creator lifecycle state, tags, approval policies, and action execution.",
      "- If you need to message a creator, approve or reject a sample, create a target collaboration, block a creator, or update campaign setup, use affiliate_request_action.",
      "- If affiliate_request_action returns a proposal requiring approval, stop and summarize the proposal for the merchant; do not try to bypass approval.",
      "- If the merchant explicitly approves or rejects a pending proposal in the current conversation, use affiliate_decide_proposal.",
      "- Do not rely on memory for creator history or policy. Ask tools for state when needed.",
      "",
      "## Workflow Discipline",
      "- On every trigger, first establish the shop/campaign/creator/thread facts with affiliate_get_workspace unless the incoming event already gives enough typed context for a single safe action.",
      "- Treat creator messages as continuation work: understand the request, check relevant campaign/collaboration/sample state, then use affiliate_request_action for any outbound message or platform mutation.",
      "- Treat sample application events as triage work: inspect creator value, product/sample policy, stock/fulfillment facts exposed by tools, then approve/reject/request human approval through affiliate_request_action.",
      "- Treat collaboration events as lifecycle work: reconcile local state, decide whether follow-up is needed, and avoid duplicate outreach.",
      "- Treat attributed order events as evidence for relation health/ROI; do not message the creator unless there is a clear business reason.",
      "- Keep your merchant-facing summary short: current fact, recommended/attempted action, proposal id if approval is required.",
      "",
      "## Current Affiliate Context",
      `- Shop ID: ${this.affiliateContext.shopId}`,
      `- Platform Shop ID: ${this.affiliateContext.platformShopId}`,
      `- Shop Name: ${this.shop.shopName}`,
      `- Trigger Kind: ${this.affiliateContext.triggerKind}`,
      `- Trigger ID: ${this.affiliateContext.triggerId}`,
      ...(this.affiliateContext.conversationId ? [`- Conversation ID: ${this.affiliateContext.conversationId}`] : []),
      ...(this.affiliateContext.creatorImUserId ? [`- Creator IM User ID: ${this.affiliateContext.creatorImUserId}`] : []),
      ...(this.affiliateContext.creatorId ? [`- Creator ID: ${this.affiliateContext.creatorId}`] : []),
      ...(this.affiliateContext.productId ? [`- Product ID: ${this.affiliateContext.productId}`] : []),
      ...(this.affiliateContext.sampleApplicationId ? [`- Sample Application ID: ${this.affiliateContext.sampleApplicationId}`] : []),
      ...(this.affiliateContext.collaborationId ? [`- Collaboration ID: ${this.affiliateContext.collaborationId}`] : []),
      ...(this.affiliateContext.orderId ? [`- Order ID: ${this.affiliateContext.orderId}`] : []),
    ].join("\n");
  }

  async handleCreatorMessage(frame: AffiliateNewMessageFrame): Promise<AffiliateDispatchResult> {
    const content = this.parseMessageContent(frame);
    const message = [
      "[Incoming Creator Message]",
      `Message ID: ${frame.messageId}`,
      `Sender Role: ${frame.senderRole}`,
      `Message Type: ${frame.messageType}`,
      "",
      content,
    ].join("\n");

    const result = await this.dispatch({
      message,
      idempotencyKey: `affiliate:${this.platform}:${frame.messageId}`,
    });
    return result;
  }

  onRunCompleted(runId: string): void {
    if (this.activeRunId === runId) {
      this.activeRunId = null;
    }
  }

  private async setup(): Promise<void> {
    if (this.gatewaySetupReady) return;

    const runProfileId = this.shop.runProfileId ?? DEFAULT_AFFILIATE_RUN_PROFILE_ID;
    rootStore.toolCapability.setSessionRunProfile(this.scopeKey, runProfileId);

    await rootStore.llmManager.applyModelForSession(this.scopeKey, {
      type: ScopeType.AFFILIATE_SESSION,
      shopId: this.shop.objectId,
    });

    this.gatewaySetupReady = true;
  }

  private async dispatch(params: {
    message: string;
    idempotencyKey: string;
  }): Promise<AffiliateDispatchResult> {
    this.abortActiveRun();
    await this.setup();
    const response = await openClawConnector.request<AffiliateDispatchResult>("agent", {
      sessionKey: this.scopeKey,
      message: params.message,
      extraSystemPrompt: this.extraSystemPrompt,
      promptMode: "raw",
      idempotencyKey: params.idempotencyKey,
    });

    if (response?.runId) {
      this.activeRunId = response.runId;
      log.info(`Affiliate agent run dispatched: runId=${response.runId} scope=${this.scopeKey}`);
    } else {
      this.activeRunId = null;
    }
    return { runId: response?.runId };
  }

  private abortActiveRun(): void {
    const previousRunId = this.activeRunId;
    if (!previousRunId) return;
    void openClawConnector.request("chat.abort", { sessionKey: this.scopeKey })
      .catch((err: unknown) => log.warn(`Failed to abort affiliate run ${previousRunId}: ${String(err)}`));
  }

  async handleSampleApplicationUpdated(frame: AffiliateSampleApplicationUpdatedFrame): Promise<AffiliateDispatchResult> {
    return this.dispatch({
      message: [
        "[Affiliate Sample Application Updated]",
        `Application ID: ${frame.applicationId}`,
        `Creator ID: ${frame.creatorId ?? ""}`,
        `Product ID: ${frame.productId ?? ""}`,
        `Status: ${frame.status}`,
        `Event Time: ${frame.eventTime}`,
      ].join("\n"),
      idempotencyKey: `affiliate:${this.platform}:sample:${frame.applicationId}:${frame.status}:${frame.eventTime}`,
    });
  }

  async handleTargetCollaborationUpdated(frame: AffiliateTargetCollaborationUpdatedFrame): Promise<AffiliateDispatchResult> {
    return this.dispatch({
      message: [
        "[Affiliate Target Collaboration Updated]",
        `Collaboration ID: ${frame.collaborationId}`,
        `Creator ID: ${frame.creatorId ?? ""}`,
        `Product ID: ${frame.productId ?? ""}`,
        `Status: ${frame.status}`,
        `Event Time: ${frame.eventTime}`,
      ].join("\n"),
      idempotencyKey: `affiliate:${this.platform}:target-collab:${frame.collaborationId}:${frame.status}:${frame.eventTime}`,
    });
  }

  async handleOrderAttributed(frame: AffiliateOrderAttributedFrame): Promise<AffiliateDispatchResult> {
    return this.dispatch({
      message: [
        "[Affiliate Order Attributed]",
        `Order ID: ${frame.orderId}`,
        `Creator ID: ${frame.creatorId ?? ""}`,
        `Product ID: ${frame.productId ?? ""}`,
        `Event Time: ${frame.eventTime}`,
      ].join("\n"),
      idempotencyKey: `affiliate:${this.platform}:order-attributed:${frame.orderId}:${frame.eventTime}`,
    });
  }

  private parseMessageContent(frame: AffiliateNewMessageFrame): string {
    if (frame.messageType.toUpperCase() === "TEXT") {
      try {
        const parsed = JSON.parse(frame.content) as Record<string, unknown>;
        if (typeof parsed.content === "string") return parsed.content;
        if (typeof parsed.text === "string") return parsed.text;
      } catch {
        // Not JSON — use raw content.
      }
      return frame.content;
    }
    return `[${frame.messageType}] ${frame.content}`;
  }
}
