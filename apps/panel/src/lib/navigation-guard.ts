export const BEFORE_NAVIGATE_EVENT = "rivonclaw:before-navigate";

export interface BeforeNavigateDetail {
  from: string;
  to: string;
}

export function navigationAllowed(from: string, to: string): boolean {
  return window.dispatchEvent(new CustomEvent<BeforeNavigateDetail>(BEFORE_NAVIGATE_EVENT, {
    cancelable: true,
    detail: { from, to },
  }));
}
