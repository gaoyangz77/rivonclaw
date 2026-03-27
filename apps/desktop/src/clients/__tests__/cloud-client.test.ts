import { describe, it, expect, vi, beforeEach } from "vitest";
import { CloudClient } from "../cloud-client.js";
import type { AuthSessionManager } from "../../auth/auth-session.js";

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAuthSession(overrides: Partial<AuthSessionManager> = {}): AuthSessionManager {
  return {
    getAccessToken: vi.fn().mockReturnValue("test-token"),
    graphqlFetch: vi.fn().mockResolvedValue({ me: { id: "1" } }),
    refresh: vi.fn().mockResolvedValue("refreshed-token"),
    ...overrides,
  } as unknown as AuthSessionManager;
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CloudClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("graphql()", () => {
    it("delegates to authSession.graphqlFetch()", async () => {
      const authSession = makeAuthSession();
      const client = new CloudClient(authSession, "en");

      const result = await client.graphql("{ me { id } }", { foo: "bar" });

      expect(authSession.graphqlFetch).toHaveBeenCalledWith("{ me { id } }", { foo: "bar" });
      expect(result).toEqual({ me: { id: "1" } });
    });
  });

  describe("rest()", () => {
    it("adds Bearer token to the request", async () => {
      const authSession = makeAuthSession();
      const client = new CloudClient(authSession, "en");
      mockFetch.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

      await client.rest("/api/test");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, init] = mockFetch.mock.calls[0];
      expect(init.headers).toEqual(
        expect.objectContaining({ Authorization: "Bearer test-token" }),
      );
    });

    it("retries on 401 after refresh", async () => {
      const authSession = makeAuthSession();
      const client = new CloudClient(authSession, "en");

      mockFetch
        .mockResolvedValueOnce(jsonResponse(401, { error: "Unauthorized" }))
        .mockResolvedValueOnce(jsonResponse(200, { data: "refreshed" }));

      const result = await client.rest("/api/test");

      expect(authSession.refresh).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      // Second call should use the refreshed token
      const [, secondInit] = mockFetch.mock.calls[1];
      expect(secondInit.headers).toEqual(
        expect.objectContaining({ Authorization: "Bearer refreshed-token" }),
      );
      expect(result).toEqual({ data: "refreshed" });
    });

    it("throws on non-2xx non-401 response", async () => {
      const authSession = makeAuthSession();
      const client = new CloudClient(authSession, "en");
      mockFetch.mockResolvedValueOnce(jsonResponse(500, { error: "Server error" }));

      await expect(client.rest("/api/test")).rejects.toThrow("Cloud REST error: 500");
      expect(authSession.refresh).not.toHaveBeenCalled();
    });

    it("passes through custom init options", async () => {
      const authSession = makeAuthSession();
      const client = new CloudClient(authSession, "en");
      mockFetch.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

      await client.rest("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "image/png", "x-shop-id": "shop-1" },
        body: Buffer.from("image-data"),
      });

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/upload");
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual(
        expect.objectContaining({
          "Content-Type": "image/png",
          "x-shop-id": "shop-1",
          Authorization: "Bearer test-token",
        }),
      );
    });
  });
});
