import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { InfoIcon } from "../../../components/icons.js";

export function AffiliateMetricLabel({
  label,
  tooltip,
}: {
  label: string;
  tooltip: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, placement: "bottom" });

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const trigger = triggerRef.current;
      const tooltipNode = tooltipRef.current;
      if (!trigger || !tooltipNode) return;
      const triggerRect = trigger.getBoundingClientRect();
      const tooltipRect = tooltipNode.getBoundingClientRect();
      const margin = 12;
      const gap = 8;
      const halfWidth = tooltipRect.width / 2;
      const left = Math.min(
        window.innerWidth - halfWidth - margin,
        Math.max(halfWidth + margin, triggerRect.left + triggerRect.width / 2),
      );
      const fitsBelow = triggerRect.bottom + gap + tooltipRect.height + margin <= window.innerHeight;
      setPosition({
        left,
        top: fitsBelow ? triggerRect.bottom + gap : triggerRect.top - tooltipRect.height - gap,
        placement: fitsBelow ? "bottom" : "top",
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <span className="affiliate-metric-label">
      <span>{label}</span>
      <span
        className="affiliate-metric-tooltip"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <button
          ref={triggerRef}
          type="button"
          className="affiliate-metric-tooltip-trigger"
          aria-label={`${label}: ${tooltip}`}
          aria-describedby={open ? tooltipId : undefined}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        >
          <InfoIcon aria-hidden="true" />
        </button>
      </span>
      {open &&
        createPortal(
          <span
            ref={tooltipRef}
            id={tooltipId}
            className="affiliate-metric-tooltip-content is-portal"
            data-placement={position.placement}
            role="tooltip"
            style={{ left: position.left, top: position.top }}
          >
            {tooltip}
          </span>,
          document.body,
        )}
    </span>
  );
}
