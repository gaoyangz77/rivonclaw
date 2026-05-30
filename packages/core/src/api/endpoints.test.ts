import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getCnRelaySystemProxyBypassDomains,
  getCnRelayUrlForGlobalFirstPartyUrl,
  getApiBaseUrl,
  getCsRelayHttpUrl,
  getCsRelayWsUrl,
  getCsTelemetryUrl,
  getFirstPartyDomainRoute,
  getObjectStorageBaseUrl,
  getReleaseFeedUrl,
  getTelemetryUrl,
  routeFirstPartyUrl,
  resetFirstPartyDomainRouteForTests,
  setFirstPartyDomainRoute,
  setStagingDevMode,
} from "./endpoints.js";

const ORIGINAL_ENV = {
  RIVONCLAW_FIRST_PARTY_DOMAIN_ROUTE: process.env.RIVONCLAW_FIRST_PARTY_DOMAIN_ROUTE,
  RIVONCLAW_CN_RELAY: process.env.RIVONCLAW_CN_RELAY,
  UPDATE_FEED_URL: process.env.UPDATE_FEED_URL,
  UPDATE_FROM_STAGING: process.env.UPDATE_FROM_STAGING,
  CS_RELAY_URL: process.env.CS_RELAY_URL,
  CS_RELAY_HTTP_URL: process.env.CS_RELAY_HTTP_URL,
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
  delete process.env.UPDATE_FEED_URL;
  delete process.env.UPDATE_FROM_STAGING;
  delete process.env.CS_RELAY_URL;
  delete process.env.CS_RELAY_HTTP_URL;
});

afterEach(() => {
  resetFirstPartyDomainRouteForTests();
  restoreEnv();
});

describe("first-party domain routing", () => {
  it("uses global .com domains by default", () => {
    expect(getFirstPartyDomainRoute()).toBe("global");
    expect(getApiBaseUrl("zh")).toBe("https://api.rivonclaw.com");
    expect(getTelemetryUrl("zh")).toBe("https://t.rivonclaw.com/");
    expect(getCsTelemetryUrl("zh")).toBe("https://t.rivonclaw.com/v1/cs-events");
    expect(getCsRelayWsUrl()).toBe("wss://relay.rivonclaw.com/ws");
    expect(getCsRelayHttpUrl()).toBe("https://relay.rivonclaw.com");
    expect(getReleaseFeedUrl("zh")).toBe("https://www.rivonclaw.com/releases");
    expect(getObjectStorageBaseUrl()).toBe("https://minio.rivonclaw.com");
  });

  it("switches all first-party service domains to the CN relay route", () => {
    setFirstPartyDomainRoute("cn-relay");

    expect(getFirstPartyDomainRoute()).toBe("cn-relay");
    expect(getApiBaseUrl("en")).toBe("https://api.zhuazhuaai.cn");
    expect(getTelemetryUrl("en")).toBe("https://t.zhuazhuaai.cn/");
    expect(getCsTelemetryUrl("en")).toBe("https://t.zhuazhuaai.cn/v1/cs-events");
    expect(getCsRelayWsUrl()).toBe("wss://relay.zhuazhuaai.cn/ws");
    expect(getCsRelayHttpUrl()).toBe("https://relay.zhuazhuaai.cn");
    expect(getReleaseFeedUrl("en")).toBe("https://www.zhuazhuaai.cn/releases");
    expect(getObjectStorageBaseUrl()).toBe("https://minio.zhuazhuaai.cn");
  });

  it("routes staging API and update feed through matching staging hosts", () => {
    setStagingDevMode(true);
    process.env.UPDATE_FROM_STAGING = "1";

    expect(getApiBaseUrl("en")).toBe("https://api-stg.rivonclaw.com");
    expect(getReleaseFeedUrl("en")).toBe("https://stg.rivonclaw.com/releases");

    setFirstPartyDomainRoute("cn-relay");

    expect(getApiBaseUrl("en")).toBe("https://api-stg.zhuazhuaai.cn");
    expect(getReleaseFeedUrl("en")).toBe("https://stg.zhuazhuaai.cn/releases");
  });

  it("keeps explicit endpoint overrides authoritative", () => {
    setFirstPartyDomainRoute("cn-relay");
    process.env.UPDATE_FEED_URL = "https://origin.example.com/releases/";
    process.env.CS_RELAY_URL = "wss://relay.example.test/ws";
    process.env.CS_RELAY_HTTP_URL = "https://relay-http.example.test/";

    expect(getReleaseFeedUrl("zh")).toBe("https://origin.example.com/releases");
    expect(getCsRelayWsUrl()).toBe("wss://relay.example.test/ws");
    expect(getCsRelayHttpUrl()).toBe("https://relay-http.example.test");
  });

  it("rewrites first-party .com URLs to the matching CN relay URL", () => {
    expect(getCnRelayUrlForGlobalFirstPartyUrl("https://api.rivonclaw.com/graphql?x=1")).toBe(
      "https://api.zhuazhuaai.cn/graphql?x=1",
    );
    expect(getCnRelayUrlForGlobalFirstPartyUrl("wss://relay.rivonclaw.com/ws")).toBe(
      "wss://relay.zhuazhuaai.cn/ws",
    );
    expect(getCnRelayUrlForGlobalFirstPartyUrl("https://example.com/path")).toBeNull();
  });

  it("routes arbitrary first-party URLs when the CN relay route is active", () => {
    expect(routeFirstPartyUrl("https://api.rivonclaw.com/graphql")).toBe("https://api.rivonclaw.com/graphql");

    setFirstPartyDomainRoute("cn-relay");

    expect(routeFirstPartyUrl("https://api.rivonclaw.com/graphql")).toBe("https://api.zhuazhuaai.cn/graphql");
    expect(routeFirstPartyUrl("https://example.com/path")).toBe("https://example.com/path");
  });

  it("lists CN relay domains that should bypass a stale system proxy", () => {
    expect(getCnRelaySystemProxyBypassDomains()).toEqual(expect.arrayContaining([
      "api.zhuazhuaai.cn",
      "api-stg.zhuazhuaai.cn",
      "relay.zhuazhuaai.cn",
      "www.zhuazhuaai.cn",
    ]));
  });
});
