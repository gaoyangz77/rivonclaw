import { ApolloLink, Observable } from "@apollo/client";
import i18n from "i18next";

/** The translation key of each Affiliate denial reason the Backend names (ADR-112, ADR-113). */
const AFFILIATE_DENIAL_REASON_KEYS: Record<string, string> = {
  AFFILIATE_CREATOR_OWNED_BY_OTHER_BD: "ecommerce.affiliateWorkspace.workbench.otherBdOperationForbidden",
  AFFILIATE_OPERATION_NOT_PERMITTED: "ecommerce.affiliateWorkspace.workbench.operationNotPermitted",
  AFFILIATE_CREATOR_OUTSIDE_REGION_SCOPE: "ecommerce.affiliateStaff.creatorOutsideRegionScope",
  AFFILIATE_TARGET_BD_OUTSIDE_REGION_OVERLAP: "ecommerce.affiliateStaff.targetOutsideRegionOverlap",
  AFFILIATE_CREATOR_OUTSIDE_TEAM_LEAD_SCOPE: "ecommerce.affiliateStaff.creatorOutsideTeamLeadScope",
  AFFILIATE_TARGET_BD_OUTSIDE_TEAM_LEAD_SCOPE: "ecommerce.affiliateStaff.targetOutsideTeamLeadScope",
  AFFILIATE_OPERATOR_OUTSIDE_SCOPE: "ecommerce.affiliateStaff.operatorOutsideScope",
};

/** Translate only explicit Affiliate denial reasons, never all FORBIDDEN errors. */
export function createAffiliatePermissionErrorLink(): ApolloLink {
  return new ApolloLink((operation, forward) => new Observable((observer) => {
    const subscription = forward(operation).subscribe({
      next(result) {
        if (!result.errors?.length) {
          observer.next(result);
          return;
        }
        observer.next({
          ...result,
          errors: result.errors.map((error) => {
            if (error.extensions?.code !== "FORBIDDEN") return error;
            const reason = error.extensions.reason;
            const key =
              typeof reason === "string" ? (AFFILIATE_DENIAL_REASON_KEYS[reason] ?? null) : null;
            return key && i18n.exists(key) ? { ...error, message: i18n.t(key) } : error;
          }),
        });
      },
      error: (error) => observer.error(error),
      complete: () => observer.complete(),
    });
    return () => subscription.unsubscribe();
  }));
}
