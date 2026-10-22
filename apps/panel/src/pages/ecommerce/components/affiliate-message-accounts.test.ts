import { expect, it } from "vitest";
import { GQL } from "@rivonclaw/core";
import { affiliateMessageAccountOptions } from "./affiliate-message-accounts.js";

it("deduplicates recipient contacts per sender account and excludes inactive, disconnected and blocked routes", () => {
  const state = {
    channelContacts: [
      ...["old", "recent"].map((id, index) => ({
        id,
        accountBindingId: "connected",
        channel: "WHATSAPP",
        status: "ACTIVE",
        lastInboundAt: `2026-10-${20 + index}T00:00:00Z`,
      })),
      ...["disconnected", "blocked", "historical"].map((id) => ({
        id,
        accountBindingId: id,
        channel: "WHATSAPP",
        status: id === "historical" ? "HISTORICAL" : "ACTIVE",
        lastObservedAt: "2026-10-21T00:00:00Z",
      })),
    ],
    whatsAppAccounts: [
      {
        id: "connected",
        displayName: "Work account",
        status: "CONNECTED",
        provider: "EVOLUTION_API",
      },
      { id: "disconnected", status: "DISCONNECTED", provider: "EVOLUTION_API" },
      {
        id: "blocked",
        status: "CONNECTED",
        provider: "EVOLUTION_API",
        outboundSendBlockedUntil: new Date(Date.now() + 60_000).toISOString(),
      },
      { id: "historical", status: "CONNECTED", provider: "EVOLUTION_API" },
    ],
  } as unknown as GQL.AffiliateCreatorContactStatePayload;
  expect(affiliateMessageAccountOptions(state, GQL.AffiliateMessageChannel.Whatsapp, true)).toEqual(
    [{ value: "recent", accountBindingId: "connected", label: "Work account", sensitive: true }],
  );
  expect(affiliateMessageAccountOptions(state, GQL.AffiliateMessageChannel.Email, true)).toEqual(
    [],
  );
});
it("uses server-filtered existing public contact labels without requiring assigned BD account catalogs", () => {
  const state = {
    channelContacts: [
      {
        id: "contact",
        accountBindingId: "account",
        accountLabel: "Public sender",
        channel: "EMAIL",
        status: "ACTIVE",
        lastObservedAt: "2026-10-21T00:00:00Z",
      },
    ],
    emailAccounts: [],
  } as unknown as GQL.AffiliateCreatorContactStatePayload;
  expect(
    affiliateMessageAccountOptions(state, GQL.AffiliateMessageChannel.Email, false)[0]?.label,
  ).toBe("Public sender");
  expect(affiliateMessageAccountOptions(state, GQL.AffiliateMessageChannel.Email, true)).toEqual(
    [],
  );
});
