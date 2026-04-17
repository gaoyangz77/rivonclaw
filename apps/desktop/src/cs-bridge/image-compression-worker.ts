/**
 * Image compression worker — runs jimp off the main Electron event loop.
 *
 * Thin message-transport shell around `image-compression-core.ts`:
 * - Receives `{ id, buffer, mimeType }` via `parentPort.on("message")`.
 * - Delegates to `compressImageBuffer` (pure, no worker deps).
 * - Posts back `{ id, ok: true, buffer, mimeType: "image/jpeg" }` or
 *   `{ id, ok: false, error }`, transferring the output ArrayBuffer.
 *
 * Imported only by this worker entry — jimp never loads in the main process.
 */

import { parentPort } from "node:worker_threads";
import { compressImageBuffer } from "./image-compression-core.js";

if (!parentPort) {
  throw new Error("image-compression-worker must be spawned as a worker thread");
}

type RequestMessage = { id: number; buffer: ArrayBuffer; mimeType: string };
type ResponseMessage =
  | { id: number; ok: true; buffer: ArrayBuffer; mimeType: string }
  | { id: number; ok: false; error: string };

parentPort.on("message", async (msg: RequestMessage) => {
  try {
    const out = await compressImageBuffer(Buffer.from(msg.buffer));
    // Copy into a fresh ArrayBuffer so the transfer list is well-typed
    // (Buffer.buffer is `ArrayBuffer | SharedArrayBuffer` in current Node
    // types). The allocation is unavoidable because transferring jimp's
    // internal buffer could invalidate state it may still reference.
    const ab = new ArrayBuffer(out.byteLength);
    new Uint8Array(ab).set(out);
    const response: ResponseMessage = { id: msg.id, ok: true, buffer: ab, mimeType: "image/jpeg" };
    parentPort!.postMessage(response, [ab]);
  } catch (err) {
    const response: ResponseMessage = {
      id: msg.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    parentPort!.postMessage(response);
  }
});
