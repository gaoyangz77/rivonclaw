import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../../components/Toast.js";
import { fetchChannelStatus, fetchAllowlist, type AllowlistResult, type ChannelsStatusSnapshot } from "../../../api/channels.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { buildAccountsList } from "../../../lib/channel-accounts.js";
import { hasUpgradeRequired } from "../ecommerce-utils.js";

export function useEscalation(
  selectedShopId: string | null,
  setUpgradePrompt: (v: boolean) => void,
) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  const selectedShop = selectedShopId
    ? entityStore.shops.find((shop) => shop.id === selectedShopId) ?? null
    : null;

  const [channelSnapshot, setChannelSnapshot] = useState<ChannelsStatusSnapshot | null>(null);
  const [savingEscalation, setSavingEscalation] = useState(false);
  const [draftEscalationChannel, setDraftEscalationChannel] = useState("");
  const [draftEscalationRecipient, setDraftEscalationRecipient] = useState("");
  const [recipientData, setRecipientData] = useState<Omit<AllowlistResult, "owners"> | null>(null);
  const pendingUserChannelSaveRef = useRef<string | null>(null);

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
    pendingUserChannelSaveRef.current = null;
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
    pendingUserChannelSaveRef.current = value || null;

    // If user cleared the channel (selected "—"), immediately save both as empty strings
    if (!value) {
      const shopId = selectedShop?.id;
      if (!shopId) return;
      setSavingEscalation(true);
      setUpgradePrompt(false);
      try {
        const shop = entityStore.shops.find((s) => s.id === shopId);
        if (!shop) throw new Error(`Shop ${shopId} not found`);
        await shop.update({
          services: {
            customerService: {
              escalationChannelId: "",
              escalationRecipientId: "",
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
      const shop = entityStore.shops.find((s) => s.id === shopId);
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
        // Auto-select the first recipient for a user-initiated channel change.
        // Passive draft syncs from shop data must not write back, or reopening the
        // drawer can revert a just-saved routing change with a stale snapshot.
        // They also must not overwrite the displayed draft recipient; otherwise
        // every reopened drawer shows the first allowlisted recipient instead of
        // the value stored on the shop.
        const shouldSaveUserChannelChange = pendingUserChannelSaveRef.current === draftEscalationChannel;
        const firstRecipient = data.allowlist[0];
        if (firstRecipient && shouldSaveUserChannelChange) {
          setDraftEscalationRecipient(firstRecipient);
          const shopId = selectedShopId;
          if (shopId && shouldSaveUserChannelChange) {
            pendingUserChannelSaveRef.current = null;
            const shop = entityStore.shops.find((s) => s.id === shopId);
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
        } else if (pendingUserChannelSaveRef.current === draftEscalationChannel) {
          pendingUserChannelSaveRef.current = null;
        }
      })
      .catch(() => {
        if (!cancelled) setRecipientData(null);
      });

    return () => { cancelled = true; };
  }, [draftEscalationChannel, selectedShopId]);

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
  const escalationChannelSelectOptions: Array<{ value: string; label: string }> = [
    { value: "", label: t("common.none") },
    ...escalationChannelOptions,
  ];
  // If current draft value is set but not in the options (channel was removed), keep it visible.
  if (draftEscalationChannel && !escalationChannelSelectOptions.some((o) => o.value === draftEscalationChannel)) {
    escalationChannelSelectOptions.push({
      value: draftEscalationChannel,
      label: `${draftEscalationChannel} (${t("crons.channelDisconnected")})`,
    });
  }

  // Build recipient options from the Desktop allowlist API (no empty option — first is auto-selected)
  const escalationRecipientOptions: Array<{ value: string; label: string }> = [];
  if (recipientData) {
    for (const recipientId of recipientData.allowlist) {
      const label = recipientData.labels[recipientId];
      escalationRecipientOptions.push({
        value: recipientId,
        label: label ? `${label} (${recipientId})` : recipientId,
      });
    }
  }
  // If current draft value is set but not in the list, keep it visible
  if (draftEscalationRecipient && !escalationRecipientOptions.some((o) => o.value === draftEscalationRecipient)) {
    escalationRecipientOptions.push({ value: draftEscalationRecipient, label: draftEscalationRecipient });
  }

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
