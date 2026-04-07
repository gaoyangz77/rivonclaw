import { createLogger } from "@rivonclaw/logger";
import WebSocket from "ws";
import { HttpsProxyAgent } from "https-proxy-agent";

const log = createLogger("proxy-network");

/**
 * Centralized network layer that routes all outbound connections through
 * the local proxy-router.  The proxy-router handles system proxy detection
 * (Clash, V2Ray, etc.) and per-key proxy routing for LLM providers.
 *
 * Before the proxy-router is ready, connections fall back to direct.
 */
export class ProxyAwareNetwork {
  private proxyRouterPort: number | null = null;

  /** Called after proxy-router binds to its port. */
  setProxyRouterPort(port: number): void {
    this.proxyRouterPort = port;
    log.info(`Proxy-aware network ready (proxy-router port: ${port})`);
  }

  getProxyRouterPort(): number | null {
    return this.proxyRouterPort;
  }

  /** Fetch that routes through the proxy-router when available. */
  async fetch(url: string | URL, init?: RequestInit): Promise<Response> {
    if (this.proxyRouterPort) {
      const { ProxyAgent } = await import("undici");
      return fetch(url, {
        ...init,
        dispatcher: new ProxyAgent(`http://127.0.0.1:${this.proxyRouterPort}`) as any,
      });
    }
    // Avoid passing undefined as second arg so callers that spy on fetch
    // see the same arity as a direct fetch(url) call.
    return init ? fetch(url, init) : fetch(url);
  }

  /**
   * Create a WebSocket that routes through the proxy-router when available.
   * Returns a standard `ws` WebSocket instance.
   */
  createWebSocket(url: string, protocols?: string | string[]): WebSocket {
    if (this.proxyRouterPort) {
      const agent = new HttpsProxyAgent(`http://127.0.0.1:${this.proxyRouterPort}`);
      return new WebSocket(url, protocols, { agent });
    }
    return new WebSocket(url, protocols);
  }

  /**
   * Create a WebSocket class (constructor) that routes through the proxy-router.
   * Used with libraries like graphql-ws that need a webSocketImpl class.
   */
  createProxiedWebSocketClass(): typeof WebSocket {
    const port = this.proxyRouterPort;
    if (!port) return WebSocket;

    // Return a subclass that automatically sets the agent
    return class ProxiedWebSocket extends WebSocket {
      constructor(url: string | URL, protocols?: string | string[], options?: WebSocket.ClientOptions) {
        const agent = new HttpsProxyAgent(`http://127.0.0.1:${port}`);
        super(url, protocols, { ...options, agent });
      }
    } as typeof WebSocket;
  }
}

// Singleton instance — imported by all consumers
export const proxyNetwork = new ProxyAwareNetwork();
