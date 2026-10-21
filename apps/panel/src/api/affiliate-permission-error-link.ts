import { ApolloLink, Observable } from "@apollo/client";
import i18n from "i18next";

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
            const key = reason === "AFFILIATE_CREATOR_OWNED_BY_OTHER_BD"
              ? "ecommerce.affiliateWorkspace.workbench.otherBdOperationForbidden"
              : reason === "AFFILIATE_OPERATION_NOT_PERMITTED"
                ? "ecommerce.affiliateWorkspace.workbench.operationNotPermitted"
                : null;
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
