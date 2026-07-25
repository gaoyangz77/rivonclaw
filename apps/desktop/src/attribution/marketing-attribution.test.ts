import { describe, expect, it } from "vitest";
import {
  MARKETING_ATTRIBUTION_STORAGE_KEY,
  findMarketingAttributionDeepLink,
  parseMarketingAttributionDeepLink,
  persistMarketingAttributionDeepLink,
  readStoredMarketingAttribution,
} from "./marketing-attribution.js";

const attribution = {
  version: 1,
  attributionId: "7c3387df-b4a9-4d79-b721-fc46683bd4a7",
  firstTouch: {
    source: "tiktok",
    medium: "organic_social",
    campaign: "cs_launch_01",
    content: "en_video_01",
    landingPage: "/",
    referrerDomain: "tiktok.com",
    capturedAt: new Date().toISOString(),
  },
  lastTouch: {
    source: "x",
    medium: "organic_social",
    campaign: "cs_launch_01",
    content: "en_video_02",
    landingPage: "/",
    referrerDomain: "x.com",
    capturedAt: new Date().toISOString(),
  },
};

function deepLink(payload: unknown): string {
  return `tkcopilot://attribution?payload=${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
}

function settingsFixture() {
  const values = new Map<string, string>();
  return {
    values,
    get: (key: string) => values.get(key),
    set: (key: string, value: string) => values.set(key, value),
    delete: (key: string) => values.delete(key),
  };
}

describe("marketing attribution deep links", () => {
  it("accepts a normalized first-party attribution payload", () => {
    expect(parseMarketingAttributionDeepLink(deepLink(attribution))).toEqual(attribution);
  });

  it("rejects unrelated routes, malformed IDs, and oversized input", () => {
    expect(parseMarketingAttributionDeepLink("https://example.com/")).toBeUndefined();
    expect(
      parseMarketingAttributionDeepLink(
        deepLink({ ...attribution, attributionId: "not-a-random-uuid" }),
      ),
    ).toBeUndefined();
    expect(parseMarketingAttributionDeepLink(`tkcopilot://attribution?payload=${"a".repeat(7_000)}`))
      .toBeUndefined();
  });

  it("removes query strings, control characters, and invalid referrer domains", () => {
    const parsed = parseMarketingAttributionDeepLink(
      deepLink({
        ...attribution,
        firstTouch: {
          ...attribution.firstTouch,
          source: " tiktok\u0000 ",
          landingPage: "/offer?email=private@example.com",
          referrerDomain: "not a domain",
        },
      }),
    );
    expect(parsed?.firstTouch.source).toBe("tiktok");
    expect(parsed?.firstTouch.landingPage).toBe("/offer");
    expect(parsed?.firstTouch.referrerDomain).toBeUndefined();
  });

  it("persists and reads a validated payload", () => {
    const settings = settingsFixture();
    expect(persistMarketingAttributionDeepLink(settings, deepLink(attribution))).toBe(true);
    expect(settings.values.has(MARKETING_ATTRIBUTION_STORAGE_KEY)).toBe(true);
    expect(readStoredMarketingAttribution(settings)).toEqual(attribution);
  });

  it("finds the protocol URL in an Electron command line", () => {
    expect(
      findMarketingAttributionDeepLink([
        "/Applications/TK Copilot.app",
        "--flag",
        deepLink(attribution),
      ]),
    ).toBe(deepLink(attribution));
  });
});
