import { app } from "electron";
import { getTelemetryUrl, getCsTelemetryUrl } from "@rivonclaw/core";
import { createLogger } from "@rivonclaw/logger";
import { RemoteTelemetryClient } from "@rivonclaw/telemetry";
import type { Storage } from "@rivonclaw/storage";

const log = createLogger("main");

export interface TelemetryInitResult {
  /**
   * User-opt-in product telemetry client. Gated by `telemetry_enabled` setting
   * (opt-out model: default ON for packaged builds, DEV_TELEMETRY=1 for dev).
   * Null when disabled.
   */
  client: RemoteTelemetryClient | null;
  /**
   * CS business-event telemetry client. Carries `cs.message`,
   * `cs.token_snapshot`, `cs.tool_call` events to the ClickHouse BI stream.
   * Collection is authorized by the paying tenant's contract, so this channel
   * is NOT gated by the end-user `telemetry_enabled` toggle — it is only
   * gated by whether we're running a packaged build (or DEV_TELEMETRY=1 in
   * dev) so unit tests and local debug sessions don't spam staging.
   *
   * Events fire only after a userId is identified via `.identify()` — pre-
   * login events are still queued and flushed once identity is set, because
   * the server needs the `userId` column populated to attribute the row.
   */
  csClient: RemoteTelemetryClient | null;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
}

/**
 * Initialize the telemetry clients and heartbeat timer.
 *
 * Two independent clients:
 *   - `client` — user-opt-in product telemetry (app.started, rule.created, …)
 *   - `csClient` — CS business events (always-on for identified commercial
 *     tenants; see interface doc above for the gate).
 *
 * Both use the same batch/retry/backoff machinery from `RemoteTelemetryClient`,
 * just with different endpoints and `enabled` gates.
 */
export function initTelemetry(
  storage: Storage,
  deviceId: string,
  locale: string,
  fetchFn?: (url: string | URL, init?: RequestInit) => Promise<Response>,
): TelemetryInitResult {
  const telemetryEnabled = !app.isPackaged
    ? process.env.DEV_TELEMETRY === "1"
    : storage.settings.get("telemetry_enabled") !== "false";

  const telemetryEndpoint = process.env.TELEMETRY_ENDPOINT || getTelemetryUrl(locale);

  let client: RemoteTelemetryClient | null = null;

  if (telemetryEnabled) {
    try {
      client = new RemoteTelemetryClient({
        endpoint: telemetryEndpoint,
        enabled: true,
        version: app.getVersion(),
        platform: process.platform,
        locale,
        deviceId,
        fetchFn,
      });
      log.info("Telemetry client initialized (user opted in)");
    } catch (error) {
      log.error("Failed to initialize telemetry client:", error);
    }
  } else {
    log.info("Telemetry disabled (user preference)");
  }

  // ---- CS business-event client ---------
  // Always on (dev + packaged). CS events are authorized by the commercial
  // tenant's contract, not the end-user opt-in toggle, so there is no
  // privacy gate. Dev-machine traffic lands in staging ClickHouse alongside
  // real user events; the data-warehouse filters internal IPs out in
  // Airflow before BI aggregation, so developer noise is priced in.
  //
  // `CS_TELEMETRY_ENDPOINT` env var still overrides the default endpoint
  // when you need to point at a local mock or a staging variant.
  const csTelemetryEndpoint =
    process.env.CS_TELEMETRY_ENDPOINT || getCsTelemetryUrl(locale);

  let csClient: RemoteTelemetryClient | null = null;
  try {
    csClient = new RemoteTelemetryClient({
      endpoint: csTelemetryEndpoint,
      enabled: true,
      version: app.getVersion(),
      platform: process.platform,
      locale,
      deviceId,
      fetchFn,
      // Tuned tighter than product telemetry: CS events are lower volume
      // per user but higher per-event business value, so we flush more
      // aggressively to narrow the dashboard-lag window.
      batchSize: 20,
      flushInterval: 15_000,
    });
    log.info(`CS business telemetry client initialized — endpoint=${csTelemetryEndpoint}`);
  } catch (error) {
    log.error("Failed to initialize CS telemetry client:", error);
  }

  // Track app.started event (product telemetry only — CS stream is business
  // events, not lifecycle).
  client?.track("app.started");

  // Track heartbeat every 5 minutes
  const heartbeatTimer = client
    ? setInterval(() => {
        client?.track("app.heartbeat", {
          uptimeMs: client.getUptime(),
        });
      }, 5 * 60 * 1000)
    : null;

  return { client, csClient, heartbeatTimer };
}
