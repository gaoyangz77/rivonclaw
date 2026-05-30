import {
  getFirstPartyDomainRoute,
  getGraphqlUrl,
  setFirstPartyDomainRoute,
  type FirstPartyDomainRoute,
} from "@rivonclaw/core";
import { createLogger } from "@rivonclaw/logger";

const log = createLogger("first-party-domain-route");

const PROBE_TIMEOUT_MS = 10_000;
const PROBE_QUERY = "query RivonClawFirstPartyRouteProbe { __typename }";

type FetchFn = (url: string | URL, init?: RequestInit) => Promise<Response>;

function forcedRouteFromEnv(): FirstPartyDomainRoute | null {
  const raw = process.env.RIVONCLAW_FIRST_PARTY_DOMAIN_ROUTE?.trim().toLowerCase();
  if (raw === "global" || raw === "cn-relay") return raw;
  if (process.env.RIVONCLAW_CN_RELAY === "1") return "cn-relay";
  return null;
}

function probeUrl(): string {
  return process.env.RIVONCLAW_CONNECTIVITY_PROBE_URL || getGraphqlUrl("en");
}

function isReachableProbeResponse(res: Response): boolean {
  return res.status >= 200 && res.status < 500;
}

export async function detectFirstPartyDomainRoute(fetchFn: FetchFn): Promise<FirstPartyDomainRoute> {
  const forcedRoute = forcedRouteFromEnv();
  if (forcedRoute) {
    log.info(`Using first-party domain route from env: ${forcedRoute}`);
    return forcedRoute;
  }

  const url = probeUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const res = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: PROBE_QUERY }),
      signal: controller.signal,
    });
    const route: FirstPartyDomainRoute = isReachableProbeResponse(res) ? "global" : "cn-relay";
    log.info(`First-party GraphQL probe ${url} returned HTTP ${res.status}; first-party domain route=${route}`);
    return route;
  } catch (err) {
    log.warn(
      `First-party GraphQL probe ${url} failed; using cn-relay route: ${err instanceof Error ? err.message : String(err)}`,
    );
    return "cn-relay";
  } finally {
    clearTimeout(timeout);
  }
}

export async function detectAndApplyFirstPartyDomainRoute(fetchFn: FetchFn): Promise<FirstPartyDomainRoute> {
  const route = await detectFirstPartyDomainRoute(fetchFn);
  setFirstPartyDomainRoute(route);
  log.info(`First-party domain route active: ${getFirstPartyDomainRoute()}`);
  return route;
}
