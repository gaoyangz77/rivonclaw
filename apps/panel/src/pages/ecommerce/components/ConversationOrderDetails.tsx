import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import type { Instance } from "mobx-state-tree";
import type { GQL } from "@rivonclaw/core";
import { CheckIcon, CopyIcon } from "../../../components/icons.js";
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

/** Shipping carrier, tracking number and the live carrier event timeline. */
export const OrderLogisticsSection = observer(function OrderLogisticsSection({
  workspace,
  shopId,
  orderId,
  shippingProvider,
  trackingNumbers,
  packageIds,
  copiedMeta,
  onCopy,
}: {
  workspace: Workspace;
  shopId: string;
  orderId: string;
  shippingProvider?: string | null;
  trackingNumbers: string[];
  packageIds: string[];
  copiedMeta: string | null;
  onCopy: CopyHandler;
}) {
  const { t } = useTranslation();
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

  return (
    <section className="cs-order-context-section">
      <h4>{t("ecommerce.customerServiceWorkspace.shipping")}</h4>
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
        <p className="cs-order-empty">
          {t("ecommerce.customerServiceWorkspace.noTrackingEvents")}
        </p>
      )}
      {events.length > 0 && (
        <ol className="cs-order-timeline">
          {events.map((event, index) => (
            <li key={`${event.updateTimeMillis ?? "event"}:${index}`}>
              <time>
                {event.updateTimeMillis ? formatCompactDateTime(event.updateTimeMillis / 1000) : "-"}
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

  return (
    <article className="cs-order-return">
      <div className="cs-order-return-head">
        <strong>
          {platformValueLabel(t, "returnType", item.returnType) ||
            t("ecommerce.customerServiceWorkspace.afterSaleRequest")}
        </strong>
        <span>
          {platformValueLabel(t, "returnStatus", item.returnStatus) ||
            t("ecommerce.customerServiceWorkspace.unknownStatus")}
        </span>
      </div>
      {(item.returnReasonText || item.returnReason) && (
        <p>{item.returnReasonText || humanizePlatformValue(item.returnReason)}</p>
      )}
      <div className="cs-order-return-meta">
        <code>{item.returnId}</code>
        {item.refundAmount?.refundTotal && (
          <strong>
            {formatOrderMoney(
              item.refundAmount.refundTotal,
              item.refundAmount.currency ?? currency,
              locale,
            )}
          </strong>
        )}
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
          {t("ecommerce.customerServiceWorkspace.createdAt")}:{" "}
          {formatCompactDateTime(item.createTime)}
        </span>
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
            onRetry={() => void workspace.fetchSelectedConversationReturnRecords(item.returnId, true)}
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
    </article>
  );
});

/** Returns (with their negotiation history) and cancellations of one order. */
export const OrderAfterSalesSection = observer(function OrderAfterSalesSection({
  workspace,
  shopId,
  orderId,
  returns,
  currency,
  locale,
}: {
  workspace: Workspace;
  shopId: string;
  orderId: string;
  returns: GQL.EcomReturn[];
  currency?: string | null;
  locale: string;
}) {
  const { t } = useTranslation();
  const cancellationsKey = conversationOrderDetailKey("cancellations", shopId, orderId);
  const cancellationsDetail = workspace.orderDetail(cancellationsKey) as {
    cancellations: GQL.EcomCancellation[];
  } | null;
  const cancellations = cancellationsDetail?.cancellations ?? [];
  const total = returns.length + cancellations.length;
  return (
    <section className="cs-order-context-section">
      <h4>{t("ecommerce.customerServiceWorkspace.afterSales", { count: total })}</h4>
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
            <article className="cs-order-return" key={item.cancelId}>
              <div className="cs-order-return-head">
                <strong>{t("ecommerce.customerServiceWorkspace.cancellationRequest")}</strong>
                <span>
                  {platformValueLabel(t, "cancelStatus", item.cancelStatus) ||
                    t("ecommerce.customerServiceWorkspace.unknownStatus")}
                </span>
              </div>
              {(item.cancelReasonText || item.cancelReason) && (
                <p>{item.cancelReasonText || humanizePlatformValue(item.cancelReason)}</p>
              )}
              <div className="cs-order-return-meta">
                <code>{item.cancelId}</code>
                {item.refundAmount?.refundTotal && (
                  <strong>
                    {formatOrderMoney(
                      item.refundAmount.refundTotal,
                      item.refundAmount.currency ?? currency,
                      locale,
                    )}
                  </strong>
                )}
              </div>
              <div className="cs-order-return-facts">
                <span>
                  {t("ecommerce.customerServiceWorkspace.createdAt")}:{" "}
                  {formatCompactDateTime(item.createTime)}
                </span>
                <span>
                  {t("ecommerce.customerServiceWorkspace.updatedAt")}:{" "}
                  {formatCompactDateTime(item.updateTime)}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
});
