import { createLogger } from "@rivonclaw/logger";
import type { GatewayEventFrame } from "@rivonclaw/gateway";
import {
  type AffiliateNewConversationFrame,
  type AffiliateNewMessageFrame,
  type AffiliateOrderAttributedFrame,
  type AffiliateSampleApplicationUpdatedFrame,
  type AffiliateTargetCollaborationUpdatedFrame,
  type EcommerceRelayFrame,
} from "@rivonclaw/core";
import {
  AffiliateSession,
  AffiliateTriggerKind,
  DEFAULT_AFFILIATE_RUN_PROFILE_ID,
  type AffiliateContext,
  type AffiliateShopContext,
} from "./affiliate-session.js";
import { normalizePlatform } from "../utils/platform.js";

const log = createLogger("affiliate-inbound");

export interface AffiliateShopSource {
  id: string;
  platform?: string | null;
  platformShopId?: string | null;
  shopName?: string | null;
}

export class AffiliateInbound {
  /** Affiliate shop context keyed by platformShopId from relay frames. */
  private shopContexts = new Map<string, AffiliateShopContext>();

  /** Long-lived affiliate sessions keyed by affiliate scope key. */
  private sessions = new Map<string, AffiliateSession>();

  /** Agent run id -> affiliate session key, used only for run lifecycle cleanup. */
  private runIndex = new Map<string, string>();

  syncFromShops(shops: Iterable<AffiliateShopSource>): Set<string> {
    const activeShopIds = new Set<string>();

    for (const shop of shops) {
      const platformShopId = shop.platformShopId ?? "";
      if (!platformShopId) continue;

      activeShopIds.add(platformShopId);
      const ctx: AffiliateShopContext = {
        objectId: shop.id,
        platformShopId,
        shopName: shop.shopName ?? platformShopId,
        platform: normalizePlatform(shop.platform ?? "TIKTOK_SHOP"),
        runProfileId: DEFAULT_AFFILIATE_RUN_PROFILE_ID,
      };

      const existing = this.shopContexts.get(platformShopId);
      if (!existing || !this.shopContextEqual(existing, ctx)) {
        this.shopContexts.set(platformShopId, ctx);
        log.info(`Affiliate shop context set: platform=${platformShopId} object=${shop.id}`);
      }
    }

    for (const [platformShopId] of this.shopContexts) {
      if (!activeShopIds.has(platformShopId)) {
        log.info(`Affiliate shop ${platformShopId} no longer active in cache, removing context`);
        this.removeShopContext(platformShopId);
      }
    }

    return activeShopIds;
  }

  removeShopContext(platformShopId: string): void {
    this.shopContexts.delete(platformShopId);
  }

  hasShopContext(platformShopId: string): boolean {
    return this.shopContexts.has(platformShopId);
  }

  getShopContext(platformShopId: string): AffiliateShopContext | undefined {
    return this.shopContexts.get(platformShopId);
  }

  handleGatewayEvent(evt: GatewayEventFrame): void {
    const payload = evt.payload as { runId?: string; state?: string } | undefined;
    if (!payload?.runId) return;
    if (payload.state !== "final" && payload.state !== "error") return;

    const sessionKey = this.runIndex.get(payload.runId);
    if (!sessionKey) return;

    this.sessions.get(sessionKey)?.onRunCompleted(payload.runId);
    this.runIndex.delete(payload.runId);
  }

  async handleFrame(frame: EcommerceRelayFrame): Promise<boolean> {
    switch (frame.type) {
      case "affiliate_tiktok_new_message":
        await this.onNewMessage(frame as AffiliateNewMessageFrame);
        return true;
      case "affiliate_tiktok_new_conversation":
        this.onNewConversation(frame as AffiliateNewConversationFrame);
        return true;
      case "affiliate_tiktok_sample_application_updated":
        await this.onSampleApplicationUpdated(frame as AffiliateSampleApplicationUpdatedFrame);
        return true;
      case "affiliate_tiktok_target_collaboration_updated":
        await this.onTargetCollaborationUpdated(frame as AffiliateTargetCollaborationUpdatedFrame);
        return true;
      case "affiliate_tiktok_order_attributed":
        await this.onOrderAttributed(frame as AffiliateOrderAttributedFrame);
        return true;
      default:
        return false;
    }
  }

  private onNewConversation(frame: AffiliateNewConversationFrame): void {
    log.info(`New affiliate conversation: shop=${frame.shopId} conv=${frame.conversationId}`);
  }

  private async onNewMessage(frame: AffiliateNewMessageFrame): Promise<void> {
    log.info(`Incoming affiliate message: shop=${frame.shopId} conv=${frame.conversationId} msg=${frame.messageId} sender=${frame.senderRole}`);

    const shop = this.shopContexts.get(frame.shopId);
    if (!shop) {
      log.error(`No affiliate shop context for platform shopId ${frame.shopId}, dropping message`);
      return;
    }

    const session = this.getOrCreateSession(shop, {
      shopId: shop.objectId,
      platformShopId: shop.platformShopId,
      triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
      triggerId: frame.conversationId,
      conversationId: frame.conversationId,
      creatorImUserId: frame.imUserId,
      orderId: frame.orderId,
    });

    try {
      const result = await session.handleCreatorMessage(frame);
      if (result.runId) this.runIndex.set(result.runId, session.scopeKey);
    } catch (err) {
      log.error(`Failed to handle affiliate message ${frame.messageId}:`, err);
    }
  }

  private async onSampleApplicationUpdated(frame: AffiliateSampleApplicationUpdatedFrame): Promise<void> {
    log.info(`Affiliate sample application event: shop=${frame.shopId} application=${frame.applicationId} status=${frame.status}`);

    const shop = this.shopContexts.get(frame.shopId);
    if (!shop) {
      log.error(`No affiliate shop context for platform shopId ${frame.shopId}, dropping sample event`);
      return;
    }

    const session = this.getOrCreateSession(shop, {
      shopId: shop.objectId,
      platformShopId: shop.platformShopId,
      triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
      triggerId: frame.applicationId,
      sampleApplicationId: frame.applicationId,
      creatorId: frame.creatorId,
      productId: frame.productId,
    });

    try {
      const result = await session.handleSampleApplicationUpdated(frame);
      if (result.runId) this.runIndex.set(result.runId, session.scopeKey);
    } catch (err) {
      log.error(`Failed to handle affiliate sample application event ${frame.applicationId}:`, err);
    }
  }

  private async onTargetCollaborationUpdated(frame: AffiliateTargetCollaborationUpdatedFrame): Promise<void> {
    log.info(`Affiliate target collaboration event: shop=${frame.shopId} collaboration=${frame.collaborationId} status=${frame.status}`);

    const shop = this.shopContexts.get(frame.shopId);
    if (!shop) {
      log.error(`No affiliate shop context for platform shopId ${frame.shopId}, dropping target collaboration event`);
      return;
    }

    const session = this.getOrCreateSession(shop, {
      shopId: shop.objectId,
      platformShopId: shop.platformShopId,
      triggerKind: AffiliateTriggerKind.TARGET_COLLABORATION,
      triggerId: frame.collaborationId,
      collaborationId: frame.collaborationId,
      creatorId: frame.creatorId,
      productId: frame.productId,
    });

    try {
      const result = await session.handleTargetCollaborationUpdated(frame);
      if (result.runId) this.runIndex.set(result.runId, session.scopeKey);
    } catch (err) {
      log.error(`Failed to handle affiliate target collaboration event ${frame.collaborationId}:`, err);
    }
  }

  private async onOrderAttributed(frame: AffiliateOrderAttributedFrame): Promise<void> {
    log.info(`Affiliate order attribution event: shop=${frame.shopId} order=${frame.orderId}`);

    const shop = this.shopContexts.get(frame.shopId);
    if (!shop) {
      log.error(`No affiliate shop context for platform shopId ${frame.shopId}, dropping order attribution event`);
      return;
    }

    const session = this.getOrCreateSession(shop, {
      shopId: shop.objectId,
      platformShopId: shop.platformShopId,
      triggerKind: AffiliateTriggerKind.ORDER_ATTRIBUTION,
      triggerId: frame.orderId,
      orderId: frame.orderId,
      creatorId: frame.creatorId,
      productId: frame.productId,
    });

    try {
      const result = await session.handleOrderAttributed(frame);
      if (result.runId) this.runIndex.set(result.runId, session.scopeKey);
    } catch (err) {
      log.error(`Failed to handle affiliate order attribution event ${frame.orderId}:`, err);
    }
  }

  private getOrCreateSession(shop: AffiliateShopContext, params: AffiliateContext): AffiliateSession {
    const platform = shop.platform ?? normalizePlatform("TIKTOK_SHOP");
    const sessionKey = AffiliateSession.buildScopeKey(platform, params);
    const existing = this.sessions.get(sessionKey);
    if (existing) return existing;

    const session = new AffiliateSession(shop, params);
    this.sessions.set(session.scopeKey, session);
    return session;
  }

  private shopContextEqual(a: AffiliateShopContext, b: AffiliateShopContext): boolean {
    return (
      a.objectId === b.objectId &&
      a.platformShopId === b.platformShopId &&
      a.platform === b.platform &&
      a.shopName === b.shopName &&
      a.runProfileId === b.runProfileId
    );
  }
}
