/**
 * Bad-review management rules shared by the store and the pages (ADR-102).
 */
import { GQL } from "@rivonclaw/core";

export type BadReviewHandlingStatus = GQL.ProductReviewHandlingStatus;

export const BAD_REVIEW_HANDLING_STATUSES: readonly BadReviewHandlingStatus[] = [
  GQL.ProductReviewHandlingStatus.Pending,
  GQL.ProductReviewHandlingStatus.InProgress,
  GQL.ProductReviewHandlingStatus.ReviewUpdated,
  GQL.ProductReviewHandlingStatus.ReviewDeleted,
  GQL.ProductReviewHandlingStatus.Closed,
];

/** Statuses an operator can pick. In progress turns AI off, so only Start follow-up sets it. */
export const BAD_REVIEW_PICKABLE_STATUSES: readonly BadReviewHandlingStatus[] =
  BAD_REVIEW_HANDLING_STATUSES.filter(
    (status) => status !== GQL.ProductReviewHandlingStatus.InProgress,
  );

type ShopFollowUpSettings = {
  services?: {
    customerService?: {
      reviewOptimization?: {
        enabled?: boolean;
        badReviewReachout?: { enabled?: boolean; mode?: GQL.BadReviewFollowUpMode };
      } | null;
    } | null;
  } | null;
};

/** Whether a person follows up this shop's bad reviews: both switches on and the mode is manual. */
export function shopFollowsUpManually(shop: ShopFollowUpSettings | null | undefined): boolean {
  const reviewOptimization = shop?.services?.customerService?.reviewOptimization;
  const reachout = reviewOptimization?.badReviewReachout;
  return (
    reviewOptimization?.enabled === true &&
    reachout?.enabled === true &&
    reachout.mode === GQL.BadReviewFollowUpMode.Manual
  );
}

/**
 * Whether a backend refusal means the shop has not paid for the feature. The backend's
 * UpgradeRequiredError reaches Panel only as this message text.
 */
export function isUpgradeRequiredMessage(message: string | null | undefined): boolean {
  return message?.startsWith("Upgrade required:") === true;
}

/** Full days between two instants, for how long a review has been in follow-up. */
export function wholeDaysBetween(fromIso: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - new Date(fromIso).getTime()) / 86_400_000));
}
