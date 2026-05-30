import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock ws and https-proxy-agent before importing the module
vi.mock("ws", () => {
  const MockWebSocket = vi.fn();
  MockWebSocket.prototype.on = vi.fn();
  MockWebSocket.prototype.close = vi.fn();
  return { default: MockWebSocket, WebSocket: MockWebSocket };
});

vi.mock("https-proxy-agent", () => ({
  HttpsProxyAgent: vi.fn(),
}));

import { ProxyAwareNetwork } from "./proxy-aware-network.js";
import WebSocket from "ws";
import { HttpsProxyAgent } from "https-proxy-agent";
import {
  getFirstPartyDomainRoute,
  resetFirstPartyDomainRouteForTests,
  setFirstPartyDomainRoute,
} from "@rivonclaw/core";

describe("ProxyAwareNetwork", () => {
  let net: ProxyAwareNetwork;

  beforeEach(() => {
    net = new ProxyAwareNetwork();
    resetFirstPartyDomainRouteForTests();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetFirstPartyDomainRouteForTests();
    vi.restoreAllMocks();
  });

  describe("fetch", () => {
    it("uses direct fetch when proxy-router is not set", async () => {
      const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("ok"));
      await net.fetch("https://example.com");
      expect(mockFetch).toHaveBeenCalledWith("https://example.com");
      mockFetch.mockRestore();
    });

    it("uses ProxyAgent when proxy-router port is set", async () => {
      net.setProxyRouterPort(12345);
      const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("ok"));
      await net.fetch("https://example.com", { method: "POST" });
      expect(mockFetch).toHaveBeenCalledWith("https://example.com", expect.objectContaining({
        method: "POST",
        dispatcher: expect.anything(),
      }));
    });

    it("rewrites first-party URLs when the CN relay route is active", async () => {
      setFirstPartyDomainRoute("cn-relay");
      const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("ok"));

      await net.fetch("https://api.rivonclaw.com/graphql");

      expect(mockFetch).toHaveBeenCalledWith("https://api.zhuazhuaai.cn/graphql");
    });

    it("switches to the CN relay and retries after global first-party fetch failures", async () => {
      const mockFetch = vi.spyOn(globalThis, "fetch")
        .mockRejectedValueOnce(new Error("fetch failed"))
        .mockRejectedValueOnce(new Error("fetch failed"))
        .mockRejectedValueOnce(new Error("fetch failed"))
        .mockResolvedValueOnce(new Response("ok"));

      await expect(net.fetch("https://api.rivonclaw.com/graphql")).resolves.toBeInstanceOf(Response);

      expect(getFirstPartyDomainRoute()).toBe("cn-relay");
      expect(mockFetch).toHaveBeenLastCalledWith("https://api.zhuazhuaai.cn/graphql");
    });

    it("can disable first-party failover for route probes", async () => {
      const mockFetch = vi.spyOn(globalThis, "fetch")
        .mockRejectedValueOnce(new Error("fetch failed"))
        .mockRejectedValueOnce(new Error("fetch failed"))
        .mockRejectedValueOnce(new Error("fetch failed"));

      await expect(net.fetch("https://api.rivonclaw.com/graphql", undefined, { firstPartyFailover: false }))
        .rejects.toThrow("fetch failed");

      expect(getFirstPartyDomainRoute()).toBe("global");
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("createWebSocket", () => {
    it("creates plain WebSocket when proxy-router is not set", () => {
      net.createWebSocket("wss://example.com");
      expect(WebSocket).toHaveBeenCalledWith("wss://example.com", undefined);
    });

    it("creates WebSocket with HttpsProxyAgent when proxy-router is set", () => {
      net.setProxyRouterPort(12345);
      net.createWebSocket("wss://example.com");
      expect(HttpsProxyAgent).toHaveBeenCalledWith("http://127.0.0.1:12345");
      expect(WebSocket).toHaveBeenCalledWith("wss://example.com", undefined, expect.objectContaining({
        agent: expect.any(Object),
      }));
    });

    it("rewrites first-party WebSocket URLs when the CN relay route is active", () => {
      setFirstPartyDomainRoute("cn-relay");
      net.createWebSocket("wss://api.rivonclaw.com/graphql");
      expect(WebSocket).toHaveBeenCalledWith("wss://api.zhuazhuaai.cn/graphql", undefined);
    });
  });

  describe("createProxiedWebSocketClass", () => {
    it("returns plain WebSocket when proxy-router is not set", () => {
      const WsClass = net.createProxiedWebSocketClass();
      expect(WsClass).toBe(WebSocket);
    });

    it("returns subclass when proxy-router is set", () => {
      net.setProxyRouterPort(12345);
      const WsClass = net.createProxiedWebSocketClass();
      expect(WsClass).not.toBe(WebSocket);
      // Instantiate to verify agent is injected
      new WsClass("wss://example.com");
      expect(HttpsProxyAgent).toHaveBeenCalledWith("http://127.0.0.1:12345");
    });

    it("rewrites first-party URLs in the proxied WebSocket class when the CN relay route is active", () => {
      setFirstPartyDomainRoute("cn-relay");
      net.setProxyRouterPort(12345);
      const WsClass = net.createProxiedWebSocketClass();

      new WsClass("wss://api.rivonclaw.com/graphql");

      expect(WebSocket).toHaveBeenCalledWith("wss://api.zhuazhuaai.cn/graphql", undefined, expect.objectContaining({
        agent: expect.any(Object),
      }));
    });
  });

  describe("getProxyRouterPort", () => {
    it("returns null before setProxyRouterPort", () => {
      expect(net.getProxyRouterPort()).toBeNull();
    });

    it("returns port after setProxyRouterPort", () => {
      net.setProxyRouterPort(54321);
      expect(net.getProxyRouterPort()).toBe(54321);
    });
  });
});
