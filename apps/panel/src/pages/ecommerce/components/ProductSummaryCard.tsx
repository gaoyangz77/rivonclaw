import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { useLazyQuery } from "@apollo/client/react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { ECOMMERCE_GET_PRODUCT_QUERY } from "../../../api/shops-queries.js";
import { CopyIcon } from "../../../components/icons.js";
import { RemoteMediaImage } from "../../../components/images/RemoteMediaImage.js";

type ProductDetailQuery = {
  ecommerceGetProduct: GQL.EcomProduct;
};

type ProductDetailVariables = {
  shopId: string;
  productId: string;
};

type ProductSkuRow = {
  key: string;
  name: string;
  status?: string | null;
  price?: string | null;
};

export function ProductSummaryCard({
  product,
  productId,
  shopId,
  label,
}: {
  product?: GQL.EcomProductSummary | null;
  productId?: string | null;
  shopId?: string | null;
  label?: string;
}) {
  const { t } = useTranslation();
  const [detailOpen, setDetailOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const canOpenDetail = Boolean(shopId && productId);
  const shouldLoadInlineProduct = canOpenDetail && !hasUsefulProductSummary(product);
  const [loadInlineProduct, { data: inlineProductData, loading: inlineProductLoading }] = useLazyQuery<
    ProductDetailQuery,
    ProductDetailVariables
  >(
    ECOMMERCE_GET_PRODUCT_QUERY,
    { fetchPolicy: "cache-first" },
  );
  const resolvedProduct = product ?? productSummaryFromProductDetail(inlineProductData?.ecommerceGetProduct);
  const price = formatProductSummaryPrice(resolvedProduct);
  const status = resolvedProduct?.status ?? null;

  useEffect(() => {
    if (!shouldLoadInlineProduct || !shopId || !productId) return;
    void loadInlineProduct({ variables: { shopId, productId } });
  }, [loadInlineProduct, productId, shouldLoadInlineProduct, shopId]);

  function openDetail(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (canOpenDetail) setDetailOpen(true);
  }

  function openImage(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (resolvedProduct?.coverImage) setPreviewImage(resolvedProduct.coverImage);
  }

  if (!productId) {
    return (
      <div className="affiliate-product-summary affiliate-product-summary-missing">
        {label ? <div className="affiliate-product-label">{label}</div> : null}
        <div className="affiliate-product-thumb affiliate-product-thumb-empty" aria-hidden="true" />
        <div>
          <div className="affiliate-product-title">
            {t("ecommerce.affiliateWorkspace.productContextMissing")}
          </div>
          <div className="affiliate-product-meta">
            {t("ecommerce.affiliateWorkspace.productContextMissingHint")}
          </div>
        </div>
      </div>
    );
  }

  const detailModal = detailOpen && shopId ? (
    <ProductDetailModal
      shopId={shopId}
      productId={productId}
      fallbackProduct={resolvedProduct}
      onClose={() => setDetailOpen(false)}
      onPreviewImage={setPreviewImage}
    />
  ) : null;
  const imagePreview = previewImage ? (
    <ProductImagePreview imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
  ) : null;

  return (
    <>
      <article
        className={`affiliate-product-summary${canOpenDetail ? " affiliate-product-summary-clickable" : ""}`}
        role={canOpenDetail ? "button" : undefined}
        tabIndex={canOpenDetail ? 0 : undefined}
        title={canOpenDetail ? t("ecommerce.productCard.openProductDetail") : undefined}
        onClick={openDetail}
        onKeyDown={(event) => {
          if (!canOpenDetail) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            setDetailOpen(true);
          }
        }}
      >
        {label ? <div className="affiliate-product-label">{label}</div> : null}
        {resolvedProduct?.coverImage ? (
          <button
            className="affiliate-product-thumb-button"
            type="button"
            onClick={openImage}
            title={t("ecommerce.productCard.enlargeProductImage")}
            aria-label={t("ecommerce.productCard.enlargeProductImage")}
          >
            <RemoteMediaImage
              alt=""
              className="affiliate-product-thumb"
              loading="lazy"
              sourceUrl={resolvedProduct.coverImage}
            />
          </button>
        ) : (
          <div className="affiliate-product-thumb affiliate-product-thumb-empty" aria-hidden="true" />
        )}
        <div className="affiliate-product-body">
          <div className="affiliate-product-title">
            {resolvedProduct?.title || (
              inlineProductLoading
                ? t("ecommerce.productCard.loadingProduct")
                : t("ecommerce.affiliateWorkspace.productContextConfirmed")
            )}
          </div>
          <div className="affiliate-product-meta-row">
            {price ? <span className="affiliate-product-price">{price}</span> : null}
            {status ? <span className="affiliate-product-status">{formatProductStatus(status, t)}</span> : null}
            <ProductPlatformIdCopy productId={productId} />
          </div>
        </div>
      </article>
      {renderProductOverlay(detailModal)}
      {renderProductOverlay(imagePreview)}
    </>
  );
}

function ProductDetailModal({
  shopId,
  productId,
  fallbackProduct,
  onClose,
  onPreviewImage,
}: {
  shopId: string;
  productId: string;
  fallbackProduct?: GQL.EcomProductSummary | null;
  onClose: () => void;
  onPreviewImage: (url: string) => void;
}) {
  const { t } = useTranslation();
  const [loadProduct, { data, loading, error }] = useLazyQuery<ProductDetailQuery, ProductDetailVariables>(
    ECOMMERCE_GET_PRODUCT_QUERY,
    { fetchPolicy: "cache-first" },
  );
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    void loadProduct({ variables: { shopId, productId } });
  }, [loadProduct, productId, shopId]);

  useEffect(() => {
    setSelectedImageUrl(null);
  }, [productId]);

  const product = data?.ecommerceGetProduct;
  const images = uniqueProductImages([
    ...(product?.images?.map((image) => image.url).filter((url): url is string => Boolean(url)) ?? []),
    fallbackProduct?.coverImage ?? null,
  ]);
  const primaryImage = selectedImageUrl && images.includes(selectedImageUrl) ? selectedImageUrl : images[0] ?? null;
  const price = (product ? formatFullProductPrice(product) : null) ?? formatProductSummaryPrice(fallbackProduct);
  const status = product?.status || fallbackProduct?.status || null;
  const description = normalizeProductDescription(product?.description);
  const shortDescription = description ? truncateProductDescription(description) : null;
  const skuRows = buildSkuRows(product, fallbackProduct, t);

  function closeFromBackdrop(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    onClose();
  }

  function closeFromButton(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onClose();
  }

  return (
    <div
      className="modal-backdrop product-detail-backdrop"
      role="presentation"
      onClick={closeFromBackdrop}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className="modal-content product-detail-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header product-detail-header">
          <div>
            <h2>{t("ecommerce.productCard.productDetailTitle")}</h2>
            <ProductPlatformIdCopy productId={productId} />
          </div>
          <button className="modal-close-btn" type="button" onClick={closeFromButton} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        <div className="product-detail-body">
          {loading && !product ? (
            <div className="affiliate-proposal-empty">{t("ecommerce.productCard.loadingProduct")}</div>
          ) : error ? (
            <div className="affiliate-proposal-empty">{t("ecommerce.productCard.productUnavailable")}</div>
          ) : (
            <div className="product-detail-layout">
              <div className="product-detail-media">
                {primaryImage ? (
                  <button
                    type="button"
                    className="product-detail-primary-image"
                    onClick={() => onPreviewImage(primaryImage)}
                  >
                    <RemoteMediaImage alt="" loading="lazy" sourceUrl={primaryImage} />
                  </button>
                ) : (
                  <div className="product-detail-primary-image product-detail-primary-image-empty" />
                )}
                {images.length > 1 ? (
                  <div className="product-detail-image-strip">
                    {images.map((image) => (
                      <button
                        key={image}
                        type="button"
                        className={image === primaryImage ? "product-detail-image-selected" : undefined}
                        onClick={() => setSelectedImageUrl(image)}
                      >
                        <RemoteMediaImage alt="" loading="lazy" sourceUrl={image} />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="product-detail-facts">
                <div className="product-detail-product-title">
                  {product?.title || fallbackProduct?.title || t("ecommerce.productCard.productDetailTitle")}
                </div>
                <div className="product-detail-callouts">
                  <ProductMetric label={t("ecommerce.productCard.price")} value={price} tone="price" />
                  <ProductMetric label={t("ecommerce.productCard.status")} value={status ? formatProductStatus(status, t) : null} />
                </div>
                <div className="product-detail-description">
                  <div className="product-detail-section-label">{t("ecommerce.productCard.description")}</div>
                  <p>{shortDescription || t("ecommerce.productCard.noDescription")}</p>
                </div>
                {skuRows.length ? (
                  <div className="product-detail-skus">
                    <div className="product-detail-section-label">{t("ecommerce.productCard.skus")}</div>
                    <div className="product-detail-sku-list">
                      {skuRows.map((sku) => (
                        <div className="product-detail-sku-row" key={sku.key}>
                          <div>
                            <strong>{sku.name}</strong>
                            {sku.status ? <span>{sku.status}</span> : null}
                          </div>
                          <div>{sku.price || "-"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductImagePreview({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  const { t } = useTranslation();
  function closeFromBackdrop(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    onClose();
  }

  function closeFromButton(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onClose();
  }

  return (
    <div
      className="modal-backdrop product-image-preview-backdrop"
      role="presentation"
      onClick={closeFromBackdrop}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className="product-image-preview"
        role="dialog"
        aria-modal="true"
        aria-label={t("ecommerce.productCard.imagePreview")}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close-btn" type="button" onClick={closeFromButton} aria-label={t("common.close")}>
          ×
        </button>
        <RemoteMediaImage alt="" loading="eager" sourceUrl={imageUrl} />
      </div>
    </div>
  );
}

function renderProductOverlay(node: ReactNode): ReactNode {
  if (!node) return null;
  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}

function ProductMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value?: string | null;
  tone?: "price";
}) {
  return (
    <div className={`product-detail-metric${tone === "price" ? " product-detail-metric-price" : ""}`}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function ProductPlatformIdCopy({ productId }: { productId?: string | null }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  if (!productId) return null;
  const resolvedProductId = productId;

  async function copyProductId(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error(t("ecommerce.affiliateWorkspace.copyFailed"));
      }
      await navigator.clipboard.writeText(resolvedProductId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      className="affiliate-id-copy-button affiliate-platform-id-copy product-platform-id-copy"
      type="button"
      onClick={copyProductId}
      aria-label={t("ecommerce.affiliateWorkspace.copyPlatformId")}
      title={copied
        ? t("ecommerce.affiliateWorkspace.platformIdCopied")
        : t("ecommerce.affiliateWorkspace.copyPlatformId")}
    >
      <CopyIcon />
      <span>{copied
        ? t("ecommerce.affiliateWorkspace.platformIdCopied")
        : t("ecommerce.affiliateWorkspace.copyPlatformId")}</span>
    </button>
  );
}

function formatProductSummaryPrice(product: GQL.EcomProductSummary | null | undefined): string | null {
  if (!product?.priceMin) return null;
  const currency = pickSummaryCurrency(product);
  if (product.priceMax && product.priceMax !== product.priceMin) {
    const min = formatMoney(product.priceMin, currency);
    const max = formatMoney(product.priceMax, currency);
    return min && max ? `${min} - ${max}` : `${product.priceMin} - ${product.priceMax}`;
  }
  return formatMoney(product.priceMin, currency) || product.priceMin;
}

function hasUsefulProductSummary(product: GQL.EcomProductSummary | null | undefined): boolean {
  return Boolean(product?.title || product?.coverImage || product?.priceMin || product?.status);
}

function productSummaryFromProductDetail(product: GQL.EcomProduct | null | undefined): GQL.EcomProductSummary | null {
  if (!product) return null;
  const prices = (product.skus ?? [])
    .map((sku) => ({
      amount: sku.price?.salePrice,
      currency: sku.price?.currency,
      value: parseFloat(sku.price?.salePrice ?? ""),
    }))
    .filter((price) => price.amount && Number.isFinite(price.value));
  const sortedPrices = [...prices].sort((a, b) => a.value - b.value);
  const min = sortedPrices[0] ?? null;
  const max = sortedPrices[sortedPrices.length - 1] ?? null;
  return {
    productId: product.productId,
    title: product.title ?? null,
    coverImage: product.images?.find((image) => image.url)?.url ?? null,
    status: product.status ?? null,
    priceMin: min?.amount ?? null,
    priceMax: max?.amount ?? null,
    skus: (product.skus ?? []).slice(0, 12).map((sku) => ({
      skuId: sku.id,
      skuName: sku.sellerSku ?? sku.id,
      sellerSku: sku.sellerSku ?? null,
      price: sku.price?.salePrice ?? null,
      currency: sku.price?.currency ?? null,
    })),
  } as GQL.EcomProductSummary;
}

function formatFullProductPrice(product: GQL.EcomProduct): string | null {
  const prices = (product.skus ?? [])
    .map((sku) => ({
      amount: sku.price?.salePrice,
      currency: sku.price?.currency,
      value: parseFloat(sku.price?.salePrice ?? ""),
    }))
    .filter((price) => price.amount && Number.isFinite(price.value));
  if (!prices.length) return null;
  const currency = pickSingleCurrency(prices.map((price) => price.currency));
  const min = prices.reduce((current, price) => price.value < current.value ? price : current, prices[0]);
  const max = prices.reduce((current, price) => price.value > current.value ? price : current, prices[0]);
  if (min.amount === max.amount) return formatMoney(min.amount, currency) || min.amount || null;
  const minText = formatMoney(min.amount, currency) || min.amount;
  const maxText = formatMoney(max.amount, currency) || max.amount;
  return minText && maxText ? `${minText} - ${maxText}` : null;
}

function pickSummaryCurrency(product: GQL.EcomProductSummary): GQL.EcomProductSkuCurrency | null {
  return pickSingleCurrency(product.skus?.map((sku) => sku.currency) ?? []);
}

function pickSingleCurrency(
  currencies: Array<GQL.EcomProductSkuCurrency | null | undefined>,
): GQL.EcomProductSkuCurrency | null {
  const unique = Array.from(new Set(currencies.filter((currency): currency is GQL.EcomProductSkuCurrency => Boolean(currency))));
  return unique.length === 1 ? unique[0] : null;
}

function formatMoney(amount: string | null | undefined, currency?: GQL.EcomProductSkuCurrency | null): string | null {
  if (!amount) return null;
  const numeric = parseFloat(amount);
  if (!Number.isFinite(numeric) || !currency) return amount;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(numeric) ? 0 : 2,
    }).format(numeric);
  } catch {
    return `${currency} ${amount}`;
  }
}

function formatProductStatus(value: string, t: ReturnType<typeof useTranslation>["t"]): string {
  return t(`ecommerce.productCard.statusLabels.${value}`, {
    defaultValue: value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()),
  });
}

function uniqueProductImages(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const images: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    images.push(value);
  }
  return images;
}

function buildSkuRows(
  product: GQL.EcomProduct | null | undefined,
  fallbackProduct: GQL.EcomProductSummary | null | undefined,
  t: ReturnType<typeof useTranslation>["t"],
): ProductSkuRow[] {
  if (product?.skus?.length) {
    return product.skus.slice(0, 12).map((sku) => ({
      key: sku.id,
      name: sku.sellerSku || sku.id,
      status: sku.statusInfo?.status ? formatProductStatus(sku.statusInfo.status, t) : null,
      price: formatMoney(sku.price?.salePrice, sku.price?.currency),
    }));
  }
  return (fallbackProduct?.skus ?? []).slice(0, 12).map((sku) => ({
    key: sku.skuId,
    name: sku.sellerSku || sku.skuName || sku.skuId,
    status: null,
    price: formatMoney(sku.price, sku.currency),
  }));
}

function normalizeProductDescription(value: string | null | undefined): string | null {
  if (!value) return null;
  const withoutImages = value
    .replace(/<img\b[^>]*>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|li|ul|ol|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const textarea = document.createElement("textarea");
  textarea.innerHTML = withoutImages;
  const normalized = textarea.value
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return normalized.length ? normalized : null;
}

function truncateProductDescription(value: string): string {
  const maxLength = 260;
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;
}
