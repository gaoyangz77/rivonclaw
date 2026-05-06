import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TOOL_SPECS_SYNC_QUERY } from "../cloud/init-queries.js";

type ToolSpecLike = {
  name?: unknown;
};

type AuthSessionLike = {
  getAccessToken(): string | null | undefined;
  graphqlFetch<T = unknown>(query: string): Promise<T>;
};

type LoggerLike = {
  info(message: string): void;
  warn(message: string, err?: unknown): void;
};

export interface StageMerchantExtensionsParams {
  sourceMerchantExtensionsDir: string;
  stateDir: string;
  authSession?: AuthSessionLike;
  toolNames?: readonly string[];
  logger?: LoggerLike;
}

export async function stageMerchantExtensionsForCloudTools(
  params: StageMerchantExtensionsParams,
): Promise<string[]> {
  if (!existsSync(params.sourceMerchantExtensionsDir)) {
    return [];
  }

  const entries = readdirSync(params.sourceMerchantExtensionsDir, { withFileTypes: true });
  const staticMerchantExtensionPaths = entries
    .filter((entry) => entry.isDirectory() && entry.name !== "rivonclaw-cloud-tools")
    .map((entry) => join(params.sourceMerchantExtensionsDir, entry.name))
    .filter((path) => existsSync(join(path, "openclaw.plugin.json")) || existsSync(join(path, "package.json")));

  const sourceCloudToolsDir = join(params.sourceMerchantExtensionsDir, "rivonclaw-cloud-tools");
  if (!existsSync(sourceCloudToolsDir)) {
    return staticMerchantExtensionPaths;
  }

  const toolNames = params.toolNames
    ? normalizeToolNames(params.toolNames)
    : await fetchCloudToolNames(params.authSession, params.logger);

  if (toolNames.length === 0) {
    if (params.toolNames || params.authSession?.getAccessToken()) {
      params.logger?.warn("Cloud tool manifest staging skipped: no backend tool names available");
    }
    return [sourceCloudToolsDir, ...staticMerchantExtensionPaths];
  }

  const stagedCloudToolsDir = join(params.stateDir, "runtime-extensions", "rivonclaw-cloud-tools");
  try {
    stageCloudToolsPlugin({
      sourceCloudToolsDir,
      stagedCloudToolsDir,
      toolNames,
    });
    params.logger?.info(`Staged rivonclaw-cloud-tools manifest with ${toolNames.length} cloud tool contract(s)`);
    return [stagedCloudToolsDir, ...staticMerchantExtensionPaths];
  } catch (err) {
    params.logger?.warn("Failed to stage rivonclaw-cloud-tools manifest; falling back to bundled manifest", err);
    return [sourceCloudToolsDir, ...staticMerchantExtensionPaths];
  }
}

async function fetchCloudToolNames(
  authSession: AuthSessionLike | undefined,
  logger: LoggerLike | undefined,
): Promise<string[]> {
  if (!authSession?.getAccessToken()) {
    return [];
  }

  try {
    const data = await authSession.graphqlFetch<{ toolSpecs?: ToolSpecLike[] }>(TOOL_SPECS_SYNC_QUERY);
    return normalizeToolNames((data.toolSpecs ?? []).map((tool) => tool.name));
  } catch (err) {
    logger?.warn("Failed to fetch backend tool specs for cloud-tools manifest staging", err);
    return [];
  }
}

function stageCloudToolsPlugin(params: {
  sourceCloudToolsDir: string;
  stagedCloudToolsDir: string;
  toolNames: readonly string[];
}): void {
  const sourceDistDir = join(params.sourceCloudToolsDir, "dist");
  if (!existsSync(sourceDistDir)) {
    throw new Error(`cloud-tools dist directory not found: ${sourceDistDir}`);
  }

  rmSync(params.stagedCloudToolsDir, { force: true, recursive: true });
  mkdirSync(params.stagedCloudToolsDir, { recursive: true });
  cpSync(join(params.sourceCloudToolsDir, "package.json"), join(params.stagedCloudToolsDir, "package.json"));
  cpSync(sourceDistDir, join(params.stagedCloudToolsDir, "dist"), { recursive: true });

  const manifest = readManifest(join(params.sourceCloudToolsDir, "openclaw.plugin.json"));
  const nextManifest = {
    ...manifest,
    contracts: {
      ...(isRecord(manifest.contracts) ? manifest.contracts : {}),
      tools: [...params.toolNames],
    },
  };

  const manifestJson = `${JSON.stringify(nextManifest, null, 2)}\n`;
  writeFileSync(join(params.stagedCloudToolsDir, "openclaw.plugin.json"), manifestJson, "utf-8");
  writeFileSync(join(params.stagedCloudToolsDir, "dist", "openclaw.plugin.json"), manifestJson, "utf-8");
}

function readManifest(path: string): Record<string, unknown> {
  const parsed = JSON.parse(readFileSync(path, "utf-8"));
  if (!isRecord(parsed)) {
    throw new Error(`plugin manifest is not an object: ${path}`);
  }
  return parsed;
}

function normalizeToolNames(names: readonly unknown[]): string[] {
  return Array.from(
    new Set(
      names
        .filter((name): name is string => typeof name === "string")
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ).sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
