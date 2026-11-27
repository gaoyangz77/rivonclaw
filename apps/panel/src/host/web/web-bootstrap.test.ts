import { describe, expect, it, vi } from "vitest";
import { INIT_ME_QUERY, INIT_SHOPS_QUERY, TOOL_SPECS_SYNC_QUERY } from "@rivonclaw/core";
import { entityStore } from "../../store/entity-store.js";
import { bootstrapEntities, type WebHostStore } from "./web-bootstrap.js";

const ME = {
  __typename: "MeResponse",
  userId: "u1",
  email: "owner@example.com",
  name: "Owner",
  enrolledModules: ["GLOBAL_ECOMMERCE_SELLER"],
  entitlementKeys: [],
  accountId: "u1",
  isOwner: true,
  permissionScopes: [],
  createdAt: "2026-01-01T00:00:00.000Z",
};

// The same store actions the web host drives in the browser; nothing is stubbed
// below the requester, so this is the population path end to end.
const store: WebHostStore = {
  clearCloudEntities: () => entityStore.clearCloudEntities(),
  clearCloudDataExceptUser: (o) => entityStore.clearCloudDataExceptUser(o),
  setAuthBootstrap: (s, e) => entityStore.setAuthBootstrap(s, e ?? null),
  ingestGraphQLResponse: (d) => entityStore.ingestGraphQLResponse(d),
  removeEntity: (t, id) => entityStore.removeEntity(t, id),
  upsertShopsFromGraphQL: (s, r) => entityStore.upsertShopsFromGraphQL(s, r),
  shopIds: () => entityStore.shops.map((s) => s.id),
};

describe("web host startup population", () => {
  it("loads the account and, for an e-commerce account, its shops into the entity store", async () => {
    const request = vi.fn(async (query: string) => {
      if (query === INIT_ME_QUERY) return { me: ME };
      if (query === INIT_SHOPS_QUERY) {
        return { shops: [{ __typename: "Shop", id: "shop-1", platform: "TIKTOK_SHOP", platformShopId: "p1", shopName: "Brightloom" }] };
      }
      return {};
    });

    await expect(bootstrapEntities(store, request as never)).resolves.toBe(true);

    expect(entityStore.currentUser?.userId).toBe("u1");
    expect(entityStore.shops.map((s) => s.id)).toEqual(["shop-1"]);
    expect(entityStore.shopLifecycle.status).toBe("ready");
    expect(entityStore.authBootstrap.status).toBe("ready");
    const queries = request.mock.calls.map((c) => c[0]);
    expect(queries).toContain(TOOL_SPECS_SYNC_QUERY);
  });

  it("skips the e-commerce queries for an account without the module", async () => {
    const request = vi.fn(async (query: string) =>
      query === INIT_ME_QUERY ? { me: { ...ME, enrolledModules: [] } } : {},
    );
    await bootstrapEntities(store, request as never);
    expect(request.mock.calls.map((c) => c[0])).not.toContain(INIT_SHOPS_QUERY);
  });

  it("keeps going when one startup query fails and says so", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const request = vi.fn(async (query: string) => {
      if (query === INIT_ME_QUERY) return { me: ME };
      if (query === TOOL_SPECS_SYNC_QUERY) throw new Error("tool specs down");
      return {};
    });
    await expect(bootstrapEntities(store, request as never)).resolves.toBe(true);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("ToolSpecsSync"), expect.any(Error));
    expect(entityStore.authBootstrap.status).toBe("ready");
    error.mockRestore();
  });

  it("reports signed out and empties the store when no account is behind the session", async () => {
    const request = vi.fn(async () => ({ me: null }));
    await expect(bootstrapEntities(store, request as never)).resolves.toBe(false);
    expect(entityStore.currentUser).toBeNull();
    expect(entityStore.authBootstrap.status).toBe("signed_out");
  });

  it("marks the bootstrap as failed when the account query itself fails", async () => {
    const request = vi.fn(async () => {
      throw new Error("backend down");
    });
    await expect(bootstrapEntities(store, request as never)).rejects.toThrow("backend down");
    expect(entityStore.authBootstrap.status).toBe("error");
  });
});
