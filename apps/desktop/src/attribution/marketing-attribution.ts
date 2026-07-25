export const MARKETING_ATTRIBUTION_SCHEME = "tkcopilot";
export const MARKETING_ATTRIBUTION_STORAGE_KEY = "marketing_attribution_v1";

const MAX_DEEP_LINK_LENGTH = 8_192;
const MAX_PAYLOAD_LENGTH = 6_144;
const MAX_CAMPAIGN_LENGTH = 128;
const MAX_PATH_LENGTH = 512;
const MAX_DOMAIN_LENGTH = 255;
const ATTRIBUTION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface MarketingTouch {
  source: string;
  medium: string;
  campaign?: string;
  content?: string;
  term?: string;
  landingPage: string;
  referrerDomain?: string;
  capturedAt: string;
}

export interface MarketingAttribution {
  version: 1;
  attributionId: string;
  firstTouch: MarketingTouch;
  lastTouch: MarketingTouch;
}

interface SettingsLike {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): boolean;
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? Array.from(value)
        .filter((character) => {
          const code = character.charCodeAt(0);
          return code > 31 && code !== 127;
        })
        .join("")
        .trim()
        .slice(0, maxLength)
    : "";
}

function cleanPath(value: unknown): string {
  const path = cleanText(value, MAX_PATH_LENGTH);
  return path.startsWith("/") ? path.split(/[?#]/, 1)[0] || "/" : "/";
}

function cleanDomain(value: unknown): string | undefined {
  const domain = cleanText(value, MAX_DOMAIN_LENGTH).toLowerCase();
  if (!domain) return undefined;
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(domain)) {
    return undefined;
  }
  return domain;
}

function cleanCapturedAt(value: unknown): string | undefined {
  const raw = cleanText(value, 40);
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) return undefined;
  const now = Date.now();
  if (timestamp < now - 366 * 24 * 60 * 60 * 1_000 || timestamp > now + 24 * 60 * 60 * 1_000) {
    return undefined;
  }
  return new Date(timestamp).toISOString();
}

function normalizeTouch(value: unknown): MarketingTouch | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const source = cleanText(input.source, MAX_CAMPAIGN_LENGTH);
  const medium = cleanText(input.medium, MAX_CAMPAIGN_LENGTH);
  const capturedAt = cleanCapturedAt(input.capturedAt);
  if (!source || !medium || !capturedAt) return undefined;

  const campaign = cleanText(input.campaign, MAX_CAMPAIGN_LENGTH);
  const content = cleanText(input.content, MAX_CAMPAIGN_LENGTH);
  const term = cleanText(input.term, MAX_CAMPAIGN_LENGTH);
  return {
    source,
    medium,
    ...(campaign ? { campaign } : {}),
    ...(content ? { content } : {}),
    ...(term ? { term } : {}),
    landingPage: cleanPath(input.landingPage),
    ...(cleanDomain(input.referrerDomain)
      ? { referrerDomain: cleanDomain(input.referrerDomain) }
      : {}),
    capturedAt,
  };
}

export function normalizeMarketingAttribution(value: unknown): MarketingAttribution | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const attributionId = cleanText(input.attributionId, 36);
  const firstTouch = normalizeTouch(input.firstTouch);
  const lastTouch = normalizeTouch(input.lastTouch);
  if (
    input.version !== 1 ||
    !ATTRIBUTION_ID_RE.test(attributionId) ||
    !firstTouch ||
    !lastTouch
  ) {
    return undefined;
  }
  return {
    version: 1,
    attributionId,
    firstTouch,
    lastTouch,
  };
}

export function parseMarketingAttributionDeepLink(rawUrl: string): MarketingAttribution | undefined {
  if (!rawUrl || rawUrl.length > MAX_DEEP_LINK_LENGTH) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return undefined;
  }
  if (
    parsed.protocol !== `${MARKETING_ATTRIBUTION_SCHEME}:` ||
    parsed.hostname !== "attribution" ||
    parsed.username ||
    parsed.password
  ) {
    return undefined;
  }

  const encodedPayload = parsed.searchParams.get("payload") ?? "";
  if (!encodedPayload || encodedPayload.length > MAX_PAYLOAD_LENGTH) return undefined;
  try {
    const decoded = Buffer.from(encodedPayload, "base64url").toString("utf8");
    if (!decoded || decoded.length > MAX_PAYLOAD_LENGTH) return undefined;
    return normalizeMarketingAttribution(JSON.parse(decoded));
  } catch {
    return undefined;
  }
}

export function persistMarketingAttributionDeepLink(
  settings: SettingsLike,
  rawUrl: string,
): boolean {
  const attribution = parseMarketingAttributionDeepLink(rawUrl);
  if (!attribution) return false;
  settings.set(MARKETING_ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
  return true;
}

export function readStoredMarketingAttribution(
  settings: SettingsLike,
): MarketingAttribution | undefined {
  const raw = settings.get(MARKETING_ATTRIBUTION_STORAGE_KEY);
  if (!raw) return undefined;
  try {
    return normalizeMarketingAttribution(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

export function clearStoredMarketingAttribution(settings: SettingsLike): void {
  settings.delete(MARKETING_ATTRIBUTION_STORAGE_KEY);
}

export function findMarketingAttributionDeepLink(args: string[]): string | undefined {
  return args.find((arg) =>
    arg.toLowerCase().startsWith(`${MARKETING_ATTRIBUTION_SCHEME}://attribution?`),
  );
}
