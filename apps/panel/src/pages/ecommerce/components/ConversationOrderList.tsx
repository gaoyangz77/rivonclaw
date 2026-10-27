import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRightIcon, RefreshIcon } from "../../../components/icons.js";
import { TkIconButton } from "../../../components/design-system/index.js";

export function ConversationOrderList({
  orderIds,
  expandedOrderId,
  loadingIds,
  idsError,
  loadingDetail,
  detailError,
  onToggle,
  onRetryIds,
  onRefresh,
  children,
}: {
  orderIds: string[];
  expandedOrderId: string | null;
  loadingIds: boolean;
  idsError: string | null;
  loadingDetail: boolean;
  detailError: string | null;
  onToggle: (orderId: string) => void;
  onRetryIds: () => void;
  onRefresh: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="cs-conversation-order-head">
        <span>
          {t("ecommerce.customerServiceWorkspace.orderListTitle", { count: orderIds.length })}
        </span>
      </div>
      {loadingIds && (
        <div className="cs-order-context-state" role="status">
          {t("common.loading")}
        </div>
      )}
      {idsError && (
        <div className="cs-order-context-state error" role="alert">
          <span>{t("ecommerce.customerServiceWorkspace.ordersLoadFailed")}</span>
          <button className="btn btn-secondary btn-sm" type="button" onClick={onRetryIds}>
            {t("ecommerce.customerServiceWorkspace.orderRetry")}
          </button>
        </div>
      )}
      {!loadingIds && !idsError && orderIds.length === 0 && (
        <div className="cs-order-context-state">
          {t("ecommerce.customerServiceWorkspace.ordersEmpty")}
        </div>
      )}
      {orderIds.map((orderId) => {
        const expanded = orderId === expandedOrderId;
        const contentId = `cs-order-${orderId}`;
        return (
          <div className="cs-order-accordion-item" key={orderId}>
            <div className="cs-order-accordion-heading">
              <button
                type="button"
                className="cs-order-accordion-trigger"
                aria-expanded={expanded}
                aria-controls={contentId}
                onClick={() => onToggle(orderId)}
              >
                <span className={expanded ? "cs-order-chevron expanded" : "cs-order-chevron"}>
                  <ChevronRightIcon size={14} />
                </span>
                <code>{orderId}</code>
              </button>
              {expanded && (
                <TkIconButton
                  size="sm"
                  label={t("common.refresh")}
                  onClick={onRefresh}
                  disabled={loadingDetail}
                >
                  <RefreshIcon size={14} />
                </TkIconButton>
              )}
            </div>
            <div id={contentId} hidden={!expanded}>
              {expanded &&
                (loadingDetail && !children ? (
                  <div className="cs-order-context-state" role="status">
                    {t("common.loading")}
                  </div>
                ) : detailError ? (
                  <div className="cs-order-context-state error" role="alert">
                    <span>{t("ecommerce.customerServiceWorkspace.orderLoadFailed")}</span>
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      onClick={onRefresh}
                      disabled={loadingDetail}
                    >
                      {t("ecommerce.customerServiceWorkspace.orderRetry")}
                    </button>
                  </div>
                ) : (
                  children
                ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
