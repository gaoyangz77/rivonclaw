type RegistryLogger = {
  warn?: (message: string) => void;
};

type ChannelPlugin = {
  id?: string;
  outbound?: {
    sendText?: unknown;
    sendMedia?: unknown;
    sendPayload?: unknown;
  };
};

type ChannelEntry = {
  pluginId?: string;
  plugin?: ChannelPlugin;
};

type PluginRegistryLike = {
  channels?: ChannelEntry[];
};

type PluginRegistryStateLike = {
  activeRegistry?: PluginRegistryLike | null;
  activeVersion?: number;
  channel?: {
    registry?: PluginRegistryLike | null;
    version?: number;
  };
};

const PLUGIN_REGISTRY_STATE = Symbol.for("openclaw.pluginRegistryState");

let lastHealthyChannelRegistry: PluginRegistryLike | null = null;
let guardTimer: ReturnType<typeof setInterval> | null = null;

function getRegistryState(): PluginRegistryStateLike | undefined {
  return (globalThis as typeof globalThis & {
    [PLUGIN_REGISTRY_STATE]?: PluginRegistryStateLike;
  })[PLUGIN_REGISTRY_STATE];
}

function getCurrentChannelRegistry(
  state: PluginRegistryStateLike | undefined,
): PluginRegistryLike | null {
  return state?.channel?.registry ?? state?.activeRegistry ?? null;
}

function getChannelId(entry: ChannelEntry): string | null {
  const id = entry.plugin?.id ?? entry.pluginId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function hasOutboundAdapter(entry: ChannelEntry): boolean {
  const outbound = entry.plugin?.outbound;
  return Boolean(outbound?.sendText || outbound?.sendMedia || outbound?.sendPayload);
}

function channelEntries(registry: PluginRegistryLike | null | undefined): ChannelEntry[] {
  return Array.isArray(registry?.channels) ? registry.channels : [];
}

function collectOutboundChannelIds(registry: PluginRegistryLike | null | undefined): Set<string> {
  const ids = new Set<string>();
  for (const entry of channelEntries(registry)) {
    const id = getChannelId(entry);
    if (id && hasOutboundAdapter(entry)) {
      ids.add(id);
    }
  }
  return ids;
}

function indexChannelsById(
  registry: PluginRegistryLike | null | undefined,
): Map<string, ChannelEntry> {
  const indexed = new Map<string, ChannelEntry>();
  for (const entry of channelEntries(registry)) {
    const id = getChannelId(entry);
    if (id) {
      indexed.set(id, entry);
    }
  }
  return indexed;
}

export function rememberHealthyOpenClawChannelRegistry(): void {
  const state = getRegistryState();
  const registry = getCurrentChannelRegistry(state);
  if (collectOutboundChannelIds(registry).size > 0) {
    lastHealthyChannelRegistry = registry;
  }
}

export function restoreOpenClawChannelRegistryIfPolluted(
  reason: string,
  logger?: RegistryLogger,
): boolean {
  const state = getRegistryState();
  const current = getCurrentChannelRegistry(state);
  const healthy = lastHealthyChannelRegistry;

  if (!state || !healthy || !current || current === healthy) {
    rememberHealthyOpenClawChannelRegistry();
    return false;
  }

  const healthyOutboundIds = collectOutboundChannelIds(healthy);
  if (healthyOutboundIds.size === 0) {
    return false;
  }

  const currentById = indexChannelsById(current);
  const pollutedIds = Array.from(healthyOutboundIds).filter((id) => {
    const currentEntry = currentById.get(id);
    return Boolean(currentEntry && !hasOutboundAdapter(currentEntry));
  });

  if (pollutedIds.length === 0) {
    rememberHealthyOpenClawChannelRegistry();
    return false;
  }

  state.channel ??= {};
  state.channel.registry = healthy;
  state.channel.version = (state.channel.version ?? state.activeVersion ?? 0) + 1;
  logger?.warn?.(
    `Restored OpenClaw channel registry after ${reason}; missing outbound adapters: ${pollutedIds.join(",")}`,
  );
  return true;
}

export function installOpenClawChannelRegistryGuard(logger?: RegistryLogger): void {
  rememberHealthyOpenClawChannelRegistry();
  if (guardTimer) return;

  guardTimer = setInterval(() => {
    restoreOpenClawChannelRegistryIfPolluted("periodic registry guard", logger);
  }, 5_000);
  guardTimer.unref?.();
}

export function resetOpenClawChannelRegistryGuardForTest(): void {
  lastHealthyChannelRegistry = null;
  if (guardTimer) {
    clearInterval(guardTimer);
    guardTimer = null;
  }
}
