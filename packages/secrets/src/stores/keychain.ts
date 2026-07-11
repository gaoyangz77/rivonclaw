import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { SecretStoreAccessError, type SecretKey, type SecretStore } from "../types.js";
import { createQuietLogger, DEBUG_FLAGS } from "@rivonclaw/logger";

const execFileAsync = promisify(execFile);
const log = createQuietLogger("secrets:keychain", DEBUG_FLAGS.SECRETS);

/** Account name used for all RivonClaw keychain items. */
const ACCOUNT = "rivonclaw";

/** Prefix applied to every service name so our items are easy to find. */
const SERVICE_PREFIX = "rivonclaw/";

type SecurityCommand = (args: string[]) => Promise<{ stdout: string; stderr: string }>;

const runSecurityCommand: SecurityCommand = async (args) => {
  const result = await execFileAsync("security", args);
  return { stdout: result.stdout, stderr: result.stderr };
};

function errorStderr(error: unknown): string {
  if (!error || typeof error !== "object" || !("stderr" in error)) return "";
  const stderr = (error as { stderr?: unknown }).stderr;
  return typeof stderr === "string" ? stderr : "";
}

function isItemNotFound(error: unknown): boolean {
  return /specified item could not be found|could not be found in the keychain/i.test(
    errorStderr(error),
  );
}

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
  constructor(private readonly runSecurity: SecurityCommand = runSecurityCommand) {}

  async get(key: SecretKey): Promise<string | null> {
    try {
      const { stdout } = await this.runSecurity([
        "find-generic-password",
        "-a", ACCOUNT,
        "-s", serviceName(key),
        "-w",
      ]);
      log.debug("get secret: key=" + key + " found=true");
      return stdout.trim();
    } catch (error) {
      if (isItemNotFound(error)) {
        log.debug("get secret: key=" + key + " found=false");
        return null;
      }
      log.error("failed to get secret: key=" + key + " reason=secure-store-unavailable");
      throw new SecretStoreAccessError("get", key);
    }
  }

  async set(key: SecretKey, value: string): Promise<void> {
    try {
      await this.runSecurity([
        "add-generic-password",
        "-a", ACCOUNT,
        "-s", serviceName(key),
        "-w", value,
        "-U",
      ]);
      log.debug("set secret: key=" + key);
    } catch {
      // Never pass the execFile error to the logger: its command field contains
      // the secret value supplied to `security -w`.
      log.error("failed to set secret: key=" + key + " reason=secure-store-unavailable");
      throw new SecretStoreAccessError("set", key);
    }
  }

  async delete(key: SecretKey): Promise<boolean> {
    try {
      await this.runSecurity([
        "delete-generic-password",
        "-a", ACCOUNT,
        "-s", serviceName(key),
      ]);
      log.debug("delete secret: key=" + key + " existed=true");
      return true;
    } catch (error) {
      if (isItemNotFound(error)) {
        log.debug("delete secret: key=" + key + " existed=false");
        return false;
      }
      log.error("failed to delete secret: key=" + key + " reason=secure-store-unavailable");
      throw new SecretStoreAccessError("delete", key);
    }
  }

  async listKeys(): Promise<string[]> {
    try {
      const { stdout } = await this.runSecurity(["dump-keychain"]);
      const keys: string[] = [];
      const serviceRegex = /"svce"<blob>="rivonclaw\/([^"]+)"/g;
      let match: RegExpExecArray | null;
      while ((match = serviceRegex.exec(stdout)) !== null) {
        keys.push(match[1]);
      }
      log.debug("listKeys: count=" + keys.length);
      return keys;
    } catch {
      log.error("failed to list keychain keys: reason=secure-store-unavailable");
      throw new SecretStoreAccessError("list");
    }
  }
}
