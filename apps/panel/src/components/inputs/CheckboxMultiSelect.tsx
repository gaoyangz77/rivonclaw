import { useState } from "react";
import {
  TkButton,
  TkField,
  TkPanel,
  TkPanelBody,
  TkPopover,
  TkPrivate,
} from "../design-system/index.js";
import "./CheckboxMultiSelect.css";

export interface CheckboxMultiSelectOption {
  id: string;
  label: string;
  /** Seller-authored text that privacy mode must mask (a platform shop name). */
  sensitive?: boolean;
  /** A short muted note at the end of the row (a region). */
  meta?: string;
  /** What the search matches; defaults to the label. */
  searchTerms?: readonly string[];
}

/**
 * A filter field: a label over a button that opens a checkbox list, with an optional search and a
 * bulk button acting on the options the search shows. The caller decides what the button says.
 *
 * With `onlyLabel` the field never becomes empty: each row offers "only this", the bulk button only
 * selects everything, and the last checked option cannot be unchecked.
 */
export function CheckboxMultiSelect({
  label,
  buttonText,
  popoverLabel,
  options,
  selected,
  onChange,
  selectAllLabel,
  deselectAllLabel,
  searchLabel,
  onlyLabel,
  className,
}: {
  /** Visible field label; omit when the surrounding layout names the field. */
  label?: string;
  buttonText: string;
  /** Accessible name of the button and the panel. */
  popoverLabel: string;
  options: readonly CheckboxMultiSelectOption[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
  selectAllLabel: string;
  deselectAllLabel: string;
  /** Shows a search field over the list when set. */
  searchLabel?: string;
  /** Per-row "only this" action; switches the field to the never-empty mode. */
  onlyLabel?: string;
  className?: string;
}) {
  const keepOne = onlyLabel !== undefined;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const needle = search.trim().toLocaleLowerCase();
  const visible = needle
    ? options.filter((option) =>
        (option.searchTerms ?? [option.label]).some((term) =>
          term.toLocaleLowerCase().includes(needle),
        ),
      )
    : options;
  const visibleIds = new Set(visible.map((option) => option.id));
  const allVisibleSelected =
    visible.length > 0 && visible.every((option) => selected.includes(option.id));
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
  // Acts on the options the search shows, so a seller can clear everything and then pick a few,
  // or narrow by search and take just those. The result keeps the options' own order.
  const toggleVisible = () =>
    onChange(
      allVisibleSelected
        ? selected.filter((id) => !visibleIds.has(id))
        : options
            .filter((option) => selected.includes(option.id) || visibleIds.has(option.id))
            .map((option) => option.id),
    );

  return (
    <div className={className ? `checkbox-multi-select ${className}` : "checkbox-multi-select"}>
      {label ? <span className="tk-v1-label">{label}</span> : null}
      <TkPopover
        label={popoverLabel}
        open={open}
        onOpenChange={setOpen}
        className="checkbox-multi-select-popover"
        trigger={(triggerProps) => (
          <TkButton {...triggerProps} variant="secondary" aria-label={popoverLabel}>
            {buttonText}
          </TkButton>
        )}
      >
        {searchLabel ? (
          <TkField
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchLabel}
            label={searchLabel}
            hideLabel
          />
        ) : null}
        {keepOne ? (
          <TkButton
            variant="ghost"
            size="sm"
            disabled={selected.length === options.length}
            onClick={() => onChange(options.map((option) => option.id))}
          >
            {selectAllLabel}
          </TkButton>
        ) : (
          <TkButton
            variant="ghost"
            size="sm"
            disabled={visible.length === 0}
            onClick={toggleVisible}
          >
            {allVisibleSelected ? deselectAllLabel : selectAllLabel}
          </TkButton>
        )}
        <TkPanel variant="subtle" padding="none">
          <TkPanelBody scroll className="checkbox-multi-select-list">
            {visible.map((option) => {
              const checked = selected.includes(option.id);
              return (
                <div className="checkbox-multi-select-option" key={option.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={keepOne && checked && selected.length === 1}
                      onChange={() => toggle(option.id)}
                    />
                    {option.sensitive === undefined ? (
                      <span>{option.label}</span>
                    ) : (
                      <TkPrivate sensitive={option.sensitive}>{option.label}</TkPrivate>
                    )}
                  </label>
                  {option.meta ? <small>{option.meta}</small> : null}
                  {onlyLabel ? (
                    <button
                      type="button"
                      className="checkbox-multi-select-only"
                      aria-label={`${onlyLabel}: ${option.label}`}
                      onClick={() => onChange([option.id])}
                    >
                      {onlyLabel}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </TkPanelBody>
        </TkPanel>
      </TkPopover>
    </div>
  );
}
