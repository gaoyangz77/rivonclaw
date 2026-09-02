import { useCallback, useEffect, useState } from "react";
import { useSystemIdle } from "./useSystemIdle.js";

export type OfficeScreensaver = {
  active: boolean;
  open: () => void;
  close: () => void;
};

/**
 * Decides when the office takes over the window.
 *
 * Two ways in - the machine going unattended, or the viewer asking for it - and
 * one way out.
 *
 * Dismissal is latched rather than momentary: the OS idle timer is polled every
 * few seconds, so a viewer who returns and closes the overlay is still "idle"
 * for a moment afterwards, and without the latch the office would reappear in
 * their face. The latch clears the next time activity is observed, which is
 * what re-arms the screensaver for the following absence - and it is only ever
 * set while idle, or closing a manually opened office would arm a latch that
 * nothing ever clears.
 */
export function useOfficeScreensaver(): OfficeScreensaver {
  const idle = useSystemIdle();
  const [manual, setManual] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!idle) setDismissed(false);
  }, [idle]);

  const open = useCallback(() => {
    setManual(true);
    setDismissed(false);
  }, []);

  const close = useCallback(() => {
    setManual(false);
    // Latch ONLY when idleness would otherwise re-open the overlay immediately.
    // Latching unconditionally disarms the screensaver: closing a manually
    // opened office while the machine is in use sets a latch that nothing
    // clears, because the clearing effect fires on the transition INTO
    // not-idle and we were never idle to begin with. Caught by driving a real
    // Panel against a live idle signal - the office stopped appearing after the
    // first manual open.
    setDismissed(idle);
  }, [idle]);

  return { active: manual || (idle && !dismissed), open, close };
}
