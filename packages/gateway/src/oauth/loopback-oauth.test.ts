import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { startLoopbackOAuthCallback } from "./loopback-oauth.js";

async function listenOnEphemeralPort(): Promise<{ close: () => Promise<void>; port: number }> {
  const server = createServer((_req, res) => res.end("busy"));
  await new Promise<void>((resolve, reject) => {
    server.once("listening", () => resolve());
    server.once("error", reject);
    server.listen(0, "127.0.0.1");
  });
  const addr = server.address();
  if (!addr || typeof addr !== "object") {
    throw new Error("Failed to allocate test port");
  }
  return {
    port: addr.port,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe("startLoopbackOAuthCallback", () => {
  it("falls back to an ephemeral port when the preferred port is unavailable", async () => {
    const blocker = await listenOnEphemeralPort();
    const callback = await startLoopbackOAuthCallback({
      providerLabel: "Test Provider",
      preferredPort: blocker.port,
      callbackPath: "/callback",
      expectedState: "state",
      timeoutMs: 30_000,
    });

    expect(callback.usedPreferredPort).toBe(false);
    expect(callback.port).not.toBe(blocker.port);
    expect(callback.redirectUri).toBe(`http://127.0.0.1:${callback.port}/callback`);

    callback.close(new Error("test cleanup"));
    await expect(callback.waitForCallback).rejects.toThrow("test cleanup");
    await blocker.close();
  });

  it("tries an explicit fallback port before using an ephemeral port", async () => {
    const blocker = await listenOnEphemeralPort();
    const fallbackHolder = await listenOnEphemeralPort();
    const fallbackPort = fallbackHolder.port;
    await fallbackHolder.close();

    const callback = await startLoopbackOAuthCallback({
      providerLabel: "Test Provider",
      preferredPort: blocker.port,
      fallbackPorts: [fallbackPort],
      callbackPath: "/callback",
      expectedState: "state",
      timeoutMs: 30_000,
      allowEphemeralPort: false,
    });

    expect(callback.usedPreferredPort).toBe(false);
    expect(callback.port).toBe(fallbackPort);
    expect(callback.redirectUri).toBe(`http://127.0.0.1:${fallbackPort}/callback`);

    callback.close(new Error("test cleanup"));
    await expect(callback.waitForCallback).rejects.toThrow("test cleanup");
    await blocker.close();
  });

  it("keeps waiting after stale state and resolves a later matching callback", async () => {
    const callback = await startLoopbackOAuthCallback({
      providerLabel: "Test Provider",
      preferredPort: 0,
      callbackPath: "/callback",
      expectedState: "current",
      timeoutMs: 30_000,
    });

    let settled = false;
    callback.waitForCallback.finally(() => {
      settled = true;
    }).catch(() => {});

    const staleResponse = await fetch(`${callback.redirectUri}?code=old&state=stale`);
    expect(staleResponse.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(settled).toBe(false);

    const validResponse = await fetch(`${callback.redirectUri}?code=new&state=current`);
    expect(validResponse.status).toBe(200);
    await expect(callback.waitForCallback).resolves.toEqual({ code: "new", state: "current" });
  });

  it("keeps waiting after a callback without code", async () => {
    const callback = await startLoopbackOAuthCallback({
      providerLabel: "Test Provider",
      preferredPort: 0,
      callbackPath: "/callback",
      expectedState: "current",
      timeoutMs: 30_000,
    });

    const missingCodeResponse = await fetch(`${callback.redirectUri}?state=current`);
    expect(missingCodeResponse.status).toBe(400);

    const validResponse = await fetch(`${callback.redirectUri}?code=new&state=current`);
    expect(validResponse.status).toBe(200);
    await expect(callback.waitForCallback).resolves.toEqual({ code: "new", state: "current" });
  });
});
