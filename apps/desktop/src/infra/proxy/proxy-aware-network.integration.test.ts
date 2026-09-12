import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { createServer, type Server as HttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { connect } from "node:net";
import type { Duplex } from "node:stream";
import { getCACertificates, setDefaultCACertificates, type TLSSocket } from "node:tls";
import WebSocket, { WebSocketServer } from "ws";
import { ProxyAwareNetwork } from "./proxy-aware-network.js";

// Public test-only credentials, never for deployment. The CA is trusted only
// in this test worker; the leaf certificate is valid solely for loopback.
const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const fixtureCa = fixture("proxy-test-ca.pem");
const sockets = new Set<Duplex>();
const webSockets = new Set<WebSocket>();
const connectAuthorities: string[] = [];
const deniedAuthorities: string[] = [];
const receivedRequests: Array<{
  method: string | undefined;
  url: string | undefined;
  contentType: string | undefined;
  body: string;
  tlsProtocol: string | null;
}> = [];
const receivedMessages: string[] = [];

let originalCAs: string[] | undefined;
let originServer: ReturnType<typeof createHttpsServer>;
let proxyServer: HttpServer;
let webSocketServer: WebSocketServer;
let originPort: number;
let proxyPort: number;

function trackSocket<T extends Duplex>(socket: T): T {
  sockets.add(socket);
  socket.once("close", () => sockets.delete(socket));
  return socket;
}

function trackWebSocket(ws: WebSocket): WebSocket {
  webSockets.add(ws);
  ws.once("close", () => webSockets.delete(ws));
  return ws;
}

async function listen(server: HttpServer): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("Missing fixture port"));
      resolve(address.port);
    });
  });
}

function destroyConnections() {
  for (const ws of webSockets) ws.terminate();
  for (const socket of sockets) socket.destroy();
}

async function closeServer(server: HttpServer | undefined) {
  if (!server?.listening) return;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

beforeAll(async () => {
  originalCAs = getCACertificates("default");
  setDefaultCACertificates([...originalCAs, fixtureCa]);

  originServer = createHttpsServer(
    {
      key: fixture("proxy-test-server-key.pem"),
      cert: fixture("proxy-test-server.pem") + fixtureCa,
    },
    (req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        receivedRequests.push({
          method: req.method,
          url: req.url,
          contentType: req.headers["content-type"],
          body: Buffer.concat(chunks).toString("utf8"),
          tlsProtocol: (req.socket as TLSSocket).getProtocol(),
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: { __typename: "Query" } }));
      });
    },
  );
  originServer.on("connection", trackSocket);
  webSocketServer = new WebSocketServer({ server: originServer, path: "/graphql" });
  webSocketServer.on("connection", (ws) => {
    trackWebSocket(ws);
    ws.on("message", (data, isBinary) => {
      receivedMessages.push(data.toString());
      ws.send(data, { binary: isBinary });
    });
  });
  originPort = await listen(originServer);

  proxyServer = createServer((_req, res) => {
    res.writeHead(405);
    res.end("CONNECT only");
  });
  proxyServer.on("connection", trackSocket);
  proxyServer.on("connect", (req, clientSocket, head) => {
    const authority = req.url ?? "";
    // Even a regression must not turn this fixture into an external proxy.
    // The invalid hostname also tunnels to loopback, without a DNS lookup.
    if (
      ![
        `127.0.0.1:${originPort}`,
        `localhost:${originPort}`,
        `mismatch.invalid:${originPort}`,
      ].includes(authority)
    ) {
      deniedAuthorities.push(authority);
      clientSocket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }
    connectAuthorities.push(authority);
    const targetSocket = trackSocket(
      connect(originPort, "127.0.0.1", () => {
        clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length > 0) targetSocket.write(head);
        targetSocket.pipe(clientSocket);
        clientSocket.pipe(targetSocket);
      }),
    );
    targetSocket.on("error", () => clientSocket.destroy());
    clientSocket.on("error", () => targetSocket.destroy());
    targetSocket.on("close", () => clientSocket.destroy());
    clientSocket.on("close", () => targetSocket.destroy());
  });
  proxyPort = await listen(proxyServer);
});

afterEach(() => {
  destroyConnections();
});

afterAll(async () => {
  try {
    destroyConnections();
    if (webSocketServer)
      await new Promise<void>((resolve) => webSocketServer.close(() => resolve()));
    await closeServer(originServer);
    await closeServer(proxyServer);
    expect(deniedAuthorities).toEqual([]);
  } finally {
    if (originalCAs) setDefaultCACertificates(originalCAs);
  }
});

function proxiedNetwork() {
  const network = new ProxyAwareNetwork();
  network.setProxyRouterPort(proxyPort);
  return network;
}

async function exchangeMessage(ws: WebSocket, payload: string) {
  trackWebSocket(ws);
  try {
    return await new Promise<{
      text: string;
      binary: boolean;
      status: number | undefined;
      authorized: boolean;
      protocol: string;
    }>((resolve, reject) => {
      let status: number | undefined;
      let authorized = false;
      const timer = setTimeout(
        () => reject(new Error("Timed out waiting for local WSS echo")),
        3000,
      );
      const finish = () => clearTimeout(timer);
      ws.once("upgrade", (response) => {
        status = response.statusCode;
        authorized = (response.socket as TLSSocket).authorized;
      });
      ws.once("open", () => ws.send(payload));
      ws.once("error", (error) => {
        finish();
        reject(error);
      });
      ws.once("message", (data, binary) => {
        finish();
        resolve({ text: data.toString(), binary, status, authorized, protocol: ws.protocol });
      });
      ws.once("close", () => {
        finish();
        reject(new Error("WSS closed before echo"));
      });
    });
  } finally {
    ws.terminate();
  }
}

async function certificateError(ws: WebSocket) {
  trackWebSocket(ws);
  try {
    return await new Promise<Error & { code?: string }>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Timed out waiting for TLS rejection")),
        3000,
      );
      ws.once("open", () => {
        clearTimeout(timer);
        reject(new Error("Invalid certificate was accepted"));
      });
      ws.once("error", (error) => {
        clearTimeout(timer);
        resolve(error);
      });
    });
  } finally {
    ws.terminate();
  }
}

describe.sequential("ProxyAwareNetwork integration", () => {
  it("fetch routes through the proxy (CONNECT tunnel)", async () => {
    const beforeConnect = connectAuthorities.length;
    const beforeRequests = receivedRequests.length;
    const body = JSON.stringify({ query: "{__typename}" });
    const res = await proxiedNetwork().fetch(`https://127.0.0.1:${originPort}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(3000),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { __typename: "Query" } });
    expect(connectAuthorities.slice(beforeConnect)).toEqual([`127.0.0.1:${originPort}`]);
    expect(receivedRequests.slice(beforeRequests)).toEqual([
      {
        method: "POST",
        url: "/graphql",
        contentType: "application/json",
        body,
        tlsProtocol: expect.stringMatching(/^TLSv1\.[23]$/),
      },
    ]);
  });

  it.each(["createWebSocket", "createProxiedWebSocketClass"] as const)(
    "%s routes through the proxy",
    async (method) => {
      const network = proxiedNetwork();
      const beforeConnect = connectAuthorities.length;
      const beforeMessages = receivedMessages.length;
      const url = `wss://localhost:${originPort}/graphql`;
      const ws =
        method === "createWebSocket"
          ? network.createWebSocket(url, "fixture-echo")
          : new (network.createProxiedWebSocketClass())(url, "fixture-echo");
      const payload = JSON.stringify({ type: "ping", source: method });

      expect(await exchangeMessage(ws, payload)).toEqual({
        text: payload,
        binary: false,
        status: 101,
        authorized: true,
        protocol: "fixture-echo",
      });
      expect(receivedMessages.slice(beforeMessages)).toEqual([payload]);
      expect(connectAuthorities.slice(beforeConnect)).toEqual([`localhost:${originPort}`]);
    },
  );

  it("rejects an untrusted TLS certificate through the tunnel", async () => {
    const before = connectAuthorities.length;
    setDefaultCACertificates(originalCAs!);
    try {
      const error = await certificateError(
        proxiedNetwork().createWebSocket(`wss://localhost:${originPort}/graphql`),
      );
      expect(error.code).toBe("SELF_SIGNED_CERT_IN_CHAIN");
      expect(connectAuthorities.slice(before)).toEqual([`localhost:${originPort}`]);
    } finally {
      setDefaultCACertificates([...originalCAs!, fixtureCa]);
    }
  });

  it("rejects a hostname mismatch even when the test CA is trusted", async () => {
    const before = connectAuthorities.length;
    const error = await certificateError(
      proxiedNetwork().createWebSocket(`wss://mismatch.invalid:${originPort}/graphql`),
    );
    expect(error.code).toBe("ERR_TLS_CERT_ALTNAME_INVALID");
    expect(connectAuthorities.slice(before)).toEqual([`mismatch.invalid:${originPort}`]);
  });
});
