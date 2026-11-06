import { GQL } from "@rivonclaw/core";
import type { BadReviewRowNode } from "../../store/models/EcommerceBadReviewModel.js";

type Translate = (key: string, options?: Record<string, unknown>) => string;

const PREFIX = "ecommerce.badReview";

export function badReviewStatusLabel(t: Translate, status: string | null | undefined): string {
  return status ? t(`${PREFIX}.status.${status}`) : t(`${PREFIX}.status.none`);
}

export function badReviewSourceLabel(t: Translate, source: string): string {
  return t(`${PREFIX}.source.${source}`);
}

/** The AI's part in a review, in one line: the shop's mode first, then the queue and the plan. */
export function badReviewAiProgressLabel(
  t: Translate,
  review: Pick<
    BadReviewRowNode,
    | "shopFollowUpMode"
    | "aiFollowUpStatus"
    | "reachoutState"
    | "reachoutSentCount"
    | "reachoutMaxAttempts"
  >,
): string {
  if (review.shopFollowUpMode === GQL.BadReviewFollowUpMode.Manual) return t(`${PREFIX}.ai.manual`);
  if (!review.shopFollowUpMode) return t(`${PREFIX}.ai.off`);
  if (!review.reachoutState) return t(`${PREFIX}.ai.queue.${review.aiFollowUpStatus}`);
  return t(`${PREFIX}.ai.plan`, {
    state: t(`${PREFIX}.ai.planState.${review.reachoutState}`),
    sent: review.reachoutSentCount ?? 0,
    max: review.reachoutMaxAttempts ?? 0,
  });
}
