import { createContext, useContext } from "react";
import { AFFILIATE_FULL_ACCESS, type AffiliateAccess } from "../lib/affiliate-access.js";

/**
 * The Affiliate access of the signed-in login, provided by `AffiliateStaffGate`
 * around each staff-visible page. A plain value, never an MST node.
 *
 * Outside a gate the value is the unrestricted default, so every component that
 * reads it keeps its supervisor and BD behavior unchanged.
 */
export const AffiliateAccessContext = createContext<AffiliateAccess>(AFFILIATE_FULL_ACCESS);

export function useAffiliateAccess(): AffiliateAccess {
  return useContext(AffiliateAccessContext);
}
