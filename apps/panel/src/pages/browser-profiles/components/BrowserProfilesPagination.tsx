import { useTranslation } from "react-i18next";

interface BrowserProfilesPaginationProps {
  currentPage: number;
  pageSize: number;
  totalProfiles: number;
  pageSizeOptions: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function BrowserProfilesPagination({
  currentPage,
  pageSize,
  totalProfiles,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
}: BrowserProfilesPaginationProps) {
  const { t } = useTranslation();

  if (totalProfiles <= 0) return null;

  return (
    <div className="bp-pagination">
      <button
        className="btn btn-secondary btn-sm"
        disabled={currentPage === 0}
        onClick={() => onPageChange(currentPage - 1)}
        type="button"
      >
        &larr;
      </button>
      <span className="bp-pagination-info">
        {currentPage * pageSize + 1}&ndash;{Math.min((currentPage + 1) * pageSize, totalProfiles)} / {totalProfiles}
      </span>
      <button
        className="btn btn-secondary btn-sm"
        disabled={(currentPage + 1) * pageSize >= totalProfiles}
        onClick={() => onPageChange(currentPage + 1)}
        type="button"
      >
        &rarr;
      </button>
      <select
        className="bp-page-size-select"
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
      >
        {pageSizeOptions.map((size) => (
          <option key={size} value={size}>
            {size} / {t("browserProfiles.page")}
          </option>
        ))}
      </select>
    </div>
  );
}
