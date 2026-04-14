/**
 * Tests for the image cache matching logic used to restore user-sent images
 * after history reload (images are stripped by the gateway in chat.history).
 *
 * Tests the pure `matchCachedImages()` function directly — no IndexedDB needed.
 */
import { describe, it, expect } from "vitest";
import { matchCachedImages } from "../../src/pages/chat/image-cache.js";
import { IMAGE_EXPIRED_PLACEHOLDER, type ChatMessage, type ChatImage } from "../../src/pages/chat/chat-utils.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeImage(label = "img"): ChatImage {
  return { data: `base64-${label}`, mimeType: "image/png" };
}

function makeUserMsg(
  overrides: Partial<ChatMessage> & { timestamp: number },
): ChatMessage {
  return { role: "user", text: "hello", ...overrides };
}

function makeCacheRecord(overrides: {
  idempotencyKey?: string;
  timestamp: number;
  images?: ChatImage[];
}) {
  return {
    sessionKey: "s1",
    idempotencyKey: overrides.idempotencyKey ?? "",
    timestamp: overrides.timestamp,
    images: overrides.images ?? [makeImage()],
    savedAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("matchCachedImages", () => {
  it("returns messages unchanged when cache is empty", () => {
    const msgs = [makeUserMsg({ timestamp: 1000 })];
    expect(matchCachedImages([], msgs)).toEqual(msgs);
  });

  // ---- 1. Exact idempotencyKey match ----

  it("restores images via exact idempotencyKey match", () => {
    const images = [makeImage("a")];
    const cached = [makeCacheRecord({ idempotencyKey: "key-1", timestamp: 1000, images })];
    const msgs = [makeUserMsg({ timestamp: 1000, idempotencyKey: "key-1" })];

    const result = matchCachedImages(cached, msgs);
    expect(result[0].images).toEqual(images);
  });

  // ---- 2. Timestamp fallback when message lacks idempotencyKey ----
  //      This is the bug that was fixed: cache records WITH an idempotencyKey
  //      were skipped in the fallback, causing images to be lost.

  it("falls back to timestamp when message has no idempotencyKey", () => {
    const images = [makeImage("b")];
    const cached = [makeCacheRecord({ idempotencyKey: "key-2", timestamp: 5000, images })];
    // Message has no idempotencyKey — must still match via timestamp
    const msgs = [makeUserMsg({ timestamp: 5001 })];

    const result = matchCachedImages(cached, msgs);
    expect(result[0].images).toEqual(images);
  });

  // ---- 3. Closest match when multiple records are within tolerance ----

  it("picks the closest timestamp match and uses each record at most once", () => {
    const imgA = [makeImage("a")];
    const imgB = [makeImage("b")];
    const cached = [
      makeCacheRecord({ timestamp: 10_000, images: imgA }),
      makeCacheRecord({ timestamp: 10_200, images: imgB }),
    ];
    // First message is closer to cache[1], second is closer to cache[0]
    const msgs = [
      makeUserMsg({ timestamp: 10_150 }),
      makeUserMsg({ timestamp: 9_900 }),
    ];

    const result = matchCachedImages(cached, msgs);
    // 10_150 is 150ms from cache[0] and 50ms from cache[1] -> picks cache[1]
    expect(result[0].images).toEqual(imgB);
    // 9_900 is 100ms from cache[0] -> picks cache[0] (cache[1] already used)
    expect(result[1].images).toEqual(imgA);
  });

  // ---- 4. No match outside tolerance ----

  it("does not restore images when timestamp delta exceeds 5s tolerance", () => {
    const cached = [makeCacheRecord({ timestamp: 1000 })];
    const msgs = [makeUserMsg({ timestamp: 7_000 })]; // 6s away

    const result = matchCachedImages(cached, msgs);
    expect(result[0].images).toBeUndefined();
  });

  // ---- 5. Messages with existing images are not overwritten ----

  it("skips messages that already have images", () => {
    const existingImages = [makeImage("existing")];
    const cached = [makeCacheRecord({ idempotencyKey: "key-3", timestamp: 2000 })];
    const msgs = [
      makeUserMsg({ timestamp: 2000, idempotencyKey: "key-3", images: existingImages }),
    ];

    const result = matchCachedImages(cached, msgs);
    expect(result[0].images).toEqual(existingImages);
  });

  // ---- Edge cases ----

  it("skips non-user messages", () => {
    const cached = [makeCacheRecord({ timestamp: 3000 })];
    const msgs: ChatMessage[] = [
      { role: "assistant", text: "hi", timestamp: 3000 },
    ];

    const result = matchCachedImages(cached, msgs);
    expect(result[0].images).toBeUndefined();
  });

  it("does not double-use a cache record", () => {
    const images = [makeImage("only-one")];
    const cached = [makeCacheRecord({ idempotencyKey: "k1", timestamp: 4000, images })];
    const msgs = [
      makeUserMsg({ timestamp: 4000, idempotencyKey: "k1" }),
      makeUserMsg({ timestamp: 4001 }), // close timestamp, but record already used
    ];

    const result = matchCachedImages(cached, msgs);
    expect(result[0].images).toEqual(images);
    expect(result[1].images).toBeUndefined();
  });

  // ---- Expired placeholder stripping ----

  it("strips expired placeholder when images restored via exact key match", () => {
    const images = [makeImage("restored")];
    const cached = [makeCacheRecord({ idempotencyKey: "key-exp", timestamp: 8000, images })];
    const msgs = [
      makeUserMsg({
        timestamp: 8000,
        idempotencyKey: "key-exp",
        text: `hello\n${IMAGE_EXPIRED_PLACEHOLDER}`,
      }),
    ];

    const result = matchCachedImages(cached, msgs);
    expect(result[0].images).toEqual(images);
    expect(result[0].text).toBe("hello");
    expect(result[0].text).not.toContain(IMAGE_EXPIRED_PLACEHOLDER);
  });

  it("strips expired placeholder when images restored via timestamp fallback", () => {
    const images = [makeImage("fallback-restored")];
    const cached = [makeCacheRecord({ idempotencyKey: "key-fb", timestamp: 9000, images })];
    const msgs = [
      makeUserMsg({
        timestamp: 9001,
        text: `hi there\n${IMAGE_EXPIRED_PLACEHOLDER}`,
      }),
    ];

    const result = matchCachedImages(cached, msgs);
    expect(result[0].images).toEqual(images);
    expect(result[0].text).toBe("hi there");
    expect(result[0].text).not.toContain(IMAGE_EXPIRED_PLACEHOLDER);
  });

  it("preserves expired placeholder when no cache match", () => {
    const msgs = [
      makeUserMsg({
        timestamp: 50_000,
        text: `some text\n${IMAGE_EXPIRED_PLACEHOLDER}`,
      }),
    ];

    const result = matchCachedImages([], msgs);
    expect(result[0].images).toBeUndefined();
    expect(result[0].text).toContain(IMAGE_EXPIRED_PLACEHOLDER);
  });
});
