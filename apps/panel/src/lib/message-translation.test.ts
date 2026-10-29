import { describe, expect, it } from "vitest";
import { GQL } from "@rivonclaw/core";
import {
  creatorLanguageSamples,
  customerLanguageSamples,
  languageSamples,
  siteLanguage,
  SITE_LANGUAGES,
  translationIdentity,
} from "./message-translation.js";
describe("translation language evidence", () => {
  it("covers every supported site with known defaults and unknown English fallback", () => {
    expect(Object.keys(SITE_LANGUAGES).sort()).toEqual(Object.values(GQL.ShopRegion).sort());
    expect(siteLanguage("MX")).toBe("es");
    expect(siteLanguage("MY")).toBe("ms");
    expect(siteLanguage("SG")).toBe("en");
    expect(siteLanguage(null)).toBe("en");
  });
  it("limits latest-first samples, excludes nonlinguistic content and caps total characters", () => {
    const result = languageSamples(
      Array.from({ length: 9 }, (_, i) => ({ id: String(i), text: "hola".repeat(300), time: i })),
    );
    expect(result.samples.join("").length).toBe(4000);
    expect(result.signature).toContain('"8"');
    expect(result.signature).not.toContain('"0"');
    expect(languageSamples([{ id: "1", text: "12345 😊 https://", time: 1 }]).samples).toHaveLength(
      1,
    );
    expect(languageSamples([{ id: "1", text: "12345 😊", time: 1 }]).samples).toHaveLength(0);
    expect(
      languageSamples(
        Array.from({ length: 8 }, (_, i) => ({ id: String(i), text: "Hola", time: i })),
      ).samples,
    ).toHaveLength(5);
  });
  it("uses buyer text only, excludes summaries, cards, images and seller text", () => {
    expect(
      customerLanguageSamples([
        {
          messageId: "one",
          sender: { role: "BUYER" },
          type: "TEXT",
          text: "Hola",
          createTime: "2026-10-29T00:00:00Z",
        },
        { sender: { role: "CUSTOMER_SERVICE" }, type: "TEXT", text: "Hello" },
        { sender: { role: "BUYER" }, type: "PRODUCT_CARD", text: '{"title":"test"}' },
        { sender: { role: "BUYER" }, type: "IMAGE", text: "image" },
        { sender: { role: "BUYER" }, isSummaryMessage: true, text: "Summary" },
      ]).samples,
    ).toEqual(["Hola"]);
  });
  it("filters creator channel and platform shop and never includes card JSON", () => {
    const make = (channel: string, shopId: string, direction = "CREATOR") =>
      ({
        channel,
        shopId,
        direction,
        messageRef: shopId + channel,
        parts: [
          { kind: "TEXT", text: shopId + channel },
          { kind: "TARGET_COLLABORATION_CARD", text: "json" },
        ],
      }) as GQL.AffiliateCreatorMessageHistoryItem;
    const messages = [
      make("PLATFORM_CHAT", "1"),
      make("PLATFORM_CHAT", "2"),
      make("WHATSAPP", "1"),
      make("EMAIL", "1"),
      make("PLATFORM_CHAT", "1", "SELLER"),
    ];
    expect(
      creatorLanguageSamples(messages, GQL.AffiliateMessageChannel.PlatformChat, "1").samples,
    ).toEqual(["1PLATFORM_CHAT"]);
    expect(creatorLanguageSamples(messages, GQL.AffiliateMessageChannel.Whatsapp).samples).toEqual([
      "1WHATSAPP",
    ]);
    expect(creatorLanguageSamples(messages, GQL.AffiliateMessageChannel.Email).samples).toEqual([
      "1EMAIL",
    ]);
  });
  it("distinguishes owner and member identities", () => {
    expect(translationIdentity({ userId: "owner", accountId: "owner" })).not.toBe(
      translationIdentity({ userId: "member", accountId: "owner" }),
    );
    expect(translationIdentity(null)).toBe("");
  });
});
