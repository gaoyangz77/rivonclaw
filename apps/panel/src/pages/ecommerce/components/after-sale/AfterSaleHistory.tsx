import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { TkAlert, TkLoadingState, TkPrivate } from "../../../../components/design-system/index.js";
import { formatCompactDateTime, platformValueLabel } from "../../customer-service-order-utils.js";
import { useEntityStore } from "../../../../store/EntityStoreProvider.js";
import { ReturnRecordEvidence } from "../ReturnRecordEvidence.js";

/** Live negotiation history of the open request, including the buyer's evidence photos and videos. */
export const AfterSaleHistory = observer(function AfterSaleHistory() {
  const { t } = useTranslation();
  const detail = useEntityStore().ecommerceAfterSale.detail;

  if (detail.recordsStatus === "loading" || detail.recordsStatus === "idle") {
    return <TkLoadingState size="inline" label={t("ecommerce.afterSale.history.loading")} />;
  }
  if (detail.recordsStatus === "error") {
    return (
      <TkAlert tone="danger" title={t("ecommerce.afterSale.history.failed")}>
        {detail.recordsError}
      </TkAlert>
    );
  }
  if (detail.records.length === 0) {
    return <p className="after-sale-muted">{t("ecommerce.afterSale.history.empty")}</p>;
  }
  return (
    <ol className="after-sale-history">
      {detail.records.map((record, index) => (
        <li key={index} className="after-sale-history-item">
          <div className="after-sale-history-head">
            <strong>{platformValueLabel(t, "recordEvent", record.event) || "-"}</strong>
            <span>{platformValueLabel(t, "recordRole", record.role)}</span>
            <time>{formatCompactDateTime(record.createTime)}</time>
          </div>
          {record.description ? <p>{record.description}</p> : null}
          {record.reasonText ? <p>{record.reasonText}</p> : null}
          {record.note ? (
            <p>
              <TkPrivate>{record.note}</TkPrivate>
            </p>
          ) : null}
          <ReturnRecordEvidence images={record.images} videos={record.videos} />
        </li>
      ))}
    </ol>
  );
});
