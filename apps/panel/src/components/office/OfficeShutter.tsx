import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { OfficeOverlay } from "./OfficeOverlay.js";
import type { OfficeShutter as OfficeShutterState } from "./useOfficeShutter.js";

/**
 * How long the door's roll takes; must match the CSS transition on
 * `.layout-door--rolling`. The office behind the door stays mounted this long
 * after a close so the door has something to roll down over.
 */
const ROLL_MS = 320;

/**
 * The work UI as a roller shutter door, with the office behind it.
 *
 * `children` is the whole application - banner, sidebar, pages. It is wrapped
 * in a door that rolls up out of the window as `openness` rises, revealing the
 * office stage fixed behind it. Retracted (openness 0) the door is just the app
 * plus a grab strip along its lower edge, and the office is not mounted at all:
 * the canvas behind the door costs nothing until something lifts it.
 *
 * Position is driven by a CSS custom property set imperatively rather than a
 * JSX `style` prop: the value changes on every pointer move, and the Panel's
 * styling rules keep inline styles out of JSX. The transition is disabled
 * while a finger owns the door so it tracks the drag instead of chasing it.
 *
 * State is owned by the caller, not here: the sidebar carries a second way to
 * roll the door up, and two `useOfficeShutter()` instances would each hold
 * their own openness and quietly ignore each other.
 */
export function OfficeShutter({
  shutter,
  children,
}: {
  shutter: OfficeShutterState;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const doorRef = useRef<HTMLDivElement>(null);
  // `mounted` flips to false the instant openness returns to 0, but the door
  // is still visibly rolling down for ROLL_MS after that. Keep the office
  // behind it until the roll is over, or the last frames show the page ground
  // where the office was.
  const [settling, setSettling] = useState(false);
  const rolling = shutter.mounted || settling;

  useEffect(() => {
    doorRef.current?.style.setProperty("--office-openness", String(shutter.openness));
  }, [shutter.openness]);

  useEffect(() => {
    if (shutter.mounted) {
      setSettling(true);
      return;
    }
    const timer = setTimeout(() => setSettling(false), ROLL_MS);
    return () => clearTimeout(timer);
  }, [shutter.mounted]);

  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    shutter.beginDrag(event.clientY, event.currentTarget);
  };

  return (
    <>
      <div
        ref={doorRef}
        className={`layout-door${rolling ? " layout-door--rolling" : ""}${
          shutter.dragging ? " layout-door--dragging" : ""
        }`}
      >
        {children}
      </div>
      {!rolling && (
        // The door's lower edge: the only thing to grab while it is down, and
        // the only cost the office carries while nobody is looking at it.
        <div
          className="office-shutter-handle"
          role="button"
          tabIndex={0}
          aria-label={t("office.pullUp")}
          title={t("office.pullUp")}
          onPointerDown={startDrag}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") shutter.open();
          }}
        />
      )}
      {rolling && (
        <div className="office-stage">
          <OfficeOverlay onExit={shutter.close} />
          {/* The rolled-up door's lower edge sits along the top of the window;
              pulling it down closes the office. */}
          <div
            className="office-shutter-grip"
            role="button"
            tabIndex={0}
            aria-label={t("office.pullDown")}
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
