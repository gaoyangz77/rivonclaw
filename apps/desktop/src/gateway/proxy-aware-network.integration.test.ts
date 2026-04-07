import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server as HttpServer, type IncomingMessage } from "node:http";
import { connect, type Socket } from "node:net";
import { ProxyAwareNetwork } from "./proxy-aware-network.js";

/**
 * Integration test: spins up a real HTTP CONNECT proxy, then verifies
 * that ProxyAwareNetwork.fetch() and .createWebSocket() actually route
 * traffic through it.
 */

let proxyServer: HttpServer;
let proxyPort: number;
let connectCount = 0;

beforeAll(async () => {
  proxyServer = createServer((_req, res) => {
    res.writeHead(405);
    res.end("CONNECT only");
  });

  // Handle CONNECT method (HTTP tunnel)
  proxyServer.on("connect", (req: IncomingMessage, clientSocket: Socket, head: Buffer) => {
    connectCount++;
    const [host, portStr] = (req.url ?? "").split(":");
    const port = parseInt(portStr || "443", 10);

    const targetSocket = connect(port, host, () => {
      clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length > 0) targetSocket.write(head);
      targetSocket.pipe(clientSocket);
      clientSocket.pipe(targetSocket);
    });

    targetSocket.on("error", () => clientSocket.end());
    clientSocket.on("error", () => targetSocket.end());
  });

  await new Promise<void>((resolve) => {
    proxyServer.listen(0, "127.0.0.1", () => {
      const addr = proxyServer.address();
      proxyPort = typeof addr === "object" && addr ? addr.port : 0;
      resolve();
    });
  });
});

afterAll(() => {
  proxyServer?.close();
});

describe("ProxyAwareNetwork integration", () => {
  it("fetch routes through the proxy (CONNECT tunnel)", async () => {
    const net = new ProxyAwareNetwork();
    // Point to our local proxy (simulating proxy-router)
    net.setProxyRouterPort(proxyPort);

    const before = connectCount;
    const res = await net.fetch("https://api.rivonclaw.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{__typename}" }),
    });
    const data = await res.json() as { data?: { __typename: string } };

    expect(res.status).toBe(200);
    expect(data.data?.__typename).toBe("Query");
    expect(connectCount).toBeGreaterThan(before); // proxy was actually used
  });

  it("createWebSocket routes through the proxy", async () => {
    const net = new ProxyAwareNetwork();
    net.setProxyRouterPort(proxyPort);

    const before = connectCount;

    // Connect to a real WSS endpoint through our proxy
    const ws = net.createWebSocket("wss://api.rivonclaw.com/graphql");

    const connected = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => { ws.close(); resolve(false); }, 10_000);
      ws.on("open", () => { clearTimeout(timeout); ws.close(); resolve(true); });
      ws.on("error", () => { clearTimeout(timeout); resolve(false); });
    });

    expect(connected).toBe(true);
    expect(connectCount).toBeGreaterThan(before); // proxy was actually used
  });

  it("createProxiedWebSocketClass routes through the proxy", async () => {
    const net = new ProxyAwareNetwork();
    net.setProxyRouterPort(proxyPort);

    const before = connectCount;
    const WsClass = net.createProxiedWebSocketClass();
    const ws = new WsClass("wss://api.rivonclaw.com/graphql");

    const connected = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => { ws.close(); resolve(false); }, 10_000);
      ws.on("open", () => { clearTimeout(timeout); ws.close(); resolve(true); });
      ws.on("error", () => { clearTimeout(timeout); resolve(false); });
    });

    expect(connected).toBe(true);
    expect(connectCount).toBeGreaterThan(before);
  });
});
