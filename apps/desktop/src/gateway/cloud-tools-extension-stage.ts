import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const CLOUD_TOOLS_STAGE_MARKER_VERSION = 1;
const CLOUD_TOOLS_STAGE_MARKER_NAME = ".rivonclaw-cloud-tools-stage.json";

type LoggerLike = {
  info(message: string): void;
  warn(message: string, err?: unknown): void;
};

export interface StageMerchantExtensionsParams {
  sourceMerchantExtensionsDir: string;
  stateDir: string;
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
    .filter(
      (path) =>
        existsSync(join(path, "openclaw.plugin.json")) || existsSync(join(path, "package.json")),
    );

  const sourceCloudToolsDir = join(params.sourceMerchantExtensionsDir, "rivonclaw-cloud-tools");
  if (!existsSync(sourceCloudToolsDir)) {
    return staticMerchantExtensionPaths;
  }

  const toolNames = normalizeToolNames(params.toolNames ?? []);

  if (toolNames.length === 0) {
    if (params.toolNames) {
      params.logger?.warn("Cloud tool manifest staging skipped: no backend tool names available");
    }
    return [sourceCloudToolsDir, ...staticMerchantExtensionPaths];
  }

  const runtimeExtensionsDir = join(params.stateDir, "runtime-extensions");
  const stagedCloudToolsDir = join(runtimeExtensionsDir, "rivonclaw-cloud-tools");
  try {
    cleanupOldCloudToolsStages(runtimeExtensionsDir, stagedCloudToolsDir);
    const stageResult = stageCloudToolsPlugin({
      sourceCloudToolsDir,
      stagedCloudToolsDir,
      toolNames,
    });
    params.logger?.info(
      `${stageResult === "reused" ? "Reused staged" : "Staged"} rivonclaw-cloud-tools manifest with ${toolNames.length} cloud tool contract(s)`,
    );
    return [stagedCloudToolsDir, ...staticMerchantExtensionPaths];
  } catch (err) {
    params.logger?.warn(
      "Failed to stage rivonclaw-cloud-tools manifest; falling back to bundled manifest",
      err,
    );
    return [sourceCloudToolsDir, ...staticMerchantExtensionPaths];
  }
}

function stageCloudToolsPlugin(params: {
  sourceCloudToolsDir: string;
  stagedCloudToolsDir: string;
  toolNames: readonly string[];
}): "staged" | "reused" {
  const sourceDistDir = join(params.sourceCloudToolsDir, "dist");
  if (!existsSync(sourceDistDir)) {
    throw new Error(`cloud-tools dist directory not found: ${sourceDistDir}`);
  }

  const manifest = readManifest(join(params.sourceCloudToolsDir, "openclaw.plugin.json"));
  const nextManifest = {
    ...manifest,
    contracts: {
      ...(isRecord(manifest.contracts) ? manifest.contracts : {}),
      tools: [...params.toolNames],
    },
  };
  const manifestJson = `${JSON.stringify(nextManifest, null, 2)}\n`;
  const stageDigest = resolveCloudToolsStageDigest({
    sourceCloudToolsDir: params.sourceCloudToolsDir,
    manifestJson,
  });
  const runtimeExtensionsDir = join(params.stagedCloudToolsDir, "..");
  const markerPath = join(runtimeExtensionsDir, CLOUD_TOOLS_STAGE_MARKER_NAME);

  if (
    canReuseCloudToolsStage({
      sourceCloudToolsDir: params.sourceCloudToolsDir,
      stagedCloudToolsDir: params.stagedCloudToolsDir,
      markerPath,
      expectedDigest: stageDigest,
      manifestJson,
    })
  ) {
    writeCloudToolsStageMarker(markerPath, stageDigest);
    return "reused";
  }

  rmSync(markerPath, { force: true });
  rmSync(params.stagedCloudToolsDir, { force: true, recursive: true });
  mkdirSync(params.stagedCloudToolsDir, { recursive: true });
  cpSync(
    join(params.sourceCloudToolsDir, "package.json"),
    join(params.stagedCloudToolsDir, "package.json"),
  );
  cpSync(sourceDistDir, join(params.stagedCloudToolsDir, "dist"), { recursive: true });
  writeFileSync(join(params.stagedCloudToolsDir, "openclaw.plugin.json"), manifestJson, "utf-8");
  writeFileSync(
    join(params.stagedCloudToolsDir, "dist", "openclaw.plugin.json"),
    manifestJson,
    "utf-8",
  );
  writeCloudToolsStageMarker(markerPath, stageDigest);
  return "staged";
}

function canReuseCloudToolsStage(params: {
  sourceCloudToolsDir: string;
  stagedCloudToolsDir: string;
  markerPath: string;
  expectedDigest: string;
  manifestJson: string;
}): boolean {
  if (
    !existsSync(join(params.stagedCloudToolsDir, "package.json")) ||
    !existsSync(join(params.stagedCloudToolsDir, "openclaw.plugin.json")) ||
    !existsSync(join(params.stagedCloudToolsDir, "dist")) ||
    !existsSync(join(params.stagedCloudToolsDir, "dist", "openclaw.plugin.json"))
  ) {
    return false;
  }

  if (existsSync(params.markerPath)) {
    try {
      const marker = JSON.parse(readFileSync(params.markerPath, "utf-8")) as {
        version?: unknown;
        digest?: unknown;
      };
      if (
        marker.version === CLOUD_TOOLS_STAGE_MARKER_VERSION &&
        marker.digest === params.expectedDigest
      ) {
        return true;
      }
    } catch {
      // Fall through to content verification so old or damaged markers self-heal.
    }
  }

  return cloudToolsStageContentsMatch(params);
}

function cloudToolsStageContentsMatch(params: {
  sourceCloudToolsDir: string;
  stagedCloudToolsDir: string;
  manifestJson: string;
}): boolean {
  try {
    if (
      !readFileSync(join(params.sourceCloudToolsDir, "package.json")).equals(
        readFileSync(join(params.stagedCloudToolsDir, "package.json")),
      ) ||
      readFileSync(join(params.stagedCloudToolsDir, "openclaw.plugin.json"), "utf-8") !==
        params.manifestJson
    ) {
      return false;
    }
    return directoriesMatch(
      join(params.sourceCloudToolsDir, "dist"),
      join(params.stagedCloudToolsDir, "dist"),
      params.manifestJson,
    );
  } catch {
    return false;
  }
}

function directoriesMatch(sourceDir: string, stagedDir: string, manifestJson: string): boolean {
  const sourceEntries = readdirSync(sourceDir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const stagedEntries = readdirSync(stagedDir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  if (
    sourceEntries.length !== stagedEntries.length ||
    sourceEntries.some((entry, index) => entry.name !== stagedEntries[index]?.name)
  ) {
    return false;
  }

  for (const sourceEntry of sourceEntries) {
    const stagedEntry = stagedEntries.find((entry) => entry.name === sourceEntry.name);
    if (!stagedEntry || sourceEntry.isDirectory() !== stagedEntry.isDirectory()) {
      return false;
    }
    const sourcePath = join(sourceDir, sourceEntry.name);
    const stagedPath = join(stagedDir, sourceEntry.name);
    if (sourceEntry.isDirectory()) {
      if (!directoriesMatch(sourcePath, stagedPath, manifestJson)) return false;
    } else if (sourceEntry.isFile() && stagedEntry.isFile()) {
      const expected =
        sourceEntry.name === "openclaw.plugin.json"
          ? Buffer.from(manifestJson, "utf-8")
          : readFileSync(sourcePath);
      if (!expected.equals(readFileSync(stagedPath))) return false;
    } else {
      return false;
    }
  }
  return true;
}

function writeCloudToolsStageMarker(markerPath: string, digest: string): void {
  writeFileSync(
    markerPath,
    `${JSON.stringify({ version: CLOUD_TOOLS_STAGE_MARKER_VERSION, digest })}\n`,
    "utf-8",
  );
}

function resolveCloudToolsStageDigest(params: {
  sourceCloudToolsDir: string;
  manifestJson: string;
}): string {
  const hash = createHash("sha256");
  hash.update(`rivonclaw-cloud-tools-stage-v${CLOUD_TOOLS_STAGE_MARKER_VERSION}\0`);
  hash.update(params.manifestJson);
  hashFile(hash, join(params.sourceCloudToolsDir, "package.json"), "package.json");
  hashDirectory(hash, join(params.sourceCloudToolsDir, "dist"), "dist");
  return hash.digest("hex");
}

function hashDirectory(
  hash: ReturnType<typeof createHash>,
  directory: string,
  relativePath: string,
): void {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const fullPath = join(directory, entry.name);
    const childRelativePath = `${relativePath}/${entry.name}`;
    if (entry.isDirectory()) {
      hash.update(`directory\0${childRelativePath}\0`);
      hashDirectory(hash, fullPath, childRelativePath);
    } else if (entry.isFile()) {
      hashFile(hash, fullPath, childRelativePath);
    } else {
      throw new Error(`unsupported cloud-tools stage entry: ${fullPath}`);
    }
  }
}

function hashFile(
  hash: ReturnType<typeof createHash>,
  filePath: string,
  relativePath: string,
): void {
  hash.update(`file\0${relativePath}\0`);
  hash.update(readFileSync(filePath));
  hash.update("\0");
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

function cleanupOldCloudToolsStages(runtimeExtensionsDir: string, keepDir: string): void {
  if (!existsSync(runtimeExtensionsDir)) return;
  for (const entry of readdirSync(runtimeExtensionsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "rivonclaw-cloud-tools" || !entry.name.startsWith("rivonclaw-cloud-tools-"))
      continue;
    const fullPath = join(runtimeExtensionsDir, entry.name);
    if (fullPath === keepDir) continue;
    rmSync(fullPath, { force: true, recursive: true });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
