import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SecretKey, SecretStore } from "../types.js";
import { createLogger } from "@rivonclaw/logger";

const execFileAsync = promisify(execFile);
const log = createLogger("secrets:keychain");

/** Account name used for all RivonClaw keychain items. */
const ACCOUNT = "rivonclaw";

/** Prefix applied to every service name so our items are easy to find. */
const SERVICE_PREFIX = "rivonclaw/";

function serviceName(key: string): string {
  return SERVICE_PREFIX + key;
}

/**
 * macOS Keychain implementation of SecretStore.
 *
 * Uses the `security` CLI that ships with every macOS installation.
 * All operations use execFile (NOT exec) to avoid shell-injection.
 */
export class KeychainSecretStore implements SecretStore {
  async get(key: SecretKey): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync("security", [
        "find-generic-password",
        "-a", ACCOUNT,
        "-s", serviceName(key),
        "-w",
      ]);
      log.debug("get secret: key=" + key + " found=true");
      return stdout.trim();
    } catch {
      log.debug("get secret: key=" + key + " found=false");
      return null;
    }
  }

  async set(key: SecretKey, value: string): Promise<void> {
    try {
      await execFileAsync("security", [
        "add-generic-password",
        "-a", ACCOUNT,
        "-s", serviceName(key),
        "-w", value,
        "-U",
      ]);
      log.debug("set secret: key=" + key);
    } catch (err) {
      log.error("failed to set secret: key=" + key, err);
      throw err;
    }
  }

  async delete(key: SecretKey): Promise<boolean> {
    try {
      await execFileAsync("security", [
        "delete-generic-password",
        "-a", ACCOUNT,
        "-s", serviceName(key),
      ]);
      log.debug("delete secret: key=" + key + " existed=true");
      return true;
    } catch {
      log.debug("delete secret: key=" + key + " existed=false");
      return false;
    }
  }

  async listKeys(): Promise<string[]> {
    try {
      const { stdout } = await execFileAsync("security", ["dump-keychain"]);
      const keys: string[] = [];
      const serviceRegex = /"svce"<blob>="rivonclaw\/([^"]+)"/g;
      let match: RegExpExecArray | null;
      while ((match = serviceRegex.exec(stdout)) !== null) {
        keys.push(match[1]);
      }
      log.debug("listKeys: count=" + keys.length);
      return keys;
    } catch (err) {
      log.error("failed to list keychain keys", err);
      return [];
    }
  }
}
