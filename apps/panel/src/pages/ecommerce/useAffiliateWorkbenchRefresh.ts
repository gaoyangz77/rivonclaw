import { useEffect } from "react";
import { panelEventBus } from "../../lib/event-bus.js";

/** UI-only fact changes must never enter the Desktop Agent dispatcher. */
export function useAffiliateWorkbenchRefresh(
  onRefresh: () => void,
  relationshipId?: string | null,
): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (document.hidden) {
        return;
      }
      if (timer != null) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (document.hidden) {
          return;
        }
        onRefresh();
      }, 250);
    };
    const onVisible = () => {
      if (!document.hidden) schedule();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", schedule);
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
    // Desktop emits a snapshot on every SSE connection, including reconnects.
    // Proposal events missed while disconnected must not leave a stale modal.
    const unsubscribeSnapshot = panelEventBus.subscribe("entity-snapshot", schedule);
    return () => {
      unsubscribe();
      unsubscribeProposal();
      unsubscribeSnapshot();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", schedule);
      if (timer != null) clearTimeout(timer);
    };
  }, [onRefresh, relationshipId]);
}
