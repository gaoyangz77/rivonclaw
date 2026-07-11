/** Well-known secret keys used by RivonClaw. */
export type SecretKey =
  | "llm-api-key"
  | "dingtalk-app-secret"
  | "dingtalk-token"
  | "stt-api-key"
  | (string & {}); // allow arbitrary keys while preserving autocomplete

export type SecretStoreOperation = "get" | "set" | "delete" | "list";

/**
 * The secure store exists, but the operating system would not allow it to be
 * read or modified. This is deliberately distinct from a missing secret.
 */
export class SecretStoreAccessError extends Error {
  readonly code = "SECRET_STORE_UNAVAILABLE";

  constructor(
    readonly operation: SecretStoreOperation,
    readonly key?: SecretKey,
  ) {
    super(`Secure storage is unavailable during ${operation}${key ? ` (${key})` : ""}`);
    this.name = "SecretStoreAccessError";
  }
}

/**
 * Platform-agnostic interface for secure secret storage.
 *
 * Implementations must NEVER log secret values -- only key names and
 * operation outcomes (success / failure).
 */
export interface SecretStore {
  /** Get a secret value. Returns null if not found. */
  get(key: SecretKey): Promise<string | null>;

  /** Set (create or update) a secret value. */
  set(key: SecretKey, value: string): Promise<void>;

  /** Delete a secret. Returns true if it existed. */
  delete(key: SecretKey): Promise<boolean>;

  /** List all stored secret keys (NOT values). */
  listKeys(): Promise<string[]>;
}
