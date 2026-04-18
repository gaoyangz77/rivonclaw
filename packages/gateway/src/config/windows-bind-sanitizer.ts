/**
 * Sanitize Windows-style paths in Docker bind mount specs.
 *
 * OpenClaw's Zod config schema uses naive `indexOf(":")` to split bind
 * mount strings, which breaks on Windows drive-letter paths like
 * `E:\OpenClaw:E:\OpenClaw:rw` (splits at the drive-letter colon
 * and reports source path "E" as non-absolute).
 *
 * This module converts Windows paths to POSIX format that both
 * Docker Desktop for Windows and OpenClaw accept:
 *   `E:\OpenClaw` → `/e/OpenClaw`
 *   `D:\`         → `/d`
 */

const WINDOWS_DRIVE_RE = /^([A-Za-z]):[/\\](.*)/;

/**
 * Convert a Windows drive-letter path to POSIX.
 * Returns the input unchanged if it's not a Windows drive-letter path.
 *
 *   windowsPathToPosix("E:\\OpenClaw")  → "/e/OpenClaw"
 *   windowsPathToPosix("D:\\")          → "/d"
 *   windowsPathToPosix("/home/user")    → "/home/user"
 */
export function windowsPathToPosix(p: string): string {
  const m = WINDOWS_DRIVE_RE.exec(p);
  if (!m) return p;
  const drive = m[1].toLowerCase();
  const rest = m[2].replace(/\\/g, "/").replace(/\/+$/, "");
  return rest ? `/${drive}/${rest}` : `/${drive}`;
}

/**
 * Parse a Docker bind-mount spec aware of Windows drive-letter colons.
 *
 * Format: `host:container[:options]`
 * Windows example: `E:\OpenClaw:E:\OpenClaw:rw`
 */
function splitBindSpec(spec: string): { host: string; container: string; options: string } | null {
  const hasDrive = /^[A-Za-z]:[/\\]/.test(spec);
  let sep = -1;
  for (let i = hasDrive ? 2 : 0; i < spec.length; i++) {
    if (spec[i] === ":") {
      sep = i;
      break;
    }
  }
  if (sep === -1) return null;

  const host = spec.slice(0, sep);
  const rest = spec.slice(sep + 1);

  // Container path may also have a Windows drive letter.
  const containerHasDrive = /^[A-Za-z]:[/\\]/.test(rest);
  const optStart = containerHasDrive
    ? rest.indexOf(":", 2)
    : rest.indexOf(":");

  if (optStart === -1) {
    return { host, container: rest, options: "" };
  }
  return {
    host,
    container: rest.slice(0, optStart),
    options: rest.slice(optStart + 1),
  };
}

/**
 * Normalise a single bind-mount spec: convert any Windows paths to POSIX.
 * Non-Windows specs pass through unchanged.
 *
 *   normalizeBindSpec("E:\\OpenClaw:E:\\OpenClaw:rw")  → "/e/OpenClaw:/e/OpenClaw:rw"
 *   normalizeBindSpec("/home/user:/home/user:ro")      → "/home/user:/home/user:ro"
 */
export function normalizeBindSpec(spec: string): string {
  const trimmed = spec.trim();
  if (!trimmed) return trimmed;

  const parsed = splitBindSpec(trimmed);
  if (!parsed) return trimmed;

  const host = windowsPathToPosix(parsed.host);
  const container = windowsPathToPosix(parsed.container);
  if (parsed.options) {
    return `${host}:${container}:${parsed.options}`;
  }
  return `${host}:${container}`;
}

/**
 * Sanitize an array of Docker bind-mount specs, converting any Windows
 * paths to POSIX format.  Returns a new array (never mutates the input).
 */
export function sanitizeWindowsBinds(binds: unknown): string[] | undefined {
  if (!Array.isArray(binds)) return undefined;
  return binds
    .filter((b): b is string => typeof b === "string")
    .map(normalizeBindSpec);
}