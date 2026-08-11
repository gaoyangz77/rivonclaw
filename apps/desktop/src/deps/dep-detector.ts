import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { homedir, platform } from "node:os";
import { posix, win32 } from "node:path";
import { DEFAULTS } from "@rivonclaw/core";
import {
  buildEffectivePath,
  commonExecutablePaths,
  normalizePathEnvironment,
} from "@rivonclaw/gateway/path-env";
import { createLogger } from "@rivonclaw/logger";
import type { DepName, DepStatus } from "./types.js";

const log = createLogger("deps-provisioner");
const execFile = promisify(execFileCb);

const EXEC_TIMEOUT = DEFAULTS.depsProvisioner.execTimeoutMs;

/**
 * Build an augmented PATH that includes common install locations.
 *
 * Electron apps launched from Finder/Explorer don't inherit shell PATH
 * additions from .zshrc/.bashrc, so we retain the inherited path and add
 * well-known executable directories as fallbacks.
 */
export function getAugmentedPath(): string {
  const targetPlatform = platform();
  return buildEffectivePath(process.env, {
    platform: targetPlatform,
    homeDir: homedir(),
    prependExtraPaths: targetPlatform !== "win32",
  });
}

export function getAugmentedEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const targetPlatform = platform();
  return normalizePathEnvironment(
    { ...process.env, ...overrides },
    {
      platform: targetPlatform,
      homeDir: homedir(),
      prependExtraPaths: targetPlatform !== "win32",
    },
  );
}

interface DepCheck {
  name: DepName;
  /** Commands to try in order — first success wins. */
  commands: string[][];
  /** Extract a semver-ish version string from stdout/stderr. */
  parseVersion: (output: string) => string | undefined;
}

const VERSION_CHECKS: DepCheck[] = [
  {
    name: "git",
    commands: [["git", "--version"]],
    parseVersion: (out) => out.match(/git version (\S+)/)?.[1],
  },
  {
    name: "python",
    commands: [
      ["python3", "--version"],
      ["python", "--version"],
    ],
    parseVersion: (out) => out.match(/Python (\S+)/)?.[1],
  },
  {
    name: "node",
    commands: [["node", "--version"]],
    parseVersion: (out) => out.match(/v(\S+)/)?.[1],
  },
  {
    name: "uv",
    commands: [["uv", "--version"]],
    parseVersion: (out) => out.match(/uv (\S+)/)?.[1],
  },
];

async function checkDep(
  check: DepCheck,
  env: NodeJS.ProcessEnv,
): Promise<DepStatus> {
  for (const [cmd, ...args] of check.commands) {
    try {
      const { stdout, stderr } = await execFile(cmd, args, {
        timeout: EXEC_TIMEOUT,
        env,
      });
      const combined = stdout + stderr;

      // Windows ships a "python" stub that opens the Microsoft Store
      // instead of running Python. Reject it so we install a real one.
      if (check.name === "python" && platform() === "win32" && !combined.match(/Python \d/)) {
        continue;
      }

      const version = check.parseVersion(combined);

      // Resolve the binary path via `which` (Unix) or `where.exe` (Windows).
      let binPath: string | undefined;
      try {
        const whichCmd = platform() === "win32" ? "where.exe" : "which";
        const { stdout: whichOut } = await execFile(whichCmd, [cmd], {
          timeout: EXEC_TIMEOUT,
          env,
        });
        binPath = whichOut.trim().split(/\r?\n/)[0];
      } catch {
        // Non-critical — path is optional metadata.
      }

      log.info(`${check.name} detected: ${version ?? "unknown version"}`, {
        path: binPath,
      });
      return { name: check.name, available: true, version, path: binPath };
    } catch {
      // Command failed — try next variant if any.
    }
  }

  log.info(`${check.name} not found`);
  return { name: check.name, available: false };
}

function resolveWindowsCommandInterpreter(env: NodeJS.ProcessEnv): string {
  const systemRoot = Object.entries(env).find(([key]) => key.toLowerCase() === "systemroot")?.[1];
  return win32.join(systemRoot?.trim() || "C:\\Windows", "System32", "cmd.exe");
}

async function checkNpm(env: NodeJS.ProcessEnv): Promise<boolean> {
  const isWindows = platform() === "win32";
  const command = isWindows ? resolveWindowsCommandInterpreter(env) : "npm";
  const args = isWindows ? ["/d", "/s", "/c", "npm.cmd --version"] : ["--version"];
  try {
    const { stdout, stderr } = await execFile(command, args, {
      timeout: EXEC_TIMEOUT,
      env,
      windowsHide: true,
    });
    const version = `${stdout}${stderr}`.match(/\b(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\b/)?.[1];
    let binPath: string | undefined;
    try {
      const lookup: [string, string[]] = isWindows
        ? ["where.exe", ["npm.cmd"]]
        : ["which", ["npm"]];
      const { stdout: whichOut } = await execFile(lookup[0], lookup[1], {
        timeout: EXEC_TIMEOUT,
        env,
      });
      binPath = whichOut.trim().split(/\r?\n/)[0];
    } catch {
      // Version execution is authoritative; path is diagnostic metadata only.
    }
    log.info(`npm detected: ${version ?? "unknown version"}`, { path: binPath });
    return true;
  } catch (error) {
    log.warn("npm not found or not executable", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/** Keep the Electron process PATH current after provisioning installs tools. */
export function syncDetectedDependencyPaths(statuses: DepStatus[]): void {
  const targetPlatform = platform();
  const pathApi = targetPlatform === "win32" ? win32 : posix;
  const detectedDirs = statuses.flatMap((status) =>
    status.available && status.path ? [pathApi.dirname(status.path)] : [],
  );
  const normalized = normalizePathEnvironment(process.env, {
    platform: targetPlatform,
    homeDir: homedir(),
    extraPaths: [
      ...detectedDirs,
      ...commonExecutablePaths({ platform: targetPlatform, homeDir: homedir() }),
    ],
    prependExtraPaths: true,
  });
  for (const key of Object.keys(process.env)) {
    if (targetPlatform === "win32" ? key.toLowerCase() === "path" : key === "PATH") {
      delete process.env[key];
    }
  }
  const canonicalKey = targetPlatform === "win32" ? "Path" : "PATH";
  process.env[canonicalKey] = normalized[canonicalKey];
}

/**
 * Detect all managed dependencies in parallel and return their status.
 */
export async function detectDeps(): Promise<DepStatus[]> {
  const env = getAugmentedEnvironment();
  const results = await Promise.all(VERSION_CHECKS.map((check) => checkDep(check, env)));
  const nodeIndex = results.findIndex((status) => status.name === "node");
  if (nodeIndex >= 0 && results[nodeIndex].available && !(await checkNpm(env))) {
    log.warn("Node.js detected without a working npm toolchain; provisioning is required", {
      nodeVersion: results[nodeIndex].version,
      nodePath: results[nodeIndex].path,
    });
    results[nodeIndex] = { name: "node", available: false };
  }
  syncDetectedDependencyPaths(results);
  return results;
}
