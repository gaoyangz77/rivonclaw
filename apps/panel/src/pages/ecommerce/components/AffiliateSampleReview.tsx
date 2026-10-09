import { GQL } from "@rivonclaw/core";
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

type SampleReviewAttributionRecord = Pick<
  GQL.SampleApplicationRecord,
  "merchantReviewDecidedAt" | "merchantReviewActorType" | "merchantReviewActor"
>;

/**
 * "Reviewed by {who} · {when}" for a Sample Application that has a recorded
 * merchant decision. The resolved actor names the person (or Agent); a record
 * that carries only the coarse actor type keeps the generic Agent / Staff label.
 */
export function SampleReviewAttribution({
  sampleApplication,
}: {
  sampleApplication: SampleReviewAttributionRecord;
}) {
  const { t, i18n } = useTranslation();
  if (!sampleApplication.merchantReviewDecidedAt) return null;
  const actor = sampleApplication.merchantReviewActor
    ? formatAffiliateActor(sampleApplication.merchantReviewActor, t)
    : t(
        sampleApplication.merchantReviewActorType === GQL.AffiliateLifecycleActorType.Agent
          ? "ecommerce.affiliateWorkspace.workbench.reviewActorAgent"
          : "ecommerce.affiliateWorkspace.workbench.reviewActorHuman",
      );
  return (
    <div className="affiliate-workbench-review-attribution">
      {t("ecommerce.affiliateWorkspace.workbench.reviewedBy", {
        actor,
        value: formatLocalizedDateTime(sampleApplication.merchantReviewDecidedAt, i18n.language),
      })}
    </div>
  );
}
