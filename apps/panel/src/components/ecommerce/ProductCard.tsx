import { useId, type ReactNode } from "react";
import { TkPrivate } from "../design-system/index.js";
import { CheckIcon, ShopIcon } from "../icons.js";
import { RemoteMediaImage } from "../images/RemoteMediaImage.js";

export interface ProductCardSelection {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}

export interface ProductCardProps {
  title: string;
  imageUrl?: string | null;
  shopAlias?: string | null;
  shopName: string;
  sellerSkus: readonly string[];
  aliasLabel: string;
  sellerSkuLabel: string;
  selection?: ProductCardSelection;
  status?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function ProductCard({
  title,
  imageUrl,
  shopAlias,
  shopName,
  sellerSkus,
  aliasLabel,
  sellerSkuLabel,
  selection,
  status,
  actions,
  className,
}: ProductCardProps) {
  const selectionId = useId();
  const normalizedAlias = shopAlias?.trim();
  const normalizedShopName = shopName.trim();
  const visibleSkus = sellerSkus.filter(Boolean).slice(0, 2);
  const hiddenSkuCount = Math.max(0, sellerSkus.filter(Boolean).length - visibleSkus.length);
  const allSkus = sellerSkus.filter(Boolean).join(" · ");

  return (
    <article className={`commerce-product-card${selection?.checked ? " selected" : ""}${selection?.disabled ? " disabled" : ""}${className ? ` ${className}` : ""}`}>
      <div className="commerce-product-card-main">
        <div className="commerce-product-card-media">
          {imageUrl ? (
            <RemoteMediaImage className="commerce-product-card-image" sourceUrl={imageUrl} alt="" loading="lazy" sensitive />
          ) : (
            <div className="commerce-product-card-image commerce-product-card-image-empty" aria-hidden="true"><ShopIcon /></div>
          )}
          {selection ? (
            <label className="commerce-product-card-selector" htmlFor={selectionId} title={selection.label}>
              <input
                id={selectionId}
                type="checkbox"
                checked={selection.checked}
                disabled={selection.disabled}
                onChange={(event) => selection.onChange(event.target.checked)}
              />
              <span aria-hidden="true">{selection.checked ? <CheckIcon size={12} /> : null}</span>
              <span className="sr-only">{selection.label}</span>
            </label>
          ) : null}
        </div>

        <div className="commerce-product-card-copy">
          <TkPrivate as="strong" title={title}>{title}</TkPrivate>
          <div className="commerce-product-card-shop">
            {normalizedAlias ? <span title={`${aliasLabel}: ${normalizedAlias}`}>{normalizedAlias}</span> : null}
            <TkPrivate as="small" title={normalizedShopName}>{normalizedShopName}</TkPrivate>
          </div>
        </div>
      </div>

      <div className="commerce-product-card-footer">
        <div className="commerce-product-card-skus">
          {/* The label stays readable; only the codes are masked. A seller SKU
              encodes brand, category and variant, so it identifies the seller
              the same way a product name does. The tooltip spells every SKU
              out, so it moves onto the masked node rather than staying on the
              row that also carries the label. */}
          <span>{sellerSkuLabel}</span>
          <TkPrivate
            as="div"
            sensitive={visibleSkus.length > 0}
            title={allSkus || sellerSkuLabel}
          >
            {visibleSkus.length > 0
              ? visibleSkus.map((sku) => <code key={sku}>{sku}</code>)
              : <code>—</code>}
            {hiddenSkuCount > 0 ? <small>+{hiddenSkuCount}</small> : null}
          </TkPrivate>
        </div>
        {status || actions ? <div className="commerce-product-card-accessories">{status}{actions}</div> : null}
      </div>
    </article>
  );
}
