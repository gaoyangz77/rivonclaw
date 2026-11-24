import {
  GatewayLauncher,
  resolveVendorEntryPath,
  writeGatewayConfig,
  readExistingConfig,
  resolveGatewayRpcClientIdentityPath,
} from "@rivonclaw/gateway";
import type { Storage } from "@rivonclaw/storage";
import type { SecretStore } from "@rivonclaw/secrets";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createGatewayConfigBuilder } from "../gateway/config-builder.js";
import { createGatewayEventDispatcher } from "../gateway/event-dispatcher.js";
import { startIdleMonitor } from "../scene/idle-monitor.js";
import { startSceneService } from "../scene/scene-service.js";
import type { GatewayEventHandler } from "../gateway/event-dispatcher.js";
import { getCsBridge } from "../gateway/connection.js";
import { rootStore } from "./store/desktop-store.js";
import { setIdleMonitor, setSceneService, type BroadcastEvent } from "./panel-server.js";
import { openClawConnector } from "../openclaw/index.js";
import { ensurePackagedOpenClawRuntimeDepsStage } from "./openclaw-runtime-deps-stage.js";

export interface SetupGatewayDeps {
  storage: Storage;
  secretStore: SecretStore;
  locale: string;
  configPath: string;
  stateDir: string;
  extensionsDir: string;
  sttCliPath: string;
  deviceId?: string;
  vendorDir: string;
  merchantExtensionPaths?: () => string[];
  openAICodexCompatibilityBaseUrl?: string;
  gatewayPort: number;
  /** Broadcast an event to every Panel SSE client (routed through the unified `/api/events` bus). */
  broadcastEvent: BroadcastEvent;
}

export interface GatewayRuntime {
  launcher: GatewayLauncher;
  buildFullGatewayConfig: (
    port: number,
  ) => ReturnType<ReturnType<typeof createGatewayConfigBuilder>["buildFullGatewayConfig"]>;
}

/**
 * Create the gateway launcher, config builder, and event dispatcher.
 * Writes the initial gateway config.
 */
export async function setupGateway(deps: SetupGatewayDeps): Promise<GatewayRuntime> {
  const {
    storage,
    secretStore,
    locale,
    configPath,
    stateDir,
    extensionsDir,
    sttCliPath,
    deviceId,
    vendorDir,
    merchantExtensionPaths,
    openAICodexCompatibilityBaseUrl,
    gatewayPort,
    broadcastEvent,
  } = deps;

  // Force pre-compiled ESM extensions from dist-runtime/
  const distRuntimeExtensions = join(vendorDir, "dist-runtime", "extensions");
  if (existsSync(distRuntimeExtensions)) {
    process.env.OPENCLAW_BUNDLED_PLUGINS_DIR = distRuntimeExtensions;
  }
  ensurePackagedOpenClawRuntimeDepsStage({ vendorDir, stateDir });

  // Build gateway config helpers (closures bound to current settings)
  const { buildFullGatewayConfig } = createGatewayConfigBuilder({
    storage,
    secretStore,
    locale,
    configPath,
    stateDir,
    extensionsDir,
    sttCliPath,
    deviceId,
    vendorDir,
    merchantExtensionPaths,
    openAICodexCompatibilityBaseUrl,
    channelPluginEntries: () => rootStore.channelManager.buildPluginEntries(),
    channelConfigAccounts: () => rootStore.channelManager.buildConfigAccounts(),
  });

  // The unattended exec policy is carried by tools.exec in openclaw.json
  // (security=full, ask=off), which writeGatewayConfig writes on every pass.
  // A host-local exec-approvals.json is NOT written: OpenClaw retired that
  // store in favour of SQLite, and its mere presence now hard-blocks every run
  // with ExecApprovalsMigrationRequiredError.
  writeGatewayConfig(await buildFullGatewayConfig(gatewayPort));

  // Create launcher
  const launcher = new GatewayLauncher({
    entryPath: resolveVendorEntryPath(vendorDir),
    nodeBin: process.execPath,
    env: { ELECTRON_RUN_AS_NODE: "1", OPENCLAW_DISABLE_BONJOUR: "1" },
    configPath,
    stateDir,
    gatewayPort,
  });

  // Office scene projection — turns department run activity into scene frames.
  // Independent of the CS and affiliate dispatch paths: it only reads their
  // event stream and their configured concurrency, so it cannot affect either.
  const sceneService = startSceneService({ broadcastEvent });
  setSceneService(sceneService);

  // Away-from-keyboard detection for the office screensaver. Lives beside the
  // scene because it feeds the same surface; it broadcasts only on transitions,
  // so an unattended machine costs one timer and nothing on the wire.
  const idleMonitor = startIdleMonitor({
    onChange: (state) => broadcastEvent("idle-snapshot", state),
  });
  setIdleMonitor(idleMonitor);

  // Create gateway event dispatcher — routes WS events to Panel SSE
  const dispatchGatewayEvent = createGatewayEventDispatcher({
    broadcastEvent,
    onSceneEvent: (event) => sceneService.handleEvent(event),
    chatSessions: storage.chatSessions,
    onRecipientSeen: ({ channelId, accountId, recipientId }) => {
      return rootStore.channelManager.recordRecipientSeen({ channelId, accountId, recipientId });
    },
    onSessionActivity: (sessionKey) => {
      rootStore.llmManager.trackSessionActivity(sessionKey);
    },
  });
  const handleGatewayEvent: GatewayEventHandler = (evt) => {
    // CS bridge still needs the raw gateway stream for per-turn forwarding.
    getCsBridge()?.onGatewayEvent(evt);
    dispatchGatewayEvent(evt);
  };

  // ── Wire OpenClawConnector ──────────────────────────────────────────────
  // The connector manages launcher lifecycle events and RPC connections.
  // Business logic registers callbacks via onRpcConnected() in main.ts.

  openClawConnector.initLauncher(launcher);

  openClawConnector.initDeps({
    writeConfig: () => {
      // writeConfig is synchronous in the connector interface (returns config path).
      // buildFullGatewayConfig is async, but the initial config was already written
      // above. This closure is a best-effort sync bridge — callers that need fresh
      // async config writes should use buildConfig + writeGatewayConfig directly.
      return configPath;
    },
    buildConfig: () => buildFullGatewayConfig(gatewayPort),
    buildEnv: async () => ({}), // Env is managed externally via launcher.setEnv()
    eventDispatcher: handleGatewayEvent,
  });

  // Derive RPC connection deps from the gateway config on disk.
  const config = readExistingConfig(configPath);
  const gw = config.gateway as Record<string, unknown> | undefined;
  const port = (gw?.port as number) ?? gatewayPort;
  const auth = gw?.auth as Record<string, unknown> | undefined;
  const token = auth?.token as string | undefined;

  openClawConnector.setRpcConnectionDeps({
    url: `ws://127.0.0.1:${port}`,
    token,
    deviceIdentityPath: resolveGatewayRpcClientIdentityPath(stateDir),
  });

  return {
    launcher,
    buildFullGatewayConfig,
  };
}
