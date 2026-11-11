import { TkField } from "../../../components/design-system/index.js";
import { pastedOrderSearch } from "../../../lib/order-search.js";
import "./OrderSearchField.css";

type Props = {
  label: string;
  placeholder: string;
  /** Shown instead of searching, e.g. when the box holds too many order numbers. */
  error?: string;
  draft: string;
  onDraftChange: (value: string) => void;
  /** Runs the search; called on Enter. */
  onSearch: () => void;
};

/**
 * Order-number search of a list page. It searches on Enter only, so typing never fires a query
 * per keystroke, and a pasted column keeps one order number per line.
 */
export function OrderSearchField({ label, placeholder, error, draft, onDraftChange, onSearch }: Props) {
  return (
    <TkField
      className="order-search-field"
      type="search"
      inputMode="numeric"
      autoComplete="off"
      label={label}
      placeholder={placeholder}
      error={error}
      value={draft}
      onChange={(event) => onDraftChange(event.target.value)}
      onPaste={(event) => {
        const pasted = event.clipboardData.getData("text");
        if (!/[\r\n]/.test(pasted)) return;
        event.preventDefault();
        const input = event.currentTarget;
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? start;
        onDraftChange(input.value.slice(0, start) + pastedOrderSearch(pasted) + input.value.slice(end));
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSearch();
      }}
    />
  );
}
