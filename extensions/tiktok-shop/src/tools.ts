/**
 * TikTok Shop Tool Definitions
 *
 * Each tool is a thin client that calls the backend GraphQL API via the local
 * panel-server proxy. The backend resolves TikTok tokens and makes actual API calls.
 *
 * ADR-032 "two-tool variant + platform enforcement" pattern:
 * - Seller/ops variants: full access, no buyer filter. NOT available in CS runProfile.
 * - CS (buyer-scoped) variants: ALWAYS pass session.buyerUserId to the backend resolver.
 *   Only available in CS runProfile. The backend passes buyerUserId to TikTok API for
 *   platform-level enforcement — no post-validation needed.
 * - Messaging tools: continue using conversation_id locking from session context.
 */

import { Type } from "@sinclair/typebox";
import { graphqlFetch } from "./graphql-client.js";
import { resolveSessionContext, type CSSessionContext } from "./session-context.js";

const PANEL_BASE_URL = "http://127.0.0.1:3210";

// ── Shared types ────────────────────────────────────────────────────────────

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
};

type ToolDef = {
  label: string;
  name: string;
  description: string;
  ownerOnly?: boolean;
  parameters: ReturnType<typeof Type.Object>;
  execute: (toolCallId: string, args: unknown, ctx?: Record<string, unknown>) => Promise<ToolResult>;
};

function jsonResult(payload: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

function errorResult(message: string): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
  };
}

/** Extract and format a backend GraphQL proxy response. Returns errorResult on failure. */
function unwrapGqlProxy(result: { data?: Record<string, unknown> | null; errors?: Array<{ message: string }> }): ToolResult {
  if (result.errors) {
    return errorResult(result.errors[0].message);
  }
  const gqlResult = Object.values(result.data ?? {})[0] as { code: number; message: string; data?: string } | undefined;
  if (!gqlResult) {
    return errorResult("Unexpected empty response from backend");
  }
  return jsonResult({
    ...gqlResult,
    data: gqlResult.data ? JSON.parse(gqlResult.data) : null,
  });
}

/**
 * Resolve shopId from session context or args.
 * CS sessions always use session context; management contexts use args.
 */
function resolveShopId(
  session: CSSessionContext | null,
  args: Record<string, unknown>,
): string {
  if (session) return session.shopId;
  const shopId = args.shop_id as string | undefined;
  if (!shopId) throw new Error("shop_id is required outside of CS session");
  return shopId;
}

// ── GraphQL Queries ─────────────────────────────────────────────────────────

const GQL = {
  getConversations: `
    query($shopId: String!, $pageSize: Float!, $pageToken: String, $locale: String) {
      tiktokGetConversations(shopId: $shopId, pageSize: $pageSize, pageToken: $pageToken, locale: $locale) {
        code message data
      }
    }
  `,
  getConversationMessages: `
    query($shopId: String!, $conversationId: String!, $pageSize: Float!, $pageToken: String, $locale: String) {
      tiktokGetConversationMessages(shopId: $shopId, conversationId: $conversationId, pageSize: $pageSize, pageToken: $pageToken, locale: $locale) {
        code message data
      }
    }
  `,
  getAgentSettings: `
    query($shopId: String!) {
      tiktokGetAgentSettings(shopId: $shopId) {
        code message data
      }
    }
  `,
  getOrder: `
    query($shopId: String!, $orderId: String!, $buyerUserId: String) {
      tiktokGetOrder(shopId: $shopId, orderId: $orderId, buyerUserId: $buyerUserId) {
        code message data
      }
    }
  `,
  getOrders: `
    query($shopId: String!, $buyerUserId: String, $status: String, $pageSize: Float, $pageToken: String) {
      tiktokGetOrders(shopId: $shopId, buyerUserId: $buyerUserId, status: $status, pageSize: $pageSize, pageToken: $pageToken) {
        code message data
      }
    }
  `,
  getProduct: `
    query($shopId: String!, $productId: String!) {
      tiktokGetProduct(shopId: $shopId, productId: $productId) {
        code message data
      }
    }
  `,
  getLogisticsTracking: `
    query($shopId: String!, $orderId: String!, $buyerUserId: String) {
      tiktokGetLogisticsTracking(shopId: $shopId, orderId: $orderId, buyerUserId: $buyerUserId) {
        code message data
      }
    }
  `,
  getConversationDetails: `
    query($shopId: String!, $conversationId: String!) {
      tiktokGetConversationDetails(shopId: $shopId, conversationId: $conversationId) {
        code message data
      }
    }
  `,
  getCSPerformance: `
    query($shopId: String!, $startTime: String, $endTime: String) {
      tiktokGetCSPerformance(shopId: $shopId, startTime: $startTime, endTime: $endTime) {
        code message data
      }
    }
  `,
  getWarehouses: `
    query($shopId: String!, $pageSize: Float, $pageToken: String) {
      tiktokGetWarehouses(shopId: $shopId, pageSize: $pageSize, pageToken: $pageToken) {
        code message data
      }
    }
  `,
  getGlobalWarehouses: `
    query($shopId: String!, $warehouseId: String) {
      tiktokGetGlobalWarehouses(shopId: $shopId, warehouseId: $warehouseId) {
        code message data
      }
    }
  `,
  sendMessage: `
    mutation($shopId: String!, $conversationId: String!, $type: String!, $content: String!) {
      tiktokSendMessage(shopId: $shopId, conversationId: $conversationId, type: $type, content: $content) {
        code message data
      }
    }
  `,
  readMessage: `
    mutation($shopId: String!, $conversationId: String!) {
      tiktokReadMessage(shopId: $shopId, conversationId: $conversationId) {
        code message data
      }
    }
  `,
  updateAgentSettings: `
    mutation($shopId: String!, $settings: String!) {
      tiktokUpdateAgentSettings(shopId: $shopId, settings: $settings) {
        code message data
      }
    }
  `,
  createConversation: `
    mutation($shopId: String!, $buyerUserId: String!, $orderId: String) {
      tiktokCreateConversation(shopId: $shopId, buyerUserId: $buyerUserId, orderId: $orderId) {
        code message data
      }
    }
  `,
  listShops: `
    query {
      shops {
        id shopName platform platformShopId authStatus region grantedScopes
      }
    }
  `,
  getShopAuthStatus: `
    query($id: ID!) {
      shopAuthStatus(id: $id) {
        hasToken accessTokenExpiresAt refreshTokenExpiresAt
      }
    }
  `,
};

// ── Conversation-scoped tools (locked-parameter pattern, ADR-032) ───────────
// These tools use session.conversationId injection in CS mode.

function createGetConversationsTool(): ToolDef {
  return {
    label: "TikTok \u2014 Get Conversations",
    name: "tiktok_get_conversations",
    description:
      "Get customer service conversations. In CS mode, returns only the current conversation.",
    parameters: Type.Object({
      page_size: Type.Optional(Type.Number({ description: "Page size (max 20)", default: 10 })),
      page_token: Type.Optional(Type.String({ description: "Pagination cursor" })),
    }),
    async execute(_id, args, ctx) {
      const session = resolveSessionContext(ctx);
      const a = args as { page_size?: number; page_token?: string };

      if (session) {
        // CS mode: validate conversation exists, then return only the current one (locked)
        const result = await graphqlFetch(GQL.getConversationMessages, {
          shopId: session.shopId,
          conversationId: session.conversationId,
          pageSize: 1,
        });
        if (result.errors) {
          return errorResult(result.errors[0].message);
        }
        const gqlResult = Object.values(result.data ?? {})[0] as { code: number; message: string; data?: string } | undefined;
        if (!gqlResult || gqlResult.code !== 0) {
          return errorResult(gqlResult?.message ?? "Failed to verify conversation");
        }
        return jsonResult({
          code: 0,
          message: "success",
          data: { conversations: [{ conversation_id: session.conversationId }] },
        });
      }

      const shopId = resolveShopId(null, args as Record<string, unknown>);
      const result = await graphqlFetch(GQL.getConversations, {
        shopId,
        pageSize: a.page_size ?? 10,
        pageToken: a.page_token,
      });
      return unwrapGqlProxy(result);
    },
  };
}

function createGetConversationMessagesTool(): ToolDef {
  return {
    label: "TikTok \u2014 Get Conversation Messages",
    name: "tiktok_get_conversation_messages",
    description: "Get paginated message history for a conversation.",
    parameters: Type.Object({
      conversation_id: Type.Optional(Type.String({ description: "Conversation ID (injected in CS mode)" })),
      page_size: Type.Optional(Type.Number({ description: "Number of messages per page" })),
      page_token: Type.Optional(Type.String({ description: "Pagination cursor" })),
    }),
    async execute(_id, args, ctx) {
      const session = resolveSessionContext(ctx);
      const a = args as { conversation_id?: string; page_size?: number; page_token?: string };

      const conversationId = session ? session.conversationId : a.conversation_id;
      if (!conversationId) return errorResult("conversation_id is required");

      const shopId = resolveShopId(session, args as Record<string, unknown>);
      const result = await graphqlFetch(GQL.getConversationMessages, {
        shopId,
        conversationId,
        pageSize: a.page_size ?? 20,
        pageToken: a.page_token,
      });
      return unwrapGqlProxy(result);
    },
  };
}

/** MIME type lookup for common image extensions. */
const IMAGE_EXT_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

/**
 * Upload a local image file via the panel-server REST proxy.
 * Returns the hosted URL and optional dimensions from TikTok.
 */
async function uploadImageFromFile(
  shopId: string,
  filePath: string,
): Promise<{ url: string; width?: number; height?: number }> {
  const { extname } = await import("node:path");
  const { readFile: fsReadFile } = await import("node:fs/promises");

  const imageBuffer = await fsReadFile(filePath);
  const ext = extname(filePath).toLowerCase();
  const mime = IMAGE_EXT_MIME[ext] ?? "image/png";

  const res = await fetch(`${PANEL_BASE_URL}/api/cloud/tiktok/upload-image`, {
    method: "POST",
    headers: {
      "Content-Type": mime,
      "x-shop-id": shopId,
    },
    body: imageBuffer,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Image upload failed (HTTP ${res.status}): ${errBody}`);
  }

  return (await res.json()) as { url: string; width?: number; height?: number };
}

function createSendMessageTool(): ToolDef {
  return {
    label: "TikTok \u2014 Send Message",
    name: "tiktok_send_message",
    description: [
      "Send a message in a conversation. Supported types and content formats:",
      "- TEXT: {\"content\": \"hello\"}",
      "- IMAGE: {\"file_path\": \"/path/to/image.png\"} (auto-uploaded) or {\"url\": \"https://...\", \"width\": 300, \"height\": 300}",
      "- ORDER_CARD: {\"order_id\": \"123456\"}",
      "- PRODUCT_CARD: {\"product_id\": \"123456\"}",
      "- LOGISTICS_CARD: {\"order_id\": \"123456\", \"package_id\": \"789\"} (package_id optional)",
    ].join(" "),
    parameters: Type.Object({
      conversation_id: Type.Optional(Type.String({ description: "Conversation ID (injected in CS mode)" })),
      type: Type.String({ description: "Message type: TEXT, IMAGE, ORDER_CARD, PRODUCT_CARD, LOGISTICS_CARD" }),
      content: Type.String({ description: "JSON content matching the message type (see tool description)" }),
    }),
    async execute(_id, args, ctx) {
      const session = resolveSessionContext(ctx);
      const a = args as { conversation_id?: string; type: string; content: string };

      const conversationId = session ? session.conversationId : a.conversation_id;
      if (!conversationId) return errorResult("conversation_id is required");

      const shopId = resolveShopId(session, args as Record<string, unknown>);

      let finalContent = a.content;

      // IMAGE type: handle local file upload transparently
      if (a.type === "IMAGE") {
        const parsed = JSON.parse(a.content) as { file_path?: string; url?: string; width?: number; height?: number };

        if (parsed.file_path && !parsed.url) {
          // Upload the local file, then rewrite content with the hosted URL
          const uploaded = await uploadImageFromFile(shopId, parsed.file_path);
          finalContent = JSON.stringify({
            url: uploaded.url,
            width: parsed.width ?? uploaded.width ?? 300,
            height: parsed.height ?? uploaded.height ?? 300,
          });
        }
        // If url is already present, pass through as-is
      }

      const result = await graphqlFetch(GQL.sendMessage, {
        shopId,
        conversationId,
        type: a.type,
        content: finalContent,
      });
      return unwrapGqlProxy(result);
    },
  };
}

function createReadMessageTool(): ToolDef {
  return {
    label: "TikTok \u2014 Read Message",
    name: "tiktok_read_message",
    description: "Mark messages as read in a conversation.",
    parameters: Type.Object({
      conversation_id: Type.Optional(Type.String({ description: "Conversation ID (injected in CS mode)" })),
    }),
    async execute(_id, args, ctx) {
      const session = resolveSessionContext(ctx);
      const a = args as { conversation_id?: string };

      const conversationId = session ? session.conversationId : a.conversation_id;
      if (!conversationId) return errorResult("conversation_id is required");

      const shopId = resolveShopId(session, args as Record<string, unknown>);
      const result = await graphqlFetch(GQL.readMessage, {
        shopId,
        conversationId,
      });
      return unwrapGqlProxy(result);
    },
  };
}

function createReadMessagesTool(): ToolDef {
  // "read_messages" is an alias for fetching unread messages in the current conversation
  return {
    label: "TikTok \u2014 Read Messages (Unread)",
    name: "tiktok_read_messages",
    description: "Fetch unread messages in the current conversation.",
    parameters: Type.Object({
      conversation_id: Type.Optional(Type.String({ description: "Conversation ID (injected in CS mode)" })),
    }),
    async execute(_id, args, ctx) {
      const session = resolveSessionContext(ctx);
      const a = args as { conversation_id?: string };

      const conversationId = session ? session.conversationId : a.conversation_id;
      if (!conversationId) return errorResult("conversation_id is required");

      const shopId = resolveShopId(session, args as Record<string, unknown>);

      // Fetch recent messages (unread behavior is managed by TikTok API)
      const result = await graphqlFetch(GQL.getConversationMessages, {
        shopId,
        conversationId,
        pageSize: 50,
      });
      return unwrapGqlProxy(result);
    },
  };
}

function createGetAgentSettingsTool(): ToolDef {
  return {
    label: "TikTok \u2014 Get Agent Settings",
    name: "tiktok_get_agent_settings",
    description: "Get customer service agent configuration settings.",
    parameters: Type.Object({}),
    async execute(_id, args, ctx) {
      const session = resolveSessionContext(ctx);
      const shopId = resolveShopId(session, args as Record<string, unknown>);
      const result = await graphqlFetch(GQL.getAgentSettings, { shopId });
      return unwrapGqlProxy(result);
    },
  };
}

function createUpdateAgentSettingsTool(): ToolDef {
  return {
    label: "TikTok \u2014 Update Agent Settings",
    name: "tiktok_update_agent_settings",
    description: "Update customer service agent configuration.",
    parameters: Type.Object({
      is_online: Type.Optional(Type.Boolean({ description: "Agent online status" })),
      auto_reply_enabled: Type.Optional(Type.Boolean({ description: "Enable auto-reply" })),
      auto_reply_message: Type.Optional(Type.String({ description: "Auto-reply message text" })),
      welcome_message: Type.Optional(Type.String({ description: "Welcome message for new conversations" })),
    }),
    async execute(_id, args, ctx) {
      const session = resolveSessionContext(ctx);
      const shopId = resolveShopId(session, args as Record<string, unknown>);
      const result = await graphqlFetch(GQL.updateAgentSettings, {
        shopId,
        settings: JSON.stringify(args),
      });
      return unwrapGqlProxy(result);
    },
  };
}

// ── Order tools: two-tool variant pattern (ADR-032) ─────────────────────────

/**
 * Seller/ops variant: get order by ID, no buyer filter.
 * NOT available in CS runProfile — Phase 30 Surface/RunProfile controls visibility.
 */
function createGetOrderTool(): ToolDef {
  return {
    label: "TikTok \u2014 Get Order",
    name: "tiktok_get_order",
    description:
      "Get order details by order ID. Seller/ops tool \u2014 no buyer filter. Not available in CS sessions.",
    parameters: Type.Object({
      order_id: Type.String({ description: "TikTok order ID" }),
    }),
    async execute(_id, args, ctx) {
      const session = resolveSessionContext(ctx);
      const a = args as { order_id: string };
      const shopId = resolveShopId(session, args as Record<string, unknown>);

      const result = await graphqlFetch(GQL.getOrder, {
        shopId,
        orderId: a.order_id,
      });
      return unwrapGqlProxy(result);
    },
  };
}

/**
 * CS variant: get order by ID, ALWAYS passes session.buyerUserId for buyer scoping.
 * Only available in CS runProfile.
 */
function createGetOrderForBuyerTool(): ToolDef {
  return {
    label: "TikTok \u2014 Get Order (Buyer)",
    name: "tiktok_get_order_for_buyer",
    description:
      "Get order details for the current buyer. If order_id is omitted, returns the order associated with this conversation (if any). Always scoped to the session buyer.",
    parameters: Type.Object({
      order_id: Type.Optional(Type.String({ description: "TikTok order ID (optional \u2014 defaults to conversation order)" })),
    }),
    async execute(_id, args, ctx) {
      const session = resolveSessionContext(ctx);
      if (!session) {
        return errorResult("tiktok_get_order_for_buyer requires a CS session context");
      }
      const a = args as { order_id?: string };

      // If no order_id provided, try the session's informational orderId
      const orderId = a.order_id ?? session.orderId;
      if (!orderId) {
        return errorResult("order_id is required (no default order in this session)");
      }

      const result = await graphqlFetch(GQL.getOrder, {
        shopId: session.shopId,
        orderId,
        buyerUserId: session.buyerUserId,
      });
      return unwrapGqlProxy(result);
    },
  };
}

// ── Order listing tools: two-tool variant pattern (ADR-032) ─────────────────

/**
 * Seller/ops variant: list/search orders with optional filters.
 * NOT available in CS runProfile.
 */
function createListOrdersTool(): ToolDef {
  return {
    label: "TikTok \u2014 List Orders",
    name: "tiktok_list_orders",
    description:
      "List orders with optional filters. Seller/ops tool \u2014 not available in CS sessions.",
    parameters: Type.Object({
      status: Type.Optional(Type.String({ description: "Order status filter" })),
      page_size: Type.Optional(Type.Number({ description: "Page size (default 20)" })),
      page_token: Type.Optional(Type.String({ description: "Pagination cursor" })),
    }),
    async execute(_id, args, ctx) {
      const session = resolveSessionContext(ctx);
      const a = args as { status?: string; page_size?: number; page_token?: string };
      const shopId = resolveShopId(session, args as Record<string, unknown>);

      const result = await graphqlFetch(GQL.getOrders, {
        shopId,
        status: a.status,
        pageSize: a.page_size ?? 20,
        pageToken: a.page_token,
      });
      return unwrapGqlProxy(result);
    },
  };
}

/**
 * CS variant: list orders for session.buyerUserId.
 * Only available in CS runProfile.
 */
function createListBuyerOrdersTool(): ToolDef {
  return {
    label: "TikTok \u2014 List Buyer Orders",
    name: "tiktok_list_buyer_orders",
    description:
      "List recent orders for the current buyer. Always scoped to session buyer.",
    parameters: Type.Object({
      status: Type.Optional(Type.String({ description: "Order status filter" })),
      page_size: Type.Optional(Type.Number({ description: "Page size (default 20)" })),
      page_token: Type.Optional(Type.String({ description: "Pagination cursor" })),
    }),
    async execute(_id, args, ctx) {
      const session = resolveSessionContext(ctx);
      if (!session) {
        return errorResult("tiktok_list_buyer_orders requires a CS session context");
      }
      const a = args as { status?: string; page_size?: number; page_token?: string };

      const result = await graphqlFetch(GQL.getOrders, {
        shopId: session.shopId,
        buyerUserId: session.buyerUserId,
        status: a.status,
        pageSize: a.page_size ?? 20,
        pageToken: a.page_token,
      });
      return unwrapGqlProxy(result);
    },
  };
}

// ── Product tool (unrestricted) ─────────────────────────────────────────────

function createGetProductTool(): ToolDef {
  return {
    label: "TikTok \u2014 Get Product",
    name: "tiktok_get_product",
    description: "Get product details by product ID. Unrestricted (public catalog data).",
    parameters: Type.Object({
      product_id: Type.String({ description: "TikTok product ID" }),
    }),
    async execute(_id, args, ctx) {
      const session = resolveSessionContext(ctx);
      const a = args as { product_id: string };
      const shopId = resolveShopId(session, args as Record<string, unknown>);

      const result = await graphqlFetch(GQL.getProduct, {
        shopId,
        productId: a.product_id,
      });
      return unwrapGqlProxy(result);
    },
  };
}

// ── Logistics tools: two-tool variant pattern (ADR-032) ─────────────────────

/**
 * Seller/ops variant: get logistics tracking, no buyer filter.
 * NOT available in CS runProfile.
 */
function createGetLogisticsTrackingTool(): ToolDef {
  return {
    label: "TikTok \u2014 Get Logistics Tracking",
    name: "tiktok_get_logistics_tracking",
    description:
      "Get logistics tracking for an order. Seller/ops tool \u2014 no buyer filter. Not available in CS sessions.",
    parameters: Type.Object({
      order_id: Type.String({ description: "TikTok order ID to track" }),
    }),
    async execute(_id, args, ctx) {
      const session = resolveSessionContext(ctx);
      const a = args as { order_id: string };
      const shopId = resolveShopId(session, args as Record<string, unknown>);

      const result = await graphqlFetch(GQL.getLogisticsTracking, {
        shopId,
        orderId: a.order_id,
      });
      return unwrapGqlProxy(result);
    },
  };
}

/**
 * CS variant: get logistics tracking, ALWAYS passes session.buyerUserId for buyer scoping.
 * Only available in CS runProfile.
 */
function createGetLogisticsForBuyerTool(): ToolDef {
  return {
    label: "TikTok \u2014 Get Logistics (Buyer)",
    name: "tiktok_get_logistics_for_buyer",
    description:
      "Get logistics tracking for a buyer's order. Always scoped to the session buyer.",
    parameters: Type.Object({
      order_id: Type.String({ description: "TikTok order ID to track" }),
    }),
    async execute(_id, args, ctx) {
      const session = resolveSessionContext(ctx);
      if (!session) {
        return errorResult("tiktok_get_logistics_for_buyer requires a CS session context");
      }
      const a = args as { order_id: string };

      const result = await graphqlFetch(GQL.getLogisticsTracking, {
        shopId: session.shopId,
        orderId: a.order_id,
        buyerUserId: session.buyerUserId,
      });
      return unwrapGqlProxy(result);
    },
  };
}

// ── Internal Management Tools (3) ───────────────────────────────────────────

function createListShopsTool(): ToolDef {
  return {
    label: "TikTok \u2014 List Shops",
    name: "tiktok_list_shops",
    ownerOnly: true,
    description: "List all connected TikTok Shop stores for the current user.",
    parameters: Type.Object({}),
    async execute() {
      const result = await graphqlFetch(GQL.listShops);
      if (result.errors) return errorResult(result.errors[0].message);

      const shops = (result.data as { shops?: unknown[] })?.shops ?? [];
      return jsonResult({ shops });
    },
  };
}

function createGetCurrentShopTool(): ToolDef {
  return {
    label: "TikTok \u2014 Get Current Shop",
    name: "tiktok_get_current_shop",
    ownerOnly: true,
    description: "Get the currently active TikTok Shop context.",
    parameters: Type.Object({}),
    async execute() {
      const result = await graphqlFetch(GQL.listShops);
      if (result.errors) return errorResult(result.errors[0].message);

      const shops = (result.data as { shops?: Array<{ authStatus: string; [k: string]: unknown }> })?.shops ?? [];
      const activeShop = shops.find((s) => s.authStatus === "AUTHORIZED");
      if (!activeShop) return errorResult("No authorized shop found");
      return jsonResult(activeShop);
    },
  };
}

function createGetShopAuthStatusTool(): ToolDef {
  return {
    label: "TikTok \u2014 Get Shop Auth Status",
    name: "tiktok_get_shop_auth_status",
    ownerOnly: true,
    description: "Check OAuth authorization status and token validity for a shop.",
    parameters: Type.Object({
      shop_id: Type.String({ description: "Shop ID to check" }),
    }),
    async execute(_id, args) {
      const a = args as { shop_id: string };
      const result = await graphqlFetch(GQL.getShopAuthStatus, { id: a.shop_id });
      return unwrapGqlProxy(result);
    },
  };
}

// ── Conversation details (conversation-scoped) ─────────────────────────────

function createGetConversationDetailsTool(): ToolDef {
  return {
    label: "TikTok \u2014 Get Conversation Details",
    name: "tiktok_get_conversation_details",
    description: "Get detailed information about a conversation including status, participants, and metadata.",
    parameters: Type.Object({
      conversation_id: Type.Optional(Type.String({ description: "Conversation ID (injected in CS mode)" })),
    }),
    async execute(_id, args, ctx) {
      const session = resolveSessionContext(ctx);
      const a = args as { conversation_id?: string };

      const conversationId = session ? session.conversationId : a.conversation_id;
      if (!conversationId) return errorResult("conversation_id is required");

      const shopId = resolveShopId(session, args as Record<string, unknown>);
      const result = await graphqlFetch(GQL.getConversationDetails, {
        shopId,
        conversationId,
      });
      return unwrapGqlProxy(result);
    },
  };
}

// ── CS Performance (management/seller tool) ─────────────────────────────────

function createGetCSPerformanceTool(): ToolDef {
  return {
    label: "TikTok \u2014 Get CS Performance",
    name: "tiktok_get_cs_performance",
    description: "Get customer service performance metrics. Seller/management tool \u2014 not needed in CS buyer sessions.",
    parameters: Type.Object({
      start_time: Type.Optional(Type.String({ description: "Performance period start time" })),
      end_time: Type.Optional(Type.String({ description: "Performance period end time" })),
    }),
    async execute(_id, args, ctx) {
      const session = resolveSessionContext(ctx);
      const a = args as { start_time?: string; end_time?: string };
      const shopId = resolveShopId(session, args as Record<string, unknown>);

      const result = await graphqlFetch(GQL.getCSPerformance, {
        shopId,
        startTime: a.start_time,
        endTime: a.end_time,
      });
      return unwrapGqlProxy(result);
    },
  };
}

// ── Warehouse tools (management/seller tools) ───────────────────────────────

function createGetWarehousesTool(): ToolDef {
  return {
    label: "TikTok \u2014 Get Warehouses",
    name: "tiktok_get_warehouses",
    description: "Get list of seller warehouses. Seller/management tool \u2014 not needed in CS buyer sessions.",
    parameters: Type.Object({
      page_size: Type.Optional(Type.Number({ description: "Number of warehouses per page" })),
      page_token: Type.Optional(Type.String({ description: "Pagination cursor" })),
    }),
    async execute(_id, args, ctx) {
      const session = resolveSessionContext(ctx);
      const a = args as { page_size?: number; page_token?: string };
      const shopId = resolveShopId(session, args as Record<string, unknown>);

      const result = await graphqlFetch(GQL.getWarehouses, {
        shopId,
        pageSize: a.page_size,
        pageToken: a.page_token,
      });
      return unwrapGqlProxy(result);
    },
  };
}

function createGetGlobalWarehousesTool(): ToolDef {
  return {
    label: "TikTok \u2014 Get Global Warehouses",
    name: "tiktok_get_global_warehouses",
    description: "Get global seller warehouse information. Seller/management tool \u2014 not needed in CS buyer sessions.",
    parameters: Type.Object({
      warehouse_id: Type.Optional(Type.String({ description: "Specific warehouse ID to filter" })),
    }),
    async execute(_id, args, ctx) {
      const session = resolveSessionContext(ctx);
      const a = args as { warehouse_id?: string };
      const shopId = resolveShopId(session, args as Record<string, unknown>);

      const result = await graphqlFetch(GQL.getGlobalWarehouses, {
        shopId,
        warehouseId: a.warehouse_id,
      });
      return unwrapGqlProxy(result);
    },
  };
}

// ── Export all tools ────────────────────────────────────────────────────────

export function getAllTools(): ToolDef[] {
  return [
    // Conversation-scoped tools (locked-parameter pattern)
    createReadMessagesTool(),
    createSendMessageTool(),
    createGetConversationsTool(),
    createGetConversationMessagesTool(),
    createGetConversationDetailsTool(),
    createReadMessageTool(),
    createGetAgentSettingsTool(),
    createUpdateAgentSettingsTool(),
    // Order tools: seller/ops variant + CS buyer-scoped variant
    createGetOrderTool(),
    createGetOrderForBuyerTool(),
    // Order listing tools: seller/ops variant + CS buyer-scoped variant
    createListOrdersTool(),
    createListBuyerOrdersTool(),
    // Product (unrestricted)
    createGetProductTool(),
    // Logistics tools: seller/ops variant + CS buyer-scoped variant
    createGetLogisticsTrackingTool(),
    createGetLogisticsForBuyerTool(),
    // Warehouse tools (seller/management)
    createGetWarehousesTool(),
    createGetGlobalWarehousesTool(),
    // CS Performance (seller/management)
    createGetCSPerformanceTool(),
    // Internal Management Tools (3)
    createListShopsTool(),
    createGetCurrentShopTool(),
    createGetShopAuthStatusTool(),
  ];
}
