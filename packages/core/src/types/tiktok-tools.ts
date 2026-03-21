import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// Common types
// ---------------------------------------------------------------------------

/** Standard TikTok API response envelope. */
export const tiktokApiResponseSchema = z.object({
  code: z.number(),
  message: z.string(),
  request_id: z.string().optional(),
});

export type TiktokApiResponse = z.infer<typeof tiktokApiResponseSchema>;

/** Message type enum used in conversations. */
export const tiktokMessageTypeSchema = z.enum([
  "TEXT",
  "IMAGE",
  "PRODUCT_CARD",
  "ORDER_CARD",
  "VIDEO",
  "LOGISTICS_CARD",
  "COUPON_CARD",
  "EMOTICONS",
  "ALLOCATED_SERVICE",
  "NOTIFICATION",
  "BUYER_ENTER_FROM_TRANSFER",
  "BUYER_ENTER_FROM_PRODUCT",
  "BUYER_ENTER_FROM_ORDER",
  "OTHER",
]);

export type TiktokMessageType = z.infer<typeof tiktokMessageTypeSchema>;

/** Sender information attached to a message. */
export const tiktokSenderSchema = z.object({
  im_user_id: z.string(),
  role: z.enum(["BUYER", "SELLER", "SYSTEM", "ROBOT"]),
});

export type TiktokSender = z.infer<typeof tiktokSenderSchema>;

/** A single message object. */
export const tiktokMessageSchema = z.object({
  message_id: z.string(),
  index: z.string().optional(),
  conversation_id: z.string(),
  type: tiktokMessageTypeSchema,
  content: z.string(),
  create_time: z.number(),
  is_visible: z.boolean().optional(),
  sender: tiktokSenderSchema,
});

export type TiktokMessage = z.infer<typeof tiktokMessageSchema>;

/** A conversation summary object. */
export const tiktokConversationSchema = z.object({
  conversation_id: z.string(),
  status: z.string().optional(),
  buyer_user_id: z.string().optional(),
  last_message_time: z.number().optional(),
  unread_count: z.number().optional(),
  create_time: z.number().optional(),
});

export type TiktokConversation = z.infer<typeof tiktokConversationSchema>;

// ---------------------------------------------------------------------------
// CS Read Tools (5)
// ---------------------------------------------------------------------------

// 1. getConversations
export const getConversationsInputSchema = z.object({
  page_token: z.string().optional(),
  page_size: z.number().int().min(1).max(20),
  locale: z.string().optional(),
});
export type GetConversationsInput = z.infer<typeof getConversationsInputSchema>;

export const getConversationsOutputSchema = tiktokApiResponseSchema.extend({
  data: z.object({
    conversations: z.array(tiktokConversationSchema),
    next_page_token: z.string().optional(),
  }).optional(),
});
export type GetConversationsOutput = z.infer<typeof getConversationsOutputSchema>;

// 2. getConversationMessages
export const getConversationMessagesInputSchema = z.object({
  conversation_id: z.string(),
  page_token: z.string().optional(),
  page_size: z.number().int().min(1),
  locale: z.string().optional(),
});
export type GetConversationMessagesInput = z.infer<typeof getConversationMessagesInputSchema>;

export const getConversationMessagesOutputSchema = tiktokApiResponseSchema.extend({
  data: z.object({
    messages: z.array(tiktokMessageSchema),
    next_page_token: z.string().optional(),
  }).optional(),
});
export type GetConversationMessagesOutput = z.infer<typeof getConversationMessagesOutputSchema>;

// 3. getConversationDetails
export const getConversationDetailsInputSchema = z.object({
  conversation_id: z.string(),
});
export type GetConversationDetailsInput = z.infer<typeof getConversationDetailsInputSchema>;

export const getConversationDetailsOutputSchema = tiktokApiResponseSchema.extend({
  data: z.object({
    conversation_id: z.string(),
    status: z.string().optional(),
    buyer_user_id: z.string().optional(),
    order_id: z.string().optional(),
    create_time: z.number().optional(),
    last_message_time: z.number().optional(),
    unread_count: z.number().optional(),
    participants: z.array(tiktokSenderSchema).optional(),
  }).optional(),
});
export type GetConversationDetailsOutput = z.infer<typeof getConversationDetailsOutputSchema>;

// 4. getAgentSettings
export const getAgentSettingsInputSchema = z.object({});
export type GetAgentSettingsInput = z.infer<typeof getAgentSettingsInputSchema>;

export const getAgentSettingsOutputSchema = tiktokApiResponseSchema.extend({
  data: z.object({
    is_online: z.boolean().optional(),
    auto_reply_enabled: z.boolean().optional(),
    auto_reply_message: z.string().optional(),
    welcome_message: z.string().optional(),
  }).optional(),
});
export type GetAgentSettingsOutput = z.infer<typeof getAgentSettingsOutputSchema>;

// 5. getCsPerformance
export const getCsPerformanceInputSchema = z.object({
  start_time: z.string().optional(),
  end_time: z.string().optional(),
});
export type GetCsPerformanceInput = z.infer<typeof getCsPerformanceInputSchema>;

export const getCsPerformanceOutputSchema = tiktokApiResponseSchema.extend({
  data: z.object({
    avg_response_time_seconds: z.number().optional(),
    total_conversations: z.number().optional(),
    resolved_conversations: z.number().optional(),
    customer_satisfaction_rate: z.number().optional(),
    first_response_time_seconds: z.number().optional(),
  }).optional(),
});
export type GetCsPerformanceOutput = z.infer<typeof getCsPerformanceOutputSchema>;

// ---------------------------------------------------------------------------
// CS Write Tools (6)
// ---------------------------------------------------------------------------

// 6. createConversation
export const createConversationInputSchema = z.object({
  buyer_user_id: z.string(),
  order_id: z.string().optional(),
});
export type CreateConversationInput = z.infer<typeof createConversationInputSchema>;

export const createConversationOutputSchema = tiktokApiResponseSchema.extend({
  data: z.object({
    conversation_id: z.string(),
  }).optional(),
});
export type CreateConversationOutput = z.infer<typeof createConversationOutputSchema>;

// 7. sendMessage
export const sendMessageInputSchema = z.object({
  conversation_id: z.string(),
  type: tiktokMessageTypeSchema,
  content: z.record(z.string(), z.unknown()),
});
export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;

export const sendMessageOutputSchema = tiktokApiResponseSchema.extend({
  data: z.object({
    message_id: z.string(),
  }).optional(),
});
export type SendMessageOutput = z.infer<typeof sendMessageOutputSchema>;

// 8. readMessage
export const readMessageInputSchema = z.object({
  conversation_id: z.string(),
});
export type ReadMessageInput = z.infer<typeof readMessageInputSchema>;

export const readMessageOutputSchema = tiktokApiResponseSchema;
export type ReadMessageOutput = z.infer<typeof readMessageOutputSchema>;

// 9. uploadImage (multipart/form-data — schema is a placeholder)
export const uploadImageInputSchema = z.object({
  /** Binary image data. Actual transport is multipart/form-data; this schema is a placeholder for MCP tool definition. */
  file_path: z.string().describe("Local path to the image file to upload"),
});
export type UploadImageInput = z.infer<typeof uploadImageInputSchema>;

export const uploadImageOutputSchema = tiktokApiResponseSchema.extend({
  data: z.object({
    url: z.string(),
    width: z.number().optional(),
    height: z.number().optional(),
  }).optional(),
});
export type UploadImageOutput = z.infer<typeof uploadImageOutputSchema>;

// 10. updateAgentSettings
export const updateAgentSettingsInputSchema = z.object({
  is_online: z.boolean().optional(),
  auto_reply_enabled: z.boolean().optional(),
  auto_reply_message: z.string().optional(),
  welcome_message: z.string().optional(),
});
export type UpdateAgentSettingsInput = z.infer<typeof updateAgentSettingsInputSchema>;

export const updateAgentSettingsOutputSchema = tiktokApiResponseSchema;
export type UpdateAgentSettingsOutput = z.infer<typeof updateAgentSettingsOutputSchema>;

// 11. searchSessions
export const searchSessionsInputSchema = z.object({
  keyword: z.string().optional(),
  status: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  page_token: z.string().optional(),
  page_size: z.number().int().optional(),
});
export type SearchSessionsInput = z.infer<typeof searchSessionsInputSchema>;

export const searchSessionsOutputSchema = tiktokApiResponseSchema.extend({
  data: z.object({
    sessions: z.array(z.object({
      session_id: z.string(),
      conversation_id: z.string().optional(),
      status: z.string().optional(),
      buyer_user_id: z.string().optional(),
      create_time: z.number().optional(),
    })),
    next_page_token: z.string().optional(),
  }).optional(),
});
export type SearchSessionsOutput = z.infer<typeof searchSessionsOutputSchema>;

// ---------------------------------------------------------------------------
// Product (1)
// ---------------------------------------------------------------------------

// 12. getProduct
export const getProductInputSchema = z.object({
  product_id: z.string(),
});
export type GetProductInput = z.infer<typeof getProductInputSchema>;

export const getProductOutputSchema = tiktokApiResponseSchema.extend({
  data: z.object({
    product_id: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
    category_id: z.string().optional(),
    brand_id: z.string().optional(),
    images: z.array(z.object({
      url: z.string(),
      width: z.number().optional(),
      height: z.number().optional(),
    })).optional(),
    skus: z.array(z.object({
      sku_id: z.string(),
      price: z.string().optional(),
      inventory: z.number().optional(),
    })).optional(),
    create_time: z.number().optional(),
    update_time: z.number().optional(),
  }).optional(),
});
export type GetProductOutput = z.infer<typeof getProductOutputSchema>;

// ---------------------------------------------------------------------------
// Logistics (2)
// ---------------------------------------------------------------------------

// 13. getWarehouses
export const getWarehousesInputSchema = z.object({
  page_token: z.string().optional(),
  page_size: z.number().int().optional(),
});
export type GetWarehousesInput = z.infer<typeof getWarehousesInputSchema>;

export const getWarehousesOutputSchema = tiktokApiResponseSchema.extend({
  data: z.object({
    warehouses: z.array(z.object({
      warehouse_id: z.string(),
      name: z.string().optional(),
      address: z.string().optional(),
      region: z.string().optional(),
      is_default: z.boolean().optional(),
    })),
    next_page_token: z.string().optional(),
  }).optional(),
});
export type GetWarehousesOutput = z.infer<typeof getWarehousesOutputSchema>;

// 14. getShippingProviders
export const getShippingProvidersInputSchema = z.object({
  delivery_option_id: z.string(),
});
export type GetShippingProvidersInput = z.infer<typeof getShippingProvidersInputSchema>;

export const getShippingProvidersOutputSchema = tiktokApiResponseSchema.extend({
  data: z.object({
    shipping_providers: z.array(z.object({
      shipping_provider_id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
    })),
  }).optional(),
});
export type GetShippingProvidersOutput = z.infer<typeof getShippingProvidersOutputSchema>;

// ---------------------------------------------------------------------------
// Internal Management (3) — local, not TikTok API calls
// ---------------------------------------------------------------------------

// 15. listShops
export const listShopsInputSchema = z.object({});
export type ListShopsInput = z.infer<typeof listShopsInputSchema>;

export const listShopsOutputSchema = z.object({
  shops: z.array(z.object({
    shop_id: z.string(),
    shop_name: z.string(),
    region: z.string().optional(),
    is_active: z.boolean(),
    auth_status: z.enum(["AUTHORIZED", "EXPIRED", "REVOKED", "PENDING"]),
  })),
});
export type ListShopsOutput = z.infer<typeof listShopsOutputSchema>;

// 16. getCurrentShop
export const getCurrentShopInputSchema = z.object({});
export type GetCurrentShopInput = z.infer<typeof getCurrentShopInputSchema>;

export const getCurrentShopOutputSchema = z.object({
  shop_id: z.string(),
  shop_name: z.string(),
  region: z.string().optional(),
  seller_base_region: z.string().optional(),
  auth_status: z.enum(["AUTHORIZED", "EXPIRED", "REVOKED", "PENDING"]),
});
export type GetCurrentShopOutput = z.infer<typeof getCurrentShopOutputSchema>;

// 17. getShopAuthStatus
export const getShopAuthStatusInputSchema = z.object({
  shop_id: z.string(),
});
export type GetShopAuthStatusInput = z.infer<typeof getShopAuthStatusInputSchema>;

export const getShopAuthStatusOutputSchema = z.object({
  shop_id: z.string(),
  auth_status: z.enum(["AUTHORIZED", "EXPIRED", "REVOKED", "PENDING"]),
  access_token_expires_at: z.number().optional(),
  refresh_token_expires_at: z.number().optional(),
  granted_scopes: z.array(z.string()).optional(),
});
export type GetShopAuthStatusOutput = z.infer<typeof getShopAuthStatusOutputSchema>;

// ---------------------------------------------------------------------------
// Tool category enum
// ---------------------------------------------------------------------------

export const tiktokToolCategorySchema = z.enum([
  "TIKTOK_CS",
  "TIKTOK_PRODUCT",
  "TIKTOK_LOGISTICS",
  "TIKTOK_MANAGEMENT",
]);

export type TiktokToolCategory = z.infer<typeof tiktokToolCategorySchema>;

// ---------------------------------------------------------------------------
// Tool Registry
// ---------------------------------------------------------------------------

export const TIKTOK_TOOL_REGISTRY = [
  // CS Read Tools
  {
    name: "tiktok_get_conversations",
    description: "Get a paginated list of customer service conversations",
    category: "TIKTOK_CS",
    inputSchema: getConversationsInputSchema,
    outputSchema: getConversationsOutputSchema,
  },
  {
    name: "tiktok_get_conversation_messages",
    description: "Get messages within a specific conversation",
    category: "TIKTOK_CS",
    inputSchema: getConversationMessagesInputSchema,
    outputSchema: getConversationMessagesOutputSchema,
  },
  {
    name: "tiktok_get_conversation_details",
    description: "Get detailed information about a specific conversation",
    category: "TIKTOK_CS",
    inputSchema: getConversationDetailsInputSchema,
    outputSchema: getConversationDetailsOutputSchema,
  },
  {
    name: "tiktok_get_agent_settings",
    description: "Get current customer service agent settings",
    category: "TIKTOK_CS",
    inputSchema: getAgentSettingsInputSchema,
    outputSchema: getAgentSettingsOutputSchema,
  },
  {
    name: "tiktok_get_cs_performance",
    description: "Get customer service performance metrics",
    category: "TIKTOK_CS",
    inputSchema: getCsPerformanceInputSchema,
    outputSchema: getCsPerformanceOutputSchema,
  },
  // CS Write Tools
  {
    name: "tiktok_create_conversation",
    description: "Create a new customer service conversation with a buyer",
    category: "TIKTOK_CS",
    inputSchema: createConversationInputSchema,
    outputSchema: createConversationOutputSchema,
  },
  {
    name: "tiktok_send_message",
    description: "Send a message in an existing conversation",
    category: "TIKTOK_CS",
    inputSchema: sendMessageInputSchema,
    outputSchema: sendMessageOutputSchema,
  },
  {
    name: "tiktok_read_message",
    description: "Mark messages as read in a conversation",
    category: "TIKTOK_CS",
    inputSchema: readMessageInputSchema,
    outputSchema: readMessageOutputSchema,
  },
  {
    name: "tiktok_upload_image",
    description: "Upload an image for use in customer service messages",
    category: "TIKTOK_CS",
    inputSchema: uploadImageInputSchema,
    outputSchema: uploadImageOutputSchema,
  },
  {
    name: "tiktok_update_agent_settings",
    description: "Update customer service agent configuration",
    category: "TIKTOK_CS",
    inputSchema: updateAgentSettingsInputSchema,
    outputSchema: updateAgentSettingsOutputSchema,
  },
  {
    name: "tiktok_search_sessions",
    description: "Search customer service sessions with filters",
    category: "TIKTOK_CS",
    inputSchema: searchSessionsInputSchema,
    outputSchema: searchSessionsOutputSchema,
  },
  // Product
  {
    name: "tiktok_get_product",
    description: "Get detailed product information by product ID",
    category: "TIKTOK_PRODUCT",
    inputSchema: getProductInputSchema,
    outputSchema: getProductOutputSchema,
  },
  // Logistics
  {
    name: "tiktok_get_warehouses",
    description: "Get a list of seller warehouses",
    category: "TIKTOK_LOGISTICS",
    inputSchema: getWarehousesInputSchema,
    outputSchema: getWarehousesOutputSchema,
  },
  {
    name: "tiktok_get_shipping_providers",
    description: "Get shipping providers for a delivery option",
    category: "TIKTOK_LOGISTICS",
    inputSchema: getShippingProvidersInputSchema,
    outputSchema: getShippingProvidersOutputSchema,
  },
  // Internal Management
  {
    name: "tiktok_list_shops",
    description: "List all connected TikTok Shop shops",
    category: "TIKTOK_MANAGEMENT",
    inputSchema: listShopsInputSchema,
    outputSchema: listShopsOutputSchema,
  },
  {
    name: "tiktok_get_current_shop",
    description: "Get the currently active shop context",
    category: "TIKTOK_MANAGEMENT",
    inputSchema: getCurrentShopInputSchema,
    outputSchema: getCurrentShopOutputSchema,
  },
  {
    name: "tiktok_get_shop_auth_status",
    description: "Get authorization status for a specific shop",
    category: "TIKTOK_MANAGEMENT",
    inputSchema: getShopAuthStatusInputSchema,
    outputSchema: getShopAuthStatusOutputSchema,
  },
] as const;
