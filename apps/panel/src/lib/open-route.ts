/**
 * Opens a Panel route from anywhere. App passes `onNavigate` to almost no page, so a page must not
 * rely on a prop for this: App listens for this event.
 */
export function openPanelRoute(path: string): void {
  window.dispatchEvent(new CustomEvent("rivonclaw:open-route", { detail: { path } }));
}
