import type { ReactNode } from "react";
import { TkPrivate } from "../design-system/index.js";
import { ShopIcon } from "../icons.js";
import { RemoteMediaImage } from "../images/RemoteMediaImage.js";
import "./ProductTableCell.css";

export interface ProductTableCellProps {
  title?: string | null;
  imageUrl?: string | null;
  image?: ReactNode;
  skus?: readonly (string | null | undefined)[];
  extraSkuCount?: number;
  skuLabel: string;
  productId?: string | null;
  productIdLabel?: string;
  emptyTitle?: string;
  className?: string;
}

/** A compact product identity for tables; missing catalog facts stay visibly missing. */
export function ProductTableCell({
  title,
  imageUrl,
  image,
  skus = [],
  extraSkuCount,
  skuLabel,
  productId,
  productIdLabel,
  emptyTitle = "—",
  className,
}: ProductTableCellProps) {
  const productTitle = title?.trim();
  const distinctSkus = [...new Set(skus.map((sku) => sku?.trim()).filter((sku): sku is string => Boolean(sku)))];
  const firstSku = distinctSkus[0];
  const remainingSkuCount = extraSkuCount ?? distinctSkus.length - 1;

  return (
    <div className={`commerce-product-table-cell${className ? ` ${className}` : ""}`}>
      <span className="commerce-product-table-cell-media" aria-hidden="true">
        {image ?? (imageUrl ? (
          <RemoteMediaImage sourceUrl={imageUrl} alt="" loading="lazy" sensitive />
        ) : (
          <ShopIcon />
        ))}
      </span>
      <span className="commerce-product-table-cell-copy">
        <TkPrivate
          as="strong"
          className="commerce-product-table-cell-title"
          sensitive={Boolean(productTitle)}
          title={productTitle || undefined}
        >
          {productTitle || productId || emptyTitle}
        </TkPrivate>
        {firstSku ? (
          <small className="commerce-product-table-cell-meta">
            <span className="commerce-product-table-cell-label">{skuLabel} · </span>
            <TkPrivate
              as="span"
              className="commerce-product-table-cell-sku"
              title={distinctSkus.join(" · ")}
            >
              {firstSku}
            </TkPrivate>
            {remainingSkuCount > 0 ? <span>+{remainingSkuCount}</span> : null}
          </small>
        ) : productId && productTitle ? (
          <small className="commerce-product-table-cell-meta" title={productId}>
            {productIdLabel ? `${productIdLabel} · ` : null}{productId}
          </small>
        ) : null}
      </span>
    </div>
  );
}
