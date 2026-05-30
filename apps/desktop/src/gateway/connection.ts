import { createLogger } from "@rivonclaw/logger";
import { openClawConnector } from "../openclaw/index.js";
import { CustomerServiceBridge } from "../cs-bridge/customer-service-bridge.js";
import { rootStore } from "../app/store/desktop-store.js";
import { getAuthSession } from "../auth/session-ref.js";
import { ensureAgentToolingReady } from "./agent-tooling-readiness.js";

const log = createLogger("gateway-connection");

// ── Module-level state ─────────────────────────────────────────────────────

let _csBridge: CustomerServiceBridge | null = null;

// ── Public API ─────────────────────────────────────────────────────────────

export function getCsBridge(): CustomerServiceBridge | null {
  return _csBridge;
}

// ---------------------------------------------------------------------------
// CS Bridge reactive startup
// ---------------------------------------------------------------------------
// The bridge must start when BOTH conditions are met:
//   1. Gateway RPC is connected (we can dispatch agent runs)
//   2. User data shows ecommerce module enrolled
// Auth changes are coordinated at the app lifecycle level. Do not subscribe
// directly to authSession.onUserChanged here: login sets cachedUser before the
// auth-change bootstrap/restart sequence has settled.

let _csBridgeStarting = false;
let _csBridgeLifecycleGeneration = 0;

export function stopCsBridge(): void {
  _csBridgeLifecycleGeneration += 1;
  _csBridgeStarting = false;
  if (_csBridge) {
    _csBridge.stop();
    _csBridge = null;
  }
}

export function tryStartCsBridge(gatewayId: string, locale?: string): void {
  const authSession = getAuthSession();
  if (!authSession) return;

  const attemptStart = () => {
    if (_csBridge || _csBridgeStarting) return;
    const generation = _csBridgeLifecycleGeneration;
    _csBridgeStarting = true;

    void (async () => {
      try {
        // Both conditions: RPC connected + user has ecommerce
        let rpc: unknown;
        try {
          rpc = openClawConnector.ensureRpcReady();
        } catch {
          rpc = null;
        }
        if (!rpc) return;
        const user = authSession.getCachedUser();
        const hasEcommerce = user?.enrolledModules?.includes("GLOBAL_ECOMMERCE_SELLER");
        if (!hasEcommerce) return;

        try {
          await ensureAgentToolingReady();
        } catch (e) {
          log.warn("CS bridge startup waiting for agent tooling failed:", e);
          return;
        }

        if (generation !== _csBridgeLifecycleGeneration || _csBridge) return;

        // Auth/RPC may have changed while waiting for cloud tools. Re-check before
        // binding the bridge to this login session.
        try {
          rpc = openClawConnector.ensureRpcReady();
        } catch {
          rpc = null;
        }
        if (!rpc) return;
        const latestUser = authSession.getCachedUser();
        const latestHasEcommerce = latestUser?.enrolledModules?.includes("GLOBAL_ECOMMERCE_SELLER");
        if (!latestHasEcommerce) return;

        _csBridge = new CustomerServiceBridge({
          gatewayId,
          locale,
        });
        rootStore.llmManager.refreshModelCatalog().catch(() => {});
        _csBridge.start().catch((e: unknown) => log.error("CS bridge start failed:", e));
        log.info("CS bridge started (ecommerce module detected)");
      } finally {
        if (generation === _csBridgeLifecycleGeneration) {
          _csBridgeStarting = false;
        }
      }
    })();
  };

  // Try immediately (user data may already be cached)
  attemptStart();
}
