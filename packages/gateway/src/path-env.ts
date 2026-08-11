import { posix, win32 } from "node:path";
import { homedir } from "node:os";

export interface EffectivePathOptions {
  platform?: NodeJS.Platform;
  homeDir?: string;
  extraPaths?: string[];
  prependExtraPaths?: boolean;
}

function pathDelimiter(platform: NodeJS.Platform): string {
  return platform === "win32" ? win32.delimiter : posix.delimiter;
}

/** Common executable locations shared by Desktop dependency checks and Gateway. */
export function commonExecutablePaths(options: EffectivePathOptions = {}): string[] {
  const targetPlatform = options.platform ?? process.platform;
  const home = options.homeDir ?? homedir();

  if (targetPlatform === "win32") {
    return [
      "C:\\Program Files\\Git\\cmd",
      "C:\\Program Files\\Git\\bin",
      win32.join(home, "AppData", "Local", "Programs", "Git", "cmd"),
      win32.join(home, "AppData", "Local", "Programs", "Git", "bin"),
      win32.join(home, "AppData", "Local", "Programs", "Python"),
      win32.join(home, "AppData", "Local", "Programs", "Python", "Python313"),
      win32.join(home, "AppData", "Local", "Programs", "Python", "Python313", "Scripts"),
      "C:\\Program Files\\nodejs",
      win32.join(home, "AppData", "Local", "Programs", "nodejs"),
      win32.join(home, "scoop", "shims"),
      win32.join(home, ".cargo", "bin"),
    ];
  }

  return [
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    "/usr/local/bin",
    "/usr/local/sbin",
    posix.join(home, ".nvm", "current", "bin"),
    posix.join(home, ".volta", "bin"),
    posix.join(home, ".fnm", "aliases", "default", "bin"),
    posix.join(home, ".local", "bin"),
    posix.join(home, ".cargo", "bin"),
  ];
}

/**
 * Combine all executable-path aliases without losing Windows `Path`.
 * Later object entries are treated as explicit overrides and retain priority.
 */
export function buildEffectivePath(
  env: NodeJS.ProcessEnv = process.env,
  options: EffectivePathOptions = {},
): string {
  const targetPlatform = options.platform ?? process.platform;
  const separator = pathDelimiter(targetPlatform);
  const pathValues = Object.entries(env)
    .filter(([key, value]) =>
      targetPlatform === "win32"
        ? key.toLowerCase() === "path" && value !== undefined
        : key === "PATH" && value !== undefined,
    )
    .reverse()
    .flatMap(([, value]) => String(value).split(separator));
  const extraPaths = options.extraPaths ?? commonExecutablePaths(options);
  const candidates = options.prependExtraPaths
    ? [...extraPaths, ...pathValues]
    : [...pathValues, ...extraPaths];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const rawEntry of candidates) {
    const entry = rawEntry.trim();
    if (!entry) continue;
    const identity = targetPlatform === "win32" ? entry.toLowerCase() : entry;
    if (seen.has(identity)) continue;
    seen.add(identity);
    result.push(entry);
  }
  return result.join(separator);
}

/** Return an env with exactly one canonical executable-path key. */
export function normalizePathEnvironment(
  env: NodeJS.ProcessEnv = process.env,
  options: EffectivePathOptions = {},
): NodeJS.ProcessEnv {
  const targetPlatform = options.platform ?? process.platform;
  const normalized = { ...env };
  if (targetPlatform === "win32") {
    for (const key of Object.keys(normalized)) {
      if (key.toLowerCase() === "path") delete normalized[key];
    }
    normalized.Path = buildEffectivePath(env, options);
  } else {
    normalized.PATH = buildEffectivePath(env, options);
  }
  return normalized;
}
