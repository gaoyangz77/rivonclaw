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
  setRunProfileForScope,
  getRunProfileForScope,
  setDefaultRunProfile,
} from "../tool-registry.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("tool-registry", () => {
  beforeEach(() => mockFetch.mockReset());

  describe("setRunProfileForScope", () => {
    it("calls PUT /tools/run-profile with runProfileId", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));

      await setRunProfileForScope("sk1", "p1");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/tools/run-profile",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            scopeKey: "sk1",
            runProfileId: "p1",
          }),
        }),
      );
    });

    it("passes null runProfileId to clear", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));

      await setRunProfileForScope("sk1", null);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/tools/run-profile",
        expect.objectContaining({
          body: JSON.stringify({
            scopeKey: "sk1",
            runProfileId: null,
          }),
        }),
      );
    });
  });

  describe("getRunProfileForScope", () => {
    it("calls /tools/run-profile with query params and returns runProfileId", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ runProfileId: "p1" }));

      const result = await getRunProfileForScope("sk1");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/tools/run-profile?"),
        expect.anything(),
      );
      expect(result).toBe("p1");
    });

    it("returns null on error", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ error: "not found" }, 404));

      const result = await getRunProfileForScope("sk1");

      expect(result).toBeNull();
    });
  });

  describe("setDefaultRunProfile", () => {
    it("calls PUT /tools/default-run-profile with runProfileId", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));

      await setDefaultRunProfile("p1");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/tools/default-run-profile",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ runProfileId: "p1" }),
        }),
      );
    });

    it("passes null to clear default", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));

      await setDefaultRunProfile(null);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/tools/default-run-profile",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ runProfileId: null }),
        }),
      );
    });
  });
});
