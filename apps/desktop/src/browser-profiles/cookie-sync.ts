import { createLogger } from "@rivonclaw/logger";
import { getRpcClient } from "../gateway/rpc-client-ref.js";
import type { SessionStateStack } from "./session-state-wiring.js";
import type { ManagedBrowserEntry } from "./managed-browser-service.js";

const log = createLogger("cookie-sync");

export interface CookieSyncDeps {
  getSessionStateStack: () => SessionStateStack | null;
  getManagedBrowserEntries: () => ManagedBrowserEntry[];
}

let _deps: CookieSyncDeps | null = null;

export function initCookieSync(deps: CookieSyncDeps): void {
  _deps = deps;
}

/**
 * Push locally-stored (decrypted) cookies for all managed profiles to the
 * gateway plugin so it can restore them via CDP on browser_session_start.
 *
 * Best-effort: errors are logged and swallowed.
 */
export async function pushStoredCookiesToGateway(): Promise<void> {
  const rpcClient = getRpcClient();
  if (!rpcClient) return;
  const stack = _deps?.getSessionStateStack() ?? null;
  if (!stack) return;

  // Iterate over all managed browser entries that are running/allocated
  const entries = _deps!.getManagedBrowserEntries();
  for (const entry of entries) {
    try {
      const raw = await stack.store.readCookieSnapshot("managed_profile", entry.profileId);
      if (!raw) continue;
      const cookies = JSON.parse(raw.toString("utf-8"));
      if (!Array.isArray(cookies) || cookies.length === 0) continue;

      await rpcClient.request("browser_profiles_push_cookies", {
        profileName: entry.profileId,
        cookies,
        cdpPort: entry.port,
      });
      log.debug(`Pushed ${cookies.length} stored cookies for profile ${entry.profileId} to gateway`);
    } catch (e: unknown) {
      log.debug(`Failed to push stored cookies for profile ${entry.profileId} (best-effort):`, e);
    }
  }
}

/**
 * Pull captured cookies from the gateway plugin for a profile and persist
 * them locally (encrypted).
 *
 * Best-effort: errors are logged and swallowed.
 */
export async function pullAndPersistCookies(profileName: string): Promise<void> {
  const rpcClient = getRpcClient();
  if (!rpcClient) return;
  const stack = _deps?.getSessionStateStack() ?? null;
  if (!stack) return;

  try {
    const result = await rpcClient.request<{ cookies: Array<Record<string, unknown>> }>(
      "browser_profiles_pull_cookies",
      { profileName },
    );
    if (!result?.cookies || !Array.isArray(result.cookies) || result.cookies.length === 0) {
      log.debug(`No cookies returned from gateway for profile ${profileName}`);
      return;
    }

    const payload = Buffer.from(JSON.stringify(result.cookies), "utf-8");
    await stack.store.ensureDir("managed_profile", profileName);
    await stack.store.writeCookieSnapshot("managed_profile", profileName, payload);
    log.info(`Pulled and persisted ${result.cookies.length} cookies for profile ${profileName} from gateway`);
  } catch (e: unknown) {
    log.debug(`Failed to pull cookies for profile ${profileName} (best-effort):`, e);
  }
}
