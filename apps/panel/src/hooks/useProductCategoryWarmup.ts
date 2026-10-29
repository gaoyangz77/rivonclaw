import { useEffect } from "react";
import { entityStore } from "../store/entity-store.js";

/** Give the first render and startup requests a head start, then warm the idle Panel. */
export function useProductCategoryWarmup(
  userId: string | null,
  session: number,
  locale: string,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!userId || !enabled) return;
    let idleId: number | undefined;
    let fallbackTimer: number | undefined;
    const warm = () => {
      if (entityStore.currentUser?.userId !== userId || entityStore.categorySession !== session)
        return;
      void entityStore.ensureCategories(locale).catch((error) => {
        console.warn("Failed to preload product category dictionary", error);
      });
    };
    const startupTimer = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(warm);
      } else {
        fallbackTimer = window.setTimeout(warm, 1_000);
      }
    }, 5_000);
    return () => {
      window.clearTimeout(startupTimer);
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
    };
  }, [userId, session, locale, enabled]);
}
