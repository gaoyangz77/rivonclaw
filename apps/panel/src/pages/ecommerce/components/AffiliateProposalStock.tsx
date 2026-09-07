import { useTranslation } from "react-i18next";
import { TkPrivate, TkTableFrame } from "../../../components/design-system/index.js";
import "./AffiliateProposalStock.css";

export interface AffiliateProposalStockItem {
  id: string;
  skuId: string | null;
  label: string | null;
  quantity: number | null;
}

/** SKU subrows belong to one Sample's decision, never to the outer work list. */
export function AffiliateProposalStock({ items }: { items: AffiliateProposalStockItem[] }) {
  const { t, i18n } = useTranslation();
  const format = new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 0 });

  if (!items.length) return <span className="affiliate-proposal-stock-empty">—</span>;

  return (
    <TkTableFrame variant="embedded">
      <table
        className="affiliate-proposal-stock-table"
        aria-label={t("ecommerce.affiliateWorkspace.stockSummary.title")}
      >
        <thead>
          <tr>
            <th scope="col">{t("ecommerce.affiliateWorkspace.stockSummary.item")}</th>
            <th scope="col" className="affiliate-proposal-stock-quantity">
              {t("ecommerce.affiliateWorkspace.sampleDecisionBundle.stock")}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <TkPrivate className="affiliate-proposal-stock-label" sensitive={Boolean(item.label)}>
                  {item.label ?? "—"}
                </TkPrivate>
              </td>
              <td className="affiliate-proposal-stock-quantity affiliate-proposal-stock-value">
                {item.quantity == null ? "—" : format.format(item.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TkTableFrame>
  );
}
