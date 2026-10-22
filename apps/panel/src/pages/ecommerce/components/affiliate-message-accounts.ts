import { GQL } from "@rivonclaw/core";

/** Each option is an existing recipient route on one usable sender account. */
export function affiliateMessageAccountOptions(
  state: GQL.AffiliateCreatorContactStatePayload | null | undefined,
  channel: GQL.AffiliateMessageChannel,
  assigned: boolean,
): Array<{ value: string; label: string; accountBindingId: string; sensitive: boolean }> {
  const contacts = [...(state?.channelContacts ?? [])]
    .filter(
      (contact) =>
        contact.channel === channel &&
        contact.status === GQL.AffiliateCreatorChannelContactStatus.Active,
    )
    .sort(
      (a, b) =>
        Date.parse(b.lastInboundAt ?? b.lastOutboundAt ?? b.lastObservedAt) -
          Date.parse(a.lastInboundAt ?? a.lastOutboundAt ?? a.lastObservedAt) ||
        a.id.localeCompare(b.id),
    );
  const accounts =
    channel === GQL.AffiliateMessageChannel.Whatsapp
      ? (state?.whatsAppAccounts ?? [])
      : (state?.emailAccounts ?? []);
  const byAccount = new Map<
    string,
    { value: string; label: string; accountBindingId: string; sensitive: boolean }
  >();
  for (const contact of contacts) {
    const account = accounts.find((candidate) => candidate.id === contact.accountBindingId);
    if (
      assigned &&
      (!account ||
        account.status !== "CONNECTED" ||
        ("outboundSendBlockedUntil" in account &&
          account.outboundSendBlockedUntil &&
          Date.parse(account.outboundSendBlockedUntil) > Date.now()))
    )
      continue;
    if (
      assigned &&
      account?.provider !==
        (channel === GQL.AffiliateMessageChannel.Whatsapp
          ? GQL.WhatsAppProvider.EvolutionApi
          : GQL.EmailProvider.MicrosoftGraph)
    )
      continue;
    if (byAccount.has(contact.accountBindingId)) continue;
    const address =
      account &&
      ("phoneNumber" in account
        ? account.phoneNumber
        : "sharedMailboxAddress" in account
          ? account.sharedMailboxAddress || account.emailAddress
          : undefined);
    byAccount.set(contact.accountBindingId, {
      value: contact.id,
      accountBindingId: contact.accountBindingId,
      label:
        account?.displayName ||
        contact.accountLabel ||
        address ||
        contact.effectiveAlias ||
        contact.accountBindingId,
      sensitive: true,
    });
  }
  return [...byAccount.values()];
}
