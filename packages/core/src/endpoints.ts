import { DEFAULTS } from "./defaults.js";

// ---------------------------------------------------------------------------
// First-party service URLs — derived from DEFAULTS.domains
// ---------------------------------------------------------------------------

/** @deprecated Use `DEFAULTS.domains.api` or `getApiBaseUrl()` instead. */
export const API_BASE_URL = `https://${DEFAULTS.domains.api}`;
/** @deprecated Use `DEFAULTS.domains.apiCn` or `getApiBaseUrl()` instead. */
export const API_BASE_URL_CN = `https://${DEFAULTS.domains.apiCn}`;
/** @deprecated Use `DEFAULTS.domains.telemetry` or `getTelemetryUrl()` instead. */
export const TELEMETRY_URL = `https://${DEFAULTS.domains.telemetry}/`;
/** @deprecated Use `DEFAULTS.domains.telemetryCn` or `getTelemetryUrl()` instead. */
export const TELEMETRY_URL_CN = `https://${DEFAULTS.domains.telemetryCn}/`;

/**
 * Return the API base URL for the given language/locale.
 * Overridable for staging/testing:
 *   - Node.js (Desktop): set env RIVONCLAW_API_BASE_URL
 *   - Browser (Panel):   call setApiBaseUrlOverride() at init time
 */
let _apiBaseUrlOverride: string | undefined;

/** Override the API base URL globally (call from Panel init to support staging). */
export function setApiBaseUrlOverride(url: string): void {
	_apiBaseUrlOverride = url;
}

export function getApiBaseUrl(lang: string): string {
	if (_apiBaseUrlOverride) return _apiBaseUrlOverride;
	const nodeOverride = typeof process !== "undefined" ? process.env.RIVONCLAW_API_BASE_URL : undefined;
	if (nodeOverride) return nodeOverride;
	return lang === "zh" ? `https://${DEFAULTS.domains.apiCn}` : `https://${DEFAULTS.domains.api}`;
}

/** Return the GraphQL endpoint URL for the given language/locale. */
export function getGraphqlUrl(lang: string): string {
	return `${getApiBaseUrl(lang)}/graphql`;
}

/** Return the telemetry endpoint URL for the given locale. */
export function getTelemetryUrl(locale: string): string {
	return locale === "zh"
		? `https://${DEFAULTS.domains.telemetryCn}/`
		: `https://${DEFAULTS.domains.telemetry}/`;
}

// ---------------------------------------------------------------------------
// Release feed URLs
// ---------------------------------------------------------------------------

/**
 * Return the release feed URL for auto-updater.
 * Respects UPDATE_FROM_STAGING env var.
 */
export function getReleaseFeedUrl(locale: string): string {
	const useStaging = typeof process !== "undefined" && process.env.UPDATE_FROM_STAGING === "1";
	if (useStaging) return `https://${DEFAULTS.domains.staging}/releases`;
	return locale === "zh"
		? `https://${DEFAULTS.domains.webCn}/releases`
		: `https://${DEFAULTS.domains.web}/releases`;
}

// ---------------------------------------------------------------------------
// Channel API endpoints — composed from DEFAULTS.channels
// ---------------------------------------------------------------------------

/** Telegram Bot API: sendMessage endpoint. */
export function getTelegramSendUrl(botToken: string): string {
	return `https://${DEFAULTS.channels.telegram}/bot${botToken}/sendMessage`;
}

/** Resolve Feishu/Lark API host based on domain variant. */
export function getFeishuHost(domain: string): string {
	return domain === "lark" ? DEFAULTS.channels.lark : DEFAULTS.channels.feishu;
}

/** Feishu/Lark tenant access token endpoint. */
export function getFeishuTokenUrl(domain: string): string {
	return `https://${getFeishuHost(domain)}/open-apis/auth/v3/tenant_access_token/internal`;
}

/** Feishu/Lark send message endpoint. */
export function getFeishuMessageUrl(domain: string): string {
	return `https://${getFeishuHost(domain)}/open-apis/im/v1/messages?receive_id_type=open_id`;
}

/** LINE Messaging API: push message endpoint. */
export function getLinePushUrl(): string {
	return `https://${DEFAULTS.channels.line}/v2/bot/message/push`;
}

/**
 * Channel domains that should bypass the outbound proxy (domestic access).
 * Used by proxy-manager to build NO_PROXY list.
 */
export const CHANNEL_NO_PROXY_DOMAINS: readonly string[] = [
	DEFAULTS.channels.feishu,
	DEFAULTS.channels.lark,
	DEFAULTS.channels.wecom,
];

// ---------------------------------------------------------------------------
// Provider API endpoints
// ---------------------------------------------------------------------------

/** Anthropic Messages API endpoint. */
export function getAnthropicMessagesUrl(): string {
	return `https://${DEFAULTS.providers.anthropic}/v1/messages`;
}

// ---------------------------------------------------------------------------
// Local model defaults — composed from DEFAULTS.ollama
// ---------------------------------------------------------------------------

/** Default Ollama base URL (e.g. "http://localhost:11434"). */
export function getOllamaBaseUrl(): string {
	return `http://${DEFAULTS.ollama.host}:${DEFAULTS.ollama.port}`;
}

/** Default Ollama OpenAI-compatible base URL (with /v1 suffix). */
export function getOllamaOpenAiBaseUrl(): string {
	return `${getOllamaBaseUrl()}/v1`;
}
