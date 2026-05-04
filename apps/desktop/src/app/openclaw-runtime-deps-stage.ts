import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createLogger } from "@rivonclaw/logger";

const log = createLogger("gateway:runtime-deps");

function sanitizePathSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function createPathHash(value: string): string {
  return createHash("sha256").update(resolve(value)).digest("hex").slice(0, 12);
}

function readPackageVersion(packageRoot: string): string {
  try {
    const raw = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf-8")) as {
      version?: unknown;
    };
    return typeof raw.version === "string" && raw.version.trim()
      ? raw.version.trim()
      : "unknown";
  } catch {
    return "unknown";
  }
}

function bundledRuntimeDepsRoot(vendorDir: string, stateDir: string): string {
  const packageKey = `openclaw-${sanitizePathSegment(readPackageVersion(vendorDir))}-${createPathHash(vendorDir)}`;
  return join(stateDir, "plugin-runtime-deps", packageKey);
}

function hasUsefulRuntimeDeps(nodeModulesDir: string): boolean {
  return (
    existsSync(join(nodeModulesDir, "grammy", "package.json")) ||
    existsSync(join(nodeModulesDir, "express", "package.json")) ||
    existsSync(join(nodeModulesDir, "@modelcontextprotocol", "sdk", "package.json"))
  );
}

/**
 * OpenClaw treats packaged bundled plugins as external runtime-deps installs.
 * RivonClaw already ships vendor/openclaw/node_modules, but OpenClaw's packaged
 * plugin search roots do not include that package root. Bridge the two by
 * creating the expected external stage root and pointing its node_modules at
 * the packaged vendor node_modules tree.
 */
export function ensurePackagedOpenClawRuntimeDepsStage(params: {
  vendorDir: string;
  stateDir: string;
}): void {
  const vendorDir = resolve(params.vendorDir);
  const stateDir = resolve(params.stateDir);

  if (existsSync(join(vendorDir, ".git"))) {
    return;
  }

  const vendorNodeModules = join(vendorDir, "node_modules");
  if (!hasUsefulRuntimeDeps(vendorNodeModules)) {
    return;
  }

  const stageRoot = bundledRuntimeDepsRoot(vendorDir, stateDir);
  const stageNodeModules = join(stageRoot, "node_modules");
  if (hasUsefulRuntimeDeps(stageNodeModules)) {
    return;
  }

  try {
    mkdirSync(stageRoot, { recursive: true });
    rmSync(stageNodeModules, { recursive: true, force: true });
    symlinkSync(vendorNodeModules, stageNodeModules, process.platform === "win32" ? "junction" : "dir");
    writeFileSync(
      join(stageRoot, "package.json"),
      JSON.stringify({ name: "openclaw-runtime-deps-install", private: true }, null, 2),
      "utf-8",
    );
    log.info(`Prepared packaged OpenClaw runtime deps stage at ${stageRoot}`);
  } catch (err) {
    log.warn("Failed to prepare packaged OpenClaw runtime deps stage:", err);
  }
}

export const __test = {
  bundledRuntimeDepsRoot,
  createPathHash,
  sanitizePathSegment,
};
