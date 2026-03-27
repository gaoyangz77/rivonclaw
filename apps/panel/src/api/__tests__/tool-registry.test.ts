// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock global fetch so the real fetchJson runs but hits our mock responses.
// This avoids vi.mock path-resolution issues with the client module.
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

import {
  fetchAvailableTools,
  setRunProfileForScope,
  getRunProfileForScope,
  setDefaultRunProfile,
  ScopeType,
} from "../tool-registry.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("tool-registry", () => {
  beforeEach(() => mockFetch.mockReset());

  describe("fetchAvailableTools", () => {
    it("calls /tools/available and returns tools array", async () => {
      const tools = [{ id: "t1", displayName: "Tool 1", description: "", category: "general", allowed: true }];
      mockFetch.mockResolvedValue(jsonResponse({ tools }));

      const result = await fetchAvailableTools();

      expect(mockFetch).toHaveBeenCalledWith("/api/tools/available", expect.anything());
      expect(result).toEqual(tools);
    });

    it("returns empty array on error", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ error: "Server error" }, 500));

      const result = await fetchAvailableTools();

      expect(result).toEqual([]);
    });
  });

  describe("setRunProfileForScope", () => {
    it("calls PUT /tools/run-profile with correct body", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));
      const profile = { id: "p1", name: "Profile 1", selectedToolIds: ["t1"], surfaceId: "s1" };

      await setRunProfileForScope(ScopeType.CHAT_SESSION, "sk1", profile);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/tools/run-profile",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            scopeType: ScopeType.CHAT_SESSION,
            scopeKey: "sk1",
            runProfile: profile,
          }),
        }),
      );
    });

    it("passes null runProfile to clear", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));

      await setRunProfileForScope(ScopeType.CHAT_SESSION, "sk1", null);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/tools/run-profile",
        expect.objectContaining({
          body: JSON.stringify({
            scopeType: ScopeType.CHAT_SESSION,
            scopeKey: "sk1",
            runProfile: null,
          }),
        }),
      );
    });
  });

  describe("getRunProfileForScope", () => {
    it("calls /tools/run-profile with query params and returns profile", async () => {
      const profile = { id: "p1", name: "Profile 1", selectedToolIds: ["t1"], surfaceId: "s1" };
      mockFetch.mockResolvedValue(jsonResponse({ runProfile: profile }));

      const result = await getRunProfileForScope(ScopeType.CHAT_SESSION, "sk1");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/tools/run-profile?"),
        expect.anything(),
      );
      expect(result).toEqual(profile);
    });

    it("returns null on error", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ error: "not found" }, 404));

      const result = await getRunProfileForScope(ScopeType.CHAT_SESSION, "sk1");

      expect(result).toBeNull();
    });
  });

  describe("setDefaultRunProfile", () => {
    it("calls PUT /tools/default-run-profile with correct body", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));
      const profile = { id: "p1", name: "Default", selectedToolIds: ["t1", "t2"], surfaceId: "s1" };

      await setDefaultRunProfile(profile);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/tools/default-run-profile",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ runProfile: profile }),
        }),
      );
    });
  });
});
