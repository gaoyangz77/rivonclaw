import { createHash } from "node:crypto";
import { createLogger } from "@rivonclaw/logger";
import { TOOL_SPECS_SYNC_QUERY } from "./init-queries.js";

const log = createLogger("tool-specs-sync");

const TOOL_SPECS_CACHE_TTL_MS = 5_000;

export type SyncedToolSpec = Record<string, unknown> & { name: string };

export type ToolSpecSnapshot = {
  data: { toolSpecs: SyncedToolSpec[] };
  digest: string;
  toolNameDigest: string;
  syncedAt: number;
};

type ToolSpecsAuthSession = {
  getAccessToken(): string | null | undefined;
  graphqlFetch(query: string): Promise<Record<string, unknown>>;
};

type ToolSpecsRootStore = {
  ingestGraphQLResponse(data: Record<string, unknown>): void;
};

let toolSpecsCache: ToolSpecSnapshot | null = null;
let toolSpecsInflight: Promise<ToolSpecSnapshot> | null = null;

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function computeToolSpecsDigest(specs: readonly unknown[]): string {
  return sha256(specs);
}

export function computeToolNameDigest(specs: readonly Record<string, unknown>[]): string {
  return sha256(specs.map((spec) => spec.name).filter((name): name is string => typeof name === "string").sort());
}

function normalizeToolSpecs(value: unknown): SyncedToolSpec[] {
  if (!Array.isArray(value)) {
    throw new Error("ToolSpecsSync returned a non-array toolSpecs payload");
  }
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`ToolSpecsSync returned an invalid ToolSpec at index ${index}`);
    }
    const spec = item as Record<string, unknown>;
    if (typeof spec.name !== "string" || spec.name.trim() === "") {
      throw new Error(`ToolSpecsSync returned a ToolSpec without a valid name at index ${index}`);
    }
    return spec as SyncedToolSpec;
  });
}

function buildSnapshot(data: Record<string, unknown>): ToolSpecSnapshot {
  const toolSpecs = normalizeToolSpecs(data.toolSpecs);
  return {
    data: { toolSpecs },
    digest: computeToolSpecsDigest(toolSpecs),
    toolNameDigest: computeToolNameDigest(toolSpecs),
    syncedAt: Date.now(),
  };
}

export function invalidateToolSpecsCache(): void {
  toolSpecsCache = null;
  toolSpecsInflight = null;
}

export function getCachedToolSpecsSnapshot(): ToolSpecSnapshot | null {
  return toolSpecsCache;
}

export async function syncDesktopToolSpecs(params: {
  authSession: ToolSpecsAuthSession;
  rootStore?: ToolSpecsRootStore;
  force?: boolean;
  ingest?: boolean;
  source?: string;
}): Promise<ToolSpecSnapshot> {
  if (!params.authSession.getAccessToken()) {
    throw new Error("Cannot sync ToolSpecs without an authenticated session");
  }

  if (!params.force && toolSpecsCache && Date.now() - toolSpecsCache.syncedAt < TOOL_SPECS_CACHE_TTL_MS) {
    if (params.ingest !== false) params.rootStore?.ingestGraphQLResponse(toolSpecsCache.data);
    return toolSpecsCache;
  }

  if (!params.force && toolSpecsInflight) {
    const snapshot = await toolSpecsInflight;
    if (params.ingest !== false) params.rootStore?.ingestGraphQLResponse(snapshot.data);
    return snapshot;
  }

  toolSpecsInflight = (async () => {
    const data = await params.authSession.graphqlFetch(TOOL_SPECS_SYNC_QUERY);
    const snapshot = buildSnapshot(data);
    toolSpecsCache = snapshot;
    log.info(
      `Synced ${snapshot.data.toolSpecs.length} ToolSpec(s) from backend`
        + ` source=${params.source ?? "unknown"} digest=${snapshot.digest.slice(0, 12)}`,
    );
    return snapshot;
  })();

  try {
    const snapshot = await toolSpecsInflight;
    if (params.ingest !== false) params.rootStore?.ingestGraphQLResponse(snapshot.data);
    return snapshot;
  } finally {
    toolSpecsInflight = null;
  }
}
