import { Activity, type ReactNode } from "react";

/**
 * Preserve a visited workspace page's React state while disconnecting its
 * effects and external-store subscriptions when the tab is inactive.
 */
export function WorkspaceTabActivity({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return <Activity mode={active ? "visible" : "hidden"}>{children}</Activity>;
}
