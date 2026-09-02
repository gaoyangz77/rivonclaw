import { useCallback, useEffect, useRef, useState } from "react";
import { useOfficeScreensaver } from "./useOfficeScreensaver.js";

/** Fraction of the viewport a drag must cover before it snaps open. */
const SNAP_THRESHOLD = 0.3;

export type OfficeShutter = {
  /** 0 = fully retracted, 1 = fully down. */
  openness: number;
  dragging: boolean;
  /** Whether the office is worth rendering at all. */
  mounted: boolean;
  beginDrag: (clientY: number, target: Element) => void;
  close: () => void;
  open: () => void;
};

/**
 * The work UI as a roller shutter, rolled UP to reveal the office behind it.
 *
 * `openness` is a continuous 0..1 rather than a boolean because the shutter has
 * to track a finger mid-drag; snapping only happens on release. 0 is the
 * shutter fully down (the app fills the window, the office is not mounted);
 * 1 is the shutter rolled all the way up. The office is unmounted at 0 - the
 * renderer is a canvas animation sharing this window's process, and a
 * screensaver has no business costing anything during the hours someone is
 * actually working.
 *
 * Auto-opening on idle and the manual trigger both route through the same
 * screensaver state, so a shutter rolled up by hand is dismissed by exactly
 * the same rules as one that went up on its own.
 */
export function useOfficeShutter(): OfficeShutter {
  const screensaver = useOfficeScreensaver();
  const [openness, setOpenness] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startY: number; startOpenness: number } | null>(null);

  // Follow the screensaver except while a finger owns the shutter: an idle
  // timer firing mid-drag must not yank the shutter out from under it.
  useEffect(() => {
    if (dragging) return;
    setOpenness(screensaver.active ? 1 : 0);
  }, [screensaver.active, dragging]);

  const beginDrag = useCallback(
    (clientY: number, target: Element) => {
      drag.current = { startY: clientY, startOpenness: openness };
      setDragging(true);

      const height = window.innerHeight || 1;
      // Upward travel opens: the finger is lifting the shutter's lower edge.
      const move = (event: PointerEvent) => {
        const state = drag.current;
        if (!state) return;
        const next = state.startOpenness + (state.startY - event.clientY) / height;
        setOpenness(Math.min(1, Math.max(0, next)));
      };
      const end = (event: PointerEvent) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        const state = drag.current;
        drag.current = null;
        setDragging(false);
        if (!state) return;
        const travelled = (state.startY - event.clientY) / height;
        const settled =
          Math.abs(travelled) < 0.02
            ? state.startOpenness >= 0.5
            : state.startOpenness + travelled > SNAP_THRESHOLD;
        // Snapping goes through the screensaver rather than setting openness
        // directly, so the dismissal latch that re-arms the idle trigger stays
        // in one place.
        if (settled) screensaver.open();
        else screensaver.close();
        setOpenness(settled ? 1 : 0);
      };

      // On the window, not the grabbed element: the element that started the
      // drag may not survive it (the door's handle re-renders as the door
      // starts to move), and a release delivered to a detached node is a drag
      // that never ends.
      void target;
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    },
    [openness, screensaver],
  );

  return {
    openness,
    dragging,
    mounted: openness > 0 || dragging,
    beginDrag,
    close: screensaver.close,
    open: screensaver.open,
  };
}
