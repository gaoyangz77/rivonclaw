import type { GQL } from "@rivonclaw/core";
import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { normalizeLanguageCode } from "../../../i18n/languages.js";
import {
  TkEmptyState,
  TkButton,
  TkTooltip,
  TkMetric,
  TkPanel,
  TkPanelBody,
  TkPanelHeader,
} from "../../../components/design-system/index.js";
import { formatLocalizedDateTime } from "../../../lib/format-datetime.js";
import "./CreatorPerformanceInsights.css";

type Share = GQL.AffiliateCreatorPerformanceShare;
const PREFIX = "ecommerce.affiliateWorkspace.creatorPerformance";

export const CreatorPerformanceInsights = observer(function CreatorPerformanceInsights({
  details,
  market,
}: {
  details: GQL.AffiliateCreatorPerformanceDetails | null | undefined;
  market?: string;
}) {
  const { t, i18n } = useTranslation();
  const store = useEntityStore();
  const locale = normalizeLanguageCode(i18n.resolvedLanguage ?? i18n.language);
  const text = (key: string) => t(`${PREFIX}.${key}`);
  const percent = (value: number) =>
    new Intl.NumberFormat(i18n.language, {
      style: "percent",
      maximumFractionDigits: 2,
    }).format(value);
  const count = (value: number | null | undefined) =>
    value == null
      ? null
      : new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 }).format(value);
  const money = (value: GQL.AffiliateCreatorPerformanceDetailMoney | null | undefined) => {
    if (!value) return null;
    const format = (amount: number) =>
      new Intl.NumberFormat(i18n.language, {
        style: "currency",
        currency: value.currency,
        maximumFractionDigits: 2,
      }).format(amount);
    if (value.amount != null) return format(value.amount);
    if (value.minimumAmount != null && value.maximumAmount != null) {
      return `${format(value.minimumAmount)} – ${format(value.maximumAmount)}`;
    }
    if (value.minimumAmount != null) return `≥ ${format(value.minimumAmount)}`;
    if (value.maximumAmount != null) return `≤ ${format(value.maximumAmount)}`;
    return null;
  };
  const label = (key: string) => {
    const normalized = key.toUpperCase().replace(/_GMV$/, "");
    const labels: Record<string, string> = {
      VIDEO: "video",
      LIVE: "live",
      SHOWCASE: "showcase",
      PRODUCT_CARD: "showcase",
      MALE: "male",
      FEMALE: "female",
      OTHER: "other",
      UNKNOWN: "unknown",
      "-1": "other",
    };
    return labels[normalized] ? text(labels[normalized]) : key;
  };
  const card = (title: string, items: Share[], kind: "donut" | "bars", category = false) => (
    <TkPanel
      as="section"
      padding="none"
      className="creator-performance-chart"
      aria-label={text(title)}
    >
      <TkPanelHeader title={text(title)} />
      <TkPanelBody>
        {items.length ? (
          <ShareChart
            items={items.map((item) => ({
              ...item,
              label:
                category && item.key !== "-1"
                  ? ((market ? store.productCategoryName(locale, market, item.key) : null) ??
                    t(`${PREFIX}.categoryId`, { id: item.key }))
                  : label(item.key),
              tooltip: category ? item.key : undefined,
            }))}
            kind={kind}
            title={text(title)}
            formatPercent={percent}
          />
        ) : (
          <p className="creator-performance-unavailable">{text("unavailable")}</p>
        )}
      </TkPanelBody>
    </TkPanel>
  );
  const metrics = (title: string, rows: Array<[string, string | null]>) => (
    <TkPanel as="section" padding="none" aria-label={text(title)}>
      <TkPanelHeader title={text(title)} />
      <TkPanelBody>
        <div className="creator-performance-metrics">
          {rows.map(([key, value]) => (
            <TkMetric key={key} label={text(key)} value={value ?? "—"} />
          ))}
        </div>
      </TkPanelBody>
    </TkPanel>
  );
  if (!details) {
    return (
      <div className="creator-performance-insights">
        <TkEmptyState title={text("noDetails")} />
      </div>
    );
  }
  return (
    <div className="creator-performance-insights">
      <div className="creator-performance-caption">
        <span>{text("snapshot")}</span>
        <time dateTime={details.observedAt}>
          {formatLocalizedDateTime(details.observedAt, i18n.language)}
        </time>
      </div>
      <div className="creator-performance-sales">
        {card("channelGmv", details.contentGmvDistribution, "donut")}
        {card("categoryGmv", details.categoryGmvDistribution, "donut", true)}
      </div>
      <div className="creator-performance-audience">
        {card(
          "followerAge",
          [...details.followerAge].sort((a, b) => parseInt(a.key) - parseInt(b.key)),
          "bars",
        )}
        {card("followerGender", details.followerGender, "donut")}
        {card(
          "followerLocation",
          [...details.followerLocation].sort((a, b) => b.share - a.share),
          "bars",
        )}
      </div>
      <p className="creator-performance-note">{text("shareNote")}</p>
      <div className="creator-performance-activity">
        {metrics("collaboration", [
          ["promotedProducts", count(details.promotedProductCount)],
          ["brands", count(details.brandCollaborationCount)],
          [
            "commission",
            details.averageCommissionRate == null ? null : percent(details.averageCommissionRate),
          ],
          ["buyerGmv", money(details.averageGmvPerBuyer)],
          ["productPrice", money(details.productOriginalPriceRange)],
        ])}
        {metrics("videoPerformance", [
          ["gpm", money(details.videoGpm)],
          [
            "engagement",
            details.videoEngagementRate == null ? null : percent(details.videoEngagementRate),
          ],
          ["likes", count(details.averageVideoLikeCount)],
          ["comments", count(details.averageVideoCommentCount)],
          ["shares", count(details.averageVideoShareCount)],
        ])}
        {metrics("livePerformance", [
          ["gpm", money(details.liveGpm)],
          [
            "engagement",
            details.liveEngagementRate == null ? null : percent(details.liveEngagementRate),
          ],
          ["views", count(details.averageLiveViewCount)],
          ["likes", count(details.averageLiveLikeCount)],
          ["comments", count(details.averageLiveCommentCount)],
          ["shares", count(details.averageLiveShareCount)],
        ])}
      </div>
    </div>
  );
});

function ShareChart({
  items,
  kind,
  title,
  formatPercent,
}: {
  items: Array<Share & { label: string; tooltip?: string }>;
  kind: "donut" | "bars";
  title: string;
  formatPercent: (value: number) => string;
}) {
  let offset = 0;
  // A neutral track remains visible for shares the platform did not report.
  // Never stretch partial demographics or top-region results to fill 100%.
  const segments = items.map((item) => {
    const start = offset;
    const size = Math.min(item.share * 100, Math.max(0, 100 - start));
    offset += size;
    return { ...item, start, size };
  });
  return (
    <div className={`creator-performance-share-chart creator-performance-share-chart-${kind}`}>
      {kind === "donut" ? (
        <svg
          className="creator-performance-donut"
          viewBox="0 0 120 120"
          role="img"
          aria-label={title}
        >
          <title>
            {items.map((item) => `${item.label}: ${formatPercent(item.share)}`).join(", ")}
          </title>
          <circle
            className="creator-performance-track"
            cx="60"
            cy="60"
            r="46"
            fill="none"
            strokeWidth="14"
          />
          {segments.map((item, index) => (
            <circle
              key={item.key}
              className={`creator-performance-tone-${index % 5}`}
              cx="60"
              cy="60"
              r="46"
              fill="none"
              strokeWidth="14"
              pathLength="100"
              strokeDasharray={`${item.size} ${100 - item.size}`}
              strokeDashoffset={-item.start}
              transform="rotate(-90 60 60)"
            />
          ))}
        </svg>
      ) : null}
      <ul className="creator-performance-share-list">
        {items.map((item, index) => (
          <li key={item.key}>
            <div className="creator-performance-share-label">
              <span
                className={`creator-performance-swatch creator-performance-tone-${index % 5}`}
                aria-hidden="true"
              />
              <span className="creator-performance-label">
                {item.tooltip ? (
                  <TkTooltip
                    label={`${item.label} (${item.tooltip})`}
                    trigger={(props) => (
                      <TkButton
                        {...props}
                        variant="ghost"
                        size="sm"
                        className="creator-performance-category-label"
                      >
                        {item.label}
                      </TkButton>
                    )}
                  />
                ) : (
                  item.label
                )}
              </span>
              <strong>{formatPercent(item.share)}</strong>
            </div>
            {kind === "bars" ? (
              <svg
                className="creator-performance-bar"
                viewBox="0 0 100 5"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <rect className="creator-performance-track" width="100" height="5" rx="2" />
                <rect
                  className={`creator-performance-tone-${index % 5}`}
                  width={item.share * 100}
                  height="5"
                  rx="2"
                />
              </svg>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
