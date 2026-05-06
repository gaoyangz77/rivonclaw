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
  channel?: {
    registry?: PluginRegistryLike | null;
    pinned?: boolean;
  };
};

export type OpenClawChannelRegistryIssue = {
  channelId: string;
  reason:
    | "ACTIVE_HAS_OUTBOUND_CHANNEL_MISSING_OUTBOUND"
    | "REQUIRED_CHANNEL_MISSING_OUTBOUND";
};

export type OpenClawChannelRegistryInspection = {
  pinned: boolean;
  channelIds: string[];
  outboundChannelIds: string[];
  issues: OpenClawChannelRegistryIssue[];
};

const PLUGIN_REGISTRY_STATE = Symbol.for("openclaw.pluginRegistryState");
const DEFAULT_REQUIRED_OUTBOUND_CHANNELS = ["openclaw-weixin", "telegram"];

function getRegistryState(): PluginRegistryStateLike | undefined {
  return (globalThis as typeof globalThis & {
    [PLUGIN_REGISTRY_STATE]?: PluginRegistryStateLike;
  })[PLUGIN_REGISTRY_STATE];
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

function formatIssues(issues: OpenClawChannelRegistryIssue[]): string {
  return issues.map((issue) => `${issue.channelId}:${issue.reason}`).join(",");
}

export function inspectOpenClawChannelRegistry(
  requiredOutboundChannelIds: string[] = DEFAULT_REQUIRED_OUTBOUND_CHANNELS,
): OpenClawChannelRegistryInspection {
  const state = getRegistryState();
  const activeRegistry = state?.activeRegistry ?? null;
  const channelRegistry = state?.channel?.registry ?? activeRegistry;
  const channelById = indexChannelsById(channelRegistry);
  const activeById = indexChannelsById(activeRegistry);
  const issues = new Map<string, OpenClawChannelRegistryIssue>();

  for (const [channelId, activeEntry] of activeById) {
    const channelEntry = channelById.get(channelId);
    if (channelEntry && hasOutboundAdapter(activeEntry) && !hasOutboundAdapter(channelEntry)) {
      issues.set(channelId, {
        channelId,
        reason: "ACTIVE_HAS_OUTBOUND_CHANNEL_MISSING_OUTBOUND",
      });
    }
  }

  for (const channelId of requiredOutboundChannelIds) {
    const channelEntry = channelById.get(channelId);
    if (channelEntry && !hasOutboundAdapter(channelEntry)) {
      issues.set(channelId, {
        channelId,
        reason: "REQUIRED_CHANNEL_MISSING_OUTBOUND",
      });
    }
  }

  return {
    pinned: Boolean(state?.channel?.pinned),
    channelIds: Array.from(channelById.keys()).sort(),
    outboundChannelIds: Array.from(channelById)
      .filter(([, entry]) => hasOutboundAdapter(entry))
      .map(([channelId]) => channelId)
      .sort(),
    issues: Array.from(issues.values()).sort((left, right) =>
      left.channelId.localeCompare(right.channelId),
    ),
  };
}

export function warnIfOpenClawChannelRegistryInvalid(
  reason: string,
  logger?: RegistryLogger,
  requiredOutboundChannelIds?: string[],
): boolean {
  const inspection = inspectOpenClawChannelRegistry(requiredOutboundChannelIds);
  if (inspection.issues.length === 0) {
    return false;
  }

  logger?.warn?.(
    `OpenClaw channel registry has missing outbound adapters after ${reason}; issues=${formatIssues(inspection.issues)} pinned=${inspection.pinned} channels=${inspection.channelIds.join(",")} outbound=${inspection.outboundChannelIds.join(",")}`,
  );
  return true;
}

export function assertOpenClawChannelRegistryValid(
  requiredOutboundChannelIds?: string[],
): void {
  const inspection = inspectOpenClawChannelRegistry(requiredOutboundChannelIds);
  if (inspection.issues.length === 0) {
    return;
  }

  throw new Error(
    `OpenClaw channel registry is missing outbound adapters: ${formatIssues(inspection.issues)}`,
  );
}
