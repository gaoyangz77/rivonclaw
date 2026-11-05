import { describe, expect, it } from "vitest";
import { GQL } from "@rivonclaw/core";
import {
  afterSaleDeadlineState,
  resolveAfterSaleDecision,
  splitDuration,
  type AfterSaleKind,
} from "./after-sale.js";

const K = GQL.EcomAfterSaleRequestKind;

/** `status` only documents the case: the backend decides `needsReview`, the Panel never does. */
function facts(
  kind: AfterSaleKind,
  _status: string | null,
  sellerNextAction: string | null,
  needsReview = true,
) {
  return { kind, sellerNextAction, needsReview };
}

describe("resolveAfterSaleDecision", () => {
  it("maps each seller action to its approve and reject decisions", () => {
    expect(
      resolveAfterSaleDecision(
        facts(K.Refund, "RETURN_OR_REFUND_REQUEST_PENDING", "SELLER_RESPOND_REFUND"),
      ),
    ).toEqual({
      route: "refund",
      rejectDecision: "REJECT_REFUND",
    });
    expect(
      resolveAfterSaleDecision(
        facts(K.ReturnAndRefund, "RETURN_OR_REFUND_REQUEST_PENDING", "SELLER_RESPOND_RETURN"),
      ),
    ).toEqual({
      route: "return",
      approveDecision: "APPROVE_RETURN",
      rejectDecision: "REJECT_RETURN",
    });
    expect(
      resolveAfterSaleDecision(
        facts(K.ReturnAndRefund, "BUYER_SHIPPED_ITEM", "SELLER_RESPOND_RECEIVE_PACKAGE"),
      ),
    ).toEqual({
      route: "return",
      approveDecision: "APPROVE_RECEIVED_PACKAGE",
      rejectDecision: "REJECT_RECEIVED_PACKAGE",
    });
    expect(
      resolveAfterSaleDecision(
        facts(K.Replacement, "REPLACEMENT_REQUEST_PENDING", "SELLER_RESPOND_REPLACEMENT"),
      ),
    ).toEqual({
      route: "return",
      approveDecision: "APPROVE_REPLACEMENT",
      rejectDecision: "REJECT_REPLACEMENT",
    });
    expect(
      resolveAfterSaleDecision(
        facts(K.Cancellation, "CANCELLATION_REQUEST_PENDING", "SELLER_RESPOND_BUYER_CANCEL"),
      ),
    ).toEqual({
      route: "cancellation",
    });
  });

  it("infers the decision from the kind for a pending request without an action", () => {
    expect(
      resolveAfterSaleDecision(facts(K.Refund, "RETURN_OR_REFUND_REQUEST_PENDING", null))?.route,
    ).toBe("refund");
    expect(
      resolveAfterSaleDecision(facts(K.ReturnAndRefund, "RETURN_OR_REFUND_REQUEST_PENDING", null)),
    ).toMatchObject({
      approveDecision: "APPROVE_RETURN",
    });
    expect(
      resolveAfterSaleDecision(facts(K.Replacement, "REPLACEMENT_REQUEST_PENDING", null)),
    ).toMatchObject({
      approveDecision: "APPROVE_REPLACEMENT",
    });
    expect(
      resolveAfterSaleDecision(facts(K.Cancellation, "CANCELLATION_REQUEST_PENDING", null))?.route,
    ).toBe("cancellation");
  });

  it("offers nothing for exchange, unknown actions, kind mismatches and requests that need no review", () => {
    expect(
      resolveAfterSaleDecision(facts(K.Exchange, "EXCHANGE_REQUEST_PENDING", null)),
    ).toBeNull();
    expect(
      resolveAfterSaleDecision(
        facts(K.Refund, "RETURN_OR_REFUND_REQUEST_PENDING", "SELLER_RESPOND_SOMETHING_NEW"),
      ),
    ).toBeNull();
    // The backend rejects APPROVE_RETURN for anything but RETURN_AND_REFUND.
    expect(
      resolveAfterSaleDecision(
        facts(K.Refund, "RETURN_OR_REFUND_REQUEST_PENDING", "SELLER_RESPOND_RETURN"),
      ),
    ).toBeNull();
    expect(
      resolveAfterSaleDecision(facts(K.ReturnAndRefund, "BUYER_SHIPPED_ITEM", null, false)),
    ).toBeNull();
    expect(
      resolveAfterSaleDecision(facts(K.Refund, "RETURN_OR_REFUND_REQUEST_SUCCESS", null, false)),
    ).toBeNull();
    // A recorded decision waits for TikTok's next state: the old action must not be offered again.
    expect(
      resolveAfterSaleDecision(
        facts(K.Refund, "RETURN_OR_REFUND_REQUEST_PENDING", "SELLER_RESPOND_REFUND", false),
      ),
    ).toBeNull();
  });
});

describe("afterSaleDeadlineState", () => {
  const now = Date.parse("2026-11-04T12:00:00Z");
  const createTime = "2026-11-02T12:00:00Z";

  it("reports time left, urgent under six hours", () => {
    expect(
      afterSaleDeadlineState({ sellerActionDeadline: "2026-11-04T17:12:30Z", createTime }, now),
    ).toEqual({
      state: "left",
      duration: { format: "hoursMinutes", days: 0, hours: 5, minutes: 12 },
      urgent: true,
    });
    expect(
      afterSaleDeadlineState({ sellerActionDeadline: "2026-11-04T18:00:00Z", createTime }, now),
    ).toMatchObject({
      urgent: false,
    });
    expect(
      afterSaleDeadlineState({ sellerActionDeadline: "2026-11-07T14:00:00Z", createTime }, now),
    ).toMatchObject({
      state: "left",
      duration: { format: "daysHours", days: 3, hours: 2 },
    });
  });

  it("reports overdue at and after the deadline", () => {
    expect(
      afterSaleDeadlineState({ sellerActionDeadline: "2026-11-04T12:00:00Z", createTime }, now),
    ).toEqual({ state: "overdue" });
    expect(
      afterSaleDeadlineState({ sellerActionDeadline: "2026-11-01T00:00:00Z", createTime }, now),
    ).toEqual({ state: "overdue" });
  });

  it("reports the age, and invents no SLA, when the platform sets no deadline", () => {
    expect(afterSaleDeadlineState({ sellerActionDeadline: null, createTime }, now)).toEqual({
      state: "noDeadline",
      age: { format: "daysHours", days: 2, hours: 0, minutes: 0 },
    });
  });
});

describe("splitDuration", () => {
  it("picks the unit pair by magnitude and clamps negatives", () => {
    expect(splitDuration(45)).toMatchObject({ format: "minutes", minutes: 45 });
    expect(splitDuration(125)).toMatchObject({ format: "hoursMinutes", hours: 2, minutes: 5 });
    expect(splitDuration(1500)).toMatchObject({ format: "daysHours", days: 1, hours: 1 });
    expect(splitDuration(-10)).toMatchObject({ format: "minutes", minutes: 0 });
  });
});
