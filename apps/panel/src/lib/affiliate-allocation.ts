/**
 * The error code the Backend returns when an assignment or release names an owner
 * the Creator no longer has (ADR-113): someone else changed the Creator's BD
 * after the caller looked at it.
 */
export const AFFILIATE_CREATOR_OWNER_CHANGED = "AFFILIATE_CREATOR_OWNER_CHANGED";
