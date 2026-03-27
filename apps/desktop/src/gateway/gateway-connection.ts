import { createLogger } from "@rivonclaw/logger";
import { GatewayRpcClient, readExistingConfig } from "@rivonclaw/gateway";
import type { GatewayEventFrame } from "@rivonclaw/gateway";
import { resolveGatewayPort, getCsRelayWsUrl } from "@rivonclaw/core";
import { join } from "node:path";
import { setRpcClient, getRpcClient } from "./rpc-client-ref.js";
import { pushStoredCookiesToGateway } from "../browser-profiles/cookie-sync.js";
import { CustomerServiceBridge } from "../cs-bridge/customer-service-bridge.js";
import { loadCSShopContexts } from "../cs-bridge/load-shop-contexts.js";
import type { AuthSessionManager } from "../auth/auth-session.js";
import type { GatewayEventHandler } from "./gateway-event-dispatcher.js";

const log = createLogger("gateway-connection");

// ── Module-level state ─────────────────────────────────────────────────────

let _csBridge: CustomerServiceBridge | null = null;

// ── Deps interface ─────────────────────────────────────────────────────────

export interface GatewayConnectionDeps {
  configPath: string;
  stateDir: string;
  deviceId: string;
  storage: {
    mobilePairings: {
      getAllPairings(): Array<{
        id: string;
        pairingId?: string;
        accessToken: string;
        relayUrl: string;
        deviceId: string;
        mobileDeviceId?: string;
        status?: "active" | "stale";
      }>;
    };
  };
  authSession: {
    getAccessToken(): string | null;
    getCachedUser(): { enrolledModules?: string[] } | null;
    getCachedAvailableTools(): Array<{ id: string; allowed: boolean }> | null;
    fetchAvailableTools(): Promise<Array<{ id: string; allowed: boolean }>>;
    graphqlFetch<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T>;
  } | null;
  toolCapabilityResolver: {
    init(entitledToolIds: string[], catalogTools: Array<{ id: string; source: "core" | "plugin"; pluginId?: string }>): void;
  };
  dispatchGatewayEvent: GatewayEventHandler;
}

// ── Public API ─────────────────────────────────────────────────────────────

export function getCsBridge(): CustomerServiceBridge | null {
  return _csBridge;
}

export async function connectGateway(deps: GatewayConnectionDeps): Promise<void> {
  const existing = getRpcClient();
  if (existing) {
    existing.stop();
  }

  const {
    configPath,
    stateDir,
    deviceId,
    storage,
    authSession,
    toolCapabilityResolver,
    dispatchGatewayEvent,
  } = deps;

  const config = readExistingConfig(configPath);
  const gw = config.gateway as Record<string, unknown> | undefined;
  const port = (gw?.port as number) ?? resolveGatewayPort();
  const auth = gw?.auth as Record<string, unknown> | undefined;
  const token = auth?.token as string | undefined;

  const rpcClient = new GatewayRpcClient({
    url: `ws://127.0.0.1:${port}`,
    token,
    deviceIdentityPath: join(stateDir, "identity", "device.json"),
    onConnect: () => {
      log.info("Gateway RPC client connected");

      // Start Mobile Sync engines for all active pairings (skip stale)
      const allPairings = storage.mobilePairings.getAllPairings();
      const stalePairings: Array<{ pairingId: string | undefined; mobileDeviceId: string | undefined }> = [];
      for (const pairing of allPairings) {
        if (pairing.status === "stale") {
          stalePairings.push({
            pairingId: pairing.pairingId || pairing.id,
            mobileDeviceId: pairing.mobileDeviceId,
          });
          continue;
        }
        rpcClient.request("mobile_chat_start_sync", {
          pairingId: pairing.pairingId,
          accessToken: pairing.accessToken,
          relayUrl: pairing.relayUrl,
          desktopDeviceId: pairing.deviceId,
          mobileDeviceId: pairing.mobileDeviceId || pairing.id,
        }).catch((e: unknown) => log.error(`Failed to start Mobile Sync for ${pairing.pairingId || pairing.mobileDeviceId || pairing.id}:`, e));
      }

      // Register stale pairings so the mobile channel stays visible in Panel
      if (stalePairings.length > 0) {
        rpcClient.request("mobile_chat_register_stale", { pairings: stalePairings })
          .catch((e: unknown) => log.error("Failed to register stale mobile pairings:", e));
      }

      // Initialize event bridge plugin so it captures the gateway broadcast function
      rpcClient.request("event_bridge_init", {})
        .catch((e: unknown) => log.debug("Event bridge init (may not be loaded):", e));

      // Initialize ToolCapabilityResolver with gateway tool catalog + entitlements
      (async () => {
        try {
          const catalog = await rpcClient.request<{
            groups: Array<{
              tools: Array<{ id: string; source: "core" | "plugin"; pluginId?: string }>;
            }>;
          }>("tools.catalog", { includePlugins: true });

          const catalogTools: Array<{ id: string; source: "core" | "plugin"; pluginId?: string }> = [];
          for (const group of catalog.groups ?? []) {
            for (const tool of group.tools ?? []) {
              catalogTools.push({ id: tool.id, source: tool.source, pluginId: tool.pluginId });
            }
          }

          // Get entitled tools from cached available tools or fetch fresh
          let entitledToolIds: string[] = [];
          if (authSession?.getAccessToken()) {
            const availableTools = authSession.getCachedAvailableTools()
              ?? await authSession.fetchAvailableTools().catch(() => []);
            entitledToolIds = availableTools
              .filter(t => t.allowed)
              .map(t => t.id);
          }

          toolCapabilityResolver.init(entitledToolIds, catalogTools);
        } catch (e) {
          log.warn("Failed to initialize ToolCapabilityResolver:", e);
        }
      })();

      // Start CS Bridge if user has e-commerce module
      if (authSession?.getAccessToken()) {
        const user = authSession.getCachedUser();
        const hasEcommerce = user?.enrolledModules?.includes("GLOBAL_ECOMMERCE_SELLER");
        if (hasEcommerce) {
          if (_csBridge) _csBridge.stop();
          _csBridge = new CustomerServiceBridge({
            relayUrl: getCsRelayWsUrl(),
            gatewayId: deviceId ?? "unknown",
            getAuthToken: () => authSession?.getAccessToken() ?? null,
          });
          // Load shop contexts (prompt + IDs) for CS-enabled shops bound to this device
          loadCSShopContexts(_csBridge, authSession as AuthSessionManager, deviceId).catch((e: unknown) =>
            log.error("Failed to load CS shop contexts:", e));
          // Cache available model IDs for CS model override validation
          _csBridge.refreshModelCatalog().catch(() => {});
          _csBridge.start().catch((e: unknown) => log.error("CS bridge start failed:", e));
        }
      }

      // Push locally-stored cookies for managed profiles to the gateway plugin
      pushStoredCookiesToGateway()
        .catch((e: unknown) => log.debug("Failed to push stored cookies to gateway (best-effort):", e));
    },
    onClose: () => {
      log.info("Gateway RPC client disconnected");
    },
    onEvent: (evt: GatewayEventFrame) => {
      // Forward events to CS bridge for auto-forwarding agent text to buyer
      _csBridge?.onGatewayEvent(evt);
      dispatchGatewayEvent(evt);
    },
  });

  setRpcClient(rpcClient);
  await rpcClient.start();
}

export function disconnectGateway(): void {
  if (_csBridge) {
    _csBridge.stop();
    _csBridge = null;
  }
  const rpcClient = getRpcClient();
  if (rpcClient) {
    rpcClient.stop();
    setRpcClient(null);
  }
}
