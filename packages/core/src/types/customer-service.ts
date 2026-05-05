// ── W19-0A: Core Types ──────────────────────────────────────────────────────

/** Platform-agnostic inbound message (Adapter → Core Router). */
export interface CSInboundMessage {
  id: string;
  /** Platform identifier: "wecom" | "douyin" | "xiaohongshu" | "shopee" | ... */
  platform: string;
  /** Platform-native customer identifier. */
  customer_id: string;
  msg_type: "text" | "image" | "voice" | "video";
  /** Text content (for text messages) or caption. */
  content: string;
  /** Base64-encoded media data (for image/voice/video). */
  media_data?: string;
  /** MIME type of the media (e.g. "audio/amr", "image/jpeg"). */
  media_mime?: string;
  /** Original timestamp from platform (epoch seconds). */
  timestamp: number;
  /** Platform-specific metadata (transparent passthrough, not parsed by core). */
  platform_meta?: Record<string, unknown>;
}

/** Platform-agnostic outbound reply (Core Router → Adapter). */
export interface CSOutboundMessage {
  id: string;
  platform: string;
  customer_id: string;
  msg_type: "text" | "image";
  content: string;
  /** Base64-encoded image data (for image replies). */
  image_data?: string;
  /** MIME type of image (e.g. "image/png"). */
  image_mime?: string;
}

/** Configuration for the customer service module (client-side). */
export interface CustomerServiceConfig {
  /** Relay server WebSocket URL. */
  relayUrl: string;
  /** Authentication token for relay. */
  authToken: string;
  /** Gateway ID for this RivonClaw instance. */
  gatewayId: string;
  /** User-defined business rules/prompt (editable). */
  businessPrompt: string;
  /** Enabled platforms. */
  platforms: string[];
}

/** Runtime status of the customer service module. */
export interface CustomerServiceStatus {
  connected: boolean;
  platforms: CustomerServicePlatformStatus[];
}

/** Per-platform status within customer service. */
export interface CustomerServicePlatformStatus {
  platform: string;
  boundCustomers: number;
}

// Relay frame types moved to ecommerce-relay.ts. Re-exported here for
// backwards compatibility with older customer-service imports.
export type {
  CSHelloFrame,
  CSInboundFrame,
  CSReplyFrame,
  CSImageReplyFrame,
  CSAckFrame,
  CSErrorFrame,
  CSBindShopsFrame,
  CSBindShopsResultFrame,
  CSUnbindShopsFrame,
  CSForceBindShopFrame,
  CSShopTakenOverFrame,
  CSCreateBindingFrame,
  CSCreateBindingAckFrame,
  CSUnbindAllFrame,
  CSBindingResolvedFrame,
  CSNewConversationFrame,
  CSNewMessageFrame,
  AffiliateNewConversationFrame,
  AffiliateNewMessageFrame,
  AffiliateSampleApplicationUpdatedFrame,
  AffiliateTargetCollaborationUpdatedFrame,
  AffiliateOrderAttributedFrame,
  CSWSFrame,
  EcommerceRelayFrame,
} from "./ecommerce-relay.js";

// ── Admin Directive (V0 escalation) ──────────────────────────────────────────

/** Parameters for dispatching a verified manager directive to a CS agent session. */
export interface CSAdminDirectiveParams {
  /** MongoDB ObjectId of the shop. */
  shopId: string;
  /** The CS conversation to resume. */
  conversationId: string;
  /** The buyer in this conversation. */
  buyerUserId: string;
  /** Manager's decision: "approved" | "rejected" | free text. */
  decision: string;
  /** Manager's instructions for the agent. */
  instructions: string;
  /** Related order if any. */
  orderId?: string;
}

// ── Escalation ───────────────────────────────────────────────────────────────

/** Parameters for sending an escalation message to a merchant's configured channel. */
export interface CSEscalateParams {
  /** MongoDB ObjectId of the shop. */
  shopId: string;
  /** The CS conversation being escalated. */
  conversationId: string;
  /** The buyer in this conversation. */
  buyerUserId: string;
  /** Related order if any. */
  orderId?: string;
  /** Reason for escalation. */
  reason: string;
  /** Optional additional context for the merchant. */
  context?: string;
}

// ── Adapter Interface ───────────────────────────────────────────────────────

/**
 * Interface that each platform adapter must implement.
 * The adapter handles platform-specific webhook/API logic and normalizes
 * messages into the platform-agnostic format used by the Core Router.
 */
export interface PlatformAdapter {
  /** Platform identifier (e.g. "wecom", "douyin", "xiaohongshu"). */
  readonly platform: string;

  /** Register HTTP routes for this platform's webhook. Called during server startup. */
  registerWebhook(app: unknown): void;

  /** Send a text reply to a customer on this platform. */
  sendText(customerId: string, content: string): Promise<void>;

  /** Send an image reply to a customer on this platform. */
  sendImage(customerId: string, imageData: Buffer, mime: string): Promise<void>;
}
