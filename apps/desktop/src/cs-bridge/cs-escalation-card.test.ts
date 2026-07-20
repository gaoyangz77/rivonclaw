import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "../i18n/locale.js";
import {
  buildFeishuCsEscalationCard,
  buildFeishuCsEscalationResultCard,
} from "./cs-escalation-card.js";
import {
  getCsEscalationCardLocales,
  getCsEscalationCardMessages,
} from "./cs-escalation-card-i18n.js";

describe("Feishu CS escalation card", () => {
  it("contains one multiline input, one resolved-by-default select, and one submit button", () => {
    const card = buildFeishuCsEscalationCard({
      escalationId: "M1DG8V",
      shop: "Test Shop",
      conversationId: "conv-1",
      buyer: "mayracastrocabrer",
      orderId: "576924518065478202",
      reason: "Refund requested",
      context: "Buyer contacted support",
      locale: "en",
    }) as any;
    const form = card.body.elements.find((element: any) => element.tag === "form");

    expect(form.elements.filter((element: any) => element.tag === "input")).toEqual([
      expect.objectContaining({ name: "decision", input_type: "multiline_text", required: true }),
    ]);
    expect(form.elements.filter((element: any) => element.tag === "select_static")).toEqual([
      expect.objectContaining({
        name: "resolution",
        initial_option: "resolved",
        required: true,
        placeholder: expect.objectContaining({ tag: "plain_text" }),
      }),
    ]);
    expect(
      form.elements.find((element: any) => element.tag === "select_static"),
    ).not.toHaveProperty("label");
    expect(form.elements.filter((element: any) => element.tag === "button")).toEqual([
      expect.objectContaining({
        name: "rivonclaw.cs:respond:M1DG8V",
        form_action_type: "submit",
        value: expect.objectContaining({
          action: "rivonclaw.cs:respond",
          escalationId: "M1DG8V",
        }),
      }),
    ]);
  });

  it("escapes and truncates dynamic markdown", () => {
    const card = buildFeishuCsEscalationCard({
      escalationId: "M1DG8V",
      shop: "<shop>",
      conversationId: "conv-1",
      buyer: "buyer",
      reason: `<unsafe>${"x".repeat(3_000)}`,
      locale: "en",
    }) as any;
    const markdown = card.body.elements[0].content as string;

    expect(markdown).toContain("&lt;shop&gt;");
    expect(markdown).toContain("&lt;unsafe&gt;");
    expect(markdown).not.toContain("<unsafe>");
    expect(markdown.length).toBeLessThan(3_000);
  });

  it("keeps the escalation details when replacing the original form with a green result", () => {
    const input = {
      escalationId: "M1DG8V",
      shop: "Test Shop",
      conversationId: "conv-1",
      buyer: "mayracastrocabrer",
      orderId: "576924518065478202",
      reason: "Refund requested",
      context: "Buyer contacted support",
      locale: "en",
    } as const;
    const pendingCard = buildFeishuCsEscalationCard(input) as any;
    const card = buildFeishuCsEscalationResultCard({
      ...input,
      resolved: true,
      feedback: [
        {
          callbackId: "callback-1",
          decision: "Approve the full refund",
          resolved: true,
          submittedAt: Date.UTC(2026, 6, 20, 12, 0),
        },
      ],
      feedbackTotal: 1,
    }) as any;
    const serialized = JSON.stringify(card);

    expect(card.header.template).toBe("green");
    expect(card.body.elements[0]).toEqual(pendingCard.body.elements[0]);
    expect(serialized).toContain("Test Shop");
    expect(serialized).toContain("mayracastrocabrer");
    expect(serialized).toContain("576924518065478202");
    expect(serialized).toContain("Refund requested");
    expect(serialized).toContain("Buyer contacted support");
    expect(serialized).toContain("Approve the full refund");
    expect(serialized).toContain("Resolution");
    expect(serialized).toContain("Resolved");
    expect(serialized).not.toContain("Feedback history");
    expect(serialized).not.toContain('"tag":"form"');
    expect(serialized).not.toContain('"tag":"button"');
  });

  it("separates unresolved intermediate history from the single final result", () => {
    const card = buildFeishuCsEscalationResultCard({
      escalationId: "M1DG8V",
      shop: "Test Shop",
      conversationId: "conv-1",
      buyer: "mayracastrocabrer",
      reason: "Refund requested",
      locale: "zh",
      resolved: true,
      feedback: [
        {
          callbackId: "callback-1",
          decision: "先向仓库确认库存",
          resolved: false,
          submittedAt: Date.UTC(2026, 6, 20, 12, 0),
        },
        {
          callbackId: "callback-2",
          decision: "仓库已确认，安排补发并结案",
          resolved: true,
          submittedAt: Date.UTC(2026, 6, 20, 12, 5),
        },
      ],
      feedbackTotal: 2,
    }) as any;
    const serialized = JSON.stringify(card);

    expect(serialized).toContain("处理记录");
    expect(serialized).toContain("先向仓库确认库存");
    expect(serialized).toContain("处理结果");
    expect(serialized).toContain("仓库已确认，安排补发并结案");
    expect(serialized.match(/处理结果/g)).toHaveLength(1);
    expect(serialized).not.toContain("#2");
  });

  it("keeps an unresolved escalation orange and actionable with feedback history", () => {
    const card = buildFeishuCsEscalationResultCard({
      escalationId: "M1DG8V",
      shop: "Test Shop",
      conversationId: "conv-1",
      buyer: "mayracastrocabrer",
      reason: "Refund requested",
      locale: "en",
      resolved: false,
      feedback: [
        {
          callbackId: "callback-1",
          decision: "Ask the warehouse for an update",
          resolved: false,
          submittedAt: Date.UTC(2026, 6, 20, 12, 0),
        },
      ],
      feedbackTotal: 1,
    }) as any;
    const serialized = JSON.stringify(card);

    expect(card.header.template).toBe("orange");
    expect(serialized).toContain("Feedback history");
    expect(serialized).toContain("Ask the warehouse for an update");
    expect(serialized).toContain("still open");
    expect(serialized).toContain('"tag":"form"');
    expect(serialized).toContain('"tag":"button"');
  });

  it("has a complete typed catalog for every Desktop locale and falls back to English", () => {
    expect([...getCsEscalationCardLocales()].sort()).toEqual([...SUPPORTED_LOCALES].sort());
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.values(getCsEscalationCardMessages(locale)).every(Boolean)).toBe(true);
    }
    expect(getCsEscalationCardMessages("unknown")).toEqual(getCsEscalationCardMessages("en"));
  });
});
