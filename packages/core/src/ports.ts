import { DEFAULTS } from "./defaults.js";

/**
 * Ask the OS to assign a free ephemeral port.
 * Binds a temporary server on port 0 to 127.0.0.1, reads the assigned port,
 * then closes the server and returns the port number.
 */
export async function findFreePort(): Promise<number> {
  const { createServer } = await import("node:net");
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

/** Default port for the OpenClaw gateway (WebSocket + HTTP). */
export const DEFAULT_GATEWAY_PORT = DEFAULTS.ports.gateway;

/** Offset added to the gateway port for Chrome DevTools Protocol. */
export const CDP_PORT_OFFSET = DEFAULTS.ports.cdpOffset;

/** Default port for the desktop panel HTTP server. */
export const DEFAULT_PANEL_PORT = DEFAULTS.ports.panel;

/** Default port for the local proxy router. */
export const DEFAULT_PROXY_ROUTER_PORT = DEFAULTS.ports.proxyRouter;

/** Default port for the panel Vite dev server. */
export const DEFAULT_PANEL_DEV_PORT = DEFAULTS.ports.panelDev;

/** Resolve the gateway port, respecting RIVONCLAW_GATEWAY_PORT env var. */
export function resolveGatewayPort(
  env: Record<string, string | undefined> = process.env,
): number {
  const v = env.RIVONCLAW_GATEWAY_PORT?.trim();
  return v ? Number(v) : DEFAULT_GATEWAY_PORT;
}

/** Resolve the panel server port, respecting RIVONCLAW_PANEL_PORT env var. */
export function resolvePanelPort(
  env: Record<string, string | undefined> = process.env,
): number {
  const v = env.RIVONCLAW_PANEL_PORT?.trim();
  return v ? Number(v) : DEFAULT_PANEL_PORT;
}

/** Resolve the proxy router port, respecting RIVONCLAW_PROXY_ROUTER_PORT env var. */
export function resolveProxyRouterPort(
  env: Record<string, string | undefined> = process.env,
): number {
  const v = env.RIVONCLAW_PROXY_ROUTER_PORT?.trim();
  return v ? Number(v) : DEFAULT_PROXY_ROUTER_PORT;
}
