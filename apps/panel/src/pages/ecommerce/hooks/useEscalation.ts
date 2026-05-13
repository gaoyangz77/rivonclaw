import { useState, useEffect, useMemo } from "react";
import type { Instance } from "mobx-state-tree";
import { useTranslation } from "react-i18next";
import { useToast } from "../../../components/Toast.js";
import { fetchChannelStatus, fetchAllowlist, type AllowlistResult, type ChannelsStatusSnapshot } from "../../../api/channels.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { buildAccountsList } from "../../../lib/channel-accounts.js";
import { hasUpgradeRequired } from "../ecommerce-utils.js";
import { ShopModel } from "../../../store/models/index.js";

type Shop = Instance<typeof ShopModel>;

export function useEscalation(
  selectedShop: Shop | null,
  shops: Shop[],
  setUpgradePrompt: (v: boolean) => void,
) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();

  const [channelSnapshot, setChannelSnapshot] = useState<ChannelsStatusSnapshot | null>(null);
  const [savingEscalation, setSavingEscalation] = useState(false);
  const [draftEscalationChannel, setDraftEscalationChannel] = useState("");
  const [draftEscalationRecipient, setDraftEscalationRecipient] = useState("");
  const [recipientData, setRecipientData] = useState<Omit<AllowlistResult, "owners"> | null>(null);

  // Fetch channel accounts for escalation channel selector
  useEffect(() => {
    let cancelled = false;
    fetchChannelStatus(false)
      .then((snapshot) => {
        if (cancelled || !snapshot) return;
        setChannelSnapshot(snapshot);
      })
      .catch(() => {
        // Channel status unavailable — MST accounts can still render without runtime state.
      });
    return () => { cancelled = true; };
  }, []);

  // Sync draft escalation fields from shop data when shop selection changes
  useEffect(() => {
    const cs = selectedShop?.services?.customerService;
    setDraftEscalationChannel(cs?.escalationChannelId ?? "");
    setDraftEscalationRecipient(cs?.escalationRecipientId ?? "");
  }, [selectedShop?.id, selectedShop?.services?.customerService?.escalationChannelId, selectedShop?.services?.customerService?.escalationRecipientId]);

  function handleError(err: unknown, fallbackKey: string) {
    if (hasUpgradeRequired(err)) {
      setUpgradePrompt(true);
    } else {
      setUpgradePrompt(false);
      showToast(err instanceof Error ? err.message : t(fallbackKey), "error");
    }
  }

  async function handleDraftEscalationChannelChange(value: string) {
    setDraftEscalationChannel(value);
    // Clear recipient when channel changes — the previous recipient is invalid for a different channel
    setDraftEscalationRecipient("");

    // If user cleared the channel (selected "—"), immediately save both as null
    if (!value) {
      const shopId = selectedShop?.id;
      if (!shopId) return;
      setSavingEscalation(true);
      setUpgradePrompt(false);
      try {
        const shop = shops.find((s) => s.id === shopId);
        if (!shop) throw new Error(`Shop ${shopId} not found`);
        await shop.update({
          services: {
            customerService: {
              escalationChannelId: null,
              escalationRecipientId: null,
            },
          },
        });
      } catch (err) {
        handleError(err, "ecommerce.updateFailed");
      } finally {
        setSavingEscalation(false);
      }
    }
  }

  async function handleEscalationRecipientChange(value: string) {
    setDraftEscalationRecipient(value);
    // If user cleared the recipient (selected "—"), don't save — they might be switching
    if (!value) return;
    // Auto-save both channel + recipient when recipient is selected
    const shopId = selectedShop?.id;
    if (!shopId || !draftEscalationChannel) return;
    setSavingEscalation(true);
    setUpgradePrompt(false);
    try {
      const shop = shops.find((s) => s.id === shopId);
      if (!shop) throw new Error(`Shop ${shopId} not found`);
      await shop.update({
        services: {
          customerService: {
            escalationChannelId: draftEscalationChannel,
            escalationRecipientId: value,
          },
        },
      });
    } catch (err) {
      handleError(err, "ecommerce.updateFailed");
    } finally {
      setSavingEscalation(false);
    }
  }

  // Fetch allowlist from Desktop API when the draft escalation channel changes
  useEffect(() => {
    if (!draftEscalationChannel) {
      setRecipientData(null);
      return;
    }

    const colonIdx = draftEscalationChannel.indexOf(":");
    if (colonIdx === -1) return;
    const channelId = draftEscalationChannel.slice(0, colonIdx);
    const accountId = draftEscalationChannel.slice(colonIdx + 1);

    let cancelled = false;
    fetchAllowlist(channelId, accountId)
      .then((data) => {
        if (cancelled) return;
        setRecipientData({ allowlist: data.allowlist, labels: data.labels });
        // Auto-select first recipient and save only if values actually changed
        const firstRecipient = data.allowlist[0];
        if (firstRecipient) {
          setDraftEscalationRecipient(firstRecipient);
          // Only save if channel or recipient changed from what's already persisted
          const shopId = selectedShop?.id;
          if (shopId) {
            const shop = shops.find((s) => s.id === shopId);
            const cs = shop?.services?.customerService;
            if (shop && (cs?.escalationChannelId !== draftEscalationChannel || cs?.escalationRecipientId !== firstRecipient)) {
              setSavingEscalation(true);
              shop.update({
                services: {
                  customerService: {
                    escalationChannelId: draftEscalationChannel,
                    escalationRecipientId: firstRecipient,
                  },
                },
              })
                .catch((err: unknown) => handleError(err, "ecommerce.updateFailed"))
                .finally(() => setSavingEscalation(false));
            }
          }
        }
      })
      .catch(() => {
        if (!cancelled) setRecipientData(null);
      });

    return () => { cancelled = true; };
  }, [draftEscalationChannel]);

  // Channel accounts in MST are the source of truth for account existence/name.
  // The gateway snapshot is only a runtime overlay. This mirrors ChannelsPage,
  // preventing stale WeChat runtime accounts from appearing after QR re-login.
  const availableEscalationAccounts = buildAccountsList(entityStore.channelAccounts, channelSnapshot, t)
    .map(({ channelId, channelLabel, account }) => ({
      channelId,
      account,
      value: `${channelId}:${account.accountId}`,
      label: `${channelLabel} - ${account.name || account.accountId}`,
    }));

  const escalationChannelOptions = availableEscalationAccounts.map(({ value, label }) => ({ value, label }));

  // Prepend "None" option for escalation channel selector
  const escalationChannelSelectOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [
      { value: "", label: t("common.none") },
      ...escalationChannelOptions,
    ];
    // If current draft value is set but not in the options (channel was removed), keep it visible.
    if (draftEscalationChannel && !opts.some((o) => o.value === draftEscalationChannel)) {
      opts.push({
        value: draftEscalationChannel,
        label: `${draftEscalationChannel} (${t("crons.channelDisconnected")})`,
      });
    }
    return opts;
  }, [escalationChannelOptions, draftEscalationChannel, t]);

  // Build recipient options from the Desktop allowlist API (no empty option — first is auto-selected)
  const escalationRecipientOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [];
    if (!recipientData) return opts;

    for (const recipientId of recipientData.allowlist) {
      const label = recipientData.labels[recipientId];
      opts.push({
        value: recipientId,
        label: label ? `${label} (${recipientId})` : recipientId,
      });
    }

    // If current draft value is set but not in the list, keep it visible
    if (draftEscalationRecipient && !opts.some((o) => o.value === draftEscalationRecipient)) {
      opts.push({ value: draftEscalationRecipient, label: draftEscalationRecipient });
    }

    return opts;
  }, [recipientData, draftEscalationRecipient]);

  return {
    savingEscalation,
    draftEscalationChannel,
    draftEscalationRecipient,
    escalationChannelSelectOptions,
    escalationRecipientOptions,
    handleDraftEscalationChannelChange,
    handleEscalationRecipientChange,
  };
}
