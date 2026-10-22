import "./AffiliateCampaignInvitationComposer.css";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { Select } from "../../../components/inputs/Select.js";
import { TkAlert, TkButton, TkPrivate } from "../../../components/design-system/index.js";
import {
  AFFILIATE_CHAT_CAMPAIGN_TEMPLATES_QUERY,
  SEND_AFFILIATE_CAMPAIGN_INVITATION_MUTATION,
} from "../../../api/shops-queries.js";

const prefix = "ecommerce.affiliateWorkspace.campaignInvitation.";

/** Kept behind an explicit disclosure: opening a creator modal adds no query. */
export function AffiliateCampaignInvitationComposer({
  shopId,
  creatorRelationshipId,
  disabled,
  replyToLifecycleEventId,
  onBusyChange,
  onSent,
}: {
  shopId: string;
  creatorRelationshipId: string;
  disabled: boolean;
  replyToLifecycleEventId?: string;
  onBusyChange: (busy: boolean) => void;
  onSent: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [campaignId, setCampaignId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const attempts = useRef(new Map<string, string>());
  const {
    data,
    loading,
    error: queryError,
    refetch,
  } = useQuery<{ affiliateChatCampaignTemplates: GQL.AffiliateChatCampaignTemplate[] }>(
    AFFILIATE_CHAT_CAMPAIGN_TEMPLATES_QUERY,
    {
      variables: { shopId, creatorRelationshipId },
      skip: !open || !shopId || !creatorRelationshipId,
      fetchPolicy: "network-only",
    },
  );
  const [send] = useMutation<
    { sendAffiliateCampaignInvitation: GQL.SendAffiliateCreatorMessagePayload },
    { input: GQL.SendAffiliateCampaignInvitationInput }
  >(SEND_AFFILIATE_CAMPAIGN_INVITATION_MUTATION);
  useEffect(() => {
    setCampaignId("");
    setError(null);
    attempts.current.clear();
    setOpen(false);
  }, [shopId, creatorRelationshipId]);
  const templates = data?.affiliateChatCampaignTemplates ?? [];
  const selected = templates.find((template) => template.id === campaignId);
  const configured = Boolean(
    selected?.sellerContactEmail && selected.products.length && selected.endDays > 0,
  );
  async function submit() {
    if (disabled || sending.current || !configured || !campaignId) return;
    const input: GQL.SendAffiliateCampaignInvitationInput = {
      shopId,
      creatorRelationshipId,
      campaignId,
      replyToLifecycleEventId,
      idempotencyKey: "",
    };
    const fingerprint = JSON.stringify(input);
    if (!attempts.current.has(fingerprint))
      attempts.current.set(fingerprint, `manual-invite-ui:${crypto.randomUUID()}`);
    input.idempotencyKey = attempts.current.get(fingerprint)!;
    sending.current = true;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    try {
      const result = await send({ variables: { input } });
      const delivery = result.data?.sendAffiliateCampaignInvitation.delivery;
      if (!delivery || delivery.status !== GQL.AffiliateDeliveryStatus.Sent) {
        throw new Error(delivery?.errorMessage ?? t(`${prefix}pending`));
      }
      // Retain this attempt after success, too: another click with the same
      // selected template checks the same receipt instead of creating another.
      setCampaignId("");
      setOpen(false);
      onSent();
    } catch (failure) {
      const graphError = failure as {
        errors?: readonly { extensions?: Record<string, unknown> }[];
        graphQLErrors?: readonly { extensions?: Record<string, unknown> }[];
      };
      const code = (graphError.errors ?? graphError.graphQLErrors)?.[0]?.extensions?.code;
      if (code === "MANUAL_INVITATION_REJECTED") attempts.current.delete(fingerprint);
      const reason =
        code === "MANUAL_INVITATION_UNCERTAIN"
          ? t(`${prefix}uncertain`)
          : code === "MANUAL_INVITATION_IDENTITY_REQUIRED"
            ? t(`${prefix}identityRequired`)
            : failure instanceof Error
              ? failure.message
              : String(failure);
      setError(reason);
    } finally {
      sending.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }
  return (
    <div className="affiliate-message-campaign-invitation">
      <TkButton
        variant="secondary"
        size="sm"
        disabled={disabled || busy || !shopId}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {t(`${prefix}title`)}
      </TkButton>
      {open ? (
        <>
          <p className="form-hint">{t(`${prefix}hint`)}</p>
          {queryError ? (
            <TkAlert
              tone="danger"
              title={queryError.message}
              actions={
                <TkButton variant="secondary" size="sm" onClick={() => void refetch()}>
                  {t("common.retry")}
                </TkButton>
              }
            />
          ) : null}
          <Select
            value={campaignId}
            onChange={(value) => {
              setCampaignId(value);
              setError(null);
            }}
            disabled={disabled || busy || loading}
            searchable
            options={templates.map((template) => ({ value: template.id, label: template.name }))}
            ariaLabel={t(`${prefix}select`)}
            placeholder={loading ? t("common.loading") : t(`${prefix}select`)}
            searchPlaceholder={t(`${prefix}search`)}
          />
          {!loading && !queryError && !templates.length ? (
            <p className="form-hint">{t(`${prefix}empty`)}</p>
          ) : null}
          {selected ? (
            <>
              <p className="form-hint">
                {t(`${prefix}terms`, { count: selected.products.length, days: selected.endDays })}
              </p>
              {selected.products.map((product) => (
                <div className="form-hint" key={product.productId}>
                  <TkPrivate>{product.productId}</TkPrivate>
                  {" · "}
                  {t(`${prefix}commission`, {
                    rate: product.commissionRatePercent,
                    ads: product.shopAdsCommissionRatePercent,
                  })}
                </div>
              ))}
              <p className="form-hint">
                <TkPrivate>{selected.sellerContactEmail}</TkPrivate>
                {" · "}
                {t(
                  `${prefix}${selected.isSampleApprovalExempt ? "sampleExempt" : "sampleApproval"}`,
                )}
              </p>
              {!configured ? <p role="alert">{t(`${prefix}incomplete`)}</p> : null}
              <TkButton
                variant="primary"
                size="sm"
                disabled={!configured || busy || disabled}
                onClick={() => void submit()}
              >
                {busy ? t("common.loading") : t(`${prefix}send`)}
              </TkButton>
            </>
          ) : null}
          {error ? (
            <TkAlert tone="danger" title={t(`${prefix}failed`)}>
              {error}
            </TkAlert>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
