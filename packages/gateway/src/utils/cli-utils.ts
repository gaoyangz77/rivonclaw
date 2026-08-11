/**
 * Shared CLI utility functions for discovering and auto-installing CLI tools.
 *
 * Shared by panel-server.ts (clawhub install), the gateway launcher,
 * and future CLI integrations that need the same enriched-PATH logic
 * and npm-based auto-install flow.
 */
import { existsSync, readdirSync } from "node:fs";
import { execFile } from "node:child_process";
import { delimiter, join } from "node:path";
import { homedir } from "node:os";
import {
  buildEffectivePath,
  commonExecutablePaths,
  normalizePathEnvironment,
} from "../path-env.js";
export {
  buildEffectivePath,
  commonExecutablePaths,
  normalizePathEnvironment,
} from "../path-env.js";

function pathDelimiter(platform: NodeJS.Platform): string {
  return platform === "win32" ? ";" : delimiter;
}

/**
 * Build an enriched PATH that includes common Node.js/npm install locations.
 * Packaged Electron apps on macOS inherit a minimal PATH (e.g. /usr/bin:/bin)
 * that doesn't include Homebrew, nvm, volta, fnm, etc.
 */
export function enrichedPath(basePath?: string): string {
  const home = homedir();
  const extra = commonExecutablePaths({ homeDir: home });

  // nvm: also check versioned directories (pick the first one found)
  const nvmVersions = join(home, ".nvm", "versions", "node");
  try {
    const versions = readdirSync(nvmVersions)
      .filter((v) => v.startsWith("v"))
      .sort()
      .reverse();
    if (versions.length > 0) {
      extra.push(join(nvmVersions, versions[0], "bin"));
    }
  } catch {
    // nvm not installed
  }

  return buildEffectivePath(
    basePath === undefined
      ? process.env
      : process.platform === "win32"
        ? { Path: basePath }
        : { PATH: basePath },
    { extraPaths: extra.filter((entry) => existsSync(entry)) },
  );
}

/**
 * Find a CLI binary by name in the enriched PATH.
 * Returns the full path if found, null otherwise.
 */
export function findInPath(name: string): string | null {
  const exts = process.platform === "win32" ? [".cmd", ".bat", ".exe", ""] : [""];
  const separator = pathDelimiter(process.platform);
  for (const dir of buildEffectivePath(process.env).split(separator)) {
    for (const ext of exts) {
      const p = join(dir, name + ext);
      if (existsSync(p)) {
        return p;
      }
    }
  }
  return null;
}

/**
 * Ensure a CLI tool is available. If not found, auto-install it via npm.
 *
 * 1. Check if `cliName` exists in PATH (enriched with nvm/volta/homebrew paths)
 * 2. If npm is available, run `npm install -g <npmPackage>`
 * 3. If npm is also missing, throw with a user-friendly message
 *
 * @returns The resolved path to the CLI binary.
 * @throws If the CLI cannot be found or installed.
 */
export async function ensureCliAvailable(cliName: string, npmPackage: string): Promise<string> {
  // 1. Already installed?
  const existing = findInPath(cliName);
  if (existing) return existing;

  // 2. npm available?
  const npmBin = findInPath("npm");
  if (!npmBin) {
    throw new Error(
      `${cliName} is not installed and npm was not found. ` +
        `Please install Node.js (https://nodejs.org) first, then run: npm install -g ${npmPackage}`,
    );
  }

  // 3. Auto-install via npm
  const useShell = process.platform === "win32";
  await new Promise<void>((resolve, reject) => {
    execFile(
      npmBin,
      ["install", "-g", npmPackage],
      {
        timeout: 120_000,
        shell: useShell,
        env: normalizePathEnvironment(process.env),
      },
      (err, _stdout, stderr) => {
        if (err) {
          reject(new Error(`Failed to install ${npmPackage}: ${stderr || err.message}`));
          return;
        }
        resolve();
      },
    );
  });

  // 4. Verify installation
  const installed = findInPath(cliName);
  if (!installed) {
    throw new Error(
      `Installed ${npmPackage} but ${cliName} was not found in PATH. ` +
        `Try running manually: npm install -g ${npmPackage}`,
    );
  }
  return installed;
}
