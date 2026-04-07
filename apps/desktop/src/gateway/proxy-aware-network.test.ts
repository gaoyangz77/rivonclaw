import { describe, it, expect, vi, beforeEach } from "vitest";

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

describe("ProxyAwareNetwork", () => {
  let net: ProxyAwareNetwork;

  beforeEach(() => {
    net = new ProxyAwareNetwork();
    vi.clearAllMocks();
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
      mockFetch.mockRestore();
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
