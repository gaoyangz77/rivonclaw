import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { OfficeOverlay } from "./OfficeOverlay.js";
import type { OfficeShutter as OfficeShutterState } from "./useOfficeShutter.js";

/**
 * The office, hung from the top of the window like a roller shutter.
 *
 * Always mounted, but only as a grab strip until something pulls it down - the
 * canvas behind it costs nothing while retracted.
 *
 * Position is driven by a CSS custom property set imperatively rather than a
 * JSX `style` prop: the value changes on every pointer move, and the Panel's
 * styling rules keep inline styles out of JSX. The transition is disabled
 * while a finger owns the shutter so it tracks the drag instead of chasing it.
 *
 * State is owned by the caller, not here: the sidebar carries a second way to
 * pull the office down, and two `useOfficeShutter()` instances would each hold
 * their own openness and quietly ignore each other.
 */
export function OfficeShutter({ shutter }: { shutter: OfficeShutterState }) {
  const { t } = useTranslation();
  const paneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    paneRef.current?.style.setProperty("--office-openness", String(shutter.openness));
  }, [shutter.openness]);

  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    shutter.beginDrag(event.clientY, event.currentTarget);
  };

  return (
    <>
      {/* Retracted, the shutter is just this strip: the only thing a viewer can
          grab to pull the office down, and the only cost it carries. */}
      <div
        className="office-shutter-handle"
        role="button"
        tabIndex={0}
        aria-label={t("office.pullDown")}
        onPointerDown={startDrag}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") shutter.open();
        }}
      />
      {shutter.mounted && (
        <div
          ref={paneRef}
          className={`office-shutter${shutter.dragging ? " office-shutter--dragging" : ""}`}
        >
          <OfficeOverlay onExit={shutter.close} />
          {/* Grabbing the bottom lip pulls the shutter back up. */}
          <div
            className="office-shutter-grip"
            role="button"
            tabIndex={0}
            aria-label={t("office.pullUp")}
            onPointerDown={startDrag}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") shutter.close();
            }}
          />
        </div>
      )}
    </>
  );
}
