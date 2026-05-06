import { dirname, join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { promises as fs } from "node:fs";
import { resolveCredentialsDir } from "@rivonclaw/core/node";

export interface AllowFromStore {
  version: number;
  allowFrom: string[];
}

export function resolveAllowFromPathForChannel(channelId: string, accountId?: string): string {
  const credDir = resolveCredentialsDir();
  const normalized = accountId?.trim().toLowerCase() || "";
  if (normalized) {
    return join(credDir, `${channelId}-${normalized}-allowFrom.json`);
  }
  return join(credDir, `${channelId}-allowFrom.json`);
}

export async function readAllowFromList(channelId: string, accountId?: string): Promise<string[]> {
  try {
    const filePath = resolveAllowFromPathForChannel(channelId, accountId);
    const content = await fs.readFile(filePath, "utf-8");
    if (!content.trim()) return [];
    const data: AllowFromStore = JSON.parse(content);
    return Array.isArray(data.allowFrom) ? data.allowFrom : [];
  } catch (err: any) {
    if (err.code === "ENOENT") return [];
    if (err instanceof SyntaxError) return [];
    throw err;
  }
}

export async function writeAllowFromList(channelId: string, allowFrom: string[], accountId?: string): Promise<void> {
  const filePath = resolveAllowFromPathForChannel(channelId, accountId);
  const data: AllowFromStore = { version: 1, allowFrom };
  await fs.mkdir(dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export async function addAllowFromEntry(channelId: string, accountId: string | undefined, entry: string): Promise<boolean> {
  const trimmed = entry.trim();
  if (!trimmed) return false;

  const allowlist = await readAllowFromList(channelId, accountId);
  if (allowlist.includes(trimmed)) return false;

  await writeAllowFromList(channelId, [...allowlist, trimmed], accountId);
  return true;
}

export function addAllowFromEntrySync(channelId: string, accountId: string | undefined, entry: string): boolean {
  const trimmed = entry.trim();
  if (!trimmed) return false;

  const filePath = resolveAllowFromPathForChannel(channelId, accountId);
  let allowlist: string[] = [];
  try {
    if (existsSync(filePath)) {
      const raw = readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw) as AllowFromStore;
      allowlist = Array.isArray(parsed.allowFrom) ? parsed.allowFrom : [];
    }
  } catch {
    allowlist = [];
  }

  if (allowlist.includes(trimmed)) return false;
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify({ version: 1, allowFrom: [...allowlist, trimmed] }, null, 2) + "\n", "utf-8");
  return true;
}

/** Read and merge allowFrom entries from all scoped + legacy files for a channel. */
export async function readAllAllowFromLists(channelId: string): Promise<string[]> {
  const credentialsDir = resolveCredentialsDir();
  const prefix = `${channelId}-`;
  const suffix = "-allowFrom.json";
  const allEntries = new Set<string>();

  let files: string[];
  try {
    files = await fs.readdir(credentialsDir);
  } catch (err: any) {
    if (err.code === "ENOENT") return [];
    throw err;
  }

  for (const file of files) {
    // Match both legacy "{channelId}-allowFrom.json" and scoped "{channelId}-{accountId}-allowFrom.json"
    if (!file.startsWith(prefix) || !file.endsWith(suffix)) continue;

    try {
      const content = await fs.readFile(join(credentialsDir, file), "utf-8");
      const data: AllowFromStore = JSON.parse(content);
      if (Array.isArray(data.allowFrom)) {
        for (const entry of data.allowFrom) allEntries.add(entry);
      }
    } catch {
      // Skip unreadable files
    }
  }

  return [...allEntries];
}
