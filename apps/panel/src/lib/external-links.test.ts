import { afterEach, describe, expect, it } from "vitest";
import {
  resetFirstPartyDomainRouteForTests,
  setFirstPartyDomainRoute,
} from "@rivonclaw/core";
import { EXTERNAL_LINKS } from "./external-links.js";

describe("EXTERNAL_LINKS", () => {
  afterEach(() => {
    resetFirstPartyDomainRouteForTests();
  });

  it("uses global website URLs by default", () => {
    expect(EXTERNAL_LINKS.homepage).toBe("https://www.tkcopilot.com/");
    expect(EXTERNAL_LINKS.termsOfService).toBe("https://www.tkcopilot.com/terms/");
    expect(EXTERNAL_LINKS.privacyPolicy).toBe("https://www.tkcopilot.com/privacy");
  });

  it("uses CN relay website URLs when the first-party route is cn-relay", () => {
    setFirstPartyDomainRoute("cn-relay");

    expect(EXTERNAL_LINKS.homepage).toBe("https://www.tkjiang.cn/");
    expect(EXTERNAL_LINKS.termsOfService).toBe("https://www.tkjiang.cn/terms/");
    expect(EXTERNAL_LINKS.privacyPolicy).toBe("https://www.tkjiang.cn/privacy");
  });
});
