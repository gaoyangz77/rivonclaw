import { readFileSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { normalizeWeixinAccountId } from "@rivonclaw/core";

export const WEIXIN_CHANNEL_ID = "openclaw-weixin";

function readUserIdFromParsedAccount(parsed: Record<string, unknown>): string | undefined {
  const value = parsed.userId;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function deriveRawWeixinAccountId(accountId: string): string | undefined {
  if (accountId.endsWith("-im-bot")) {
    return `${accountId.slice(0, -"-im-bot".length)}@im.bot`;
  }
  if (accountId.endsWith("-im-wechat")) {
    return `${accountId.slice(0, -"-im-wechat".length)}@im.wechat`;
  }
  return undefined;
}

function resolveWeixinAccountsDir(stateDir: string): string {
  return join(stateDir, WEIXIN_CHANNEL_ID, "accounts");
}

function resolveWeixinAccountSidecarPaths(
  stateDir: string,
  accountId: string,
  suffix: string,
): string[] {
  const canonical = normalizeWeixinAccountId(accountId);
  const accountsDir = resolveWeixinAccountsDir(stateDir);
  const paths = [join(accountsDir, `${canonical}${suffix}`)];
  const raw = deriveRawWeixinAccountId(canonical);
  if (raw) paths.push(join(accountsDir, `${raw}${suffix}`));
  return paths;
}

function resolveWeixinAccountPaths(stateDir: string, accountId: string): string[] {
  return resolveWeixinAccountSidecarPaths(stateDir, accountId, ".json");
}

export async function readWeixinAccountUserId(
  stateDir: string,
  accountId: string,
): Promise<string | undefined> {
  for (const filePath of resolveWeixinAccountPaths(stateDir, accountId)) {
    try {
      const raw = await readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const userId = readUserIdFromParsedAccount(parsed);
      if (userId) return userId;
    } catch {
      // Try compatibility path / ignore unreadable state files.
    }
  }
  return undefined;
}

export function readWeixinAccountUserIdSync(
  stateDir: string,
  accountId: string,
): string | undefined {
  for (const filePath of resolveWeixinAccountPaths(stateDir, accountId)) {
    try {
      const raw = readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const userId = readUserIdFromParsedAccount(parsed);
      if (userId) return userId;
    } catch {
      // Try compatibility path / ignore unreadable state files.
    }
  }
  return undefined;
}

export async function readWeixinContextTokenRecipientIds(
  stateDir: string,
  accountId: string,
): Promise<string[]> {
  const recipientIds = new Set<string>();
  for (const filePath of resolveWeixinAccountSidecarPaths(
    stateDir,
    accountId,
    ".context-tokens.json",
  )) {
    try {
      const raw = await readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const [recipientId, token] of Object.entries(parsed)) {
        if (
          typeof recipientId === "string"
          && recipientId.trim()
          && typeof token === "string"
          && token.trim()
        ) {
          recipientIds.add(recipientId.trim());
        }
      }
    } catch {
      // Try compatibility path / ignore unreadable state files.
    }
  }
  return [...recipientIds];
}

export async function hasWeixinContextTokenForRecipient(
  stateDir: string,
  accountId: string,
  recipientId: string,
): Promise<boolean> {
  const trimmedRecipientId = recipientId.trim();
  if (!trimmedRecipientId) return false;
  const recipientIds = await readWeixinContextTokenRecipientIds(stateDir, accountId);
  return recipientIds.includes(trimmedRecipientId);
}

export function readWeixinContextTokensSync(
  stateDir: string,
  accountId: string,
): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const filePath of resolveWeixinAccountSidecarPaths(
    stateDir,
    accountId,
    ".context-tokens.json",
  )) {
    try {
      const raw = readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const [recipientId, token] of Object.entries(parsed)) {
        if (
          typeof recipientId === "string"
          && recipientId.trim()
          && typeof token === "string"
          && token.trim()
        ) {
          tokens[recipientId.trim()] = token.trim();
        }
      }
    } catch {
      // Try compatibility path / ignore unreadable state files.
    }
  }
  return tokens;
}

export function hasWeixinContextTokenForRecipientSync(
  stateDir: string,
  accountId: string,
  recipientId: string,
): boolean {
  const trimmedRecipientId = recipientId.trim();
  if (!trimmedRecipientId) return false;
  return Object.prototype.hasOwnProperty.call(
    readWeixinContextTokensSync(stateDir, accountId),
    trimmedRecipientId,
  );
}

export async function clearWeixinContextTokenFiles(
  stateDir: string,
  accountId: string,
): Promise<void> {
  await Promise.all(
    resolveWeixinAccountSidecarPaths(stateDir, accountId, ".context-tokens.json")
      .map((filePath) => rm(filePath, { force: true })),
  );
}
