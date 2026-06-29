/**
 * Fail-open image compression wrapper backed by a child process.
 *
 * Lazily forks a single long-lived child on first call. Process startup is
 * higher than a worker thread, but one image at a time is fine for CS message
 * frequency. Serialises requests via a FIFO queue and uses a correlation id
 * so stray/late messages cannot resolve the wrong promise.
 *
 * Fail-open contract: if the child errors, crashes, or compression fails, we
 * log a warning and return the original buffer unchanged. Dropping a customer
 * image is worse than sending a big one — the CS pipeline must never lose a
 * message because of compression.
 *
 * The result is a discriminated union — `{ ok: true, buffer, mimeType }` on
 * success, `{ ok: false, buffer, mimeType, error }` on fail-open (still with
 * the original buffer so callers that ignore `ok` continue to behave
 * correctly). Callers that care about observability inspect `ok` and emit
 * telemetry themselves — this module stays CS-agnostic.
 *
 * Has no CS-specific knowledge: takes `(Buffer, mimeType)` in, returns a
 * `CompressResult` out. Reusable for any out-of-process image compression.
 */

import { fork, type ChildProcess } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "@rivonclaw/logger";

const log = createLogger("image-compressor");

export type CompressResult =
  | { ok: true; compressed: true; buffer: Buffer; mimeType: string }
  | { ok: true; compressed: false; buffer: Buffer; mimeType: string; reason: "larger_than_input" }
  | { ok: false; compressed: false; buffer: Buffer; mimeType: string; error: string };

// Sibling file inside dist/ — the child process is a separate tsdown build
// that emits `dist/image-compression-worker.cjs` alongside `main.cjs`
// (see tsdown.config.ts).
// This module's source lives under `src/cs-bridge/` but bundles into `main.cjs`,
// so at runtime `__dirname` is `dist/`. In packaged Electron, fork uses the
// Electron binary with ELECTRON_RUN_AS_NODE=1 so the child behaves like Node.
const WORKER_FILENAME = "image-compression-worker.cjs";

type PendingRequest = {
  id: number;
  buffer: Buffer;
  mimeType: string;
  resolve: (value: CompressResult) => void;
};

type ChildResponse =
  | { id: number; ok: true; buffer: Buffer | Uint8Array | ArrayBuffer; mimeType: string }
  | { id: number; ok: false; error: string };

function toBuffer(value: Buffer | Uint8Array | ArrayBuffer): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof ArrayBuffer) return Buffer.from(new Uint8Array(value));
  return Buffer.from(value);
}

let child: ChildProcess | null = null;
let nextId = 1;
const queue: PendingRequest[] = [];
let inFlight: PendingRequest | null = null;

// Test-only override: when set, used verbatim instead of the dist/ sibling
// path. Allows unit tests to point at a fixture child (e.g. one that crashes
// on purpose) without spawning the real production child.
let childPathOverride: string | null = null;
let forkForTests: typeof fork = fork;

function resolveChildPath(): string {
  if (childPathOverride !== null) return childPathOverride;
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, WORKER_FILENAME);
}

function ensureChild(): ChildProcess {
  if (child) return child;
  const childPath = resolveChildPath();
  log.info("Starting image compression child process", { childPath });
  const w = forkForTests(childPath, [], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    serialization: "advanced",
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  // Bind every handler to this specific child instance via closure. If `w`
  // crashes, handleChildDeath() sets child = null; any further events from
  // the same `w` (e.g. a delayed "exit" after "error") are ignored because
  // `w !== child`. If a new child is installed afterwards, it is a different
  // `w`, so old-child events still fail the identity check and cannot drain
  // the new child's inFlight request.
  w.on("message", (msg: ChildResponse) => {
    if (w !== child) return; // stale child — ignore
    const pending = inFlight;
    inFlight = null;
    if (!pending || pending.id !== msg.id) {
      // Stale response after a crash/respawn — ignore.
      pumpQueue();
      return;
    }
    if (msg.ok) {
      const output = toBuffer(msg.buffer);
      log.info("Image compression child completed request", {
        inputBytes: pending.buffer.byteLength,
        outputBytes: output.byteLength,
        mimeType: msg.mimeType,
      });
      if (output.byteLength >= pending.buffer.byteLength) {
        log.info("Image compression kept original buffer because compressed output was not smaller", {
          inputBytes: pending.buffer.byteLength,
          outputBytes: output.byteLength,
          mimeType: pending.mimeType,
        });
        pending.resolve({
          ok: true,
          compressed: false,
          buffer: pending.buffer,
          mimeType: pending.mimeType,
          reason: "larger_than_input",
        });
      } else {
        pending.resolve({ ok: true, compressed: true, buffer: output, mimeType: msg.mimeType });
      }
    } else {
      log.warn("Image compression child returned error; falling back to original buffer", {
        error: msg.error,
      });
      pending.resolve({
        ok: false,
        compressed: false,
        buffer: pending.buffer,
        mimeType: pending.mimeType,
        error: msg.error,
      });
    }
    pumpQueue();
  });
  w.on("error", (err) => {
    if (w !== child) return; // stale child — ignore
    log.warn("Image compression child errored; will respawn on next request", { err });
    handleChildDeath(`child process error: ${err instanceof Error ? err.message : String(err)}`);
  });
  w.on("exit", (code, signal) => {
    if (w !== child) return; // stale child — ignore
    if (code !== 0) {
      log.warn("Image compression child exited unexpectedly; will respawn on next request", {
        code,
        signal,
      });
    }
    handleChildDeath(`child process exit code=${code}${signal ? ` signal=${signal}` : ""}`);
  });
  child = w;
  return w;
}

function handleChildDeath(error: string): void {
  child = null;
  // Fail-open any in-flight and queued requests with their original buffers.
  if (inFlight) {
    inFlight.resolve({
      ok: false,
      compressed: false,
      buffer: inFlight.buffer,
      mimeType: inFlight.mimeType,
      error,
    });
    inFlight = null;
  }
  while (queue.length > 0) {
    const pending = queue.shift()!;
    pending.resolve({
      ok: false,
      compressed: false,
      buffer: pending.buffer,
      mimeType: pending.mimeType,
      error,
    });
  }
}

function pumpQueue(): void {
  if (inFlight || queue.length === 0) return;
  const next = queue.shift()!;
  inFlight = next;
  try {
    const w = ensureChild();
    const sent = w.send({ id: next.id, buffer: next.buffer, mimeType: next.mimeType });
    if (!sent) {
      throw new Error("child process IPC channel is not writable");
    }
  } catch (err) {
    // Synchronous throw — e.g. fork() failed or IPC is already closed.
    // Without this catch, inFlight would be stuck and the pending promise
    // would hang forever. Fail-open with the original buffer and drain the
    // rest of the queue (each will also fail-open on the same condition).
    log.warn("Failed to dispatch to image compression child; falling back to original buffer", {
      err,
    });
    inFlight = null;
    const error = `child process dispatch failed: ${
      err instanceof Error ? err.message : String(err)
    }`;
    next.resolve({
      ok: false,
      compressed: false,
      buffer: next.buffer,
      mimeType: next.mimeType,
      error,
    });
    pumpQueue();
  }
}

/**
 * Compress an image buffer outside the main process. Returns a discriminated union:
 *   - `{ ok: true, buffer, mimeType }` on success (compressed output).
 *   - `{ ok: false, buffer, mimeType, error }` on any failure — buffer/mimeType
 *     are the original inputs (fail-open) and `error` is a short description
 *     for observability.
 */
export function compressImageForAgent(
  buffer: Buffer,
  mimeType: string,
): Promise<CompressResult> {
  return new Promise((resolve) => {
    const pending: PendingRequest = {
      id: nextId++,
      buffer,
      mimeType,
      resolve,
    };
    queue.push(pending);
    // pumpQueue() owns the ensureChild() call and handles synchronous spawn
    // failures by fail-opening the request. Do not preflight-spawn here — that
    // would fail-open only the current request and leave any queued peers
    // hanging.
    pumpQueue();
  });
}

/**
 * Test-only: reset module state between unit tests.
 */
export function __resetImageCompressorForTests(): void {
  const previousChild = child;
  if (previousChild) {
    child = null;
    previousChild.kill();
  }
  inFlight = null;
  queue.length = 0;
  nextId = 1;
  childPathOverride = null;
  forkForTests = fork;
}

/**
 * Test-only: override the child script path. Pass an absolute path to a
 * fixture script, or `null` to restore the default dist/ sibling lookup.
 */
export function __setChildPathForTests(path: string | null): void {
  childPathOverride = path;
}

/**
 * Test-only: expose the currently-installed child process so tests can
 * simulate stale events from a previous child (Fix 2 race). Returns `null`
 * if no child is currently installed.
 */
export function __getCurrentChildForTests(): ChildProcess | null {
  return child;
}

/**
 * Test-only: override child_process.fork so tests can assert fork options or
 * simulate synchronous spawn failures.
 */
export function __setForkForTests(nextFork: typeof fork | null): void {
  forkForTests = nextFork ?? fork;
}
