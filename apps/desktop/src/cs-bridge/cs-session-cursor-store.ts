import { dirname, join } from "node:path";
import { promises as fs } from "node:fs";
import { resolveCredentialsDir } from "@rivonclaw/core/node";
import { createLogger } from "@rivonclaw/logger";

const log = createLogger("cs-session-cursor-store");
const RETENTION_MS = 3 * 365 * 24 * 60 * 60 * 1000;
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const WRITE_DEBOUNCE_MS = 1000;

export interface CustomerServiceMessageCursor {
  messageId?: string | null;
  messageIndex?: string | null;
  createTime?: number | null;
}

export interface CustomerServiceCursorRecord extends CustomerServiceMessageCursor {
  updatedAt: string;
  sessionKey?: string;
  runId?: string;
}

export interface CustomerServiceSummaryRecord extends CustomerServiceMessageCursor {
  summary: string;
  updatedAt: string;
  messageCount: number;
  sessionKey?: string;
  runId?: string;
}

interface ConversationCursorRecord {
  openclawSession?: CustomerServiceCursorRecord;
  summary?: CustomerServiceSummaryRecord;
}

interface CursorStoreFile {
  version: 1;
  conversations: Record<string, ConversationCursorRecord>;
}

let cachedStore: CursorStoreFile | null = null;
let loadPromise: Promise<CursorStoreFile> | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let writePromise: Promise<void> | null = null;
let writeGeneration = 0;
let persistedGeneration = 0;
let lastPruneAt = 0;

function cursorStorePath(): string {
  return join(resolveCredentialsDir(), "customer-service-session-cursors.json");
}

function conversationKey(shopId: string, conversationId: string): string {
  return `${shopId}:${conversationId}`;
}

function normalizeCursor(cursor: CustomerServiceMessageCursor): CustomerServiceMessageCursor | null {
  const messageId = cursor.messageId?.trim() || undefined;
  const messageIndex = cursor.messageIndex?.trim() || undefined;
  const createTime = typeof cursor.createTime === "number" && Number.isFinite(cursor.createTime)
    ? cursor.createTime
    : undefined;
  if (!messageId && !messageIndex && createTime == null) return null;
  return { messageId, messageIndex, createTime };
}

function isFresh(updatedAt: string | undefined, now = Date.now()): boolean {
  if (!updatedAt) return false;
  const parsed = Date.parse(updatedAt);
  return Number.isFinite(parsed) && now - parsed <= RETENTION_MS;
}

function pruneExpiredStore(store: CursorStoreFile, now = Date.now()): boolean {
  let changed = false;
  for (const [key, record] of Object.entries(store.conversations)) {
    if (record.openclawSession && !isFresh(record.openclawSession.updatedAt, now)) {
      delete record.openclawSession;
      changed = true;
    }
    if (record.summary && !isFresh(record.summary.updatedAt, now)) {
      delete record.summary;
      changed = true;
    }
    if (!record.openclawSession && !record.summary) {
      delete store.conversations[key];
      changed = true;
    }
  }
  return changed;
}

function compareNumericString(left: string, right: string): number {
  if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
    if (left.length !== right.length) return left.length - right.length;
    return left.localeCompare(right);
  }
  return left.localeCompare(right);
}

export function compareMessageCursor(
  left: CustomerServiceMessageCursor,
  right: CustomerServiceMessageCursor,
): number {
  const leftIndex = left.messageIndex?.trim();
  const rightIndex = right.messageIndex?.trim();
  if (leftIndex && rightIndex && leftIndex !== rightIndex) {
    return compareNumericString(leftIndex, rightIndex);
  }

  const leftTime = typeof left.createTime === "number" && Number.isFinite(left.createTime) ? left.createTime : undefined;
  const rightTime = typeof right.createTime === "number" && Number.isFinite(right.createTime) ? right.createTime : undefined;
  if (leftTime != null && rightTime != null && leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  const leftId = left.messageId?.trim();
  const rightId = right.messageId?.trim();
  if (leftId && rightId && leftId !== rightId) return leftId.localeCompare(rightId);

  if (leftIndex && !rightIndex) return 1;
  if (!leftIndex && rightIndex) return -1;
  if (leftTime != null && rightTime == null) return 1;
  if (leftTime == null && rightTime != null) return -1;
  if (leftId && !rightId) return 1;
  if (!leftId && rightId) return -1;
  return 0;
}

async function loadStoreFromDisk(): Promise<CursorStoreFile> {
  try {
    const raw = await fs.readFile(cursorStorePath(), "utf-8");
    const parsed = JSON.parse(raw) as Partial<CursorStoreFile>;
    const store: CursorStoreFile = {
      version: 1,
      conversations: parsed.conversations && typeof parsed.conversations === "object"
        ? parsed.conversations
        : {},
    };
    lastPruneAt = Date.now();
    if (pruneExpiredStore(store, lastPruneAt)) {
      markStoreDirty();
    }
    return store;
  } catch (err: any) {
    if (err?.code === "ENOENT" || err instanceof SyntaxError) {
      lastPruneAt = Date.now();
      return { version: 1, conversations: {} };
    }
    throw err;
  }
}

async function readStore(): Promise<CursorStoreFile> {
  if (cachedStore) {
    pruneStoreIfDue(cachedStore);
    return cachedStore;
  }
  if (!loadPromise) {
    loadPromise = loadStoreFromDisk()
      .then((store) => {
        cachedStore = store;
        pruneStoreIfDue(store);
        return store;
      })
      .finally(() => {
        loadPromise = null;
      });
  }
  return loadPromise;
}

function pruneStoreIfDue(store: CursorStoreFile): void {
  const now = Date.now();
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
  lastPruneAt = now;
  if (pruneExpiredStore(store, now)) {
    markStoreDirty();
  }
}

function markStoreDirty(): void {
  writeGeneration += 1;
  scheduleStoreWrite();
}

function scheduleStoreWrite(): void {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    void flushCsSessionCursorStore().catch((err) => {
      log.warn("Failed to flush CS cursor store", {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }, WRITE_DEBOUNCE_MS);
  writeTimer.unref?.();
}

async function writeStoreToDisk(store: CursorStoreFile): Promise<void> {
  const filePath = cursorStorePath();
  await fs.mkdir(dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(store) + "\n", "utf-8");
}

export async function flushCsSessionCursorStore(): Promise<void> {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  if (!cachedStore || persistedGeneration === writeGeneration) {
    if (writePromise) await writePromise;
    return;
  }
  if (writePromise) {
    await writePromise;
    if (!cachedStore || persistedGeneration === writeGeneration) return;
  }
  const generationToPersist = writeGeneration;
  writePromise = writeStoreToDisk(cachedStore)
    .then(() => {
      persistedGeneration = Math.max(persistedGeneration, generationToPersist);
    })
    .finally(() => {
      writePromise = null;
      if (persistedGeneration < writeGeneration) {
        scheduleStoreWrite();
      }
    });
  await writePromise;
}

export async function readOpenClawSessionCursor(input: {
  shopId: string;
  conversationId: string;
}): Promise<CustomerServiceCursorRecord | undefined> {
  const store = await readStore();
  return store.conversations[conversationKey(input.shopId, input.conversationId)]?.openclawSession;
}

export async function advanceOpenClawSessionCursor(input: {
  shopId: string;
  conversationId: string;
  cursor: CustomerServiceMessageCursor;
  sessionKey?: string;
  runId?: string;
}): Promise<CustomerServiceCursorRecord | undefined> {
  const cursor = normalizeCursor(input.cursor);
  if (!cursor) return undefined;

  try {
    const store = await readStore();
    const key = conversationKey(input.shopId, input.conversationId);
    const existing = store.conversations[key]?.openclawSession;
    if (existing && compareMessageCursor(cursor, existing) <= 0) {
      return existing;
    }

    const next: CustomerServiceCursorRecord = {
      ...cursor,
      sessionKey: input.sessionKey,
      runId: input.runId,
      updatedAt: new Date().toISOString(),
    };
    store.conversations[key] = {
      ...store.conversations[key],
      openclawSession: next,
    };
    markStoreDirty();
    return next;
  } catch (err) {
    log.warn("Failed to advance OpenClaw CS session cursor", {
      shopId: input.shopId,
      conversationId: input.conversationId,
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

export async function readConversationSummary(input: {
  shopId: string;
  conversationId: string;
}): Promise<CustomerServiceSummaryRecord | undefined> {
  const store = await readStore();
  return store.conversations[conversationKey(input.shopId, input.conversationId)]?.summary;
}

export async function writeConversationSummary(input: {
  shopId: string;
  conversationId: string;
  cursor: CustomerServiceMessageCursor;
  summary: string;
  messageCount: number;
  sessionKey?: string;
  runId?: string;
}): Promise<CustomerServiceSummaryRecord | undefined> {
  const cursor = normalizeCursor(input.cursor);
  const summary = input.summary.trim();
  if (!cursor || !summary) return undefined;

  try {
    const store = await readStore();
    const key = conversationKey(input.shopId, input.conversationId);
    const next: CustomerServiceSummaryRecord = {
      ...cursor,
      summary,
      messageCount: Math.max(0, Math.floor(input.messageCount)),
      sessionKey: input.sessionKey,
      runId: input.runId,
      updatedAt: new Date().toISOString(),
    };
    store.conversations[key] = {
      ...store.conversations[key],
      summary: next,
    };
    markStoreDirty();
    return next;
  } catch (err) {
    log.warn("Failed to write CS conversation summary", {
      shopId: input.shopId,
      conversationId: input.conversationId,
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

export function resetCsSessionCursorStoreForTests(): void {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  cachedStore = null;
  loadPromise = null;
  writePromise = null;
  writeGeneration = 0;
  persistedGeneration = 0;
  lastPruneAt = 0;
}
