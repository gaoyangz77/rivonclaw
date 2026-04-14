/**
 * IndexedDB cache for user-sent chat images.
 *
 * The gateway strips image data from chat.history responses, so images
 * disappear after app restart.  This module caches images at send time
 * and merges them back when loading history.
 */

import { IMAGE_EXPIRED_PLACEHOLDER, type ChatImage, type ChatMessage } from "./chat-utils.js";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

interface CachedImageRecord {
  sessionKey: string;
  idempotencyKey: string;  // unique per send — primary matching key
  timestamp: number;       // fallback for old records without idempotencyKey
  images: ChatImage[];
  savedAt: number;         // for 7-day expiry
}

const DB_NAME = "rivonclaw-image-cache";
const DB_VERSION = 1;
const STORE = "images";
const TIMESTAMP_TOLERANCE_MS = 5_000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { autoIncrement: true });
        store.createIndex("sessionKey", "sessionKey", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("savedAt", "savedAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Cache images when the user sends a message with attachments. */
export async function saveImages(
  sessionKey: string,
  idempotencyKey: string,
  timestamp: number,
  images: ChatImage[],
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).add({
    sessionKey,
    idempotencyKey,
    timestamp,
    images,
    savedAt: Date.now(),
  } satisfies CachedImageRecord);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Pure matching logic extracted for testability.
 *
 * Primary matching: by `idempotencyKey` (exact, no tolerance needed).
 * Fallback: closest timestamp match within ±5 s tolerance.
 * Each cache record is used at most once. Returns a new array.
 */
export function matchCachedImages(
  cached: CachedImageRecord[],
  messages: ChatMessage[],
): ChatMessage[] {
  if (cached.length === 0) return messages;

  // Build a lookup by idempotencyKey for O(1) matching
  const byKey = new Map<string, number>();
  for (let i = 0; i < cached.length; i++) {
    if (cached[i].idempotencyKey) byKey.set(cached[i].idempotencyKey, i);
  }

  const used = new Set<number>();

  return messages.map((msg) => {
    if (msg.role !== "user" || (msg.images && msg.images.length > 0)) return msg;

    // 1) Exact match by idempotencyKey
    if (msg.idempotencyKey) {
      const idx = byKey.get(msg.idempotencyKey);
      if (idx !== undefined && !used.has(idx)) {
        used.add(idx);
        return { ...msg, images: cached[idx].images, text: msg.text.replaceAll(IMAGE_EXPIRED_PLACEHOLDER, "").trim() };
      }
    }

    // 2) Fallback: closest timestamp match within tolerance
    let bestIdx = -1;
    let bestDelta = Infinity;
    for (let i = 0; i < cached.length; i++) {
      if (used.has(i)) continue;
      const delta = Math.abs(cached[i].timestamp - msg.timestamp);
      if (delta <= TIMESTAMP_TOLERANCE_MS && delta < bestDelta) {
        bestDelta = delta;
        bestIdx = i;
      }
    }
    if (bestIdx !== -1) {
      used.add(bestIdx);
      return { ...msg, images: cached[bestIdx].images, text: msg.text.replaceAll(IMAGE_EXPIRED_PLACEHOLDER, "").trim() };
    }

    return msg;
  });
}

/**
 * Merge cached images into parsed history messages.
 *
 * Fetches cached records from IndexedDB, then delegates to
 * `matchCachedImages` for the actual matching logic.
 * Returns a new array — does not mutate the input.
 */
export async function restoreImages(
  sessionKey: string,
  messages: ChatMessage[],
): Promise<ChatMessage[]> {
  const db = await openDB();
  const tx = db.transaction(STORE, "readonly");
  const index = tx.objectStore(STORE).index("sessionKey");
  const req = index.getAll(sessionKey);

  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      db.close();
      resolve(matchCachedImages(req.result, messages));
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

/**
 * Clear cached images.
 * - With `sessionKey`: delete all entries for that session (conversation reset).
 * - Without: delete entries older than 7 days (startup cleanup).
 */
export async function clearImages(sessionKey?: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);

  if (sessionKey) {
    const idx = store.index("sessionKey");
    const cursorReq = idx.openCursor(sessionKey);
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
  } else {
    const cutoff = Date.now() - MAX_AGE_MS;
    const idx = store.index("savedAt");
    const cursorReq = idx.openCursor(IDBKeyRange.upperBound(cutoff));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
