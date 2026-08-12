import { describe, expect, it } from "vitest";
import { ROUTES } from "./routes.js";

describe("commerce navigation", () => {
  it("places Product Knowledge inside Affiliate immediately after Team & Channels", () => {
    const teamIndex = ROUTES.findIndex((route) => route.path === "/commerce/affiliate/team");
    const knowledgeIndex = ROUTES.findIndex((route) => route.path === "/commerce/product-knowledge");
    const knowledgeRoute = ROUTES[knowledgeIndex];

    expect(teamIndex).toBeGreaterThan(-1);
    expect(knowledgeIndex).toBe(teamIndex + 1);
    expect(knowledgeRoute?.parentPath).toBe("/commerce/affiliate");
  });
});
