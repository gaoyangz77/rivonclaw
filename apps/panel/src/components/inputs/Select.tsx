import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Show a search input at the top of the dropdown to filter options. */
  searchable?: boolean;
  /** When true (requires searchable), allow the user to submit a custom value not in the options list. */
  creatable?: boolean;
}

export function Select({ value, onChange, options, placeholder, disabled, className, searchable, creatable }: SelectProps) {
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
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownMaxHeight = 280;
    const openAbove = spaceBelow < dropdownMaxHeight && rect.top > spaceBelow;
    // Horizontal: if dropdown would overflow right edge, align to right side of trigger
    const dropdownWidth = Math.max(rect.width, 200);
    const overflowsRight = rect.left + dropdownWidth > window.innerWidth - 8;
    const horizontalStyle = overflowsRight
      ? { right: window.innerWidth - rect.right, left: "auto" as const }
      : { left: rect.left };

    setDropdownStyle({
      position: "fixed",
      ...(openAbove
        ? { bottom: window.innerHeight - rect.top + 4, maxHeight: rect.top - 8 }
        : { top: rect.bottom + 4, maxHeight: spaceBelow - 8 }),
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
      requestAnimationFrame(() => searchRef.current?.focus());
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
          const spaceBelow = window.innerHeight - rect.bottom;
          const maxH = 280;
          const above = spaceBelow < maxH && rect.top > spaceBelow;
          const s = dropdownRef.current.style;
          if (above) {
            s.top = "";
            s.bottom = `${window.innerHeight - rect.top + 4}px`;
            s.maxHeight = `${rect.top - 8}px`;
          } else {
            s.bottom = "";
            s.top = `${rect.bottom + 4}px`;
            s.maxHeight = `${spaceBelow - 8}px`;
          }
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
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()) || o.value.toLowerCase().includes(search.toLowerCase()))
    : options;

  const showCreatable = creatable && searchable && search.trim()
    && !filteredOptions.some((o) => o.value === search.trim());

  return (
    <div ref={ref} className={`custom-select${className ? ` ${className}` : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className="custom-select-trigger"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
      >
        <span className={selected ? "custom-select-label" : "custom-select-placeholder"}>
          {selected ? selected.label : placeholder ?? ""}
        </span>
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
                placeholder="Search..."
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
              <div className="custom-select-option-label">{opt.label}</div>
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
