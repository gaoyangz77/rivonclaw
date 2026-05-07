/**
 * Simplified WebSocket client for connecting to the OpenClaw gateway from
 * the RivonClaw panel (browser).  Handles the challenge-response handshake,
 * JSON-RPC request/response, event streaming, and auto-reconnect.
 *
 * Compared to OpenClaw's GatewayBrowserClient this version skips device
 * identity / IndexedDB / crypto.subtle — the panel is always on localhost
 * so simple token auth is sufficient.
 */

export type GatewayEvent = {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
};

export type GatewayHelloOk = {
  type: "hello-ok";
  protocol: number;
  features?: { methods?: string[]; events?: string[] };
  snapshot?: {
    sessionDefaults?: {
      mainSessionKey?: string;
      defaultAgentId?: string;
    };
    [key: string]: unknown;
  };
};

export type GatewayChatClientOptions = {
  url: string;
  token?: string;
  autoStartKeepalive?: boolean;
  onConnected?: (hello: GatewayHelloOk) => void;
  onDisconnected?: () => void;
  onEvent?: (evt: GatewayEvent) => void;
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
  timeout?: ReturnType<typeof setTimeout>;
};

/** Application-level keepalive interval (ms). */
const KEEPALIVE_INTERVAL_MS = 25_000;
/** If a keepalive ping doesn't get a pong within this time, assume dead. */
const KEEPALIVE_TIMEOUT_MS = 10_000;

export class GatewayChatClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private closed = false;
  private connectNonce: string | null = null;
  private connectSent = false;
  private backoffMs = 800;
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  private keepaliveTimeout: ReturnType<typeof setTimeout> | null = null;
  private authenticated = false;
  private keepaliveEnabled: boolean;

  constructor(private opts: GatewayChatClientOptions) {
    this.keepaliveEnabled = opts.autoStartKeepalive !== false;
  }

  start(): void {
    this.closed = false;
    this.doConnect();
  }

  stop(): void {
    this.closed = true;
    this.stopKeepalive();
    this.ws?.close(1000, "client stopped");
    this.ws = null;
    this.flushPending(new Error("client stopped"));
  }

  setKeepaliveEnabled(enabled: boolean): void {
    this.keepaliveEnabled = enabled;
    if (!enabled) {
      this.stopKeepalive();
      return;
    }
    if (this.authenticated) {
      this.startKeepalive();
    }
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  request<T = unknown>(method: string, params?: unknown, timeoutMs = 30_000): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("gateway not connected"));
    }
    const id = crypto.randomUUID();
    const frame = { type: "req", id, method, params };
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC timeout after ${timeoutMs}ms: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve: (v) => resolve(v as T), reject, timeout });
      this.ws!.send(JSON.stringify(frame));
    });
  }

  // --- internal ---

  private doConnect(): void {
    if (this.closed) return;
    this.connectSent = false;
    this.connectNonce = null;
    this.authenticated = false;

    const ws = new WebSocket(this.opts.url);
    this.ws = ws;

    ws.addEventListener("message", (ev) => this.handleMessage(String(ev.data ?? "")));

    ws.addEventListener("close", () => {
      this.ws = null;
      this.authenticated = false;
      this.stopKeepalive();
      this.flushPending(new Error("gateway disconnected"));
      this.opts.onDisconnected?.();
      this.scheduleReconnect();
    });

    ws.addEventListener("error", (e) => {
      console.warn("[gateway-client] WebSocket error (close handler will follow):", e);
    });
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 1.7, 15_000);
    setTimeout(() => this.doConnect(), delay);
  }

  private sendConnect(): void {
    if (this.connectSent || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.connectSent = true;

    const params = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: "openclaw-control-ui",
        version: "1.0.0",
        platform: navigator.platform ?? "web",
        mode: "webchat",
      },
      role: "operator",
      scopes: ["operator.admin"],
      caps: ["tool-events"],
      auth: this.opts.token ? { token: this.opts.token } : undefined,
      userAgent: navigator.userAgent,
      locale: navigator.language,
    };

    this.request<GatewayHelloOk>("connect", params)
      .then((hello) => {
        this.backoffMs = 800;
        this.authenticated = true;
        if (this.keepaliveEnabled) {
          this.startKeepalive();
        }
        this.opts.onConnected?.(hello);
      })
      .catch((err) => {
        console.warn("[gateway-client] connect handshake failed:", err);
        this.ws?.close(1000, "handshake failed");
      });
  }

  // --- keepalive ---

  private startKeepalive(): void {
    this.stopKeepalive();
    this.keepaliveTimer = setInterval(() => this.sendPing(), KEEPALIVE_INTERVAL_MS);
  }

  private stopKeepalive(): void {
    if (this.keepaliveTimer) { clearInterval(this.keepaliveTimer); this.keepaliveTimer = null; }
    if (this.keepaliveTimeout) { clearTimeout(this.keepaliveTimeout); this.keepaliveTimeout = null; }
  }

  private sendPing(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.authenticated) return;

    // Set a deadline — if no response arrives, force-close so onDisconnected fires.
    this.keepaliveTimeout = setTimeout(() => {
      console.warn("[gateway-client] keepalive timeout — closing connection");
      this.ws?.close(1000, "keepalive timeout");
    }, KEEPALIVE_TIMEOUT_MS);

    // Use a lightweight RPC call as an application-level ping. Avoid
    // sessions.list here: it can hydrate session metadata and briefly block the
    // gateway event loop on large or cold stores.
    this.request("agent.identity.get", { agentId: "main" })
      .then(() => {
        if (this.keepaliveTimeout) { clearTimeout(this.keepaliveTimeout); this.keepaliveTimeout = null; }
      })
      .catch((err) => {
        console.warn("[gateway-client] keepalive ping failed:", err);
      });
  }

  // --- message handling ---

  private handleMessage(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const frame = parsed as { type?: string };

    if (frame.type === "event") {
      const evt = parsed as GatewayEvent;
      // Gateway sends connect.challenge first — respond with connect request
      if (evt.event === "connect.challenge") {
        const payload = evt.payload as { nonce?: string } | undefined;
        if (payload?.nonce) {
          this.connectNonce = payload.nonce;
          this.sendConnect();
        }
        return;
      }
      this.opts.onEvent?.(evt);
      return;
    }

    if (frame.type === "res") {
      const res = parsed as { id: string; ok: boolean; payload?: unknown; error?: { message?: string } };
      const pending = this.pending.get(res.id);
      if (!pending) return;
      this.pending.delete(res.id);
      if (pending.timeout) clearTimeout(pending.timeout);
      if (res.ok) {
        pending.resolve(res.payload);
      } else {
        pending.reject(new Error(res.error?.message ?? "request failed"));
      }
    }
  }

  private flushPending(err: Error): void {
    for (const [, p] of this.pending) {
      if (p.timeout) clearTimeout(p.timeout);
      p.reject(err);
    }
    this.pending.clear();
  }
}
