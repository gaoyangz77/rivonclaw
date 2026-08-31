import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronRightIcon } from "../icons.js";
import { TkPopover } from "./Overlays.js";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export interface TkHierarchicalNavChild {
  id: string;
  label: string;
  description?: string;
  group?: string;
  icon?: ReactNode;
}

export interface TkHierarchicalNavItem {
  id: string;
  label: string;
  icon?: ReactNode;
  description?: string;
  flyoutEyebrow?: string;
  flyoutLabel?: string;
  children?: readonly TkHierarchicalNavChild[];
}

export interface TkHierarchicalNavProps {
  items: readonly TkHierarchicalNavItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  collapsed?: boolean;
  defaultOpenItemId?: string;
  hoverOpenDelay?: number;
  hoverCloseDelay?: number;
  className?: string;
}

/**
 * Two-level product navigation. Parents disclose a portal flyout; leaves navigate.
 * Hover is an enhancement only: focus, click and arrow-key paths expose the same content.
 */
export function TkHierarchicalNav({
  items,
  value,
  onChange,
  label,
  collapsed = false,
  defaultOpenItemId,
  hoverOpenDelay = 140,
  hoverCloseDelay = 180,
  className,
}: TkHierarchicalNavProps) {
  const initialOpenItem = items.some(
    (item) => item.id === defaultOpenItemId && item.children?.length,
  )
    ? defaultOpenItemId ?? null
    : null;
  const [openItemId, setOpenItemId] = useState<string | null>(initialOpenItem);
  const [pinnedItemId, setPinnedItemId] = useState<string | null>(initialOpenItem);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingChildFocusRef = useRef<string | null>(null);
  const suppressFocusOpenRef = useRef<string | null>(null);
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const flyoutRefs = useRef(new Map<string, HTMLDivElement>());

  function clearOpenTimer() {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    openTimerRef.current = null;
  }

  function clearCloseTimer() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }

  function clearTimers() {
    clearOpenTimer();
    clearCloseTimer();
  }

  useEffect(
    () => () => {
      clearOpenTimer();
      clearCloseTimer();
    },
    [],
  );

  useEffect(() => {
    if (!openItemId || pendingChildFocusRef.current !== openItemId) return;
    const frame = requestAnimationFrame(() => {
      flyoutRefs.current
        .get(openItemId)
        ?.querySelector<HTMLButtonElement>("[data-tk-nav-child]")
        ?.focus();
      pendingChildFocusRef.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [openItemId]);

  function openTemporarily(itemId: string, delay = 0) {
    clearTimers();
    if (delay === 0) {
      setOpenItemId(itemId);
      return;
    }
    openTimerRef.current = setTimeout(() => setOpenItemId(itemId), delay);
  }

  function scheduleClose(itemId: string) {
    clearOpenTimer();
    clearCloseTimer();
    if (pinnedItemId === itemId) return;
    closeTimerRef.current = setTimeout(() => {
      setOpenItemId((current) => (current === itemId ? null : current));
    }, hoverCloseDelay);
  }

  function close(itemId: string, restoreFocus = false) {
    clearTimers();
    setOpenItemId((current) => (current === itemId ? null : current));
    setPinnedItemId((current) => (current === itemId ? null : current));
    if (restoreFocus) {
      suppressFocusOpenRef.current = itemId;
      requestAnimationFrame(() => triggerRefs.current.get(itemId)?.focus());
    }
  }

  function handleParentFocus(itemId: string) {
    if (suppressFocusOpenRef.current === itemId) {
      suppressFocusOpenRef.current = null;
      return;
    }
    openTemporarily(itemId);
  }

  function handleParentClick(itemId: string) {
    clearTimers();
    if (pinnedItemId === itemId && openItemId === itemId) {
      setPinnedItemId(null);
      setOpenItemId(null);
      return;
    }
    setPinnedItemId(itemId);
    setOpenItemId(itemId);
  }

  function handleParentKeyDown(event: KeyboardEvent<HTMLButtonElement>, itemId: string) {
    if (!["ArrowRight", "ArrowDown", "Enter", " "].includes(event.key)) return;
    event.preventDefault();
    clearTimers();
    setOpenItemId(itemId);
    const mountedFlyout = flyoutRefs.current.get(itemId);
    if (mountedFlyout) {
      requestAnimationFrame(() => {
        mountedFlyout.querySelector<HTMLButtonElement>("[data-tk-nav-child]")?.focus();
      });
    } else {
      pendingChildFocusRef.current = itemId;
    }
  }

  function handleFlyoutKeyDown(event: KeyboardEvent<HTMLDivElement>, itemId: string) {
    const children = Array.from(
      flyoutRefs.current
        .get(itemId)
        ?.querySelectorAll<HTMLButtonElement>("[data-tk-nav-child]") ?? [],
    );
    if (!children.length) return;
    const currentIndex = children.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % children.length;
    if (event.key === "ArrowUp")
      nextIndex = currentIndex < 0 ? children.length - 1 : (currentIndex - 1 + children.length) % children.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = children.length - 1;
    if (event.key === "ArrowLeft" || event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(itemId, true);
      return;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    children[nextIndex]?.focus();
  }

  function selectChild(itemId: string, childId: string) {
    onChange(childId);
    close(itemId);
  }

  return (
    <nav
      className={cx(
        "tk-v1-hierarchical-nav",
        collapsed && "tk-v1-hierarchical-nav-collapsed",
        className,
      )}
      aria-label={label}
    >
      <ul className="tk-v1-hierarchical-nav-list">
        {items.map((item) => {
          const hasChildren = Boolean(item.children?.length);
          const usesCompactGrid = (item.children?.length ?? 0) >= 6;
          const isOpen = openItemId === item.id;
          const isCurrent = value === item.id;
          const isActivePath = isCurrent || Boolean(item.children?.some((child) => child.id === value));

          if (!hasChildren) {
            return (
              <li key={item.id} className="tk-v1-hierarchical-nav-item">
                <button
                  type="button"
                  className={cx(
                    "tk-v1-hierarchical-nav-trigger",
                    isCurrent && "is-current",
                  )}
                  aria-label={item.label}
                  aria-current={isCurrent ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  onClick={() => {
                    clearTimers();
                    setOpenItemId(null);
                    setPinnedItemId(null);
                    onChange(item.id);
                  }}
                >
                  <span className="tk-v1-hierarchical-nav-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="tk-v1-hierarchical-nav-label" aria-hidden="true">
                    {item.label}
                  </span>
                </button>
              </li>
            );
          }

          return (
            <li
              key={item.id}
              className="tk-v1-hierarchical-nav-item"
              onPointerEnter={() => openTemporarily(item.id, hoverOpenDelay)}
              onPointerLeave={() => scheduleClose(item.id)}
            >
              <TkPopover
                label={item.flyoutLabel ?? item.label}
                placement="right-start"
                open={isOpen}
                onOpenChange={(nextOpen) => {
                  if (nextOpen) setOpenItemId(item.id);
                  else close(item.id);
                }}
                role="navigation"
                className={cx(
                  "tk-v1-nav-flyout",
                  usesCompactGrid && "tk-v1-nav-flyout-grid",
                )}
                contentRef={(node) => {
                  if (node) flyoutRefs.current.set(item.id, node);
                  else flyoutRefs.current.delete(item.id);
                }}
                trigger={(props) => (
                  <button
                    {...props}
                    ref={(node) => {
                      props.ref(node);
                      if (node) triggerRefs.current.set(item.id, node);
                      else triggerRefs.current.delete(item.id);
                    }}
                    className={cx(
                      "tk-v1-hierarchical-nav-trigger",
                      isActivePath && "is-active-path",
                      isOpen && "is-open",
                    )}
                    aria-label={item.label}
                    title={collapsed ? item.label : undefined}
                    onClick={() => handleParentClick(item.id)}
                    onFocus={() => handleParentFocus(item.id)}
                    onBlur={() => scheduleClose(item.id)}
                    onKeyDown={(event) => handleParentKeyDown(event, item.id)}
                  >
                    <span className="tk-v1-hierarchical-nav-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="tk-v1-hierarchical-nav-label" aria-hidden="true">
                      {item.label}
                    </span>
                    <span className="tk-v1-hierarchical-nav-chevron" aria-hidden="true">
                      <ChevronRightIcon />
                    </span>
                  </button>
                )}
              >
                <div
                  onPointerEnter={clearCloseTimer}
                  onPointerLeave={() => scheduleClose(item.id)}
                  onFocusCapture={clearCloseTimer}
                  onKeyDown={(event) => handleFlyoutKeyDown(event, item.id)}
                >
                  {(item.flyoutEyebrow || item.description) && (
                    <header className="tk-v1-nav-flyout-header">
                      {item.flyoutEyebrow && <span>{item.flyoutEyebrow}</span>}
                      <strong>{item.label}</strong>
                      {item.description && <p>{item.description}</p>}
                    </header>
                  )}
                  <div className="tk-v1-nav-flyout-list">
                    {item.children?.map((child, index) => {
                      const previousGroup = index > 0 ? item.children?.[index - 1]?.group : undefined;
                      const showGroup = Boolean(child.group && child.group !== previousGroup);
                      const childIsCurrent = child.id === value;
                      return (
                        <div key={child.id} className="tk-v1-nav-flyout-entry">
                          {showGroup && <div className="tk-v1-nav-flyout-group">{child.group}</div>}
                          <button
                            type="button"
                            data-tk-nav-child
                            className={cx(
                              "tk-v1-nav-flyout-link",
                              childIsCurrent && "is-current",
                            )}
                            aria-current={childIsCurrent ? "page" : undefined}
                            onClick={() => selectChild(item.id, child.id)}
                          >
                            {child.icon && (
                              <span className="tk-v1-nav-flyout-icon" aria-hidden="true">
                                {child.icon}
                              </span>
                            )}
                            <span>
                              <strong>{child.label}</strong>
                              {child.description && <small>{child.description}</small>}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </TkPopover>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
