import { print } from "graphql";
import { describe, expect, it } from "vitest";
import { CS_CONVERSATION_ORDER_CONTEXT_QUERY } from "./shops-queries.js";

describe("customer service order context query", () => {
  it("loads the order and order-scoped returns in one operation", () => {
    const query = print(CS_CONVERSATION_ORDER_CONTEXT_QUERY);

    expect(query).toContain("order: ecommerceGetOrder");
    expect(query).toContain("returns: ecommerceSearchReturns");
    expect(query).toMatch(/orderIds: \[\$orderId\]/);
    expect(query).toContain("refundTotal");
    expect(query).toContain("lineItems");
  });
});
