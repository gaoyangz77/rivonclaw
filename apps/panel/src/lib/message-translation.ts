import { GQL } from "@rivonclaw/core";

/** Site defaults, aligned with backend CsDeterministicMessages. No UI locale inference. */
export const SITE_LANGUAGES: Record<GQL.ShopRegion, string> = {
  US: "en",
  GB: "en",
  MX: "es",
  BR: "pt",
  ES: "es",
  FR: "fr",
  DE: "de",
  IT: "it",
  IE: "en",
  AT: "de",
  NL: "nl",
  PT: "pt",
  HU: "hu",
  CZ: "cs",
  GR: "el",
  BE: "nl",
  PL: "pl",
  TH: "th",
  ID: "id",
  MY: "ms",
  VN: "vi",
  PH: "tl",
  SG: "en",
  JP: "ja",
};
export function siteLanguage(site?: string | null): string {
  return SITE_LANGUAGES[site?.toUpperCase() as GQL.ShopRegion] ?? "en";
}
export function translationIdentity(
  user: { userId: string; accountId?: string } | null | undefined,
): string {
  return user ? JSON.stringify([user.accountId ?? user.userId, user.userId]) : "";
}

export interface InboundLanguageSample {
  id: string;
  text: string;
  time: number;
}
export function languageSamples(items: readonly InboundLanguageSample[]) {
  let remaining = 4_000;
  const samples: string[] = [];
  const evidence: string[] = [];
  for (const item of [...items].sort((a, b) => b.time - a.time || b.id.localeCompare(a.id))) {
    if (!remaining || samples.length === 5) break;
    const text = item.text.trim();
    if (!text || /^[\s\d\p{P}\p{S}]*$/u.test(text)) continue;
    const excerpt = text.slice(0, remaining);
    samples.push(excerpt);
    evidence.push(JSON.stringify([item.id, excerpt]));
    remaining -= excerpt.length;
  }
  return { samples, signature: evidence.join("\n") };
}

export function customerLanguageSamples(messages: readonly Record<string, any>[]) {
  return languageSamples(
    messages.flatMap((message) => {
      if (
        String(message.sender?.role).toUpperCase() !== "BUYER" ||
        message.isSummaryMessage ||
        String(message.type ?? "TEXT").toUpperCase() !== "TEXT" ||
        typeof message.text !== "string"
      )
        return [];
      return [
        {
          id: String(message.messageId ?? message.id ?? ""),
          text: message.text,
          time: Number(message.createTime) || Date.parse(String(message.createTime ?? "")) || 0,
        },
      ];
    }),
  );
}

export function creatorLanguageSamples(
  messages: readonly GQL.AffiliateCreatorMessageHistoryItem[],
  channel: GQL.AffiliateMessageChannel,
  shopId?: string,
) {
  return languageSamples(
    messages.flatMap((message) => {
      if (
        message.direction !== GQL.AffiliateCreatorMessageDirection.Creator ||
        message.channel !== channel ||
        (channel === GQL.AffiliateMessageChannel.PlatformChat && message.shopId !== shopId)
      )
        return [];
      const text = message.parts
        .filter((part) => part.kind === GQL.AffiliateHistoryPartKind.Text)
        .map((part) => part.text ?? "")
        .join("\n");
      return [{ id: message.messageRef, text, time: Date.parse(message.createdAt ?? "") || 0 }];
    }),
  );
}
