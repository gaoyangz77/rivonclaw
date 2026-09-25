import { useTranslation } from "react-i18next";
import { TkIconButton } from "../../../components/design-system/index.js";
import { ChevronRightIcon } from "../../../components/icons.js";

/**
 * "start–end of total" summary plus previous/next for one offset-paged result.
 * Navigation is disabled while a page is loading so requests cannot interleave.
 */
export function AffiliateDetailPager({
  pageIndex,
  pageSize,
  totalRows,
  loading,
  onPageChange,
}: {
  pageIndex: number;
  pageSize: number;
  totalRows: number;
  loading: boolean;
  onPageChange: (pageIndex: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const pages = Math.max(1, Math.ceil(totalRows / pageSize));
  const start = totalRows ? pageIndex * pageSize + 1 : 0;
  const end = Math.min((pageIndex + 1) * pageSize, totalRows);
  const number = new Intl.NumberFormat(i18n.language);

  return (
    <nav
      className="affiliate-detail-pager"
      aria-label={t("ecommerce.affiliateAnalytics.details.pagination")}
      aria-busy={loading || undefined}
    >
      <span className="affiliate-detail-pager-summary">
        {t("ecommerce.affiliateAnalytics.details.pageSummary", {
          start: number.format(start),
          end: number.format(end),
          total: number.format(totalRows),
        })}
      </span>
      <div className="affiliate-detail-pager-controls">
        <TkIconButton
          className="affiliate-detail-pager-previous"
          size="sm"
          label={t("ecommerce.affiliateAnalytics.details.previousPage")}
          disabled={loading || pageIndex === 0}
          onClick={() => onPageChange(pageIndex - 1)}
        >
          <ChevronRightIcon />
        </TkIconButton>
        <span className="affiliate-detail-pager-position">
          {number.format(pageIndex + 1)} / {number.format(pages)}
        </span>
        <TkIconButton
          size="sm"
          label={t("ecommerce.affiliateAnalytics.details.nextPage")}
          disabled={loading || pageIndex + 1 >= pages}
          onClick={() => onPageChange(pageIndex + 1)}
        >
          <ChevronRightIcon />
        </TkIconButton>
      </div>
    </nav>
  );
}

/**
 * After a page change, bring the start of the table back into view when the
 * reader has scrolled past it (the pager sits below 50 rows). Measured against
 * the nearest vertical scroller so it works in the page and inside the modal.
 */
export function revealTableStart(frame: HTMLElement | null) {
  if (!frame) return;
  let scroller = frame.parentElement;
  while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
    scroller = scroller.parentElement;
  }
  const viewportTop = scroller ? scroller.getBoundingClientRect().top : 0;
  if (frame.getBoundingClientRect().top < viewportTop) frame.scrollIntoView({ block: "start" });
}
