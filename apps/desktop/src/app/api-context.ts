import type { Storage } from "@rivonclaw/storage";
import type { SecretStore } from "@rivonclaw/secrets";
import type { UsageSnapshotEngine } from "../usage/usage-snapshot-engine.js";
import type { UsageQueryService } from "../usage/usage-query-service.js";
import type { AuthSessionManager } from "../auth/session.js";
import type { CloudClient } from "../cloud/cloud-client.js";
import type { ChannelManagerInstance } from "../channels/channel-manager.js";
import type { DesktopGoogleAuthCoordinator } from "../auth/google-oauth.js";
import type { DesktopBrowserLoginCoordinator } from "../auth/browser-login.js";

export interface ApiContext {
  storage: Storage;
  secretStore: SecretStore;
  proxyRouterPort: number;
  gatewayPort: number;
  onProviderChange?: (hint?: { configOnly?: boolean; keyOnly?: boolean }) => void;
  onOpenFileDialog?: () => Promise<string | null>;
  sttManager?: {
    transcribe(audio: Buffer, format: string): Promise<string | null>;
    isEnabled(): boolean;
    getProvider(): string | null;
  };
  onSttChange?: () => void;
  onExtrasChange?: () => void;
  onAuthChange?: (action?: string) => Promise<void>;
  onCloudLlmEntitlementAvailable?: () => Promise<void>;
  onToolSelectionChange?: (effectiveToolIds: string[]) => void;
  onBrowserChange?: () => void;
  onAutoLaunchChange?: (enabled: boolean) => void;
  onChannelConfigured?: (channelId: string) => void;
  onTelemetryTrack?: (eventType: string, metadata?: Record<string, unknown>) => void;
  /**
   * Emit a Customer Service business-telemetry event. Routed through a
   * separate always-on `RemoteTelemetryClient` that ships to the CS BI
   * ClickHouse stream — bypasses the `telemetry_enabled` user opt-in.
   * No-op if the CS telemetry client is not initialized (dev without
   * `DEV_TELEMETRY=1`, init failure).
   */
  onCsTelemetryTrack?: (eventType: string, metadata?: Record<string, unknown>) => void;
  vendorDir: string;
  /** Node.js binary path — Electron's process.execPath with ELECTRON_RUN_AS_NODE=1 */
  nodeBin: string;
  deviceId?: string;
  getUpdateResult?: () => {
    updateAvailable: boolean;
    currentVersion: string;
    latestVersion?: string;
    downloadUrl?: string | null;
  } | null;
  getGatewayInfo?: () => { wsUrl: string; token?: string };
  getPanelUrl?: () => string;
  snapshotEngine?: UsageSnapshotEngine;
  queryService?: UsageQueryService;
  authSession?: AuthSessionManager;
  googleAuthCoordinator?: DesktopGoogleAuthCoordinator;
  browserLoginCoordinator?: DesktopBrowserLoginCoordinator;
  openExternal?: (url: string) => Promise<unknown>;
  cloudClient?: CloudClient;
  channelManager?: ChannelManagerInstance;
  desktopApiToken?: string;
}
