import { when } from "mobx";
import { types, flow } from "mobx-state-tree";
import { fetchJson } from "../../api/client.js";
import { API, clientPath } from "@rivonclaw/core/api-contract";
import type { ChannelsStatusSnapshot } from "@rivonclaw/core";
import type { AllowlistResult, PairingRequest } from "../../api/channels.js";
import { runtimeStatusStore } from "../runtime-status-store.js";

/** Fired after any channel configuration change. */
const CHANNEL_CHANGED_EVENT = "channel-changed";
const CHANNEL_STATUS_POLL_MS = 30_000;
const CHANNEL_STATUS_RETRY_MS = 10_000;
const CHANNEL_GATEWAY_RETRY_MS = 1_500;

function isGatewayNotConnectedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("Gateway not connected");
}

/**
 * Channel management operations as MST actions on the Panel entity store.
 *
 * Channel accounts live on rootStore.channelAccounts. Runtime status is stored
 * here so all channel state flows through MST instead of page-local hooks.
 */
export const ChannelManagerModel = types
  .model("ChannelManager", {
    initialized: types.optional(types.boolean, false),
    statusSnapshot: types.maybeNull(types.frozen<ChannelsStatusSnapshot>()),
    statusLoading: types.optional(types.boolean, true),
    statusRefreshing: types.optional(types.boolean, false),
    statusError: types.maybeNull(types.string),
  })
  .volatile(() => ({
    statusPolling: false,
    statusPollTimer: null as ReturnType<typeof setTimeout> | null,
    statusRetryTimer: null as ReturnType<typeof setTimeout> | null,
    readinessWait: null as (Promise<void> & { cancel?: () => void }) | null,
  }))
  .actions((self) => {
    function broadcast(): void {
      window.dispatchEvent(new CustomEvent(CHANNEL_CHANGED_EVENT));
    }

    function clearStatusPollTimer(): void {
      if (self.statusPollTimer) {
        clearTimeout(self.statusPollTimer);
        self.statusPollTimer = null;
      }
    }

    function clearStatusRetryTimer(): void {
      if (self.statusRetryTimer) {
        clearTimeout(self.statusRetryTimer);
        self.statusRetryTimer = null;
      }
    }

    function cancelReadinessWait(): void {
      self.readinessWait?.cancel?.();
      self.readinessWait = null;
    }

    function scheduleStatusPoll(delayMs: number): void {
      clearStatusPollTimer();
      if (!self.statusPolling) return;
      self.statusPollTimer = setTimeout(() => {
        void pollChannelStatus();
      }, delayMs);
    }

    function scheduleGatewayRetry(): void {
      clearStatusRetryTimer();
      self.statusRetryTimer = setTimeout(() => {
        self.statusRetryTimer = null;
        void retryGatewayStatus();
      }, CHANNEL_GATEWAY_RETRY_MS);
    }

    function setStatusSnapshot(snapshot: ChannelsStatusSnapshot | null): void {
      self.statusSnapshot = snapshot;
      self.statusError = null;
      clearStatusRetryTimer();
    }

    function setStatusError(err: unknown, showError: boolean): void {
      if (showError || !self.statusSnapshot) {
        self.statusError = String(err);
      }
    }

    const probeChannelStatus = flow(function* (): Generator<Promise<{ snapshot: ChannelsStatusSnapshot | null; error?: string }>, void, { snapshot: ChannelsStatusSnapshot | null; error?: string }> {
      try {
        const data = yield fetchJson<{ snapshot: ChannelsStatusSnapshot | null; error?: string }>(
          clientPath(API["channels.status"]) + "?probe=true",
        );
        if (data.snapshot) {
          setStatusSnapshot(data.snapshot);
        }
      } catch {
        // Keep the fast non-probe snapshot if a slow probe fails.
      }
    });

    function backgroundProbe(): void {
      void probeChannelStatus();
    }

    const loadChannelStatus = flow(function* (
      showLoading = true,
      opts?: { probe?: boolean },
    ): Generator<Promise<{ snapshot: ChannelsStatusSnapshot | null; error?: string }>, ChannelsStatusSnapshot | null, { snapshot: ChannelsStatusSnapshot | null; error?: string }> {
      if (showLoading) {
        self.statusLoading = true;
        self.statusError = null;
      }
      try {
        const data = yield fetchJson<{ snapshot: ChannelsStatusSnapshot | null; error?: string }>(
          clientPath(API["channels.status"]) + "?probe=false",
        );
        setStatusSnapshot(data.snapshot);
        if (opts?.probe !== false) {
          backgroundProbe();
        }
        return data.snapshot;
      } catch (err) {
        if (isGatewayNotConnectedError(err)) {
          self.statusError = null;
          self.statusLoading = showLoading || !self.statusSnapshot;
          self.statusRefreshing = false;
          scheduleGatewayRetry();
          return null;
        }
        setStatusError(err, showLoading);
        return null;
      } finally {
        if (!self.statusRetryTimer) {
          self.statusLoading = false;
        }
        self.statusRefreshing = false;
      }
    });

    const retryGatewayStatus = flow(function* (): Generator<Promise<{ snapshot: ChannelsStatusSnapshot | null; error?: string }>, void, { snapshot: ChannelsStatusSnapshot | null; error?: string }> {
      try {
        const data = yield fetchJson<{ snapshot: ChannelsStatusSnapshot | null; error?: string }>(
          clientPath(API["channels.status"]) + "?probe=false",
        );
        setStatusSnapshot(data.snapshot);
        self.statusLoading = false;
        self.statusRefreshing = false;
        if (self.statusPolling) {
          scheduleStatusPoll(CHANNEL_STATUS_POLL_MS);
        }
      } catch (err) {
        if (isGatewayNotConnectedError(err)) {
          self.statusError = null;
          self.statusLoading = true;
          self.statusRefreshing = false;
          scheduleGatewayRetry();
          return;
        }
        setStatusError(err, true);
        self.statusLoading = false;
        self.statusRefreshing = false;
      }
    });

    const pollChannelStatus = flow(function* (): Generator<Promise<{ snapshot: ChannelsStatusSnapshot | null; error?: string }>, void, { snapshot: ChannelsStatusSnapshot | null; error?: string }> {
      if (!self.statusPolling) return;
      self.statusRefreshing = true;
      try {
        const data = yield fetchJson<{ snapshot: ChannelsStatusSnapshot | null; error?: string }>(
          clientPath(API["channels.status"]) + "?probe=false",
        );
        setStatusSnapshot(data.snapshot);
        self.statusLoading = false;
        self.statusRefreshing = false;
        scheduleStatusPoll(CHANNEL_STATUS_POLL_MS);
      } catch (err) {
        if (isGatewayNotConnectedError(err)) {
          self.statusError = null;
          self.statusLoading = true;
          self.statusRefreshing = false;
          scheduleGatewayRetry();
          return;
        }
        setStatusError(err, false);
        self.statusLoading = false;
        self.statusRefreshing = false;
        scheduleStatusPoll(CHANNEL_STATUS_RETRY_MS);
      }
    });

    const retryChannelStatus = flow(function* (attempt = 0): Generator<Promise<{ snapshot: ChannelsStatusSnapshot | null; error?: string }>, void, { snapshot: ChannelsStatusSnapshot | null; error?: string }> {
      try {
        const data = yield fetchJson<{ snapshot: ChannelsStatusSnapshot | null; error?: string }>(
          clientPath(API["channels.status"]) + "?probe=false",
        );
        setStatusSnapshot(data.snapshot);
        self.statusLoading = false;
      } catch {
        const delays = [1500, 3000, 5000];
        if (attempt < delays.length - 1) {
          retryUntilReady(attempt + 1);
        }
      }
    });

    function retryUntilReady(attempt = 0): void {
      const delays = [1500, 3000, 5000];
      const delay = delays[attempt] ?? delays[delays.length - 1]!;
      setTimeout(() => {
        void retryChannelStatus(attempt);
      }, delay);
    }

    const waitForReadyAndPoll = flow(function* (): Generator<Promise<void>, void, void> {
      cancelReadinessWait();
      self.readinessWait = when(() => runtimeStatusStore.openClawConnector.sidecarState === "ready");
      try {
        yield self.readinessWait;
        self.readinessWait = null;
        if (!self.statusPolling) return;
        void pollChannelStatus();
      } catch {
        self.readinessWait = null;
      }
    });

    return {
      /** Fetch channel status into MST. Fast path uses probe=false; probe=true runs in the background by default. */
      loadChannelStatus,

      /** Retry loading until the gateway is back after a config-triggered restart. */
      retryUntilReady,

      /** Manual refresh action used by page controls. */
      handleRefresh() {
        self.statusRefreshing = true;
        void loadChannelStatus(false);
      },

      /** Start the channel status poller. Safe to call multiple times. */
      startStatusPolling() {
        if (self.statusPolling) return;
        self.statusPolling = true;
        void waitForReadyAndPoll();
      },

      /** Stop the channel status poller. */
      stopStatusPolling() {
        self.statusPolling = false;
        clearStatusPollTimer();
        clearStatusRetryTimer();
        cancelReadinessWait();
      },

      beforeDestroy() {
        clearStatusPollTimer();
        clearStatusRetryTimer();
        cancelReadinessWait();
      },

      /** Create a new channel account. */
      createAccount: flow(function* (data: {
        channelId: string;
        accountId: string;
        name?: string;
        config: Record<string, unknown>;
        secrets?: Record<string, string>;
      }) {
        yield fetchJson(clientPath(API["channels.accounts.create"]), {
          method: "POST",
          body: JSON.stringify(data),
        });
        broadcast();
        void loadChannelStatus(false, { probe: false });
        // Desktop REST -> channelManager.addAccount() -> Desktop MST -> SSE -> Panel auto-updates
      }),

      /** Update an existing channel account. */
      updateAccount: flow(function* (
        channelId: string,
        accountId: string,
        data: { name?: string; config: Record<string, unknown>; secrets?: Record<string, string> },
      ) {
        yield fetchJson(
          clientPath(API["channels.accounts.update"], { channelId, accountId }),
          { method: "PUT", body: JSON.stringify(data) },
        );
        broadcast();
        void loadChannelStatus(false, { probe: false });
      }),

      /** Delete a channel account. */
      deleteAccount: flow(function* (channelId: string, accountId: string) {
        yield fetchJson(
          clientPath(API["channels.accounts.delete"], { channelId, accountId }),
          { method: "DELETE" },
        );
        broadcast();
        void loadChannelStatus(false, { probe: false });
      }),

      /** Get full account config (including secrets) from Desktop SQLite. */
      getAccountConfig: flow(function* (channelId: string, accountId: string) {
        return yield fetchJson(
          clientPath(API["channels.accounts.get"], { channelId, accountId }),
        );
      }),

      /** Refresh pairing requests. Desktop updates account.recipients in MST. */
      getPairingRequests: flow(function* (channelId: string, accountId?: string) {
        const qs = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";
        const data: { requests: PairingRequest[] } = yield fetchJson(
          clientPath(API["pairing.requests"], { channelId }) + qs,
        );
        return data.requests;
      }),

      /** Refresh allowlist. Desktop updates account.recipients in MST. */
      getAllowlist: flow(function* (channelId: string, accountId?: string) {
        const qs = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";
        return yield fetchJson<AllowlistResult>(
          clientPath(API["pairing.allowlist.get"], { channelId }) + qs,
        );
      }),

      /** Approve a pairing request for a channel account. */
      approvePairing: flow(function* (channelId: string, code: string, locale?: string, accountId?: string) {
        return yield fetchJson(clientPath(API["pairing.approve"]), {
          method: "POST",
          body: JSON.stringify({ channelId, accountId, code, locale }),
        });
      }),

      /** Set a recipient alias/label. */
      setRecipientLabel: flow(function* (channelId: string, recipientId: string, label: string, accountId?: string) {
        const qs = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";
        yield fetchJson(clientPath(API["pairing.allowlist.setLabel"], { channelId, recipientId }) + qs, {
          method: "PUT",
          body: JSON.stringify({ label }),
        });
      }),

      /** Set or clear recipient owner role. */
      setRecipientOwner: flow(function* (channelId: string, recipientId: string, isOwner: boolean, accountId?: string) {
        const qs = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";
        yield fetchJson(clientPath(API["pairing.allowlist.setOwner"], { channelId, recipientId }) + qs, {
          method: "PUT",
          body: JSON.stringify({ isOwner }),
        });
      }),

      /** Remove a recipient from the account allowlist. */
      removeFromAllowlist: flow(function* (channelId: string, recipientId: string, accountId?: string) {
        const qs = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";
        yield fetchJson(clientPath(API["pairing.allowlist.remove"], { channelId, recipientId }) + qs, {
          method: "DELETE",
        });
      }),

      /** Broadcast channel change to all listeners (for cross-page coordination). */
      broadcast,

      /** Subscribe to channel changes. Returns cleanup function. */
      onChange(callback: () => void): () => void {
        window.addEventListener(CHANNEL_CHANGED_EVENT, callback);
        return () => window.removeEventListener(CHANNEL_CHANGED_EVENT, callback);
      },
    };
  });
