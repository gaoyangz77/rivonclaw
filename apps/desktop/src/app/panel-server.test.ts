import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

  // --- Settings ---
  describe("Settings", () => {
    it("GET /api/settings returns default settings initially", async () => {
      const { status, body } = await fetchJson<{ settings: Record<string, string> }>("/api/settings");
      expect(status).toBe(200);
      expect(body.settings).toEqual({});
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
      const { status } = await fetchJson<unknown>("/api/key-usage/active");
      expect(status).toBe(200);
    });
  });

  describe("GET /api/models", () => {
    it("uses the synced cloud catalog instead of stale gateway model entries", async () => {
      storage.providerKeys.create({
        id: "cloud-catalog-test",
        provider: "rivonclaw-pro",
        label: "TK Copilot AI",
        model: "rivonclaw-flagship",
        isDefault: true,
        authType: "custom",
        baseUrl: "https://api.rivonclaw.com/llm/v1",
        customProtocol: "openai",
        customModelsJson: JSON.stringify([
          {
            id: "rivonclaw-flagship",
            display_name: "Flagship",
            context_length: 372_000,
            context_tokens: 244_000,
          },
        ]),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const { status, body } = await fetchJson<{
        models: Record<
          string,
          Array<{ id: string; name: string; contextWindow?: number; contextTokens?: number }>
        >;
      }>("/api/models");

      expect(status).toBe(200);
      expect(body.models["rivonclaw-pro"]).toEqual([
        {
          id: "rivonclaw-flagship",
          name: "Flagship",
          contextWindow: 372_000,
          contextTokens: 244_000,
        },
      ]);
      storage.providerKeys.delete("cloud-catalog-test");
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

describe("managed chat media proxy", () => {
  it("proxies gateway-managed assistant media with gateway bearer auth", async () => {
    const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    let observedAuthorization: string | undefined;
    let observedPath: string | undefined;

    const gateway = createServer((req, res) => {
      observedAuthorization = req.headers.authorization;
      observedPath = req.url;
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": String(imageBytes.byteLength),
        "Cache-Control": "private, max-age=31536000, immutable",
      });
      res.end(imageBytes);
    });
    const gatewayPort = await new Promise<number>((resolve, reject) => {
      gateway.listen(0, "127.0.0.1", () => {
        const address = gateway.address();
        if (address && typeof address === "object") resolve(address.port);
        else reject(new Error("gateway test server did not bind"));
      });
      gateway.on("error", reject);
    });

    const testStorage = createStorage(":memory:");
    const panel = await startPanelServer({
      port: 0,
      panelDistDir: "/tmp/nonexistent-panel-dist",
      storage: testStorage,
      secretStore: { get: async () => null, set: async () => {}, delete: async () => {} } as any,
      vendorDir: "/tmp/nonexistent-vendor",
      nodeBin: process.execPath,
      proxyRouterPort: 18881,
      gatewayPort,
      getGatewayInfo: () => ({
        wsUrl: `ws://127.0.0.1:${gatewayPort}`,
        token: "gateway-token",
      }),
    });

    try {
      const mediaPath =
        "/api/chat/media/outgoing/agent%3Amain%3Apanel-dfc12609/56745c79-d32f-4f8b-89f1-e1b71c67dfdb/full";
      const res = await fetch(`http://127.0.0.1:${panel.port}${mediaPath}`);

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      expect(Buffer.from(await res.arrayBuffer())).toEqual(imageBytes);
      expect(observedAuthorization).toBe("Bearer gateway-token");
      expect(observedPath).toBe(mediaPath);
    } finally {
      await new Promise<void>((resolve, reject) => {
        panel.server.close((err) => (err ? reject(err) : resolve()));
      });
      await new Promise<void>((resolve, reject) => {
        gateway.close((err) => (err ? reject(err) : resolve()));
      });
      testStorage.close();
    }
  });

  it("serves gateway-managed assistant media from the local store when gateway history lookup misses it", async () => {
    const previousStateDir = process.env.OPENCLAW_STATE_DIR;
    const stateDir = mkdtempSync(join(tmpdir(), "panel-managed-media-"));
    const attachmentId = "39a1ab68-9584-4dc0-a831-14c507ca43fb";
    const sessionKey = "agent:main:panel-dfc12609";
    const imageBytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const mediaBase = join(stateDir, "media", "outgoing");
    const recordsDir = join(mediaBase, "records");
    const originalsDir = join(mediaBase, "originals");
    mkdirSync(recordsDir, { recursive: true });
    mkdirSync(originalsDir, { recursive: true });
    const imagePath = join(originalsDir, "chart.jpg");
    writeFileSync(imagePath, imageBytes);
    writeFileSync(
      join(recordsDir, `${attachmentId}.json`),
      JSON.stringify({
        attachmentId,
        sessionKey,
        messageId: "side-append-message",
        createdAt: "2026-07-27T22:27:08.417Z",
        retentionClass: "history",
        alt: "chart.jpg",
        original: {
          path: imagePath,
          contentType: "image/jpeg",
          width: 2048,
          height: 1172,
          sizeBytes: imageBytes.byteLength,
          filename: "chart.jpg",
        },
      }),
    );

    const gateway = createServer((_req, res) => {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("not found");
    });
    const gatewayPort = await new Promise<number>((resolve, reject) => {
      gateway.listen(0, "127.0.0.1", () => {
        const address = gateway.address();
        if (address && typeof address === "object") resolve(address.port);
        else reject(new Error("gateway test server did not bind"));
      });
      gateway.on("error", reject);
    });

    const testStorage = createStorage(":memory:");
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const panel = await startPanelServer({
      port: 0,
      panelDistDir: "/tmp/nonexistent-panel-dist",
      storage: testStorage,
      secretStore: { get: async () => null, set: async () => {}, delete: async () => {} } as any,
      vendorDir: "/tmp/nonexistent-vendor",
      nodeBin: process.execPath,
      proxyRouterPort: 18881,
      gatewayPort,
      getGatewayInfo: () => ({
        wsUrl: `ws://127.0.0.1:${gatewayPort}`,
        token: "gateway-token",
      }),
    });

    try {
      const mediaPath = `/api/chat/media/outgoing/${encodeURIComponent(sessionKey)}/${attachmentId}/full`;
      const res = await fetch(`http://127.0.0.1:${panel.port}${mediaPath}`);

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/jpeg");
      expect(Buffer.from(await res.arrayBuffer())).toEqual(imageBytes);
    } finally {
      await new Promise<void>((resolve, reject) => {
        panel.server.close((err) => (err ? reject(err) : resolve()));
      });
      await new Promise<void>((resolve, reject) => {
        gateway.close((err) => (err ? reject(err) : resolve()));
      });
      testStorage.close();
      if (previousStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
      else process.env.OPENCLAW_STATE_DIR = previousStateDir;
      rmSync(stateDir, { recursive: true, force: true });
    }
  });

  it("falls back to the transcript MEDIA path when the managed original has been removed", async () => {
    const previousStateDir = process.env.OPENCLAW_STATE_DIR;
    const stateDir = mkdtempSync(join(tmpdir(), "panel-managed-media-transcript-"));
    const attachmentId = "39a1ab68-9584-4dc0-a831-14c507ca43fb";
    const sessionKey = "agent:main:panel-dfc12609";
    const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const mediaBase = join(stateDir, "media", "outgoing");
    const recordsDir = join(mediaBase, "records");
    const workspaceDir = join(stateDir, "workspace");
    const sessionsDir = join(stateDir, "agents", "main", "sessions");
    mkdirSync(recordsDir, { recursive: true });
    mkdirSync(workspaceDir, { recursive: true });
    mkdirSync(sessionsDir, { recursive: true });
    const workspaceImagePath = join(workspaceDir, "chart.png");
    writeFileSync(workspaceImagePath, imageBytes);
    writeFileSync(
      join(recordsDir, `${attachmentId}.json`),
      JSON.stringify({
        attachmentId,
        sessionKey,
        messageId: "side-append-message",
        original: {
          path: join(mediaBase, "originals", "removed.jpg"),
          contentType: "image/jpeg",
          filename: "removed.jpg",
        },
      }),
    );
    writeFileSync(
      join(sessionsDir, "session.jsonl"),
      [
        JSON.stringify({
          type: "message",
          id: "text-message",
          message: {
            role: "assistant",
            content: [{ type: "text", text: `Here it is:\n\nMEDIA:${workspaceImagePath}` }],
          },
        }),
        JSON.stringify({
          type: "message",
          id: "side-append-message",
          parentId: "text-message",
          message: {
            role: "assistant",
            content: [{ type: "image", url: "unused" }],
          },
        }),
      ].join("\n"),
    );

    const gateway = createServer((_req, res) => {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("not found");
    });
    const gatewayPort = await new Promise<number>((resolve, reject) => {
      gateway.listen(0, "127.0.0.1", () => {
        const address = gateway.address();
        if (address && typeof address === "object") resolve(address.port);
        else reject(new Error("gateway test server did not bind"));
      });
      gateway.on("error", reject);
    });

    const testStorage = createStorage(":memory:");
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const panel = await startPanelServer({
      port: 0,
      panelDistDir: "/tmp/nonexistent-panel-dist",
      storage: testStorage,
      secretStore: { get: async () => null, set: async () => {}, delete: async () => {} } as any,
      vendorDir: "/tmp/nonexistent-vendor",
      nodeBin: process.execPath,
      proxyRouterPort: 18881,
      gatewayPort,
      getGatewayInfo: () => ({
        wsUrl: `ws://127.0.0.1:${gatewayPort}`,
        token: "gateway-token",
      }),
    });

    try {
      const mediaPath = `/api/chat/media/outgoing/${encodeURIComponent(sessionKey)}/${attachmentId}/full`;
      const res = await fetch(`http://127.0.0.1:${panel.port}${mediaPath}`);

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      expect(Buffer.from(await res.arrayBuffer())).toEqual(imageBytes);
    } finally {
      await new Promise<void>((resolve, reject) => {
        panel.server.close((err) => (err ? reject(err) : resolve()));
      });
      await new Promise<void>((resolve, reject) => {
        gateway.close((err) => (err ? reject(err) : resolve()));
      });
      testStorage.close();
      if (previousStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
      else process.env.OPENCLAW_STATE_DIR = previousStateDir;
      rmSync(stateDir, { recursive: true, force: true });
    }
  });

  it("falls back to the transcript MEDIA path when the managed record has been removed", async () => {
    const previousStateDir = process.env.OPENCLAW_STATE_DIR;
    const stateDir = mkdtempSync(join(tmpdir(), "panel-managed-media-pruned-record-"));
    const attachmentId = "971b2e3f-8fc6-4a58-850e-97b648c051b7";
    const sessionKey = "agent:main:panel-dfc12609";
    const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const workspaceDir = join(stateDir, "workspace");
    const sessionsDir = join(stateDir, "agents", "main", "sessions");
    mkdirSync(workspaceDir, { recursive: true });
    mkdirSync(sessionsDir, { recursive: true });
    const workspaceImagePath = join(workspaceDir, "holylegend_current_sps_component_scores.png");
    writeFileSync(workspaceImagePath, imageBytes);
    writeFileSync(
      join(sessionsDir, "session.jsonl"),
      [
        JSON.stringify({
          type: "message",
          id: "assistant-text",
          message: {
            role: "assistant",
            content: `Reattached the chart below.\n\nMEDIA:${workspaceImagePath}`,
          },
        }),
        JSON.stringify({
          type: "message",
          id: "assistant-image",
          parentId: "assistant-text",
          message: {
            role: "assistant",
            content: [
              {
                type: "image",
                url: `/api/chat/media/outgoing/${encodeURIComponent(sessionKey)}/${attachmentId}/full`,
              },
            ],
          },
        }),
      ].join("\n"),
    );

    const gateway = createServer((_req, res) => {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("not found");
    });
    const gatewayPort = await new Promise<number>((resolve, reject) => {
      gateway.listen(0, "127.0.0.1", () => {
        const address = gateway.address();
        if (address && typeof address === "object") resolve(address.port);
        else reject(new Error("gateway test server did not bind"));
      });
      gateway.on("error", reject);
    });

    const testStorage = createStorage(":memory:");
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const panel = await startPanelServer({
      port: 0,
      panelDistDir: "/tmp/nonexistent-panel-dist",
      storage: testStorage,
      secretStore: { get: async () => null, set: async () => {}, delete: async () => {} } as any,
      vendorDir: "/tmp/nonexistent-vendor",
      nodeBin: process.execPath,
      proxyRouterPort: 18881,
      gatewayPort,
      getGatewayInfo: () => ({
        wsUrl: `ws://127.0.0.1:${gatewayPort}`,
        token: "gateway-token",
      }),
    });

    try {
      const mediaPath = `/api/chat/media/outgoing/${encodeURIComponent(sessionKey)}/${attachmentId}/full`;
      const res = await fetch(`http://127.0.0.1:${panel.port}${mediaPath}`);

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      expect(Buffer.from(await res.arrayBuffer())).toEqual(imageBytes);
    } finally {
      await new Promise<void>((resolve, reject) => {
        panel.server.close((err) => (err ? reject(err) : resolve()));
      });
      await new Promise<void>((resolve, reject) => {
        gateway.close((err) => (err ? reject(err) : resolve()));
      });
      testStorage.close();
      if (previousStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
      else process.env.OPENCLAW_STATE_DIR = previousStateDir;
      rmSync(stateDir, { recursive: true, force: true });
    }
  });
});

describe("local chat media route", () => {
  it("serves image files under the OpenClaw state directory", async () => {
    const previousStateDir = process.env.OPENCLAW_STATE_DIR;
    const stateDir = mkdtempSync(join(tmpdir(), "panel-local-chat-media-"));
    const workspaceDir = join(stateDir, "workspace");
    mkdirSync(workspaceDir, { recursive: true });
    const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const imagePath = join(workspaceDir, "chart.png");
    writeFileSync(imagePath, imageBytes);

    const testStorage = createStorage(":memory:");
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const panel = await startPanelServer({
      port: 0,
      panelDistDir: "/tmp/nonexistent-panel-dist",
      storage: testStorage,
      secretStore: { get: async () => null, set: async () => {}, delete: async () => {} } as any,
      vendorDir: "/tmp/nonexistent-vendor",
      nodeBin: process.execPath,
      proxyRouterPort: 18881,
      gatewayPort: 18882,
    });

    try {
      const res = await fetch(
        `http://127.0.0.1:${panel.port}/api/chat/media/local?path=${encodeURIComponent(imagePath)}`,
      );

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      expect(Buffer.from(await res.arrayBuffer())).toEqual(imageBytes);
    } finally {
      await new Promise<void>((resolve, reject) => {
        panel.server.close((err) => (err ? reject(err) : resolve()));
      });
      testStorage.close();
      if (previousStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
      else process.env.OPENCLAW_STATE_DIR = previousStateDir;
      rmSync(stateDir, { recursive: true, force: true });
    }
  });

  it("rejects image paths outside the OpenClaw state directory", async () => {
    const previousStateDir = process.env.OPENCLAW_STATE_DIR;
    const stateDir = mkdtempSync(join(tmpdir(), "panel-local-chat-media-deny-"));
    const outsideDir = mkdtempSync(join(tmpdir(), "panel-local-chat-media-outside-"));
    const outsidePath = join(outsideDir, "chart.png");
    writeFileSync(outsidePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const testStorage = createStorage(":memory:");
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const panel = await startPanelServer({
      port: 0,
      panelDistDir: "/tmp/nonexistent-panel-dist",
      storage: testStorage,
      secretStore: { get: async () => null, set: async () => {}, delete: async () => {} } as any,
      vendorDir: "/tmp/nonexistent-vendor",
      nodeBin: process.execPath,
      proxyRouterPort: 18881,
      gatewayPort: 18882,
    });

    try {
      const res = await fetch(
        `http://127.0.0.1:${panel.port}/api/chat/media/local?path=${encodeURIComponent(outsidePath)}`,
      );

      expect(res.status).toBe(403);
    } finally {
      await new Promise<void>((resolve, reject) => {
        panel.server.close((err) => (err ? reject(err) : resolve()));
      });
      testStorage.close();
      if (previousStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
      else process.env.OPENCLAW_STATE_DIR = previousStateDir;
      rmSync(stateDir, { recursive: true, force: true });
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });
});
