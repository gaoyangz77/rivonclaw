export type WmsCredentialMode = "AUTHORIZE" | "EXISTING";

export type WmsCredentialField =
  | "apiKey"
  | "apiSecret"
  | "apiToken"
  | "refreshToken"
  | "providerUserId"
  | "authorizationUser"
  | "authorizationToken";

export interface WmsCredentialDraft {
  apiKey: string;
  apiSecret: string;
  apiToken: string;
  refreshToken: string;
  providerUserId: string;
  authorizationUser: string;
  authorizationToken: string;
}

const STATIC_FIELDS: Record<string, readonly WmsCredentialField[]> = {
  YEJOIN: ["apiToken"],
  XLWMS: ["apiKey", "apiSecret"],
  LINGXING: ["apiKey", "apiSecret"],
  SELLFOX: ["apiKey", "apiSecret"],
};

export function wmsCredentialFields(
  provider: string,
  mode: WmsCredentialMode,
): readonly WmsCredentialField[] {
  if (provider === "JFWMS") {
    return mode === "AUTHORIZE"
      ? ["apiKey", "apiSecret", "authorizationUser", "authorizationToken"]
      : ["apiKey", "apiSecret", "refreshToken", "providerUserId"];
  }
  return STATIC_FIELDS[provider] ?? ["apiToken"];
}

/** Missing structured fields, or null when the credential draft can be submitted. */
export function wmsCredentialIssue(
  provider: string,
  mode: WmsCredentialMode,
  draft: WmsCredentialDraft,
  isEdit: boolean,
): "missingFields" | null {
  const required = wmsCredentialFields(provider, mode);
  const enteredAny = required.some((field) => draft[field].trim());
  if (isEdit && !enteredAny && !(provider === "JFWMS" && mode === "AUTHORIZE"))
    return null;
  return required.every((field) => draft[field].trim())
    ? null
    : "missingFields";
}
