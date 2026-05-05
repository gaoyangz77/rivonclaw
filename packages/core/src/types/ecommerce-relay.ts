// ── Ecommerce Relay WebSocket Frame Types (Relay ↔ Desktop) ────────────────

/** Client → Relay: authenticate gateway connection. */
export interface CSHelloFrame {
  type: "cs_hello";
  gateway_id: string;
  auth_token: string;
}

/** Relay → Client: incoming customer message. */
export interface CSInboundFrame {
  type: "cs_inbound";
  id: string;
  platform: string;
  customer_id: string;
  msg_type: string;
  content: string;
  timestamp: number;
  media_data?: string;
  media_mime?: string;
}

/** Client → Relay: text reply to customer. */
export interface CSReplyFrame {
  type: "cs_reply";
  id: string;
  platform: string;
  customer_id: string;
  content: string;
}

/** Client → Relay: image reply to customer. */
export interface CSImageReplyFrame {
  type: "cs_image_reply";
  id: string;
  platform: string;
  customer_id: string;
  image_data: string;
  image_mime: string;
}

/** Relay → Client: acknowledgment. */
export interface CSAckFrame {
  type: "cs_ack";
  id: string;
}

/** Relay → Client: error response. */
export interface CSErrorFrame {
  type: "cs_error";
  message: string;
}

/** Client → Relay: bind shops to this gateway. */
export interface CSBindShopsFrame {
  type: "cs_bind_shops";
  shopIds: string[];
}

/** Relay → Client: shop binding result. */
export interface CSBindShopsResultFrame {
  type: "cs_bind_shops_result";
  bound: string[];
  /** Shop IDs that were taken over from another gateway during binding. */
  takenOver?: string[];
  /** @deprecated Always empty — kept for backwards compatibility. */
  conflicts: Array<{ shopId: string; gatewayId: string }>;
}

/** Client → Relay: unbind shops. */
export interface CSUnbindShopsFrame {
  type: "cs_unbind_shops";
  shopIds: string[];
}

/** Client → Relay: force-bind a shop (take over from another device). */
export interface CSForceBindShopFrame {
  type: "cs_force_bind_shop";
  shopId: string;
}

/** Relay → Client: your shop was taken over by another device. */
export interface CSShopTakenOverFrame {
  type: "cs_shop_taken_over";
  shopId: string;
  newGatewayId: string;
}

/** Client → Relay: request a new binding token. */
export interface CSCreateBindingFrame {
  type: "cs_create_binding";
  gateway_id: string;
  platform?: string;
}

/** Relay → Client: binding token created. */
export interface CSCreateBindingAckFrame {
  type: "cs_create_binding_ack";
  token: string;
  customer_service_url: string;
}

/** Client → Relay: unbind all customers for this gateway. */
export interface CSUnbindAllFrame {
  type: "cs_unbind_all";
  gateway_id: string;
}

/** Relay → Client: a customer was successfully bound to this gateway. */
export interface CSBindingResolvedFrame {
  type: "cs_binding_resolved";
  platform: string;
  customer_id: string;
  gateway_id: string;
}

// The wire-format `type` strings ("cs_tiktok_new_message", etc.) are kept for
// backward compatibility with the relay server. Interface names describe the
// domain payload handled by desktop after relay demux.

/** Relay → Client: new customer-service conversation notification. */
export interface CSNewConversationFrame {
  type: "cs_tiktok_new_conversation";
  shopId: string;
  conversationId: string;
  createTime: number;
}

/** Relay → Client: buyer message relayed to desktop customer-service agent. */
export interface CSNewMessageFrame {
  type: "cs_tiktok_new_message";
  shopId: string;
  conversationId: string;
  /** Buyer's IM user ID from webhook sender.im_user_id. */
  imUserId: string;
  /** Platform order ID if conversation is order-scoped. */
  orderId?: string;
  messageId: string;
  messageType: string;
  content: string;
  senderRole: string;
  senderId: string;
  createTime: number;
  isVisible: boolean;
}

/** Relay → Client: new affiliate creator conversation notification. */
export interface AffiliateNewConversationFrame {
  type: "affiliate_tiktok_new_conversation";
  shopId: string;
  conversationId: string;
  createTime: number;
}

/** Relay → Client: creator message relayed to desktop affiliate agent. */
export interface AffiliateNewMessageFrame {
  type: "affiliate_tiktok_new_message";
  shopId: string;
  conversationId: string;
  /** Creator's IM user ID from webhook sender.im_user_id. */
  imUserId: string;
  /** Platform order ID when the affiliate conversation is order-scoped. */
  orderId?: string;
  messageId: string;
  messageType: string;
  content: string;
  senderRole: string;
  senderId: string;
  createTime: number;
  isVisible: boolean;
}

/** Relay → Client: sample application lifecycle update. */
export interface AffiliateSampleApplicationUpdatedFrame {
  type: "affiliate_tiktok_sample_application_updated";
  shopId: string;
  applicationId: string;
  creatorId?: string;
  productId?: string;
  status: string;
  eventTime: number;
}

/** Relay → Client: target collaboration lifecycle update. */
export interface AffiliateTargetCollaborationUpdatedFrame {
  type: "affiliate_tiktok_target_collaboration_updated";
  shopId: string;
  collaborationId: string;
  creatorId?: string;
  productId?: string;
  status: string;
  eventTime: number;
}

/** Relay → Client: affiliate-attributed order update. */
export interface AffiliateOrderAttributedFrame {
  type: "affiliate_tiktok_order_attributed";
  shopId: string;
  orderId: string;
  creatorId?: string;
  productId?: string;
  eventTime: number;
}

/** Union of all ecommerce relay WebSocket frames. */
export type CSWSFrame =
  | CSHelloFrame
  | CSInboundFrame
  | CSReplyFrame
  | CSImageReplyFrame
  | CSAckFrame
  | CSErrorFrame
  | CSBindShopsFrame
  | CSBindShopsResultFrame
  | CSUnbindShopsFrame
  | CSForceBindShopFrame
  | CSShopTakenOverFrame
  | CSCreateBindingFrame
  | CSCreateBindingAckFrame
  | CSUnbindAllFrame
  | CSBindingResolvedFrame
  | CSNewConversationFrame
  | CSNewMessageFrame
  | AffiliateNewConversationFrame
  | AffiliateNewMessageFrame
  | AffiliateSampleApplicationUpdatedFrame
  | AffiliateTargetCollaborationUpdatedFrame
  | AffiliateOrderAttributedFrame;

/** Preferred neutral name for new code; CSWSFrame is kept for compatibility. */
export type EcommerceRelayFrame = CSWSFrame;
