import { useEffect, useState } from "react";
import { panelEventBus } from "../../lib/event-bus.js";

/**
 * Has the user stepped away from the machine?
 *
 * Reported by Desktop from the OS idle timer, not inferred from activity in
 * this window: someone typing in another application has not stepped away, and
 * a screensaver that appeared because they stopped touching one window would be
 * wrong. Desktop broadcasts only on transitions and re-sends the current value
 * on connect, so this stays accurate across a Panel reload.
 */
export function useSystemIdle(): boolean {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    return panelEventBus.subscribe("idle-snapshot", (payload) => {
      if (typeof payload !== "object" || payload === null) return;
      const next = (payload as { idle?: unknown }).idle;
      if (typeof next === "boolean") setIdle(next);
    });
  }, []);

  return idle;
}
