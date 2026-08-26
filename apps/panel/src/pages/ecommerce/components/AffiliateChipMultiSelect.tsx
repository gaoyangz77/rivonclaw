import { useTranslation } from "react-i18next";

/**
 * Pill toggles for one OR-within-a-field condition dimension.
 *
 * Shared by the creator filter bar and the approval policy form so both express
 * "any of these" the same way. Values are ids or enum members — never entity
 * objects — so the control never outlives the row it came from.
 */
export function AffiliateChipMultiSelect<T extends string>({
  label,
  hint,
  emptyLabel,
  options,
  selectedIds,
  onChange,
  className,
}: {
  label: string;
  hint?: string;
  /** Shown under the grid when nothing is selected, i.e. the "matches all" state. */
  emptyLabel?: string;
  options: Array<{ id: T; label: string }>;
  selectedIds: readonly T[];
  onChange: (selectedIds: T[]) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const knownIds = new Set(options.map((option) => option.id));
  const unknownSelectedIds = selectedIds.filter((id) => !knownIds.has(id));

  function toggle(id: T): void {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id],
    );
  }

  return (
    <div className={className ? `affiliate-policy-field ${className}` : "affiliate-policy-field"}>
      <span>{label}</span>
      {hint ? <small className="affiliate-chip-select-hint">{hint}</small> : null}
      <div className="affiliate-policy-option-grid">
        {options.length === 0 ? (
          <div className="affiliate-policy-option-empty">
            {t("ecommerce.affiliateWorkspace.policies.noSelectableOptions")}
          </div>
        ) : (
          options.map((option) => (
            <button
              key={option.id}
              className={`affiliate-policy-option${
                selectedIds.includes(option.id) ? " affiliate-policy-option-selected" : ""
              }`}
              type="button"
              aria-pressed={selectedIds.includes(option.id)}
              onClick={() => toggle(option.id)}
            >
              {option.label}
            </button>
          ))
        )}
      </div>
      {emptyLabel ? (
        <small>
          {selectedIds.length === 0
            ? emptyLabel
            : t("ecommerce.affiliateWorkspace.policies.selectedCount", { count: selectedIds.length })}
        </small>
      ) : null}
      {unknownSelectedIds.length > 0 ? (
        <small className="affiliate-policy-unknown-count">
          {t("ecommerce.affiliateWorkspace.policies.unknownSelectedCount", {
            count: unknownSelectedIds.length,
          })}
        </small>
      ) : null}
    </div>
  );
}
