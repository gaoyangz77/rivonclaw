import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getAllTools } from "./tools.js";

// Mock the graphql-client module
const mockGraphqlFetch = vi.fn();
vi.mock("./graphql-client.js", () => ({
  graphqlFetch: (...args: unknown[]) => mockGraphqlFetch(...args),
}));

function findTool(name: string) {
  const tool = getAllTools().find((t) => t.name === name);
  if (!tool) throw new Error(`Tool ${name} not found`);
  return tool;
}

function makeCSContext(overrides?: Partial<{ shopId: string; conversationId: string; buyerUserId: string; orderId: string }>) {
  return {
    csSessionContext: {
      shopId: overrides?.shopId ?? "shop-1",
      conversationId: overrides?.conversationId ?? "conv-1",
      buyerUserId: overrides?.buyerUserId ?? "buyer-1",
      ...(overrides?.orderId ? { orderId: overrides.orderId } : {}),
    },
  };
}

function mockGqlSuccess(data: unknown) {
  mockGraphqlFetch.mockResolvedValueOnce({
    data: {
      result: {
        code: 0,
        message: "success",
        data: JSON.stringify(data),
      },
    },
  });
}

describe("TikTok Shop Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Tool registry", () => {
    it("should register all 21 tools", () => {
      const tools = getAllTools();
      expect(tools).toHaveLength(21);
    });

    it("should have unique tool names", () => {
      const tools = getAllTools();
      const names = tools.map((t) => t.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it("should include buyer-scoped tool variants", () => {
      const tools = getAllTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain("tiktok_get_order_for_buyer");
      expect(names).toContain("tiktok_list_buyer_orders");
      expect(names).toContain("tiktok_get_logistics_for_buyer");
    });

    it("should include seller/ops tool variants", () => {
      const tools = getAllTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain("tiktok_get_order");
      expect(names).toContain("tiktok_list_orders");
      expect(names).toContain("tiktok_get_logistics_tracking");
    });

    it("should NOT include standalone upload_image tool", () => {
      const tools = getAllTools();
      const names = tools.map((t) => t.name);
      expect(names).not.toContain("tiktok_upload_image");
    });

    it("should include new Gap 1-4 tools", () => {
      const tools = getAllTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain("tiktok_get_conversation_details");
      expect(names).toContain("tiktok_get_cs_performance");
      expect(names).toContain("tiktok_get_warehouses");
      expect(names).toContain("tiktok_get_global_warehouses");
    });
  });

  describe("Conversation-scoped tool binding (ADR-032 locked-parameter pattern)", () => {
    describe("tiktok_send_message", () => {
      it("should use conversation_id from session context in CS mode", async () => {
        mockGqlSuccess({ message_id: "msg-1" });

        const tool = findTool("tiktok_send_message");
        const result = await tool.execute(
          "call-1",
          { type: "TEXT", content: '{"content":"hello"}' },
          makeCSContext(),
        );

        expect(mockGraphqlFetch).toHaveBeenCalledTimes(1);
        const [, vars] = mockGraphqlFetch.mock.calls[0];
        expect(vars.conversationId).toBe("conv-1");
        expect(vars.shopId).toBe("shop-1");

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.code).toBe(0);
      });
    });

    describe("tiktok_read_message", () => {
      it("should use conversation_id from session context", async () => {
        mockGraphqlFetch.mockResolvedValueOnce({
          data: { result: { code: 0, message: "success" } },
        });

        const tool = findTool("tiktok_read_message");
        await tool.execute("call-1", {}, makeCSContext());

        const [, vars] = mockGraphqlFetch.mock.calls[0];
        expect(vars.conversationId).toBe("conv-1");
      });

      it("should require conversation_id outside CS mode", async () => {
        const tool = findTool("tiktok_read_message");
        const result = await tool.execute("call-1", {});

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.error).toContain("conversation_id is required");
      });
    });

    describe("tiktok_get_conversations", () => {
      it("should return only current conversation in CS mode", async () => {
        const tool = findTool("tiktok_get_conversations");

        mockGraphqlFetch.mockResolvedValueOnce({
          data: { result: { code: 0, message: "success", data: '{"messages":[]}' } },
        });

        const result = await tool.execute("call-1", {}, makeCSContext());

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.data.conversations).toHaveLength(1);
        expect(parsed.data.conversations[0].conversation_id).toBe("conv-1");
      });
    });
  });

  describe("Two-tool variant pattern (ADR-032 platform enforcement)", () => {
    describe("tiktok_get_order (seller/ops variant)", () => {
      it("should return order without buyer filter", async () => {
        mockGqlSuccess({
          order_id: "order-1",
          buyer_user_id: "any-buyer",
        });

        const tool = findTool("tiktok_get_order");
        const result = await tool.execute("call-1", {
          order_id: "order-1",
          shop_id: "shop-1",
        });

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.data.order_id).toBe("order-1");
        // Verify no buyerUserId was passed to backend
        const [, vars] = mockGraphqlFetch.mock.calls[0];
        expect(vars.buyerUserId).toBeUndefined();
      });
    });

    describe("tiktok_get_order_for_buyer (CS variant)", () => {
      it("should always pass session.buyerUserId to backend", async () => {
        mockGqlSuccess({
          order_id: "order-1",
          buyer_user_id: "buyer-1",
          total_amount: "29.99",
        });

        const tool = findTool("tiktok_get_order_for_buyer");
        const result = await tool.execute(
          "call-1",
          { order_id: "order-1" },
          makeCSContext({ buyerUserId: "buyer-1" }),
        );

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.data.order_id).toBe("order-1");

        // Verify buyerUserId was passed to backend for platform enforcement
        const [, vars] = mockGraphqlFetch.mock.calls[0];
        expect(vars.buyerUserId).toBe("buyer-1");
        expect(vars.shopId).toBe("shop-1");
      });

      it("should use session orderId when order_id is not provided", async () => {
        mockGqlSuccess({
          order_id: "session-order",
          buyer_user_id: "buyer-1",
        });

        const tool = findTool("tiktok_get_order_for_buyer");
        const result = await tool.execute(
          "call-1",
          {},
          makeCSContext({ buyerUserId: "buyer-1", orderId: "session-order" }),
        );

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.data.order_id).toBe("session-order");
        const [, vars] = mockGraphqlFetch.mock.calls[0];
        expect(vars.orderId).toBe("session-order");
        expect(vars.buyerUserId).toBe("buyer-1");
      });

      it("should error when no order_id and no session orderId", async () => {
        const tool = findTool("tiktok_get_order_for_buyer");
        const result = await tool.execute(
          "call-1",
          {},
          makeCSContext({ buyerUserId: "buyer-1" }),
        );

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.error).toContain("order_id is required");
      });

      it("should require CS session context", async () => {
        const tool = findTool("tiktok_get_order_for_buyer");
        const result = await tool.execute("call-1", { order_id: "order-1" });

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.error).toContain("requires a CS session context");
      });
    });

    describe("tiktok_list_orders (seller/ops variant)", () => {
      it("should list orders without buyer filter", async () => {
        mockGqlSuccess({
          orders: [{ order_id: "order-1" }, { order_id: "order-2" }],
        });

        const tool = findTool("tiktok_list_orders");
        const result = await tool.execute("call-1", { shop_id: "shop-1" });

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.data.orders).toHaveLength(2);
        // Verify no buyerUserId was passed
        const [, vars] = mockGraphqlFetch.mock.calls[0];
        expect(vars.buyerUserId).toBeUndefined();
      });
    });

    describe("tiktok_list_buyer_orders (CS variant)", () => {
      it("should always pass session.buyerUserId to backend", async () => {
        mockGqlSuccess({
          orders: [{ order_id: "order-1", buyer_user_id: "buyer-1" }],
        });

        const tool = findTool("tiktok_list_buyer_orders");
        const result = await tool.execute(
          "call-1",
          {},
          makeCSContext({ buyerUserId: "buyer-1" }),
        );

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.data.orders).toHaveLength(1);

        // Verify buyerUserId was passed
        const [, vars] = mockGraphqlFetch.mock.calls[0];
        expect(vars.buyerUserId).toBe("buyer-1");
      });

      it("should require CS session context", async () => {
        const tool = findTool("tiktok_list_buyer_orders");
        const result = await tool.execute("call-1", {});

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.error).toContain("requires a CS session context");
      });
    });

    describe("tiktok_get_logistics_tracking (seller/ops variant)", () => {
      it("should return tracking without buyer filter", async () => {
        mockGqlSuccess({
          order_id: "order-1",
          tracking_number: "TRK123",
          tracking_status: "IN_TRANSIT",
        });

        const tool = findTool("tiktok_get_logistics_tracking");
        const result = await tool.execute("call-1", {
          order_id: "order-1",
          shop_id: "shop-1",
        });

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.data.tracking_number).toBe("TRK123");
        // Only one GQL call (no order lookup for validation)
        expect(mockGraphqlFetch).toHaveBeenCalledTimes(1);
        // No buyerUserId passed
        const [, vars] = mockGraphqlFetch.mock.calls[0];
        expect(vars.buyerUserId).toBeUndefined();
      });
    });

    describe("tiktok_get_logistics_for_buyer (CS variant)", () => {
      it("should always pass session.buyerUserId to backend", async () => {
        mockGqlSuccess({
          order_id: "order-1",
          tracking_number: "TRK123",
          tracking_status: "IN_TRANSIT",
        });

        const tool = findTool("tiktok_get_logistics_for_buyer");
        const result = await tool.execute(
          "call-1",
          { order_id: "order-1" },
          makeCSContext({ buyerUserId: "buyer-1" }),
        );

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.data.tracking_number).toBe("TRK123");
        // Only one GQL call (platform enforcement, no pre-validation)
        expect(mockGraphqlFetch).toHaveBeenCalledTimes(1);
        // buyerUserId passed for platform enforcement
        const [, vars] = mockGraphqlFetch.mock.calls[0];
        expect(vars.buyerUserId).toBe("buyer-1");
      });

      it("should require CS session context", async () => {
        const tool = findTool("tiktok_get_logistics_for_buyer");
        const result = await tool.execute("call-1", { order_id: "order-1" });

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.error).toContain("requires a CS session context");
      });
    });
  });

  describe("Gap 1: tiktok_get_conversation_details", () => {
    it("should use conversation_id from session context in CS mode", async () => {
      mockGqlSuccess({ conversation_id: "conv-1", status: "ACTIVE", buyer: { id: "buyer-1" } });

      const tool = findTool("tiktok_get_conversation_details");
      const result = await tool.execute("call-1", {}, makeCSContext());

      const [, vars] = mockGraphqlFetch.mock.calls[0];
      expect(vars.conversationId).toBe("conv-1");
      expect(vars.shopId).toBe("shop-1");

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.code).toBe(0);
      expect(parsed.data.conversation_id).toBe("conv-1");
    });

    it("should require conversation_id outside CS mode", async () => {
      const tool = findTool("tiktok_get_conversation_details");
      const result = await tool.execute("call-1", {});

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain("conversation_id is required");
    });
  });

  describe("Gap 2: tiktok_get_cs_performance", () => {
    it("should call backend with optional time range", async () => {
      mockGqlSuccess({ avg_response_time: 120, satisfaction_rate: 0.95 });

      const tool = findTool("tiktok_get_cs_performance");
      const result = await tool.execute("call-1", {
        shop_id: "shop-1",
        start_time: "2026-01-01",
        end_time: "2026-03-01",
      });

      const [, vars] = mockGraphqlFetch.mock.calls[0];
      expect(vars.shopId).toBe("shop-1");
      expect(vars.startTime).toBe("2026-01-01");
      expect(vars.endTime).toBe("2026-03-01");

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.code).toBe(0);
    });

    it("should work without time range params", async () => {
      mockGqlSuccess({ avg_response_time: 100 });

      const tool = findTool("tiktok_get_cs_performance");
      await tool.execute("call-1", { shop_id: "shop-1" });

      const [, vars] = mockGraphqlFetch.mock.calls[0];
      expect(vars.startTime).toBeUndefined();
      expect(vars.endTime).toBeUndefined();
    });
  });

  describe("Gap 3: tiktok_get_warehouses", () => {
    it("should return warehouse list", async () => {
      mockGqlSuccess({ warehouses: [{ id: "wh-1", name: "Main Warehouse" }] });

      const tool = findTool("tiktok_get_warehouses");
      const result = await tool.execute("call-1", { shop_id: "shop-1" });

      const [, vars] = mockGraphqlFetch.mock.calls[0];
      expect(vars.shopId).toBe("shop-1");

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.code).toBe(0);
      expect(parsed.data.warehouses).toHaveLength(1);
    });

    it("should pass pagination params", async () => {
      mockGqlSuccess({ warehouses: [] });

      const tool = findTool("tiktok_get_warehouses");
      await tool.execute("call-1", { shop_id: "shop-1", page_size: 5, page_token: "cursor-1" });

      const [, vars] = mockGraphqlFetch.mock.calls[0];
      expect(vars.pageSize).toBe(5);
      expect(vars.pageToken).toBe("cursor-1");
    });
  });

  describe("Gap 4: tiktok_get_global_warehouses", () => {
    it("should return global warehouse info", async () => {
      mockGqlSuccess({ warehouses: [{ id: "gwh-1", name: "Global Hub" }] });

      const tool = findTool("tiktok_get_global_warehouses");
      const result = await tool.execute("call-1", { shop_id: "shop-1" });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.code).toBe(0);
    });

    it("should pass warehouse_id filter", async () => {
      mockGqlSuccess({ warehouses: [{ id: "gwh-1" }] });

      const tool = findTool("tiktok_get_global_warehouses");
      await tool.execute("call-1", { shop_id: "shop-1", warehouse_id: "gwh-1" });

      const [, vars] = mockGraphqlFetch.mock.calls[0];
      expect(vars.warehouseId).toBe("gwh-1");
    });
  });

  describe("Gap 5: Image upload encapsulation in send_message", () => {
    it("should pass through IMAGE with pre-uploaded URL directly", async () => {
      mockGqlSuccess({ message_id: "msg-img-1" });

      const tool = findTool("tiktok_send_message");
      const content = JSON.stringify({ url: "https://example.com/img.png", width: 300, height: 300 });
      const result = await tool.execute(
        "call-1",
        { type: "IMAGE", content },
        makeCSContext(),
      );

      // Should call sendMessage directly, no upload
      expect(mockGraphqlFetch).toHaveBeenCalledTimes(1);
      const [, vars] = mockGraphqlFetch.mock.calls[0];
      expect(vars.type).toBe("IMAGE");
      expect(vars.content).toBe(content);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.code).toBe(0);
    });
  });

  describe("Management tools", () => {
    describe("tiktok_list_shops", () => {
      it("should return shops list", async () => {
        mockGraphqlFetch.mockResolvedValueOnce({
          data: {
            shops: [
              { id: "shop-1", shopName: "My Store", authStatus: "AUTHORIZED" },
            ],
          },
        });

        const tool = findTool("tiktok_list_shops");
        const result = await tool.execute("call-1", {});

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.shops).toHaveLength(1);
      });
    });

    describe("tiktok_get_current_shop", () => {
      it("should return the first authorized shop", async () => {
        mockGraphqlFetch.mockResolvedValueOnce({
          data: {
            shops: [
              { id: "shop-1", shopName: "Store A", authStatus: "TOKEN_EXPIRED" },
              { id: "shop-2", shopName: "Store B", authStatus: "AUTHORIZED" },
            ],
          },
        });

        const tool = findTool("tiktok_get_current_shop");
        const result = await tool.execute("call-1", {});

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.id).toBe("shop-2");
      });

      it("should return error when no authorized shop exists", async () => {
        mockGraphqlFetch.mockResolvedValueOnce({
          data: {
            shops: [
              { id: "shop-1", shopName: "Store", authStatus: "TOKEN_EXPIRED" },
            ],
          },
        });

        const tool = findTool("tiktok_get_current_shop");
        const result = await tool.execute("call-1", {});

        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.error).toBe("No authorized shop found");
      });
    });
  });
});
