import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { Server } from "node:http";
import { createStorage, type Storage } from "@rivonclaw/storage";
import { startPanelServer } from "./panel-server.js";

let server: Server;
let storage: Storage;
let baseUrl: string;

async function fetchJson<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(baseUrl + path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = (await res.json()) as T;
  return { status: res.status, body };
}

beforeAll(async () => {
  storage = createStorage(":memory:");

  const result = await startPanelServer({
    port: 0, // random port
    panelDistDir: "/tmp/nonexistent-panel-dist", // no static files needed for API tests
    storage,
    secretStore: { get: async () => null, set: async () => {}, delete: async () => {} } as any,
    vendorDir: "/tmp/nonexistent-vendor",
    nodeBin: process.execPath,
    proxyRouterPort: 18881,
    gatewayPort: 18882,
  });

  server = result.server;
  baseUrl = `http://127.0.0.1:${result.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  storage.close();
});

describe("panel-server API", () => {
  // --- Status ---
  describe("GET /api/status", () => {
    it("returns ok status", async () => {
      const { status, body } = await fetchJson<{ status: string }>("/api/status");
      expect(status).toBe(200);
      expect(body.status).toBe("ok");
    });
  });

  describe("Browser Profiles REST endpoints", () => {
    it("POST /api/browser-profiles/test-proxy returns 400 when id is missing", async () => {
      const { status, body } = await fetchJson<{ error: string }>(
        "/api/browser-profiles/test-proxy",
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );
      expect(status).toBe(400);
      expect(body.error).toContain("Missing id");
    });

    it("POST /api/browser-profiles/test-proxy returns 401 when not authenticated", async () => {
      const { status, body } = await fetchJson<{ error: string }>(
        "/api/browser-profiles/test-proxy",
        {
          method: "POST",
          body: JSON.stringify({ id: "some-profile-id" }),
        },
      );
      expect(status).toBe(401);
      expect(body.error).toContain("Not authenticated");
    });

    it("DELETE /api/browser-profiles/:id/data returns ok for non-existent profile", async () => {
      const { status, body } = await fetchJson<{ ok: boolean }>(
        "/api/browser-profiles/nonexistent-id/data",
        { method: "DELETE" },
      );
      expect(status).toBe(200);
      expect(body.ok).toBe(true);
    });
  });

  // --- Settings ---
  describe("Settings", () => {
    it("GET /api/settings returns default settings initially", async () => {
      const { status, body } = await fetchJson<{ settings: Record<string, string> }>("/api/settings");
      expect(status).toBe(200);
      expect(body.settings).toEqual({
        "file-permissions-full-access": "true",
      });
    });

    it("PUT /api/settings stores settings", async () => {
      const { status } = await fetchJson("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ theme: "dark", locale: "zh-CN" }),
      });
      expect(status).toBe(200);

      const { body } = await fetchJson<{ settings: Record<string, string> }>("/api/settings");
      expect(body.settings.theme).toBe("dark");
      expect(body.settings.locale).toBe("zh-CN");
    });

    it("PUT /api/settings overwrites existing keys", async () => {
      await fetchJson("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ theme: "light" }),
      });

      const { body } = await fetchJson<{ settings: Record<string, string> }>("/api/settings");
      expect(body.settings.theme).toBe("light");
      expect(body.settings.locale).toBe("zh-CN"); // unchanged
    });
  });

  // --- Permissions ---
  describe("Permissions", () => {
    it("GET /api/permissions returns default empty permissions", async () => {
      const { status, body } = await fetchJson<{ permissions: { readPaths: string[]; writePaths: string[] } }>("/api/permissions");
      expect(status).toBe(200);
      expect(body.permissions.readPaths).toEqual([]);
      expect(body.permissions.writePaths).toEqual([]);
    });

    it("PUT /api/permissions updates permissions", async () => {
      const { status } = await fetchJson("/api/permissions", {
        method: "PUT",
        body: JSON.stringify({
          readPaths: ["/home/user/docs"],
          writePaths: ["/home/user/output"],
        }),
      });
      expect(status).toBe(200);

      const { body } = await fetchJson<{ permissions: { readPaths: string[]; writePaths: string[] } }>("/api/permissions");
      expect(body.permissions.readPaths).toEqual(["/home/user/docs"]);
      expect(body.permissions.writePaths).toEqual(["/home/user/output"]);
    });
  });

  // --- 404 for unknown routes ---
  describe("404 handling", () => {
    it("returns 404 for unknown API routes", async () => {
      const { status, body } = await fetchJson<{ error: string }>("/api/unknown");
      expect(status).toBe(404);
      expect(body.error).toBe("Not found");
    });
  });

  // --- CORS ---
  describe("CORS", () => {
    it("responds to OPTIONS with 204", async () => {
      const res = await fetch(baseUrl + "/api/status", { method: "OPTIONS" });
      expect(res.status).toBe(204);
    });

    it("includes CORS headers on responses", async () => {
      const res = await fetch(baseUrl + "/api/status");
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  // --- Per-Key Usage (W15-C) ---
  describe("GET /api/key-usage", () => {
    it("returns 200 with empty array when no usage data", async () => {
      const { status, body } = await fetchJson<unknown[]>("/api/key-usage");
      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
    });

    it("returns 200 with data after seeding a provider key", async () => {
      // Seed a provider key
      storage.providerKeys.create({
        id: "usage-test-key",
        provider: "openai",
        label: "Usage Test Key",
        model: "gpt-4o",
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const { status, body } = await fetchJson<unknown[]>("/api/key-usage");
      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);

      // Clean up
      storage.providerKeys.delete("usage-test-key");
    });
  });

  describe("GET /api/key-usage/active", () => {
    it("returns 200 with null when no active key", async () => {
      const { status, body } = await fetchJson<unknown>("/api/key-usage/active");
      expect(status).toBe(200);
    });
  });

  // --- Skills API ---
  describe("Skills API", () => {
    describe("GET /api/skills/installed", () => {
      it("returns 200 with skills array", async () => {
        const { status, body } = await fetchJson<{ skills: unknown[] }>("/api/skills/installed");
        expect(status).toBe(200);
        expect(Array.isArray(body.skills)).toBe(true);
      });
    });

    describe("POST /api/skills/install", () => {
      it("returns 400 when slug is missing", async () => {
        const { status, body } = await fetchJson<{ error: string }>("/api/skills/install", {
          method: "POST",
          body: JSON.stringify({}),
        });
        expect(status).toBe(400);
        expect(body.error).toContain("slug");
      });
    });

    describe("POST /api/skills/delete", () => {
      it("returns 400 when slug is missing", async () => {
        const { status, body } = await fetchJson<{ error: string }>("/api/skills/delete", {
          method: "POST",
          body: JSON.stringify({}),
        });
        expect(status).toBe(400);
        expect(body.error).toContain("slug");
      });

      it("returns 400 for path traversal attempt", async () => {
        const { status, body } = await fetchJson<{ error: string }>("/api/skills/delete", {
          method: "POST",
          body: JSON.stringify({ slug: "../etc" }),
        });
        expect(status).toBe(400);
        expect(body.error).toContain("Invalid slug");
      });
    });
  });
});
