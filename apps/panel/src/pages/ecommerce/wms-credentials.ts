/**
 * Shape checks for WMS API tokens.
 *
 * Some providers expect the token field to carry a JSON credential object
 * rather than an opaque string. Nothing in the form said so beyond a
 * placeholder, so a token pasted in the wrong shape saved cleanly and only
 * surfaced hours later as a backend 500 during the nightly inventory sync
 * (2026-08-18: ten shops failed for one account saved as a plain string).
 * Checking here turns that into an inline error at the moment of typing.
 *
 * The provider contracts mirror the backend clients, which are the authority:
 * XlwmsClient.ts requires appKey + appSecret, LingxingWmsClient.ts requires
 * appId + appSecret, and YEJOIN takes an opaque string.
 */

export type WmsApiTokenIssue = "invalidJson" | "missingFields";

const JSON_CREDENTIAL_FIELDS: Record<string, readonly string[]> = {
  XLWMS: ["appKey", "appSecret"],
  LINGXING: ["appId", "appSecret"],
};

/** The fields a provider's token must carry, or null when it takes a plain string. */
export function wmsApiTokenFields(provider: string): readonly string[] | null {
  return JSON_CREDENTIAL_FIELDS[provider] ?? null;
}

/**
 * What is wrong with this token for this provider, or null when it is usable.
 *
 * An empty token is never an issue here: creation already requires a non-empty
 * token, and an empty field while editing means "keep the stored one".
 */
export function wmsApiTokenIssue(provider: string, apiToken: string): WmsApiTokenIssue | null {
  const required = wmsApiTokenFields(provider);
  if (!required) return null;

  const trimmed = apiToken.trim();
  if (!trimmed) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return "invalidJson";
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "invalidJson";
  }

  const record = parsed as Record<string, unknown>;
  const hasEvery = required.every((field) => {
    const value = record[field];
    return typeof value === "string" && value.trim().length > 0;
  });
  return hasEvery ? null : "missingFields";
}
