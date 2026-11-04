import { useTranslation } from "react-i18next";
import { TkPrivate } from "../../../components/design-system/index.js";
import type { ShopDisplayLabel } from "../../../lib/shop-display.js";
import "./CustomerServiceOrdersWithoutConversation.css";

/** Display-ready order row; the page owns formatting so this component stays presentational. */
export interface OrderWithoutConversationRow {
  shopId: string;
  orderId: string;
  shop: ShopDisplayLabel;
  statusLabel: string;
  createdLabel: string;
  amountLabel: string;
  pending: boolean;
  error: string | null;
}

/**
 * Order-ID search hits whose buyer has no conversation yet. The operator starts
 * the conversation from here and then types the first message in the regular
 * reply composer.
 */
export function CustomerServiceOrdersWithoutConversation({
  rows,
  onStart,
}: {
  rows: OrderWithoutConversationRow[];
  onStart: (shopId: string, orderId: string) => void;
}) {
  const { t } = useTranslation();
  if (rows.length === 0) return null;
  return (
    <section
      className="cs-orders-without-conversation"
      aria-label={t("ecommerce.customerServiceWorkspace.ordersWithoutConversationTitle")}
    >
      <h3 className="cs-orders-without-conversation-title">
        {t("ecommerce.customerServiceWorkspace.ordersWithoutConversationTitle")}
      </h3>
      <ul className="cs-orders-without-conversation-list">
        {rows.map((row) => (
          <li key={`${row.shopId}:${row.orderId}`} className="cs-orders-without-conversation-row">
            <div className="cs-orders-without-conversation-main">
              <strong title={row.orderId}>{row.orderId}</strong>
              <TkPrivate
                as="span"
                className="cs-orders-without-conversation-shop"
                sensitive={row.shop.sensitive}
              >
                {row.shop.text}
              </TkPrivate>
              <span className="cs-orders-without-conversation-meta">
                {[row.statusLabel, row.createdLabel, row.amountLabel]
                  .filter((part) => part && part !== "-")
                  .join(" · ")}
              </span>
              {row.error && (
                <div className="form-error" role="alert">
                  {row.error}
                </div>
              )}
            </div>
            <button
              className="btn btn-primary btn-sm"
              type="button"
              disabled={row.pending}
              onClick={() => onStart(row.shopId, row.orderId)}
            >
              {row.pending
                ? t("common.loading")
                : t("ecommerce.customerServiceWorkspace.startConversation")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
