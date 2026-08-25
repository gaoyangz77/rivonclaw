import { describe, expect, it } from "vitest";
import { canSeeRoute } from "./permission-scope.js";

const AFFILIATE = "AFFILIATE";
const BILLING = "BILLING";

describe("canSeeRoute", () => {
  it("shows every route while signed out", () => {
    expect(canSeeRoute({ scope: AFFILIATE }, null)).toBe(true);
    expect(canSeeRoute({}, null)).toBe(true);
  });

  it("shows every route to a main account, even with no scopes listed", () => {
    const owner = { isOwner: true, permissionScopes: [] };
    expect(canSeeRoute({ scope: AFFILIATE }, owner)).toBe(true);
    expect(canSeeRoute({}, owner)).toBe(true);
  });

  it("shows unscoped base pages to a member holding no scopes", () => {
    expect(canSeeRoute({}, { isOwner: false, permissionScopes: [] })).toBe(true);
  });

  it("shows a scoped route only when the member holds that scope", () => {
    const bd = { isOwner: false, permissionScopes: [AFFILIATE] };
    expect(canSeeRoute({ scope: AFFILIATE }, bd)).toBe(true);
    expect(canSeeRoute({ scope: BILLING }, bd)).toBe(false);
  });
});
