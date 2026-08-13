import { describe, expect, it } from "vitest";
import { ROUTES } from "./routes.js";

describe("commerce navigation", () => {
  it("keeps the Affiliate manual workspace in its task-priority order", () => {
    const affiliateChildren = ROUTES
      .filter((route) => route.parentPath === "/commerce/affiliate")
      .map((route) => route.path);

    expect(affiliateChildren).toEqual([
      "/commerce/affiliate/attention",
      "/commerce/affiliate/team",
      "/commerce/product-knowledge",
      "/commerce/affiliate/campaigns",
      "/commerce/affiliate/creators",
      "/commerce/affiliate/history",
      "/commerce/affiliate/intelligence",
    ]);
  });
});
