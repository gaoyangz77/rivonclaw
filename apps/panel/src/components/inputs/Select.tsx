import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

const DROPDOWN_MAX_HEIGHT = 280;
const DROPDOWN_GAP = 4;
const VIEWPORT_GUTTER = 20;

interface DropdownVerticalLayout {
  top?: number;
  bottom?: number;
  maxHeight: number;
}

function getDropdownVerticalLayout(
  rect: Pick<DOMRect, "top" | "bottom">,
  viewportHeight: number,
): DropdownVerticalLayout {
  const availableBelow = Math.max(
    0,
    viewportHeight - rect.bottom - DROPDOWN_GAP - VIEWPORT_GUTTER,
  );
  const availableAbove = Math.max(0, rect.top - DROPDOWN_GAP - VIEWPORT_GUTTER);
  const openAbove = availableBelow < DROPDOWN_MAX_HEIGHT && availableAbove > availableBelow;

  return openAbove
    ? {
        bottom: viewportHeight - rect.top + DROPDOWN_GAP,
        maxHeight: Math.min(DROPDOWN_MAX_HEIGHT, availableAbove),
      }
    : {
        top: rect.bottom + DROPDOWN_GAP,
        maxHeight: Math.min(DROPDOWN_MAX_HEIGHT, availableBelow),
      };
}

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  badge?: string;
  badgeTone?: "neutral" | "success" | "warning" | "info";
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  /** Show a search input at the top of the dropdown to filter options. */
  searchable?: boolean;
  /** Localized placeholder for the dropdown search input. */
  searchPlaceholder?: string;
  /** When true (requires searchable), allow the user to submit a custom value not in the options list. */
  creatable?: boolean;
}

export function Select({ value, onChange, options, placeholder, ariaLabel, disabled, className, searchable, searchPlaceholder, creatable }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const verticalStyle = getDropdownVerticalLayout(rect, window.innerHeight);
    // Horizontal: if dropdown would overflow right edge, align to right side of trigger
    const dropdownWidth = Math.max(rect.width, 200);
    const overflowsRight = rect.left + dropdownWidth > window.innerWidth - 8;
    const horizontalStyle = overflowsRight
      ? { right: window.innerWidth - rect.right, left: "auto" as const }
      : { left: rect.left };

    setDropdownStyle({
      position: "fixed",
      ...verticalStyle,
      ...horizontalStyle,
      minWidth: rect.width,
      width: "max-content",
      maxWidth: window.innerWidth - 16,
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }

    updatePosition();

    // Auto-focus the search input when opening a searchable dropdown
    if (searchable) {
      requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
    }

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleScroll(e: Event) {
      // Ignore scroll events from within the select wrapper or the portal dropdown
      if (ref.current && ref.current.contains(e.target as Node)) return;
      if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) return;
      // If an ancestor of the select scrolled (e.g. modal backdrop), reposition via
      // direct DOM update to avoid re-render → scroll → reposition loop.
      const scrollTarget = e.target as Node;
      // Ancestor check: covers both Element ancestors and the Document node itself
      // (focus-induced scrolls, e.g. when auto-focusing the search input, can fire
      // scroll events on `document` which is not an Element).
      if (scrollTarget.contains(ref.current)) {
        if (triggerRef.current && dropdownRef.current) {
          const rect = triggerRef.current.getBoundingClientRect();
          const verticalStyle = getDropdownVerticalLayout(rect, window.innerHeight);
          const s = dropdownRef.current.style;
          s.top = verticalStyle.top === undefined ? "" : `${verticalStyle.top}px`;
          s.bottom = verticalStyle.bottom === undefined ? "" : `${verticalStyle.bottom}px`;
          s.maxHeight = `${verticalStyle.maxHeight}px`;
          const dw = Math.max(rect.width, 200);
          if (rect.left + dw > window.innerWidth - 8) {
            s.left = "auto";
            s.right = `${window.innerWidth - rect.right}px`;
          } else {
            s.right = "";
            s.left = `${rect.left}px`;
          }
          s.minWidth = `${rect.width}px`;
          s.width = "max-content";
          s.maxWidth = `${window.innerWidth - 16}px`;
        }
        return;
      }
      setOpen(false);
    }
    function handleResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open, updatePosition, searchable]);

  const selected = options.find((o) => o.value === value)
    ?? (creatable && value ? { value, label: value } : undefined);

  const filteredOptions = searchable && search
    ? options.filter((option) =>
        option.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()) ||
        option.value.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    : options;

  const showCreatable = creatable && searchable && search.trim()
    && !filteredOptions.some((o) => o.value === search.trim());

  return (
    <div ref={ref} className={`custom-select${className ? ` ${className}` : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className="custom-select-trigger"
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
      >
        <span className={selected ? "custom-select-label" : "custom-select-placeholder"}>
          {selected ? selected.label : placeholder ?? ""}
        </span>
        {selected?.badge ? (
          <span className={`custom-select-badge ${selected.badgeTone ?? "neutral"}`}>
            {selected.badge}
          </span>
        ) : null}
        <span className="custom-select-chevron">{open ? "\u25B2" : "\u25BC"}</span>
      </button>
      {open && createPortal(
        <div ref={dropdownRef} className={`custom-select-dropdown${className ? ` ${className}` : ""}`} style={dropdownStyle}>
          {searchable && (
            <div className="custom-select-search-wrap">
              <input
                ref={searchRef}
                type="text"
                className="custom-select-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder ?? "Search..."}
                aria-label={searchPlaceholder ?? "Search..."}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          {filteredOptions.map((opt) => (
            <button
              type="button"
              key={opt.value}
              className="custom-select-option"
              data-selected={opt.value === value || undefined}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              <div className="custom-select-option-main">
                <div className="custom-select-option-label">{opt.label}</div>
                {opt.badge ? (
                  <span className={`custom-select-badge ${opt.badgeTone ?? "neutral"}`}>
                    {opt.badge}
                  </span>
                ) : null}
              </div>
              {opt.description && (
                <div className="custom-select-option-desc">{opt.description}</div>
              )}
            </button>
          ))}
          {showCreatable && (
            <button
              type="button"
              className="custom-select-option custom-select-option-create"
              onClick={() => {
                onChange(search.trim());
                setOpen(false);
              }}
            >
              <div className="custom-select-option-label">{search.trim()}</div>
            </button>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
