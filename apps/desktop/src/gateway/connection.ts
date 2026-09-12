import { createLogger } from "@rivonclaw/logger";
import { openClawConnector } from "../openclaw/index.js";
import { CustomerServiceBridge } from "../cs-bridge/customer-service-bridge.js";
import { rootStore } from "../app/store/desktop-store.js";
import { getAuthSession } from "../auth/session-ref.js";
import { ensureAgentToolingReady } from "./agent-tooling-readiness.js";
import {
  CS_ADMISSION_CANCEL_REASON,
  resolveCsAutomaticMaxConcurrent,
  type CsRunAdmissionCancelReason,
} from "../cs-bridge/cs-run-admission.js";
import {
  clearPendingCsDispatches,
  flushCsDispatchesAfterBridgeReady,
  getPendingCsDispatchCount,
  resolveCsReplayStartSpacingMs,
} from "../cs-bridge/cs-conversation-signal-buffer.js";

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
//   2. A user is signed in
// Auth changes are coordinated at the app lifecycle level. Do not subscribe
// directly to authSession.onUserChanged here: login sets cachedUser before the
// auth-change bootstrap/restart sequence has settled.

let _csBridgeStarting = false;
let _csBridgeLifecycleGeneration = 0;
let _csBridgeSuspended = false;

export function stopCsBridge(
  reason: CsRunAdmissionCancelReason = CS_ADMISSION_CANCEL_REASON.BRIDGE_STOPPED,
): void {
  _csBridgeLifecycleGeneration += 1;
  _csBridgeStarting = false;
  // The replay buffer outlives the bridge on purpose: a Gateway crash rejects
  // the bridge's queued admissions and the recovery path re-queues them here,
  // and signals that arrive while the Gateway is down land here too. Only a
  // sign-out or account switch discards it -- that work belongs to the session
  // being torn down, and replaying it would resurrect the previous account's
  // conversations under the next login.
  //
  // Clearing on every teardown (1.9.5 - 1.9.10) had a hole: the launcher's
  // "stopped" event calls this with the default reason, so a Gateway that died
  // a second time before the replacement bridge came up wiped the backlog the
  // first death had just re-queued. Keying the clear on the reason closes it.
  //
  // The clear stays BEFORE the teardown. Stopping the bridge rejects queued
  // admissions whose handlers run in a later microtask; clearing afterwards
  // would still work today, but only by that invisible ordering.
  if (reason === CS_ADMISSION_CANCEL_REASON.AUTH_CHANGE) {
    clearPendingCsDispatches();
  }
  if (_csBridge) {
    _csBridge.stop(reason);
    _csBridge = null;
  }
  _csBridgeSuspended = false;
}

async function flushPendingCsDispatches(bridge: CustomerServiceBridge): Promise<void> {
  // Two extra workers over the admission limit: enough that a slot freed by a
  // finished run has a dispatch already past its pre-admission work and ready
  // to take it, without putting more concurrent conversation-delta fetches on
  // a Gateway that is the reason we are replaying in the first place.
  const concurrency = resolveCsAutomaticMaxConcurrent() + 2;
  // ...and space their starts out. After an OOM restart the buffer holds the
  // whole cancelled queue (64-69 entries on 2026-09-09); starting six of them
  // in the first second puts a Gateway that has just finished loading straight
  // at 4/4 with six conversation-delta fetches in flight. A saturated Gateway
  // lives ~8 min on that machine against 11-17 idle, so ramp up instead of
  // stepping. Fresh buyer messages are not paced; they never pass through here.
  const startSpacingMs = resolveCsReplayStartSpacingMs();

  // Entries can land in the buffer while a replay is running: a dispatch that
  // was mid-setup at the crash reaches the retired admission gate only after
  // its setup finishes (up to a 30 s `chat.history` timeout on a stalled
  // Gateway) and re-queues itself from there. The buffer is drained at the
  // start of each pass, so loop until a pass finds it empty -- or until this
  // bridge has been replaced, in which case its successor's start-up flush
  // owns whatever is left.
  for (;;) {
    const startedAt = Date.now();
    const result = await flushCsDispatchesAfterBridgeReady(
      (dispatch) => bridge.handleCsConversationSignal(dispatch),
      {
        concurrency,
        startSpacingMs,
        onError: (dispatch, error) =>
          log.warn(
            `CS bridge replay failed for conv=${dispatch.conversationId} ` +
            `shop=${dispatch.platformShopId}:`,
            error,
          ),
      },
    );

    if (result.flushed > 0) {
      log.info(
        `CS bridge replayed ${result.flushed} startup dispatch(es) ` +
        `(maxWaitMs=${result.maxWaitMs} concurrency=${concurrency} ` +
        `startSpacingMs=${startSpacingMs} failed=${result.failed} ` +
        `elapsedMs=${Date.now() - startedAt})`,
      );
    }
    if (result.flushed === 0 || getPendingCsDispatchCount() === 0 || _csBridge !== bridge) {
      return;
    }
  }
}

export function suspendCsBridge(): void {
  _csBridgeLifecycleGeneration += 1;
  _csBridgeStarting = false;
  if (!_csBridge) return;
  _csBridgeSuspended = true;
  _csBridge.suspendForGatewayDisconnect();
}

export function updateCsBridgeLocale(locale?: string): void {
  _csBridge?.updateLocale(locale);
}

export function tryStartCsBridge(gatewayId: string, locale?: string): void {
  const authSession = getAuthSession();
  if (!authSession) return;

  const attemptStart = () => {
    if (_csBridgeStarting) return;
    const generation = _csBridgeLifecycleGeneration;
    _csBridgeStarting = true;

    void (async () => {
      try {
        // Both conditions: RPC connected + signed-in user.
        let rpc: unknown;
        try {
          rpc = openClawConnector.ensureRpcReady();
        } catch {
          rpc = null;
        }
        if (!rpc) return;
        const user = authSession.getCachedUser();
        if (!user) return;

        if (_csBridge) {
          if (!_csBridgeSuspended) return;
          await _csBridge.resumeAfterGatewayReconnect();
          if (generation !== _csBridgeLifecycleGeneration || !_csBridge) return;
          _csBridgeSuspended = false;
          await flushPendingCsDispatches(_csBridge);
          log.info("CS bridge resumed after Gateway RPC reconnect");
          return;
        }

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
        if (!latestUser) return;

        const bridge = new CustomerServiceBridge({
          gatewayId,
          locale,
        });
        await bridge.start();
        if (generation !== _csBridgeLifecycleGeneration || _csBridge) {
          bridge.stop();
          return;
        }
        _csBridge = bridge;
        _csBridgeSuspended = false;
        rootStore.llmManager.refreshModelCatalog().catch(() => {});
        await flushPendingCsDispatches(bridge);
        log.info("CS bridge started (signed-in ecommerce workspace)");
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
