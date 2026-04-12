import {
  GatewayLauncher,
  resolveVendorEntryPath,
  writeGatewayConfig,
  readExistingConfig,
} from "@rivonclaw/gateway";
import type { Storage } from "@rivonclaw/storage";
import type { SecretStore } from "@rivonclaw/secrets";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createGatewayConfigBuilder } from "../gateway/config-builder.js";
import { createGatewayEventDispatcher } from "../gateway/event-dispatcher.js";
import type { GatewayEventHandler } from "../gateway/event-dispatcher.js";
import { connectGateway, disconnectGateway } from "../gateway/connection.js";
import type { GatewayConnectionDeps } from "../gateway/connection.js";
import { rootStore } from "./store/desktop-store.js";
import { OUR_PLUGIN_IDS } from "../generated/our-plugin-ids.js";
import type { pushChatSSE as PushChatSSEFn } from "./panel-server.js";
import { openClawConnector } from "../openclaw/index.js";

export interface SetupGatewayDeps {
  storage: Storage;
  secretStore: SecretStore;
  locale: string;
  configPath: string;
  stateDir: string;
  extensionsDir: string;
  sttCliPath: string;
  filePermissionsPluginPath: string | undefined;
  vendorDir: string;
  gatewayPort: number;
  deviceId: string;
  pushChatSSE: typeof PushChatSSEFn;
}

export interface GatewayRuntime {
  launcher: GatewayLauncher;
  buildFullGatewayConfig: (port: number) => ReturnType<ReturnType<typeof createGatewayConfigBuilder>["buildFullGatewayConfig"]>;
  gatewayConnectionDeps: GatewayConnectionDeps;
  connectGateway: typeof connectGateway;
  disconnectGateway: typeof disconnectGateway;
}

/**
 * Create the gateway launcher, config builder, and event dispatcher.
 * Writes the initial gateway config and disables mDNS.
 */
export async function setupGateway(deps: SetupGatewayDeps): Promise<GatewayRuntime> {
  const {
    storage, secretStore, locale, configPath, stateDir,
    extensionsDir, sttCliPath, filePermissionsPluginPath, vendorDir,
    gatewayPort, deviceId, pushChatSSE,
  } = deps;

  // Force pre-compiled ESM extensions from dist-runtime/
  const distRuntimeExtensions = join(vendorDir, "dist-runtime", "extensions");
  if (existsSync(distRuntimeExtensions)) {
    process.env.OPENCLAW_BUNDLED_PLUGINS_DIR = distRuntimeExtensions;
  }

  // Build gateway config helpers (closures bound to current settings)
  const { buildFullGatewayConfig } = createGatewayConfigBuilder({
    storage, secretStore, locale, configPath, stateDir, extensionsDir,
    sttCliPath, filePermissionsPluginPath, vendorDir,
    channelPluginEntries: () => rootStore.channelManager.buildPluginEntries(),
    channelConfigAccounts: () => rootStore.channelManager.buildConfigAccounts(),
  });

  writeGatewayConfig(await buildFullGatewayConfig(gatewayPort));

  // Disable mDNS/Bonjour — desktop app manages its own device pairing.
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf-8"));
    if (!raw.discovery) raw.discovery = {};
    if (!raw.discovery.mdns) raw.discovery.mdns = {};
    raw.discovery.mdns.mode = "off";
    writeFileSync(configPath, JSON.stringify(raw, null, 2), "utf-8");
  } catch { /* non-critical */ }

  // Create launcher
  const launcher = new GatewayLauncher({
    entryPath: resolveVendorEntryPath(vendorDir),
    nodeBin: process.execPath,
    env: { ELECTRON_RUN_AS_NODE: "1", OPENCLAW_DISABLE_BONJOUR: "1" },
    configPath,
    stateDir,
  });

  // Create gateway event dispatcher — routes WS events to Panel SSE
  const dispatchGatewayEvent = createGatewayEventDispatcher({
    pushChatSSE,
    chatSessions: storage.chatSessions,
  });

  // Gateway connection deps — passed to connectGateway() on each "ready" event
  const gatewayConnectionDeps = {
    configPath,
    stateDir,
    deviceId,
    gatewayPort,
    storage,
    toolCapability: rootStore.toolCapability,
    ourPluginIds: OUR_PLUGIN_IDS,
    dispatchGatewayEvent,
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
    eventDispatcher: dispatchGatewayEvent,
  });

  // Derive RPC connection deps from the gateway config on disk — same values
  // that connectGateway() computes at call-time.
  const config = readExistingConfig(configPath);
  const gw = config.gateway as Record<string, unknown> | undefined;
  const port = (gw?.port as number) ?? gatewayPort;
  const auth = gw?.auth as Record<string, unknown> | undefined;
  const token = auth?.token as string | undefined;

  openClawConnector.setRpcConnectionDeps({
    url: `ws://127.0.0.1:${port}`,
    token,
    deviceIdentityPath: join(stateDir, "identity", "device.json"),
  });

  return {
    launcher,
    buildFullGatewayConfig,
    gatewayConnectionDeps,
    connectGateway,
    disconnectGateway,
  };
}
