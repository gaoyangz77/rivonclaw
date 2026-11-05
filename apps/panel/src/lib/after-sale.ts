/**
 * After-sale review workspace rules (ADR-099).
 *
 * Pure functions shared by the MST model and the page: which backend decision a request maps to,
 * and how much time is left. Platform status and action
 * strings are TikTok's open vocabulary, so unknown values are never mapped to a decision.
 */
import { GQL } from "@rivonclaw/core";

export type AfterSaleKind = GQL.EcomAfterSaleRequestKind;

export const AFTER_SALE_KINDS: readonly AfterSaleKind[] = [
  GQL.EcomAfterSaleRequestKind.Cancellation,
  GQL.EcomAfterSaleRequestKind.Refund,
  GQL.EcomAfterSaleRequestKind.ReturnAndRefund,
  GQL.EcomAfterSaleRequestKind.Replacement,
  GQL.EcomAfterSaleRequestKind.Exchange,
];

export const SELLER_ACTIONS = {
  refund: "SELLER_RESPOND_REFUND",
  return: "SELLER_RESPOND_RETURN",
  receivePackage: "SELLER_RESPOND_RECEIVE_PACKAGE",
  replacement: "SELLER_RESPOND_REPLACEMENT",
  buyerCancel: "SELLER_RESPOND_BUYER_CANCEL",
} as const;

export const AFTER_SALE_SELLER_ACTIONS: readonly string[] = Object.values(SELLER_ACTIONS);

/** Statuses a seller can filter the ALL view by; the list is a convenience, the platform may send others. */
export const AFTER_SALE_STATUSES: readonly string[] = [
  "RETURN_OR_REFUND_REQUEST_PENDING",
  "AWAITING_BUYER_RESPONSE",
  "AWAITING_BUYER_SHIP",
  "BUYER_SHIPPED_ITEM",
  "RETURN_OR_REFUND_REQUEST_SUCCESS",
  "RETURN_OR_REFUND_REQUEST_COMPLETE",
  "RETURN_OR_REFUND_REQUEST_CANCEL",
  "REFUND_OR_RETURN_REQUEST_REJECT",
  "REPLACEMENT_REQUEST_PENDING",
  "REPLACEMENT_REQUEST_COMPLETE",
  "REPLACEMENT_REQUEST_CANCEL",
  "REPLACEMENT_REQUEST_REJECT",
  "EXCHANGE_REQUEST_PENDING",
  "EXCHANGE_REQUEST_COMPLETE",
  "EXCHANGE_REQUEST_CANCEL",
  "CANCELLATION_REQUEST_PENDING",
  "CANCELLATION_REQUEST_SUCCESS",
  "CANCELLATION_REQUEST_CANCEL",
  "CANCELLATION_REQUEST_COMPLETE",
];

/**
 * Structural subset of an after-sale request; satisfied by MST nodes and plain DTOs alike.
 * `needsReview` is the backend's: TikTok asks the seller to decide and no recorded decision waits
 * for TikTok's next state (ADR-099 Decisions 3 and 11). The Panel never derives it.
 */
export interface AfterSaleRequestFacts {
  kind: AfterSaleKind;
  sellerNextAction?: string | null;
  needsReview: boolean;
}

export function afterSaleKey(shopId: string, kind: AfterSaleKind, requestId: string): string {
  return `${shopId}:${kind}:${requestId}`;
}

export type AfterSaleReturnApproval =
  | typeof GQL.EcomApproveReturnDecision.ApproveReturn
  | typeof GQL.EcomApproveReturnDecision.ApproveReceivedPackage
  | typeof GQL.EcomApproveReturnDecision.ApproveReplacement;

export type AfterSaleReturnRejection =
  | "REJECT_REFUND"
  | "REJECT_RETURN"
  | "REJECT_RECEIVED_PACKAGE"
  | "REJECT_REPLACEMENT";

/** The backend call an approve or reject maps to. `route` picks the mutation and the reject endpoint. */
export type AfterSaleDecision =
  | { route: "refund"; rejectDecision: "REJECT_REFUND" }
  | {
      route: "return";
      approveDecision: AfterSaleReturnApproval;
      rejectDecision: Exclude<AfterSaleReturnRejection, "REJECT_REFUND">;
    }
  | { route: "cancellation" };

const RETURN_DECISIONS = {
  return: {
    route: "return",
    approveDecision: GQL.EcomApproveReturnDecision.ApproveReturn,
    rejectDecision: "REJECT_RETURN",
  },
  receivePackage: {
    route: "return",
    approveDecision: GQL.EcomApproveReturnDecision.ApproveReceivedPackage,
    rejectDecision: "REJECT_RECEIVED_PACKAGE",
  },
  replacement: {
    route: "return",
    approveDecision: GQL.EcomApproveReturnDecision.ApproveReplacement,
    rejectDecision: "REJECT_REPLACEMENT",
  },
} as const satisfies Record<string, AfterSaleDecision>;

/**
 * Decision that a request that needs review maps to, or null when the workspace offers none.
 *
 * An explicit seller action wins and must agree with the kind: the backend's `approveReturn`
 * rejects APPROVE_RETURN for anything but RETURN_AND_REFUND and APPROVE_REPLACEMENT for anything
 * but a replacement, so a mismatching pair is shown read-only instead of failing at TikTok. A
 * pending request without an action takes the decision its kind implies. Exchange has no backend
 * decision, and an unknown action is never guessed.
 */
export function resolveAfterSaleDecision(request: AfterSaleRequestFacts): AfterSaleDecision | null {
  if (!request.needsReview) return null;
  const { kind } = request;
  const action = request.sellerNextAction;
  if (action) {
    switch (action) {
      case SELLER_ACTIONS.refund:
        return kind === "REFUND" ? { route: "refund", rejectDecision: "REJECT_REFUND" } : null;
      case SELLER_ACTIONS.return:
        return kind === "RETURN_AND_REFUND" ? RETURN_DECISIONS.return : null;
      case SELLER_ACTIONS.receivePackage:
        return kind === "RETURN_AND_REFUND" ? RETURN_DECISIONS.receivePackage : null;
      case SELLER_ACTIONS.replacement:
        return kind === "REPLACEMENT" ? RETURN_DECISIONS.replacement : null;
      case SELLER_ACTIONS.buyerCancel:
        return kind === "CANCELLATION" ? { route: "cancellation" } : null;
      default:
        return null;
    }
  }
  switch (kind) {
    case "REFUND":
      return { route: "refund", rejectDecision: "REJECT_REFUND" };
    case "RETURN_AND_REFUND":
      return RETURN_DECISIONS.return;
    case "REPLACEMENT":
      return RETURN_DECISIONS.replacement;
    case "CANCELLATION":
      return { route: "cancellation" };
    default:
      return null;
  }
}

/** What approving and rejecting do for one decision, as i18n keys under `ecommerce.afterSale.actions`. */
export interface AfterSaleActionLabels {
  approve:
    | "approveRefund"
    | "approveReturn"
    | "approveReceivedPackage"
    | "approveReplacement"
    | "approveCancellation";
  reject:
    | "rejectRefund"
    | "rejectReturn"
    | "rejectReceivedPackage"
    | "rejectReplacement"
    | "rejectCancellation";
}

/** The suggested action buttons of a decision: they name what the seller is agreeing to. */
export function afterSaleActionLabels(decision: AfterSaleDecision): AfterSaleActionLabels {
  if (decision.route === "refund") return { approve: "approveRefund", reject: "rejectRefund" };
  if (decision.route === "cancellation") {
    return { approve: "approveCancellation", reject: "rejectCancellation" };
  }
  switch (decision.approveDecision) {
    case GQL.EcomApproveReturnDecision.ApproveReceivedPackage:
      return { approve: "approveReceivedPackage", reject: "rejectReceivedPackage" };
    case GQL.EcomApproveReturnDecision.ApproveReplacement:
      return { approve: "approveReplacement", reject: "rejectReplacement" };
    default:
      return { approve: "approveReturn", reject: "rejectReturn" };
  }
}

/** A span of minutes split for display; the unit pair depends on the magnitude. */
export interface AfterSaleDuration {
  format: "daysHours" | "hoursMinutes" | "minutes";
  days: number;
  hours: number;
  minutes: number;
}

export function splitDuration(totalMinutes: number): AfterSaleDuration {
  const total = Math.max(0, Math.floor(totalMinutes));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  const format = days > 0 ? "daysHours" : hours > 0 ? "hoursMinutes" : "minutes";
  return { format, days, hours, minutes };
}

/** Under this many minutes left the deadline is shown as urgent. */
export const URGENT_MINUTES_LEFT = 6 * 60;

export type AfterSaleDeadlineState =
  | { state: "left"; duration: AfterSaleDuration; urgent: boolean }
  | { state: "overdue" }
  | { state: "noDeadline"; age: AfterSaleDuration };

/**
 * Time left until the platform deadline. Without a deadline the request's age is reported; the
 * workspace invents no SLA of its own.
 */
export function afterSaleDeadlineState(
  request: { sellerActionDeadline?: string | null; createTime: string },
  nowMs: number,
): AfterSaleDeadlineState {
  if (request.sellerActionDeadline) {
    const minutesLeft = (Date.parse(request.sellerActionDeadline) - nowMs) / 60_000;
    if (minutesLeft <= 0) return { state: "overdue" };
    return {
      state: "left",
      duration: splitDuration(minutesLeft),
      urgent: minutesLeft < URGENT_MINUTES_LEFT,
    };
  }
  return {
    state: "noDeadline",
    age: splitDuration((nowMs - Date.parse(request.createTime)) / 60_000),
  };
}

/**
 * Evidence images on a rejection. The backend uploads each one through TikTok's product image
 * upload (JPG/JPEG/PNG/WEBP/HEIC/BMP, at most 10 MB), and the encoded request must stay under
 * the 32 MB the gateway allows the reject routes, so the images together stay under 20 MB.
 */
export const AFTER_SALE_REJECT_IMAGE_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/bmp",
];
export const AFTER_SALE_REJECT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const AFTER_SALE_REJECT_IMAGES_MAX_TOTAL_BYTES = 20 * 1024 * 1024;

/** A rejection image as the reject routes take it: base64 bytes without a data-URL prefix. */
export interface AfterSaleRejectImage {
  data: string;
  mime: string;
}

export async function toRejectImage(file: File): Promise<AfterSaleRejectImage> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return { data: btoa(binary), mime: file.type };
}
