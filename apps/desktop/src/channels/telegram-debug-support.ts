import type { Storage } from "@rivonclaw/storage";

export const TELEGRAM_CHANNEL_ID = "telegram";
export const RIVONCLAW_TELEGRAM_DEBUG_ACCOUNT_ID = "rivonclaw-support";
export const RIVONCLAW_TELEGRAM_DEBUG_OPERATOR_USER_IDS_SETTING_KEY = "telegram-debug.operator-user-ids";

export function normalizeTelegramDebugOperatorUserIds(values: readonly unknown[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const id = String(value ?? "").trim();
    if (!/^\d+$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function serializeTelegramDebugOperatorUserIds(values: readonly unknown[]): string {
  return JSON.stringify(normalizeTelegramDebugOperatorUserIds(values));
}

export function readTelegramDebugOperatorUserIds(storage: Storage): string[] {
  const raw = storage.settings.get(RIVONCLAW_TELEGRAM_DEBUG_OPERATOR_USER_IDS_SETTING_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? normalizeTelegramDebugOperatorUserIds(parsed) : [];
  } catch {
    return [];
  }
}

