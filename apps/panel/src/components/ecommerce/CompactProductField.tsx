import { TkPrivate } from "../design-system/index.js";
import { ShopIcon } from "../icons.js";
import { RemoteMediaImage } from "../images/RemoteMediaImage.js";
import "./CompactProductField.css";

export interface CompactProductFieldProps {
  title?: string | null;
  imageUrl?: string | null;
  skus?: readonly (string | null | undefined)[];
  extraSkuCount?: number;
  skuLabel: string;
  productId?: string | null;
  productIdLabel?: string;
  emptyTitle?: string;
}

/** SKU-first product identity for dense work queues. Parent cells own width. */
export function CompactProductField({
  title,
  imageUrl,
  skus = [],
  extraSkuCount,
  skuLabel,
  productId,
  productIdLabel,
  emptyTitle = "—",
}: CompactProductFieldProps) {
  const name = title?.trim();
  const sellerSkus = [
    ...new Set(skus.map((sku) => sku?.trim()).filter((sku): sku is string => Boolean(sku))),
  ];
  const sku = sellerSkus[0];
  const more = Math.max(0, extraSkuCount ?? sellerSkus.length - 1);

  return (
    <div className="commerce-compact-product-field">
      <span className="commerce-compact-product-field-media" aria-hidden="true">
        {imageUrl ? (
          <RemoteMediaImage sourceUrl={imageUrl} alt="" loading="lazy" sensitive />
        ) : (
          <ShopIcon />
        )}
      </span>
      <span className="commerce-compact-product-field-copy">
        {sku ? (
          <span className="commerce-compact-product-field-primary">
            <small className="sr-only">{skuLabel}</small>
            <TkPrivate
              as="span"
              className="commerce-compact-product-field-sku"
              title={sellerSkus.join(" · ")}
            >
              {sku}
            </TkPrivate>
            {more > 0 ? <small>+{more}</small> : null}
          </span>
        ) : null}
        {name ? (
          <TkPrivate as="span" className="commerce-compact-product-field-name" title={name}>
            {name}
          </TkPrivate>
        ) : null}
        {!sku && productId ? (
          <span className="commerce-compact-product-field-id" title={productId}>
            {productIdLabel ? `${productIdLabel} · ` : ""}
            {productId}
          </span>
        ) : null}
        {!sku && !name && !productId ? (
          <span className="commerce-compact-product-field-name">{emptyTitle}</span>
        ) : null}
      </span>
    </div>
  );
}
