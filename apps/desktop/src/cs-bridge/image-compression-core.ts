/**
 * Pure image compression logic — no worker_threads, no side effects.
 *
 * Extracted so unit tests can exercise the compression algorithm directly
 * without spawning a worker thread. The worker entry
 * (`image-compression-worker.ts`) wraps this with message transport; the
 * wrapper (`image-compressor.ts`) wraps the worker with queueing + fail-open.
 *
 * Mirrors `apps/panel/src/pages/chat/chat-image-utils.ts`: resize longest edge
 * to DEFAULTS.chat.compressMaxDimension, re-encode as JPEG, progressively
 * lower quality (initial/min from DEFAULTS.chat) until base64 fits
 * DEFAULTS.chat.compressTargetBytes.
 */

import { Jimp, JimpMime } from "jimp";
import { DEFAULTS } from "@rivonclaw/core";

const MAX_DIMENSION = DEFAULTS.chat.compressMaxDimension;
const TARGET_BYTES = DEFAULTS.chat.compressTargetBytes;
const INITIAL_QUALITY = DEFAULTS.chat.compressInitialQuality;
const MIN_QUALITY = DEFAULTS.chat.compressMinQuality;
const QUALITY_STEP = 0.1;

/**
 * Compress an image buffer. Always returns a JPEG (regardless of input type).
 * Throws on decode failure — callers implement fail-open.
 */
export async function compressImageBuffer(buffer: Buffer): Promise<Buffer> {
  const image = await Jimp.read(buffer);

  // Resize to fit within MAX_DIMENSION on the longest edge, preserving aspect ratio.
  const longest = Math.max(image.width, image.height);
  if (longest > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / longest;
    image.resize({ w: Math.round(image.width * scale), h: Math.round(image.height * scale) });
  }

  // Mirrors Panel's base64-length gate in chat-image-utils.ts: progressively
  // lower quality until the *base64-encoded* output fits TARGET_BYTES. This is
  // the unit that actually matters (LLM providers cap on base64 payload size
  // and bill tokens on base64 bytes). We compute the base64 length analytically
  // as ceil(binary / 3) * 4 to avoid a needless base64 encode per iteration.
  let quality = Math.round(INITIAL_QUALITY * 100);
  const minQuality = Math.round(MIN_QUALITY * 100);
  let out = await image.getBuffer(JimpMime.jpeg, { quality });
  let base64Length = Math.ceil(out.byteLength / 3) * 4;
  while (base64Length > TARGET_BYTES && quality > minQuality) {
    quality = Math.max(minQuality, quality - Math.round(QUALITY_STEP * 100));
    out = await image.getBuffer(JimpMime.jpeg, { quality });
    base64Length = Math.ceil(out.byteLength / 3) * 4;
  }

  return out;
}
