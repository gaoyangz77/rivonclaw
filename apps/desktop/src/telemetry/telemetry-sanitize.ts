/**
 * Scrubbing for free text that leaves the machine in telemetry metadata.
 * Telemetry metadata must not carry PII or secrets (see @rivonclaw/telemetry).
 */

// Windows profile names may contain spaces, so that segment runs to the next separator.
const USER_HOME_PATH = /(?:\/Users\/|\/home\/)[^\s/\\]+|[A-Za-z]:[\\/]Users[\\/][^\\/\r\n]+/gi;

/**
 * Opaque runs long enough to be keys, tokens, JWT segments, or hashes. Real
 * error prose and path segments stay well below this length.
 */
const OPAQUE_TOKEN = /[A-Za-z0-9_-]{24,}/g;

/** Replace the user-name part of home-directory paths with "~". */
export function redactUserPaths(text: string): string {
  return text.replace(USER_HOME_PATH, "~");
}

/**
 * Prepare an error message for telemetry: strip user names from paths, mask
 * opaque token-like runs, collapse whitespace, and cap the length.
 */
export function sanitizeTelemetryErrorText(text: string, maxChars: number): string {
  const scrubbed = redactUserPaths(text)
    .replace(OPAQUE_TOKEN, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();
  return scrubbed.length > maxChars ? `${scrubbed.slice(0, maxChars - 1)}…` : scrubbed;
}
