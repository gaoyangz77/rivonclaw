import { createLogger } from "@rivonclaw/logger";
import { DEFAULTS } from "@rivonclaw/core";
import WebSocket from "ws";
import { HttpsProxyAgent } from "https-proxy-agent";

const log = createLogger("proxy-network");

const MAX_RETRIES = DEFAULTS.proxyNetwork.maxRetries;
const RETRY_BASE_DELAY_MS = DEFAULTS.proxyNetwork.retryBaseDelayMs;

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

  /** Fetch that routes through the proxy-router when available, with retry on network errors. */
  async fetch(url: string | URL, init?: RequestInit): Promise<Response> {
    const sanitizedUrl = this.sanitizeUrl(url);
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.doFetch(url, init);
      } catch (err) {
        lastError = err;

        // Never retry intentional cancellation
        if (this.isAbortError(err, init?.signal)) break;

        if (attempt < MAX_RETRIES) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
          log.warn(
            `Fetch attempt ${attempt}/${MAX_RETRIES} failed for ${sanitizedUrl}: ${err instanceof Error ? err.message : String(err)} — retrying in ${delay}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));

          // Re-check abort after sleeping — the caller may have cancelled while we waited
          if (init?.signal?.aborted) break;
        } else {
          log.warn(
            `Fetch attempt ${attempt}/${MAX_RETRIES} failed for ${sanitizedUrl}: ${err instanceof Error ? err.message : String(err)} — all retries exhausted`,
          );
        }
      }
    }

    throw lastError;
  }

  /** Execute a single fetch, routing through the proxy-router when available. */
  private async doFetch(url: string | URL, init?: RequestInit): Promise<Response> {
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

  /** Check if an error is an intentional abort (not a retryable network error). */
  private isAbortError(err: unknown, signal?: AbortSignal | null): boolean {
    if (signal?.aborted) return true;
    if (err instanceof DOMException && err.name === "AbortError") return true;
    if (err instanceof Error && err.name === "AbortError") return true;
    return false;
  }

  /** Strip query params from a URL for privacy-safe logging. */
  private sanitizeUrl(url: string | URL): string {
    try {
      const parsed = new URL(url.toString());
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return String(url);
    }
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
