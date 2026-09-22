export const AFFILIATE_CAMPAIGN_NAME_MAX_LENGTH = 120;

/**
 * Campaign names are multilingual display labels. Target Collaboration names
 * are generated separately by the Backend, so the Panel only enforces the
 * storage/display contract here.
 */
export function isAffiliateCampaignNameValid(value: string): boolean {
  const clean = value.trim();
  return (
    clean.length > 0 &&
    clean.length <= AFFILIATE_CAMPAIGN_NAME_MAX_LENGTH &&
    !/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/u.test(clean)
  );
}
