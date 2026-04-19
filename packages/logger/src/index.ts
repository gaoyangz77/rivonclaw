import { DEFAULTS } from "@rivonclaw/core";
import { Logger } from "tslog";
import {
  mkdirSync,
  appendFileSync,
  statSync,
  renameSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { resolveLogDir } from "@rivonclaw/core/node";
import { isDebugFlagEnabled } from "./debug-flags.js";

export { DEBUG_FLAGS, isDebugFlagEnabled } from "./debug-flags.js";
export type { DebugFlag } from "./debug-flags.js";

export const LOG_DIR = resolveLogDir();

const LOG_FILENAME = "rivonclaw.log";
const LOG_FILENAME_PREV = "rivonclaw.log.1";
const DEFAULT_MAX_FILE_SIZE = DEFAULTS.logger.maxFileSizeBytes;

// --- Module state ---
let fileLoggingEnabled = false;
let logDir = LOG_DIR;
let maxFileSize = DEFAULT_MAX_FILE_SIZE;
const registeredLoggers: Logger<unknown>[] = [];

export function ensureLogDir(): void {
  mkdirSync(logDir, { recursive: true });
}

export interface FileLoggingOptions {
  /** Max size per log file in bytes. Default: 5 MB. Total on disk ~ 2x this value. */
  maxFileSize?: number;
  /** Override log directory (for testing). Default: ~/.rivonclaw/logs */
  logDir?: string;
}

/**
 * Enable file-based log persistence. Call once at app startup.
 *
 * Writes to `{logDir}/rivonclaw.log`. When the file exceeds `maxFileSize`,
 * it is rotated to `rivonclaw.log.1` (one backup). Total disk usage <= 2x maxFileSize.
 *
 * Loggers created before AND after this call will write to disk.
 */
export function enableFileLogging(options?: FileLoggingOptions): void {
  if (options?.logDir) logDir = options.logDir;
  maxFileSize = options?.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;

  ensureLogDir();
  rotateIfNeeded();
  fileLoggingEnabled = true;

  // Retroactively attach transport to already-created loggers
  for (const logger of registeredLoggers) {
    attachFileTransport(logger);
  }
}

/**
 * Reset module state. Only for testing — do not call in production.
 * @internal
 */
export function _resetFileLogging(): void {
  fileLoggingEnabled = false;
  logDir = LOG_DIR;
  maxFileSize = DEFAULT_MAX_FILE_SIZE;
  registeredLoggers.length = 0;
}

function attachFileTransport(logger: Logger<unknown>): void {
  logger.attachTransport((logObj: Record<string, unknown>) => {
    writeToFile(formatLogLine(logObj));
  });
}

function getLogFilePath(): string {
  return join(logDir, LOG_FILENAME);
}

function rotateIfNeeded(): void {
  const logPath = getLogFilePath();
  try {
    if (!existsSync(logPath)) return;
    const { size } = statSync(logPath);
    if (size >= maxFileSize) {
      const prevPath = join(logDir, LOG_FILENAME_PREV);
      if (existsSync(prevPath)) unlinkSync(prevPath);
      renameSync(logPath, prevPath);
    }
  } catch {
    // Don't break the app for rotation errors
  }
}

function writeToFile(line: string): void {
  try {
    appendFileSync(getLogFilePath(), line + "\n", "utf-8");
    rotateIfNeeded();
  } catch {
    // Silently ignore — logging should never crash the app
  }
}

function formatLogLine(logObj: Record<string, unknown>): string {
  const meta = logObj._meta as
    | { date?: Date; logLevelName?: string; name?: string }
    | undefined;
  const ts = (meta?.date ?? new Date()).toISOString();
  const level = (meta?.logLevelName ?? "INFO").padEnd(5);
  const name = meta?.name ?? "";

  // Collect positional arguments (tslog stores them as "0", "1", …)
  const parts: string[] = [];
  for (let i = 0; ; i++) {
    const val = logObj[String(i)];
    if (val === undefined) break;
    parts.push(typeof val === "string" ? val : JSON.stringify(val));
  }

  return `${ts} ${level} [${name}] ${parts.join(" ")}`;
}

export interface CreateLoggerOptions {
  /**
   * Override the minimum tslog level (0 = SILLY, 2 = DEBUG, 3 = INFO, 4 = WARN, 5 = ERROR).
   * Defaults to 0 in dev and 3 in production. Useful for noisy modules that
   * should stay quiet unless an opt-in debug flag is set.
   */
  minLevel?: number;
}

export function createLogger(
  name: string,
  options?: CreateLoggerOptions,
): Logger<unknown> {
  const logger = new Logger({
    name,
    type: "pretty",
    minLevel:
      options?.minLevel ?? (process.env.NODE_ENV === "production" ? 3 : 0),
  });

  registeredLoggers.push(logger);

  if (fileLoggingEnabled) {
    attachFileTransport(logger);
  }

  return logger;
}

/**
 * Create a logger that stays at INFO+ unless the named DEBUG_* env var is "1".
 * Use for chatty modules that you only want to hear from when troubleshooting.
 */
export function createQuietLogger(
  name: string,
  debugEnvVar: string,
): Logger<unknown> {
  return createLogger(name, {
    minLevel: isDebugFlagEnabled(debugEnvVar) ? undefined : 3,
  });
}
