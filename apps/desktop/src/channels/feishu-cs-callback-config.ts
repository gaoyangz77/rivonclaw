import { createHash } from "node:crypto";
import { getApiBaseUrl } from "@rivonclaw/core";
import type { Storage } from "@rivonclaw/storage";
import { createLogger } from "@rivonclaw/logger";
import {
  patchFeishuMessageCardCallbackUrl,
  resolveFeishuAccountCredentials,
} from "./feishu-open-api.js";

const log = createLogger("feishu-cs-callback");
const CALLBACK_PATH = "/api/webhooks/feishu/cs-escalation-card";
const MARKER_PREFIX = "_internal.feishu-card-callback-v2";
const WARNING_PREFIX = "_internal.feishu-card-callback-warning";
const RETRY_DELAYS_MS = [0, 1_000, 4_000] as const;

let storageRef: Storage | undefined;
let localeRef = "en";
const inflight = new Map<string, Promise<void>>();

function key(prefix: string, domain: string, appId: string): string {
  return `${prefix}:${domain}:${appId}`;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

export function configureFeishuCsCallbackRuntime(params: {
  storage: Storage;
  locale: string;
}): void {
  storageRef = params.storage;
  localeRef = params.locale;
}

export function resolveFeishuCsCallbackUrl(locale = localeRef): string {
  return `${getApiBaseUrl(locale).replace(/\/+$/, "")}${CALLBACK_PATH}`;
}

export function getFeishuCsCallbackWarning(
  storage: Storage,
  config: Record<string, unknown>,
): string | null {
  const appId = typeof config.appId === "string" ? config.appId.trim() : "";
  const domain =
    typeof config.domain === "string" && config.domain.trim() ? config.domain.trim() : "feishu";
  return appId ? (storage.settings.get(key(WARNING_PREFIX, domain, appId)) ?? null) : null;
}

export async function ensureFeishuCsCallbackConfigured(accountId: string): Promise<void> {
  if (!storageRef) throw new Error("Feishu CS callback runtime is not initialized");
  const existing = inflight.get(accountId);
  if (existing) return existing;

  const task = (async () => {
    const { appId, appSecret, domain } = resolveFeishuAccountCredentials(accountId);
    const callbackUrl = resolveFeishuCsCallbackUrl();
    const markerKey = key(MARKER_PREFIX, domain, appId);
    const warningKey = key(WARNING_PREFIX, domain, appId);
    const urlHash = hash(callbackUrl);
    try {
      const marker = JSON.parse(storageRef!.settings.get(markerKey) ?? "null") as {
        urlHash?: unknown;
      } | null;
      if (marker?.urlHash === urlHash) {
        storageRef!.settings.delete(warningKey);
        return;
      }
    } catch {
      // A malformed internal marker is equivalent to no marker.
    }

    let lastError: unknown;
    for (const delayMs of RETRY_DELAYS_MS) {
      await sleep(delayMs);
      try {
        await patchFeishuMessageCardCallbackUrl({
          appId,
          appSecret,
          domain,
          callbackUrl,
        });
        storageRef!.settings.set(
          markerKey,
          JSON.stringify({ urlHash, callbackUrl, configuredAt: new Date().toISOString() }),
        );
        storageRef!.settings.delete(warningKey);
        log.info(`Configured Feishu CS callback account=${accountId} domain=${domain}`);
        return;
      } catch (error) {
        lastError = error;
      }
    }

    const message = "Customer-service card callback is not configured";
    storageRef!.settings.set(warningKey, message);
    log.warn(
      `Failed to configure Feishu CS callback account=${accountId} domain=${domain}: ${String(lastError)}`,
    );
    throw new Error(message, { cause: lastError });
  })().finally(() => inflight.delete(accountId));
  inflight.set(accountId, task);
  return task;
}

export function configureExistingFeishuCsCallbacks(accountIds: string[]): void {
  for (const accountId of accountIds) {
    void ensureFeishuCsCallbackConfigured(accountId).catch(() => {});
  }
}

export function resetFeishuCsCallbackRuntimeForTests(): void {
  storageRef = undefined;
  localeRef = "en";
  inflight.clear();
}
