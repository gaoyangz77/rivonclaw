import { useEffect } from "react";
import { panelEventBus } from "../../lib/event-bus.js";

/** UI-only fact changes must never enter the Desktop Agent dispatcher. */
export function useAffiliateWorkbenchRefresh(
  onRefresh: () => void,
  relationshipId?: string | null,
): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let deferred = false;
    const schedule = () => {
      if (document.hidden) {
        deferred = true;
        return;
      }
      if (timer != null) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (document.hidden) {
          deferred = true;
          return;
        }
        deferred = false;
        onRefresh();
      }, 250);
    };
    const onVisible = () => {
      if (!document.hidden && deferred) schedule();
    };
    document.addEventListener("visibilitychange", onVisible);
    const onChange = (payload: unknown) => {
      const change = payload as {
        creatorRelationshipId?: string;
        proposal?: { creatorRelationshipId?: string | null };
      } | null;
      const changedRelationshipId =
        change?.creatorRelationshipId ?? change?.proposal?.creatorRelationshipId;
      if (relationshipId && changedRelationshipId !== relationshipId) return;
      schedule();
    };
    const unsubscribe = panelEventBus.subscribe("affiliate-workbench-changed", onChange);
    const unsubscribeProposal = panelEventBus.subscribe(
      "affiliate-action-proposal-changed",
      onChange,
    );
    return () => {
      unsubscribe();
      unsubscribeProposal();
      document.removeEventListener("visibilitychange", onVisible);
      if (timer != null) clearTimeout(timer);
    };
  }, [onRefresh, relationshipId]);
}
