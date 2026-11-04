import { useEffect, useState, type ReactNode } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import type { Instance } from "mobx-state-tree";
import type { GQL } from "@rivonclaw/core";
import { CheckIcon, ChevronRightIcon, CopyIcon } from "../../../components/icons.js";
import { TkBadge, type TkBadgeTone } from "../../../components/design-system/index.js";
import {
  conversationOrderDetailKey,
  type CustomerServiceWorkspaceModel,
} from "../../../store/models/CustomerServiceWorkspaceModel.js";
import {
  formatCompactDateTime,
  formatOrderMoney,
  humanizePlatformValue,
  platformValueLabel,
} from "../customer-service-order-utils.js";
import { ReturnRecordEvidence } from "./ReturnRecordEvidence.js";

type Workspace = Instance<typeof CustomerServiceWorkspaceModel>;
type CopyHandler = (label: string, value: string) => Promise<void>;

function CopyValueRow({
  label,
  value,
  copiedMeta,
  onCopy,
}: {
  label: string;
  value: string;
  copiedMeta: string | null;
  onCopy: CopyHandler;
}) {
  return (
    <button
      className="cs-order-recipient-field copyable"
      type="button"
      title={`${label}: ${value}`}
      onClick={() => void onCopy(label, value)}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      {copiedMeta === `${label}:${value}` ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
    </button>
  );
}

function DetailState({
  loading,
  error,
  errorLabel,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  errorLabel: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <p className="cs-order-empty" role="status">
        {t("common.loading")}
      </p>
    );
  }
  if (error) {
    return (
      <div className="cs-order-inline-error" role="alert">
        <span>{errorLabel}</span>
        <button className="btn btn-secondary btn-sm" type="button" onClick={onRetry}>
          {t("ecommerce.customerServiceWorkspace.orderRetry")}
        </button>
      </div>
    );
  }
  return null;
}

type PackageInfo = {
  trackingNumber?: string | null;
  lastMileTrackingNumber?: string | null;
  shippingProviderName?: string | null;
};
type TrackingEvent = { description?: string | null; updateTimeMillis?: number | null };

function DisclosureToggle({
  expanded,
  label,
  onToggle,
}: {
  expanded: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      className="cs-order-disclosure"
      type="button"
      aria-expanded={expanded}
      onClick={onToggle}
    >
      <span className={expanded ? "cs-order-chevron expanded" : "cs-order-chevron"}>
        <ChevronRightIcon size={12} />
      </span>
      <span>{label}</span>
    </button>
  );
}

type OrderLogisticsSectionProps = {
  workspace: Workspace;
  shopId: string;
  orderId: string;
  shippingProvider?: string | null;
  trackingNumbers: string[];
  packageIds: string[];
  copiedMeta: string | null;
  onCopy: CopyHandler;
};

/**
 * Shipping carrier, tracking number and the live carrier event timeline. The
 * timeline is collapsed to the latest event; the keyed wrapper drops the
 * expanded state when another order is shown.
 */
export const OrderLogisticsSection = observer(function OrderLogisticsSection(
  props: OrderLogisticsSectionProps,
) {
  return <OrderLogisticsSectionBody key={`${props.shopId}:${props.orderId}`} {...props} />;
});

const OrderLogisticsSectionBody = observer(function OrderLogisticsSectionBody({
  workspace,
  shopId,
  orderId,
  shippingProvider,
  trackingNumbers,
  packageIds,
  copiedMeta,
  onCopy,
}: OrderLogisticsSectionProps) {
  const { t } = useTranslation();
  const [timelineOpen, setTimelineOpen] = useState(false);
  const key = conversationOrderDetailKey("tracking", shopId, orderId);
  const tracking = workspace.orderDetail(key) as {
    shippingProvider?: string | null;
    trackingNumber?: string | null;
    events?: TrackingEvent[] | null;
  } | null;
  const loading = workspace.orderDetailLoading(key);
  const error = workspace.orderDetailError(key);
  const knownNumbers = tracking?.trackingNumber ? [tracking.trackingNumber] : trackingNumbers;
  // Some orders carry the number only on their package; look there once the
  // tracking load has settled and nothing else supplied one.
  const needPackages = Boolean(
    knownNumbers.length === 0 && packageIds.length > 0 && (tracking || error),
  );
  const packagesKey = conversationOrderDetailKey("packages", shopId, orderId);
  const packagesDetail = workspace.orderDetail(packagesKey) as { packages: PackageInfo[] } | null;
  const packages = packagesDetail?.packages ?? [];
  const packageIdsSignature = packageIds.join(",");
  useEffect(() => {
    if (needPackages) void workspace.fetchSelectedConversationOrderPackages(packageIds);
    // packageIds is tracked through its signature.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace, needPackages, packageIdsSignature]);
  const packageNumbers = [
    ...new Set(
      packages.flatMap((pkg) =>
        [pkg.trackingNumber, pkg.lastMileTrackingNumber].filter((v): v is string => Boolean(v)),
      ),
    ),
  ];
  const numbers = knownNumbers.length > 0 ? knownNumbers : packageNumbers;
  const provider =
    tracking?.shippingProvider ||
    shippingProvider ||
    packages.find((pkg) => pkg.shippingProviderName)?.shippingProviderName;
  const packagesLoading = needPackages && workspace.orderDetailLoading(packagesKey);
  const packagesError = needPackages ? workspace.orderDetailError(packagesKey) : null;
  const events = [...(tracking?.events ?? [])].sort(
    (a, b) => (b.updateTimeMillis ?? 0) - (a.updateTimeMillis ?? 0),
  );

  const latestEvent = events[0];

  return (
    <section className="cs-order-context-section">
      <div className="cs-order-context-section-head">
        <h4>{t("ecommerce.customerServiceWorkspace.shipping")}</h4>
        {events.length > 0 && (
          <DisclosureToggle
            expanded={timelineOpen}
            label={
              timelineOpen
                ? t("ecommerce.customerServiceWorkspace.hideTracking")
                : t("ecommerce.customerServiceWorkspace.viewTracking", { count: events.length })
            }
            onToggle={() => setTimelineOpen((open) => !open)}
          />
        )}
      </div>
      {(provider || numbers.length > 0) && (
        <div className="cs-order-logistics-head">
          {provider && (
            <div className="cs-order-recipient-field">
              <span>{t("ecommerce.customerServiceWorkspace.carrier")}</span>
              <strong>{provider}</strong>
            </div>
          )}
          {numbers.map((number) => (
            <CopyValueRow
              key={number}
              label={t("ecommerce.customerServiceWorkspace.trackingNumber")}
              value={number}
              copiedMeta={copiedMeta}
              onCopy={onCopy}
            />
          ))}
        </div>
      )}
      <DetailState
        loading={(loading && !tracking) || (packagesLoading && !packagesDetail)}
        error={error ?? packagesError}
        errorLabel={t("ecommerce.customerServiceWorkspace.trackingLoadFailed")}
        onRetry={() => {
          void workspace.fetchSelectedConversationOrderTracking(true);
          if (needPackages) void workspace.fetchSelectedConversationOrderPackages(packageIds, true);
        }}
      />
      {tracking && events.length === 0 && (
        <p className="cs-order-empty">{t("ecommerce.customerServiceWorkspace.noTrackingEvents")}</p>
      )}
      {latestEvent && !timelineOpen && (
        <p className="cs-order-latest-event">
          <time>
            {latestEvent.updateTimeMillis
              ? formatCompactDateTime(latestEvent.updateTimeMillis / 1000)
              : "-"}
          </time>
          <span title={latestEvent.description ?? undefined}>{latestEvent.description || "-"}</span>
        </p>
      )}
      {events.length > 0 && timelineOpen && (
        <ol className="cs-order-timeline">
          {events.map((event, index) => (
            <li key={`${event.updateTimeMillis ?? "event"}:${index}`}>
              <time>
                {event.updateTimeMillis
                  ? formatCompactDateTime(event.updateTimeMillis / 1000)
                  : "-"}
              </time>
              <span>{event.description || "-"}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
});

type ReturnRecord = {
  event?: string | null;
  role?: string | null;
  description?: string | null;
  reasonText?: string | null;
  note?: string | null;
  createTime?: number | null;
  images?: GQL.EcomReturnRecord["images"];
  videos?: GQL.EcomReturnRecord["videos"];
};

/** A request still waiting on the buyer, the seller or the platform. */
function isOpenAfterSaleStatus(status?: string | null): boolean {
  return !status || !/(COMPLETE|SUCCESS|CANCEL|REJECT)$/.test(status);
}

function AfterSaleCard({
  title,
  statusLabel,
  open,
  refund,
  createTime,
  children,
}: {
  title: string;
  statusLabel: string;
  open: boolean;
  refund?: string | null;
  createTime?: string | number | null;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const tone: TkBadgeTone = open ? "warning" : "neutral";
  return (
    <article className="cs-order-return">
      <button
        className="cs-order-return-summary"
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className={expanded ? "cs-order-chevron expanded" : "cs-order-chevron"}>
          <ChevronRightIcon size={12} />
        </span>
        <strong>{title}</strong>
        <TkBadge tone={tone}>{statusLabel}</TkBadge>
        {refund && <span className="cs-order-return-refund">{refund}</span>}
        <time>{formatCompactDateTime(createTime)}</time>
      </button>
      {expanded && <div className="cs-order-return-body">{children}</div>}
    </article>
  );
}

const ReturnCard = observer(function ReturnCard({
  workspace,
  shopId,
  orderId,
  item,
  currency,
  locale,
}: {
  workspace: Workspace;
  shopId: string;
  orderId: string;
  item: GQL.EcomReturn;
  currency?: string | null;
  locale: string;
}) {
  const { t } = useTranslation();
  const [historyOpen, setHistoryOpen] = useState(false);
  const key = conversationOrderDetailKey("returnRecords", shopId, orderId, item.returnId);
  const detail = workspace.orderDetail(key) as { records: ReturnRecord[] } | null;
  const records = [...(detail?.records ?? [])].sort(
    (a, b) => (b.createTime ?? 0) - (a.createTime ?? 0),
  );
  const refund = item.refundAmount?.refundTotal
    ? formatOrderMoney(
        item.refundAmount.refundTotal,
        item.refundAmount.currency ?? currency,
        locale,
      )
    : null;

  return (
    <AfterSaleCard
      title={
        platformValueLabel(t, "returnType", item.returnType) ||
        t("ecommerce.customerServiceWorkspace.afterSaleRequest")
      }
      statusLabel={
        platformValueLabel(t, "returnStatus", item.returnStatus) ||
        t("ecommerce.customerServiceWorkspace.unknownStatus")
      }
      open={isOpenAfterSaleStatus(item.returnStatus)}
      refund={refund}
      createTime={item.createTime}
    >
      {(item.returnReasonText || item.returnReason) && (
        <p>{item.returnReasonText || humanizePlatformValue(item.returnReason)}</p>
      )}
      <div className="cs-order-return-meta">
        <code>{item.returnId}</code>
      </div>
      <div className="cs-order-return-facts">
        {item.returnMethod && (
          <span>
            {t("ecommerce.customerServiceWorkspace.returnMethod")}:{" "}
            {platformValueLabel(t, "returnMethod", item.returnMethod)}
          </span>
        )}
        {item.returnTrackingNumber && (
          <span>
            {t("ecommerce.customerServiceWorkspace.trackingNumber")}: {item.returnTrackingNumber}
          </span>
        )}
        <span>
          {t("ecommerce.customerServiceWorkspace.updatedAt")}:{" "}
          {formatCompactDateTime(item.updateTime)}
        </span>
      </div>
      <button
        className="cs-order-history-toggle"
        type="button"
        aria-expanded={historyOpen}
        onClick={() => {
          const next = !historyOpen;
          setHistoryOpen(next);
          if (next) void workspace.fetchSelectedConversationReturnRecords(item.returnId);
        }}
      >
        {t("ecommerce.customerServiceWorkspace.returnRecords")}
      </button>
      {historyOpen && (
        <>
          <DetailState
            loading={workspace.orderDetailLoading(key) && !detail}
            error={workspace.orderDetailError(key)}
            errorLabel={t("ecommerce.customerServiceWorkspace.returnRecordsLoadFailed")}
            onRetry={() =>
              void workspace.fetchSelectedConversationReturnRecords(item.returnId, true)
            }
          />
          {detail && records.length === 0 && (
            <p className="cs-order-empty">
              {t("ecommerce.customerServiceWorkspace.returnRecordsEmpty")}
            </p>
          )}
          {records.length > 0 && (
            <ol className="cs-order-timeline">
              {records.map((record, index) => (
                <li key={`${record.createTime ?? "record"}:${index}`}>
                  <time>{formatCompactDateTime(record.createTime)}</time>
                  <span>
                    <strong>
                      {[
                        platformValueLabel(t, "recordRole", record.role),
                        platformValueLabel(t, "recordEvent", record.event),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </strong>
                    {[...new Set([record.description, record.reasonText, record.note])]
                      .filter(Boolean)
                      .map((line, lineIndex) => (
                        <span className="cs-order-timeline-line" key={lineIndex}>
                          {line}
                        </span>
                      ))}
                    <ReturnRecordEvidence images={record.images} videos={record.videos} />
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </AfterSaleCard>
  );
});

type OrderAfterSalesSectionProps = {
  workspace: Workspace;
  shopId: string;
  orderId: string;
  returns: GQL.EcomReturn[];
  currency?: string | null;
  locale: string;
};

/**
 * Returns (with their negotiation history) and cancellations of one order.
 * Each request is a one-line summary until clicked; the keyed wrapper drops
 * the expanded state when another order is shown.
 */
export const OrderAfterSalesSection = observer(function OrderAfterSalesSection(
  props: OrderAfterSalesSectionProps,
) {
  return <OrderAfterSalesSectionBody key={`${props.shopId}:${props.orderId}`} {...props} />;
});

const OrderAfterSalesSectionBody = observer(function OrderAfterSalesSectionBody({
  workspace,
  shopId,
  orderId,
  returns,
  currency,
  locale,
}: OrderAfterSalesSectionProps) {
  const { t } = useTranslation();
  const cancellationsKey = conversationOrderDetailKey("cancellations", shopId, orderId);
  const cancellationsDetail = workspace.orderDetail(cancellationsKey) as {
    cancellations: GQL.EcomCancellation[];
  } | null;
  const cancellations = cancellationsDetail?.cancellations ?? [];
  const total = returns.length + cancellations.length;
  const openCount =
    returns.filter((item) => isOpenAfterSaleStatus(item.returnStatus)).length +
    cancellations.filter((item) => isOpenAfterSaleStatus(item.cancelStatus)).length;
  return (
    <section className="cs-order-context-section">
      <div className="cs-order-context-section-head">
        <h4>{t("ecommerce.customerServiceWorkspace.afterSales", { count: total })}</h4>
        {openCount > 0 && (
          <TkBadge tone="warning">
            {t("ecommerce.customerServiceWorkspace.afterSalesOpen", { count: openCount })}
          </TkBadge>
        )}
      </div>
      <DetailState
        loading={workspace.orderDetailLoading(cancellationsKey) && !cancellationsDetail}
        error={workspace.orderDetailError(cancellationsKey)}
        errorLabel={t("ecommerce.customerServiceWorkspace.cancellationsLoadFailed")}
        onRetry={() => void workspace.fetchSelectedConversationOrderCancellations(true)}
      />
      {total === 0 && !cancellationsDetail ? null : total === 0 ? (
        <p className="cs-order-empty">{t("ecommerce.customerServiceWorkspace.noAfterSales")}</p>
      ) : (
        <div className="cs-order-returns">
          {returns.map((item) => (
            <ReturnCard
              key={item.returnId}
              workspace={workspace}
              shopId={shopId}
              orderId={orderId}
              item={item}
              currency={currency}
              locale={locale}
            />
          ))}
          {cancellations.map((item) => (
            <AfterSaleCard
              key={item.cancelId}
              title={t("ecommerce.customerServiceWorkspace.cancellationRequest")}
              statusLabel={
                platformValueLabel(t, "cancelStatus", item.cancelStatus) ||
                t("ecommerce.customerServiceWorkspace.unknownStatus")
              }
              open={isOpenAfterSaleStatus(item.cancelStatus)}
              refund={
                item.refundAmount?.refundTotal
                  ? formatOrderMoney(
                      item.refundAmount.refundTotal,
                      item.refundAmount.currency ?? currency,
                      locale,
                    )
                  : null
              }
              createTime={item.createTime}
            >
              {(item.cancelReasonText || item.cancelReason) && (
                <p>{item.cancelReasonText || humanizePlatformValue(item.cancelReason)}</p>
              )}
              <div className="cs-order-return-meta">
                <code>{item.cancelId}</code>
              </div>
              <div className="cs-order-return-facts">
                <span>
                  {t("ecommerce.customerServiceWorkspace.updatedAt")}:{" "}
                  {formatCompactDateTime(item.updateTime)}
                </span>
              </div>
            </AfterSaleCard>
          ))}
        </div>
      )}
    </section>
  );
});

function CopyOrderField({
  label,
  value,
  copiedMeta,
  onCopy,
  multiline = false,
}: {
  label: string;
  value?: string | null;
  copiedMeta: string | null;
  onCopy: CopyHandler;
  multiline?: boolean;
}) {
  const normalizedValue = value?.trim() ?? "";
  const copied = normalizedValue.length > 0 && copiedMeta === `${label}:${normalizedValue}`;

  if (!normalizedValue) {
    return (
      <div className={`cs-order-recipient-field${multiline ? " multiline" : ""}`}>
        <span>{label}</span>
        <strong>—</strong>
      </div>
    );
  }

  return (
    <button
      className={`cs-order-recipient-field copyable${multiline ? " multiline" : ""}`}
      type="button"
      title={`${label}: ${normalizedValue}`}
      onClick={() => void onCopy(label, normalizedValue)}
    >
      <span>{label}</span>
      <strong>{normalizedValue}</strong>
      {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
    </button>
  );
}

type OrderRecipientSectionProps = {
  order: GQL.EcomOrder;
  orderId: string;
  copiedMeta: string | null;
  onCopy: CopyHandler;
};

/**
 * Delivery recipient: a one-line summary with copy-all, expandable to the
 * individual copyable fields. The keyed wrapper re-collapses it per order.
 */
export function OrderRecipientSection(props: OrderRecipientSectionProps) {
  return <OrderRecipientSectionBody key={props.orderId} {...props} />;
}

function OrderRecipientSectionBody({
  order,
  orderId,
  copiedMeta,
  onCopy,
}: OrderRecipientSectionProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const recipient = order.recipientAddress;
  const recipientAddress =
    recipient?.fullAddress?.trim() ||
    [recipient?.region, recipient?.city, recipient?.district]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(", ");
  const sellerSkus = Array.from(
    new Set(
      (order.lineItems ?? [])
        .map((item) => item.sellerSku?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).join(", ");
  const copyAllLabel = t("ecommerce.customerServiceWorkspace.copyAll");
  const recipientCopyValue = [
    [t("ecommerce.customerServiceWorkspace.orderIdLabel"), order.orderId ?? orderId],
    [t("ecommerce.customerServiceWorkspace.fullName"), recipient?.name],
    [t("ecommerce.customerServiceWorkspace.address"), recipientAddress],
    [t("ecommerce.customerServiceWorkspace.zip"), recipient?.postalCode],
    [t("ecommerce.customerServiceWorkspace.phone"), recipient?.phone],
    [t("ecommerce.customerServiceWorkspace.sellerSku"), sellerSkus],
  ]
    .map(([label, value]) => `${label}\t${value?.trim() || "—"}`)
    .join("\n");
  const recipientCopied = copiedMeta === `${copyAllLabel}:${recipientCopyValue}`;
  const summary = [recipient?.name, recipient?.city || recipient?.region]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="cs-order-context-section">
      <div className="cs-order-context-section-head">
        <DisclosureToggle
          expanded={expanded}
          label={t("ecommerce.customerServiceWorkspace.recipientDetails")}
          onToggle={() => setExpanded((open) => !open)}
        />
        {!expanded && summary && <span className="cs-order-section-summary">{summary}</span>}
        <button
          className="cs-order-copy-all"
          type="button"
          title={copyAllLabel}
          onClick={() => void onCopy(copyAllLabel, recipientCopyValue)}
        >
          {recipientCopied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
          <span>{copyAllLabel}</span>
        </button>
      </div>
      {expanded && (
        <div className="cs-order-recipient-details">
          <CopyOrderField
            label={t("ecommerce.customerServiceWorkspace.fullName")}
            value={recipient?.name}
            copiedMeta={copiedMeta}
            onCopy={onCopy}
          />
          <CopyOrderField
            label={t("ecommerce.customerServiceWorkspace.address")}
            value={recipientAddress}
            copiedMeta={copiedMeta}
            onCopy={onCopy}
            multiline
          />
          <CopyOrderField
            label={t("ecommerce.customerServiceWorkspace.zip")}
            value={recipient?.postalCode}
            copiedMeta={copiedMeta}
            onCopy={onCopy}
          />
          <CopyOrderField
            label={t("ecommerce.customerServiceWorkspace.phone")}
            value={recipient?.phone}
            copiedMeta={copiedMeta}
            onCopy={onCopy}
          />
        </div>
      )}
    </section>
  );
}
