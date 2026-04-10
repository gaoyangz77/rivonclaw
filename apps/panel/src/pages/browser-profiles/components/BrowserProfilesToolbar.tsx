import { useTranslation } from "react-i18next";

interface BrowserProfilesToolbarProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  statusFilter: "all" | "ACTIVE" | "ARCHIVED";
  onStatusFilterChange: (value: "all" | "ACTIVE" | "ARCHIVED") => void;
}

export function BrowserProfilesToolbar({
  searchInput,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: BrowserProfilesToolbarProps) {
  const { t } = useTranslation();
  return (
    <div className="bp-filter-bar">
      <input
        className="bp-search-input"
        type="text"
        placeholder={t("browserProfiles.searchPlaceholder")}
        value={searchInput}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <div className="bp-status-chips">
        {(["all", "ACTIVE", "ARCHIVED"] as const).map((s) => (
          <button
            key={s}
            className={`btn btn-sm ${statusFilter === s ? "btn-outline" : "btn-secondary"}`}
            onClick={() => onStatusFilterChange(s)}
            type="button"
          >
            {s === "all"
              ? t("browserProfiles.filterAll")
              : t(`browserProfiles.status_${s.toLowerCase()}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
