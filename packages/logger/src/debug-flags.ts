/**
 * Centralized registry of DEBUG_* environment flags.
 *
 * Modules that emit chatty DEBUG output can gate themselves behind a flag
 * here via `createQuietLogger(name, DEBUG_FLAGS.X)`. Without the flag the
 * logger defaults to INFO+; set the env var to `1` at process start to
 * restore DEBUG output for troubleshooting.
 *
 * To add a new flag: add an entry here, document what it unmutes, and
 * switch the relevant `createLogger` call to `createQuietLogger`.
 */
export const DEBUG_FLAGS = {
  /** Outbound proxy selection, upstream connects, system-proxy discovery. */
  PROXY: "DEBUG_PROXY",
  /** Keychain reads and gateway secret-injector. */
  SECRETS: "DEBUG_SECRETS",
} as const;

export type DebugFlag = (typeof DEBUG_FLAGS)[keyof typeof DEBUG_FLAGS];

/** True when the given env var is set to `"1"`. */
export function isDebugFlagEnabled(envVar: string): boolean {
  return process.env[envVar] === "1";
}
