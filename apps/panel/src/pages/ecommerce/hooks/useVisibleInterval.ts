import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Calls `onTick` every `intervalMs` while the page is visible, and once at once when it becomes
 * visible again (a hidden tab skips its ticks). `onTick` must read live state when it runs; it is
 * held in a ref, so a new function per render does not restart the timer.
 */
export function useVisibleInterval(onTick: () => void, intervalMs: number, enabled: boolean): void {
  const tickRef = useRef(onTick);
  useLayoutEffect(() => {
    tickRef.current = onTick;
  }, [onTick]);
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (!document.hidden) tickRef.current();
    };
    const timer = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [intervalMs, enabled]);
}
