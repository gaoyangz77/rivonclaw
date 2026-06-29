/**
 * Image compression child process — runs jimp outside the main Electron process.
 *
 * Thin message-transport shell around `image-compression-core.ts`:
 * - Receives `{ id, buffer, mimeType }` via process IPC.
 * - Delegates to `compressImageBuffer` (pure, no worker deps).
 * - Sends back `{ id, ok: true, buffer, mimeType: "image/jpeg" }` or
 *   `{ id, ok: false, error }`.
 *
 * Imported only by this child entry — jimp never loads in the main process.
 */

import { compressImageBuffer } from "./image-compression-core.js";

if (typeof process.send !== "function") {
  throw new Error("image-compression-worker must be spawned as a child process with IPC");
}

type RequestMessage = { id: number; buffer: Buffer | Uint8Array | ArrayBuffer; mimeType: string };
type ResponseMessage =
  | { id: number; ok: true; buffer: Buffer; mimeType: string }
  | { id: number; ok: false; error: string };

function toBuffer(value: RequestMessage["buffer"]): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof ArrayBuffer) return Buffer.from(new Uint8Array(value));
  return Buffer.from(value);
}

process.on("message", async (msg: RequestMessage) => {
  try {
    const out = await compressImageBuffer(toBuffer(msg.buffer));
    const response: ResponseMessage = { id: msg.id, ok: true, buffer: out, mimeType: "image/jpeg" };
    process.send!(response);
  } catch (err) {
    const response: ResponseMessage = {
      id: msg.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    process.send!(response);
  }
});
