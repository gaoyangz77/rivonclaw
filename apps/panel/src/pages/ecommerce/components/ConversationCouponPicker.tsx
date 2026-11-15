import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { Instance } from "mobx-state-tree";
import { GQL } from "@rivonclaw/core";
import { RefreshIcon } from "../../../components/icons.js";
import {
  TkBadge,
  TkButton,
  TkField,
  TkIconButton,
} from "../../../components/design-system/index.js";
import { useToast } from "../../../components/Toast.js";
import { formatLocalizedDate } from "../../../lib/format-datetime.js";
import type { CustomerServiceWorkspaceModel } from "../../../store/models/CustomerServiceWorkspaceModel.js";
import "./ConversationCouponPicker.css";

const PREFIX = "ecommerce.customerServiceWorkspace";
const UNKNOWN_VALUE = "—";

type Coupon = GQL.CustomerServiceCoupon;

function money(value: GQL.CouponMoney | null | undefined): string | null {
  return value ? `${value.amount} ${value.currency}` : null;
}

function discountSummary(coupon: Coupon, t: TFunction): string {
  const { discount } = coupon;
  if (discount.type === GQL.CouponDiscountType.AmountOff) {
    const amount = money(discount.reductionAmount);
    return amount ? t(`${PREFIX}.couponDiscountAmount`, { amount }) : UNKNOWN_VALUE;
  }
  if (discount.type === GQL.CouponDiscountType.PercentOff && discount.percentage) {
    const max = money(discount.maxDiscount);
    return max
      ? t(`${PREFIX}.couponDiscountPercentMax`, { percentage: discount.percentage, max })
      : t(`${PREFIX}.couponDiscountPercent`, { percentage: discount.percentage });
  }
  return UNKNOWN_VALUE;
}

function thresholdSummary(coupon: Coupon, t: TFunction): string {
  const { threshold } = coupon;
  if (threshold.type === GQL.CouponThresholdType.None) return t(`${PREFIX}.couponThresholdNone`);
  const minSpend = money(threshold.minSpend);
  if (threshold.type === GQL.CouponThresholdType.MinSpend && minSpend) {
    return t(`${PREFIX}.couponThresholdMin`, { amount: minSpend });
  }
  return UNKNOWN_VALUE;
}

const DISPLAY_TYPE_KEYS: Record<GQL.CouponDisplayType, string | null> = {
  [GQL.CouponDisplayType.Chat]: "couponDisplayChat",
  [GQL.CouponDisplayType.Regular]: "couponDisplayRegular",
  [GQL.CouponDisplayType.Live]: "couponDisplayLive",
  [GQL.CouponDisplayType.CreatorExclusive]: "couponDisplayCreatorExclusive",
  [GQL.CouponDisplayType.PromoCode]: "couponDisplayPromoCode",
  [GQL.CouponDisplayType.Unknown]: null,
};

const NOT_SENDABLE_REASON_KEYS: Record<GQL.CouponNotSendableReason, string> = {
  [GQL.CouponNotSendableReason.NotOngoing]: "couponReasonNotOngoing",
  [GQL.CouponNotSendableReason.DisplayTypeNotChatOrRegular]: "couponReasonDisplayType",
  [GQL.CouponNotSendableReason.RepeatCustomersOnly]: "couponReasonRepeatCustomers",
};

function claimEndMillis(coupon: Coupon): number {
  const millis = coupon.claimEndTime ? Date.parse(coupon.claimEndTime) : Number.NaN;
  return Number.isNaN(millis) ? Number.POSITIVE_INFINITY : millis;
}

/** Sendable coupons first, then the ones that stop being claimable soonest. */
function sortCoupons(coupons: readonly Coupon[]): Coupon[] {
  return [...coupons].sort(
    (a, b) => Number(b.sendable) - Number(a.sendable) || claimEndMillis(a) - claimEndMillis(b),
  );
}

function matchesSearch(coupon: Coupon, search: string): boolean {
  return (
    coupon.title.toLowerCase().includes(search) || coupon.id.toLowerCase().includes(search)
  );
}

/**
 * Popover body that lists the shop's ongoing coupons and sends one to the buyer with a
 * click. The page owns the trigger and the open state; this component loads the list
 * while open and drops it when closed so every opening reads live coupon state.
 */
export const ConversationCouponPicker = observer(function ConversationCouponPicker({
  workspace,
  shopId,
  conversationId,
  open,
}: {
  workspace: Instance<typeof CustomerServiceWorkspaceModel>;
  shopId: string;
  conversationId: string;
  open: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    void workspace.fetchCoupons(shopId);
    return () => {
      workspace.discardCoupons(shopId);
      setSearch("");
    };
  }, [open, shopId, workspace]);

  const list = workspace.shopCoupons.get(shopId);
  const loading = workspace.isCouponsLoading(shopId);
  const error = workspace.couponsErrors.get(shopId) ?? null;
  const query = search.trim().toLowerCase();
  const coupons = list
    ? sortCoupons(list.coupons).filter((coupon) => !query || matchesSearch(coupon, query))
    : [];

  const send = async (couponId: string) => {
    try {
      if (await workspace.sendCoupon({ shopId, conversationId, couponId }, i18n.language)) {
        showToast(t(`${PREFIX}.couponSent`), "success");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : t(`${PREFIX}.couponSendFailed`), "error");
    }
  };

  return (
    <>
      <div className="cs-conversation-order-head">
        <span>{t(`${PREFIX}.couponListTitle`, { count: list?.coupons.length ?? 0 })}</span>
        <TkIconButton
          size="sm"
          label={t("common.refresh")}
          onClick={() => void workspace.fetchCoupons(shopId, true)}
          disabled={loading}
        >
          <RefreshIcon size={14} />
        </TkIconButton>
      </div>
      <div className="cs-coupon-search">
        <TkField
          label={t(`${PREFIX}.couponSearchLabel`)}
          hideLabel
          placeholder={t(`${PREFIX}.couponSearchPlaceholder`)}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="cs-conversation-order-body">
        {loading && !list && (
          <div className="cs-order-context-state" role="status">
            {t("common.loading")}
          </div>
        )}
        {error && (
          <div className="cs-order-context-state error" role="alert">
            <span>{t(`${PREFIX}.couponsLoadFailed`)}</span>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => void workspace.fetchCoupons(shopId, true)}
              disabled={loading}
            >
              {t(`${PREFIX}.orderRetry`)}
            </button>
          </div>
        )}
        {list && list.truncated && (
          <div className="cs-coupon-truncated" role="note">
            {t(`${PREFIX}.couponsTruncated`, { count: list.coupons.length })}
          </div>
        )}
        {list && list.coupons.length === 0 && (
          <div className="cs-order-context-state">{t(`${PREFIX}.couponsEmpty`)}</div>
        )}
        {list && list.coupons.length > 0 && coupons.length === 0 && (
          <div className="cs-order-context-state">{t(`${PREFIX}.couponsNoMatch`)}</div>
        )}
        {coupons.map((coupon) => {
          const displayTypeKey = DISPLAY_TYPE_KEYS[coupon.displayType];
          const reasonKey = coupon.notSendableReason
            ? NOT_SENDABLE_REASON_KEYS[coupon.notSendableReason]
            : null;
          return (
            <div className="cs-coupon-row" key={coupon.id}>
              <div className="cs-coupon-main">
                <div className="cs-coupon-title">
                  <strong>{coupon.title}</strong>
                  <code>{coupon.id}</code>
                </div>
                <div className="cs-coupon-terms">
                  <span className="cs-coupon-discount">{discountSummary(coupon, t)}</span>
                  <span>{thresholdSummary(coupon, t)}</span>
                  {coupon.claimEndTime && (
                    <span>
                      {t(`${PREFIX}.couponClaimEnds`, {
                        date: formatLocalizedDate(coupon.claimEndTime, i18n.language),
                      })}
                    </span>
                  )}
                  {coupon.singleBuyerClaimLimit != null && (
                    <span>
                      {t(`${PREFIX}.couponPerBuyerLimit`, { count: coupon.singleBuyerClaimLimit })}
                    </span>
                  )}
                </div>
                <div className="cs-coupon-badges">
                  <TkBadge tone={displayTypeKey ? "info" : "neutral"}>
                    {displayTypeKey ? t(`${PREFIX}.${displayTypeKey}`) : UNKNOWN_VALUE}
                  </TkBadge>
                  {coupon.targetBuyerSegment === GQL.CouponTargetBuyerSegment.New && (
                    <TkBadge tone="accent">{t(`${PREFIX}.couponNewCustomersOnly`)}</TkBadge>
                  )}
                </div>
                {!coupon.sendable && reasonKey && (
                  <div className="cs-coupon-reason">{t(`${PREFIX}.${reasonKey}`)}</div>
                )}
              </div>
              <TkButton
                size="sm"
                variant="primary"
                disabled={!coupon.sendable}
                loading={workspace.isCouponSending({ shopId, conversationId, couponId: coupon.id })}
                onClick={() => void send(coupon.id)}
              >
                {t(`${PREFIX}.couponSend`)}
              </TkButton>
            </div>
          );
        })}
      </div>
    </>
  );
});
