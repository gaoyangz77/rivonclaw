import { describe, expect, it } from "vitest";
import {
  buildFeishuCsEscalationCard,
  buildFeishuCsEscalationResultCard,
} from "./cs-escalation-card.js";
import {
  CS_ESCALATION_CARD_LOCALES,
  getCsEscalationCardMessages,
} from "./cs-escalation-card-i18n.js";

const input = {
  escalationId: "M1DG8V",
  shop: "Test Shop",
  conversationId: "conversation:one",
  buyer: "buyer-one",
  orderId: "order-one",
  reason: "Refund requested",
  context: "Buyer contacted support",
  locale: "en",
} as const;

function serialized(value: unknown): string {
  return JSON.stringify(value);
}

describe("Feishu CS escalation card contract", () => {
  it("sends the versioned Backend callback identity in its submit action", () => {
    const card = buildFeishuCsEscalationCard(input) as any;
    const form = card.body.elements.find((element: any) => element.tag === "form");
    const button = form.elements.find((element: any) => element.tag === "button");

    expect(button).toMatchObject({
      form_action_type: "submit",
      value: {
        action: "rivonclaw.cs:respond",
        callbackVersion: 2,
        escalationId: "M1DG8V",
        conversationId: "conversation:one",
        locale: "en",
      },
    });
    expect(serialized(card)).not.toContain("chatType");
  });

  it("replaces a resolved form with a green terminal card", () => {
    const card = buildFeishuCsEscalationResultCard({
      ...input,
      resolved: true,
      feedback: [
        {
          callbackId: "callback-one",
          decision: "Issue the refund",
          resolved: true,
          submittedAt: Date.UTC(2026, 7, 21, 12, 0),
        },
      ],
      feedbackTotal: 1,
    }) as any;

    expect(card.header.template).toBe("green");
    expect(serialized(card)).toContain("Issue the refund");
    expect(serialized(card)).not.toContain('"tag":"form"');
    expect(serialized(card)).not.toContain('"tag":"button"');
  });

  it("keeps an unresolved card orange and actionable", () => {
    const card = buildFeishuCsEscalationResultCard({
      ...input,
      resolved: false,
      feedback: [
        {
          callbackId: "callback-one",
          decision: "Ask the warehouse",
          resolved: false,
          submittedAt: Date.UTC(2026, 7, 21, 12, 0),
        },
      ],
      feedbackTotal: 1,
    }) as any;

    expect(card.header.template).toBe("orange");
    expect(serialized(card)).toContain("Ask the warehouse");
    expect(serialized(card)).toContain('"tag":"form"');
  });

  it("has complete copy for every supported locale and falls back to English", () => {
    for (const locale of CS_ESCALATION_CARD_LOCALES) {
      expect(Object.values(getCsEscalationCardMessages(locale)).every(Boolean)).toBe(true);
    }
    expect(getCsEscalationCardMessages("unknown")).toEqual(getCsEscalationCardMessages("en"));
  });
});
