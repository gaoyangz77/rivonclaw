import { GQL } from "@rivonclaw/core";
import type { TFunction } from "i18next";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { TkButton, TkPrivate, TkTooltip } from "../../../components/design-system/index.js";
import { formatAffiliateActor } from "../../../lib/affiliate-actor.js";
import { formatLocalizedDateTime } from "../../../lib/format-datetime.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import "./AffiliateSampleReview.css";

/** Shared identity: an operator alias never replaces the platform shop name. */
export const AffiliateSampleShopIdentity = observer(function AffiliateSampleShopIdentity({
  shopId,
}: {
  shopId?: string | null;
}) {
  const { t } = useTranslation();
  const store = useEntityStore();
  const shop = store.shops.find((candidate) => candidate.id === shopId);
  const alias = shop?.alias?.trim();
  const name = shop?.shopName?.trim();
  return (
    <div className="affiliate-sample-shop-identity">
      <span>{t("ecommerce.affiliateWorkspace.workbench.colShop")}</span>
      {alias ? <strong>{alias}</strong> : null}
      {name ? (
        <TkPrivate className="affiliate-sample-shop-name" sensitive title={name}>
          {name}
        </TkPrivate>
      ) : null}
      {!alias && !name ? <span>{shopId || "—"}</span> : null}
    </div>
  );
});

export function AffiliateSampleIgnoreButton({
  disabled,
  onClick,
}: {
  disabled?: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <TkTooltip
      label={t("ecommerce.affiliateWorkspace.workbench.reviewDescriptions.SOFT_REJECT")}
      trigger={(props) => (
        <TkButton {...props} variant="secondary" disabled={disabled} onClick={onClick}>
          {t("ecommerce.affiliateWorkspace.workbench.softReject")}
        </TkButton>
      )}
    />
  );
}

/** TikTok's status for a Sample Application the seller rejected (or that was cancelled by rejection). */
const PLATFORM_REJECTED_STATUS = "REJECT_CANCELLED";

/**
 * "Rejected" for a Sample Application TikTok reports as rejected, else null.
 *
 * Our own work status folds a rejection into CANCELLED, which reads as if the
 * Creator withdrew; the platform status is what says the seller said no. Every
 * surface that labels a Sample's state asks here first so they cannot disagree.
 */
export function sampleRejectedStatusLabel(
  sampleApplication: Pick<GQL.SampleApplicationRecord, "platformStatus">,
  t: TFunction,
): string | null {
  return sampleApplication.platformStatus === PLATFORM_REJECTED_STATUS
    ? t("ecommerce.affiliateWorkspace.workbench.sampleStatusRejected")
    : null;
}

type SampleReviewResultRecord = Pick<
  GQL.SampleApplicationRecord,
  | "merchantReviewDecidedAt"
  | "merchantReviewActorType"
  | "merchantReviewActor"
  | "merchantReviewRejectReason"
  | "merchantReviewRejectReasonExplanation"
  | "merchantReviewByShopRules"
>;

/**
 * The outcome of a Sample Application's review, as lines of one block: who
 * reviewed it and when, and why it was rejected. The resolved actor names the
 * person (or Agent); a record that carries only the coarse actor type keeps
 * the generic Agent / Staff label. A review the shop's rules made shows one
 * general reason rather than the Provider reason code it sent.
 *
 * Renders nothing when there is nothing to say.
 */
export function SampleReviewResult({
  sampleApplication,
}: {
  sampleApplication: SampleReviewResultRecord;
}) {
  const { t, i18n } = useTranslation();
  const decidedAt = sampleApplication.merchantReviewDecidedAt;
  const rejectReason = sampleApplication.merchantReviewRejectReason;
  const prefix = "ecommerce.affiliateWorkspace.sampleReviewResult";
  const reasonText = sampleApplication.merchantReviewByShopRules
    ? t(`${prefix}.shopRulesReason`)
    : rejectReason
      ? [
          t(`ecommerce.affiliateWorkspace.rejectReasons.${rejectReason}`, {
            defaultValue: rejectReason,
          }),
          sampleApplication.merchantReviewRejectReasonExplanation?.trim(),
        ]
          .filter(Boolean)
          .join(" · ")
      : null;
  if (!decidedAt && !reasonText) return null;

  const actor = sampleApplication.merchantReviewActor
    ? formatAffiliateActor(sampleApplication.merchantReviewActor, t)
    : t(
        sampleApplication.merchantReviewActorType === GQL.AffiliateLifecycleActorType.Agent
          ? "ecommerce.affiliateWorkspace.workbench.reviewActorAgent"
          : "ecommerce.affiliateWorkspace.workbench.reviewActorHuman",
      );

  return (
    <section className="affiliate-sample-review-result" aria-label={t(`${prefix}.label`)}>
      {decidedAt ? (
        <p className="affiliate-sample-review-result-line affiliate-sample-review-result-reviewer">
          {t("ecommerce.affiliateWorkspace.actor.reviewer", { actor })}
          <time dateTime={decidedAt}>{formatLocalizedDateTime(decidedAt, i18n.language)}</time>
        </p>
      ) : null}
      {reasonText ? (
        <p className="affiliate-sample-review-result-line">
          {t(`${prefix}.rejectReason`, { reason: reasonText })}
        </p>
      ) : null}
    </section>
  );
}
