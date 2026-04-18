import type { SecretKey, SecretStore } from "../types.js";
import { createLogger } from "@rivonclaw/logger";

const log = createLogger("secrets:memory");

/**
 * In-memory implementation of SecretStore.
 *
 * Useful for unit tests and development. Secrets are lost when the
 * process exits.
 */
export class MemorySecretStore implements SecretStore {
  private readonly store = new Map<string, string>();

  async get(key: SecretKey): Promise<string | null> {
    const value = this.store.get(key) ?? null;
    log.debug(`get secret: key=${key} found=${value !== null}`);
    return value;
  }

  async set(key: SecretKey, value: string): Promise<void> {
    this.store.set(key, value);
    log.debug(`set secret: key=${key}`);
  }

  async delete(key: SecretKey): Promise<boolean> {
    const existed = this.store.delete(key);
    log.debug(`delete secret: key=${key} existed=${existed}`);
    return existed;
  }

  async listKeys(): Promise<string[]> {
    const keys = [...this.store.keys()];
    log.debug(`listKeys: count=${keys.length}`);
    return keys;
  }
}
