import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFirstPartyDomainRoute, resetFirstPartyDomainRouteForTests } from "@rivonclaw/core";
import {
  detectAndApplyFirstPartyDomainRoute,
  detectFirstPartyDomainRoute,
} from "./first-party-domain-route.js";

const ORIGINAL_ENV = {
  RIVONCLAW_FIRST_PARTY_DOMAIN_ROUTE: process.env.RIVONCLAW_FIRST_PARTY_DOMAIN_ROUTE,
  RIVONCLAW_CN_RELAY: process.env.RIVONCLAW_CN_RELAY,
  RIVONCLAW_CONNECTIVITY_PROBE_URL: process.env.RIVONCLAW_CONNECTIVITY_PROBE_URL,
};

function restoreEnv(): void {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeEach(() => {
  resetFirstPartyDomainRouteForTests();
  delete process.env.RIVONCLAW_FIRST_PARTY_DOMAIN_ROUTE;
  delete process.env.RIVONCLAW_CN_RELAY;
  delete process.env.RIVONCLAW_CONNECTIVITY_PROBE_URL;
});

afterEach(() => {
  resetFirstPartyDomainRouteForTests();
  restoreEnv();
});

describe("first-party domain route detection", () => {
  it("uses global domains when the connectivity probe succeeds", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ status: 204 } as Response);

    await expect(detectFirstPartyDomainRoute(fetchFn)).resolves.toBe("global");
    expect(fetchFn).toHaveBeenCalledWith("https://api.rivonclaw.com/graphql", expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "query RivonClawFirstPartyRouteProbe { __typename }" }),
      signal: expect.any(AbortSignal),
    }));
  });

  it("uses the CN relay when the connectivity probe fails", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("blocked"));

    await expect(detectFirstPartyDomainRoute(fetchFn)).resolves.toBe("cn-relay");
  });

  it("honors explicit environment overrides before probing", async () => {
    process.env.RIVONCLAW_FIRST_PARTY_DOMAIN_ROUTE = "cn-relay";
    const fetchFn = vi.fn();

    await expect(detectFirstPartyDomainRoute(fetchFn)).resolves.toBe("cn-relay");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("treats HTTP auth and GraphQL validation responses as reachable API connectivity", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ status: 401 } as Response);

    await expect(detectFirstPartyDomainRoute(fetchFn)).resolves.toBe("global");
  });

  it("applies the detected route to core endpoint getters", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("blocked"));

    await detectAndApplyFirstPartyDomainRoute(fetchFn);

    expect(getFirstPartyDomainRoute()).toBe("cn-relay");
  });
});
