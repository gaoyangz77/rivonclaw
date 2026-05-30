import { DEFAULTS } from "../defaults.js";

// ---------------------------------------------------------------------------
// Staging mode
// ---------------------------------------------------------------------------

/**
 * Whether the current runtime is targeting the staging backend.
 * Primary flag: RIVONCLAW_STAGING=1 (env var).
 * Also settable at runtime via setStagingDevMode() for Panel init.
 */
let _stagingOverride: boolean | undefined;

export function setStagingDevMode(enabled: boolean): void {
	_stagingOverride = enabled;
}

export function isStagingDevMode(): boolean {
	if (_stagingOverride !== undefined) return _stagingOverride;
	return typeof process !== "undefined" && process.env.RIVONCLAW_STAGING === "1";
}

// ---------------------------------------------------------------------------
// First-party domain routing
// ---------------------------------------------------------------------------

export type FirstPartyDomainRoute = "global" | "cn-relay";

let _firstPartyDomainRoute: FirstPartyDomainRoute | undefined;

function routeFromEnv(): FirstPartyDomainRoute | undefined {
	const globalRoute = (globalThis as { __RIVONCLAW_FIRST_PARTY_DOMAIN_ROUTE__?: unknown })
		.__RIVONCLAW_FIRST_PARTY_DOMAIN_ROUTE__;
	if (globalRoute === "global" || globalRoute === "cn-relay") return globalRoute;

	if (typeof process === "undefined") return undefined;
	const raw = process.env.RIVONCLAW_FIRST_PARTY_DOMAIN_ROUTE?.trim().toLowerCase();
	if (raw === "global" || raw === "cn-relay") return raw;
	if (process.env.RIVONCLAW_CN_RELAY === "1") return "cn-relay";
	return undefined;
}

export function setFirstPartyDomainRoute(route: FirstPartyDomainRoute): void {
	_firstPartyDomainRoute = route;
}

export function getFirstPartyDomainRoute(): FirstPartyDomainRoute {
	return _firstPartyDomainRoute ?? routeFromEnv() ?? "global";
}

export function resetFirstPartyDomainRouteForTests(): void {
	_firstPartyDomainRoute = undefined;
	_apiBaseUrlOverride = undefined;
	_stagingOverride = undefined;
	delete (globalThis as { __RIVONCLAW_FIRST_PARTY_DOMAIN_ROUTE__?: unknown })
		.__RIVONCLAW_FIRST_PARTY_DOMAIN_ROUTE__;
}

function useCnRelay(): boolean {
	return getFirstPartyDomainRoute() === "cn-relay";
}

function firstPartyDomain(globalDomain: string, cnRelayDomain: string): string {
	return useCnRelay() ? cnRelayDomain : globalDomain;
}

const FIRST_PARTY_CN_HOST_BY_GLOBAL_HOST: Record<string, string> = {
	[DEFAULTS.domains.api]: DEFAULTS.domains.apiCn,
	[DEFAULTS.domains.apiStaging]: DEFAULTS.domains.apiStagingCn,
	[DEFAULTS.domains.web]: DEFAULTS.domains.webCn,
	[DEFAULTS.domains.updater]: DEFAULTS.domains.webCn,
	[DEFAULTS.domains.staging]: DEFAULTS.domains.stagingCn,
	[DEFAULTS.domains.telemetry]: DEFAULTS.domains.telemetryCn,
	[DEFAULTS.domains.csRelay]: DEFAULTS.domains.csRelayCn,
	[DEFAULTS.domains.objectStorage]: DEFAULTS.domains.objectStorageCn,
};

export function getCnRelayUrlForGlobalFirstPartyUrl(url: string | URL): string | null {
	try {
		const parsed = new URL(url.toString());
		const cnHost = FIRST_PARTY_CN_HOST_BY_GLOBAL_HOST[parsed.hostname];
		if (!cnHost) return null;
		parsed.hostname = cnHost;
		return parsed.toString();
	} catch {
		return null;
	}
}

export function routeFirstPartyUrl(url: string | URL): string | URL {
	if (!useCnRelay()) return url;
	return getCnRelayUrlForGlobalFirstPartyUrl(url) ?? url;
}

export function getCnRelaySystemProxyBypassDomains(): string[] {
	return Array.from(new Set(Object.values(FIRST_PARTY_CN_HOST_BY_GLOBAL_HOST)));
}

// ---------------------------------------------------------------------------
// API base URL
// ---------------------------------------------------------------------------

let _apiBaseUrlOverride: string | undefined;

/** Override the API base URL globally (used by tests and Panel init). */
export function setApiBaseUrlOverride(url: string | undefined): void {
	_apiBaseUrlOverride = url;
}

/** Return the API base URL for the given language/locale. */
export function getApiBaseUrl(lang: string): string {
	void lang;
	if (_apiBaseUrlOverride) return _apiBaseUrlOverride;
	if (isStagingDevMode()) {
		return `https://${firstPartyDomain(DEFAULTS.domains.apiStaging, DEFAULTS.domains.apiStagingCn)}`;
	}
	return `https://${firstPartyDomain(DEFAULTS.domains.api, DEFAULTS.domains.apiCn)}`;
}

/** Return the GraphQL endpoint URL for the given language/locale. */
export function getGraphqlUrl(lang: string): string {
	return `${getApiBaseUrl(lang)}/graphql`;
}

/** Return the telemetry endpoint URL for the given locale. */
export function getTelemetryUrl(locale: string): string {
	void locale;
	return `https://${firstPartyDomain(DEFAULTS.domains.telemetry, DEFAULTS.domains.telemetryCn)}/`;
}

/**
 * Return the CS business-telemetry endpoint URL. Separate path from the
 * opt-in user telemetry stream — accepts `cs.message` / `cs.token_snapshot`
 * / `cs.delivery_recovery` / `ecom.tool_call` / `cs.error` events that
 * commercial tenants authorize via contract.
 */
export function getCsTelemetryUrl(locale: string): string {
	void locale;
	return `https://${firstPartyDomain(DEFAULTS.domains.telemetry, DEFAULTS.domains.telemetryCn)}/v1/cs-events`;
}

// ---------------------------------------------------------------------------
// Customer-service relay URLs
// ---------------------------------------------------------------------------

/**
 * Return the CS relay WebSocket URL.
 * Overridable via CS_RELAY_URL env var for staging/testing.
 */
export function getCsRelayWsUrl(): string {
	const envOverride = typeof process !== "undefined" ? process.env.CS_RELAY_URL : undefined;
	if (envOverride) return envOverride;
	return `wss://${firstPartyDomain(DEFAULTS.domains.csRelay, DEFAULTS.domains.csRelayCn)}/ws`;
}

/**
 * Return the CS relay HTTP base URL.
 * CS_RELAY_HTTP_URL is the explicit override; CS_RELAY_URL is accepted for
 * dev setups and converted from ws(s)://.../ws to http(s)://...
 */
export function getCsRelayHttpUrl(): string {
	const explicitOverride = typeof process !== "undefined" ? process.env.CS_RELAY_HTTP_URL : undefined;
	if (explicitOverride) return explicitOverride.replace(/\/+$/, "");

	const wsOverride = typeof process !== "undefined" ? process.env.CS_RELAY_URL : undefined;
	if (wsOverride) {
		return wsOverride
			.replace(/^wss:\/\//, "https://")
			.replace(/^ws:\/\//, "http://")
			.replace(/\/ws\/?$/, "")
			.replace(/\/+$/, "");
	}

	return `https://${firstPartyDomain(DEFAULTS.domains.csRelay, DEFAULTS.domains.csRelayCn)}`;
}

/** Telegram Bot API root used by the RivonClaw support/debug proxy. */
export function getTelegramDebugRelayApiRoot(): string {
	return getCsRelayHttpUrl();
}

// ---------------------------------------------------------------------------
// Release feed URLs
// ---------------------------------------------------------------------------

/**
 * Return the release feed URL for auto-updater.
 * Respects UPDATE_FEED_URL and UPDATE_FROM_STAGING env vars.
 */
export function getReleaseFeedUrl(locale: string): string {
	void locale;
	const explicitOverride = typeof process !== "undefined" ? process.env.UPDATE_FEED_URL : undefined;
	if (explicitOverride) return explicitOverride.replace(/\/+$/, "");
	const useStaging = typeof process !== "undefined" && process.env.UPDATE_FROM_STAGING === "1";
	if (useStaging) return `https://${firstPartyDomain(DEFAULTS.domains.staging, DEFAULTS.domains.stagingCn)}/releases`;
	// Auto-updater uses a dedicated feed domain so update traffic can bypass the
	// website CDN and hit a source-origin path that fully supports differential
	// download range requests.
	return `https://${firstPartyDomain(DEFAULTS.domains.updater, DEFAULTS.domains.webCn)}/releases`;
}

/** Return the object-storage base URL used for first-party media assets. */
export function getObjectStorageBaseUrl(): string {
	return `https://${firstPartyDomain(DEFAULTS.domains.objectStorage, DEFAULTS.domains.objectStorageCn)}`;
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
	DEFAULTS.channels.weixinIlink,
	DEFAULTS.channels.weixinLiteapp,
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
