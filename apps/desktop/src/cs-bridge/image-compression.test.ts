import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { Jimp } from "jimp";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compressImageBuffer } from "./image-compression-core.js";

// Silence the compressor's logger in this test.
vi.mock("@rivonclaw/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Pure core — compressImageBuffer
// ---------------------------------------------------------------------------

describe("compressImageBuffer", () => {
  it("downscales a large image and returns a valid smaller JPEG", async () => {
    // Synthesize a 3000x2000 image with a gradient so JPEG can't trivially
    // compress it to near-zero bytes. Build RGBA via unsigned shifts so the
    // top byte (red) doesn't push the value negative in 32-bit signed math.
    const img = new Jimp({ width: 3000, height: 2000 });
    for (let y = 0; y < 2000; y += 1) {
      for (let x = 0; x < 3000; x += 1) {
        const r = Math.floor((x * 255) / 3000);
        const g = Math.floor((y * 255) / 2000);
        const b = Math.floor(((x + y) * 255) / 5000);
        const rgba = ((r * 0x01000000) + (g << 16) + (b << 8) + 0xff) >>> 0;
        img.setPixelColor(rgba, x, y);
      }
    }
    const input = await img.getBuffer("image/jpeg", { quality: 95 });
    const output = await compressImageBuffer(input);

    // Output is strictly smaller than the high-quality input.
    expect(output.byteLength).toBeLessThan(input.byteLength);

    // Output is a valid JPEG (SOI marker 0xFFD8) and decodes back.
    expect(output[0]).toBe(0xff);
    expect(output[1]).toBe(0xd8);
    const decoded = await Jimp.read(output);
    // And the longest edge has been resized to the configured max dimension.
    expect(Math.max(decoded.width, decoded.height)).toBeLessThanOrEqual(1280);
  }, 30_000);

  it("still returns a JPEG for a small image (no resize path)", async () => {
    const small = new Jimp({ width: 100, height: 80, color: 0xff0000ff });
    const input = await small.getBuffer("image/png");
    const output = await compressImageBuffer(input);
    expect(output[0]).toBe(0xff);
    expect(output[1]).toBe(0xd8);
    const decoded = await Jimp.read(output);
    expect(decoded.width).toBe(100);
    expect(decoded.height).toBe(80);
  }, 15_000);

  it("rejects a non-image buffer", async () => {
    await expect(compressImageBuffer(Buffer.from("not an image"))).rejects.toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Wrapper — compressImageForAgent fail-open
// ---------------------------------------------------------------------------

describe("compressImageForAgent", () => {
  beforeEach(async () => {
    const mod = await import("./image-compressor.js");
    mod.__resetImageCompressorForTests();
  });

  it("falls open to the original buffer when the child file is missing", async () => {
    // At test time the compiled child at dist/image-compression-worker.cjs
    // does not exist alongside the test, so child startup or module load will fail.
    // The wrapper must surface the original buffer + mime type rather than
    // throw or drop the image, AND mark the result `ok: false` with an error
    // string so callers can emit telemetry.
    const { compressImageForAgent } = await import("./image-compressor.js");
    const original = Buffer.from([1, 2, 3, 4, 5]);
    const result = await compressImageForAgent(original, "image/png");
    expect(result.ok).toBe(false);
    expect(result.buffer).toEqual(original);
    expect(result.mimeType).toBe("image/png");
    if (!result.ok) {
      expect(typeof result.error).toBe("string");
      expect(result.error.length).toBeGreaterThan(0);
    }
  }, 10_000);
});

// ---------------------------------------------------------------------------
// Fix 2 — double handleChildDeath() / cross-child event leakage
// Fix 3 — synchronous throw inside pumpQueue's ensureChild()
// ---------------------------------------------------------------------------

const fixtureDir = mkdtempSync(join(tmpdir(), "img-compressor-test-"));
afterAll(() => {
  rmSync(fixtureDir, { recursive: true, force: true });
});

/** Writes a fixture child process script to disk and returns its absolute path. */
function writeFixtureChild(filename: string, source: string): string {
  const full = join(fixtureDir, filename);
  writeFileSync(full, source, "utf8");
  return full;
}

describe("compressImageForAgent — child process lifecycle edge cases", () => {
  beforeEach(async () => {
    const mod = await import("./image-compressor.js");
    mod.__resetImageCompressorForTests();
  });

  it("forks the image compressor as an Electron run-as-node child process", async () => {
    const {
      compressImageForAgent,
      __setForkForTests,
    } = await import("./image-compressor.js");
    const fakeChild = new EventEmitter() as EventEmitter & {
      send: ReturnType<typeof vi.fn>;
      kill: ReturnType<typeof vi.fn>;
    };
    const forkMock = vi.fn(
      (_modulePath: string, args: string[], options: Record<string, unknown>) => {
        fakeChild.send = vi.fn((msg: { id: number; buffer: Buffer; mimeType: string }) => {
          setImmediate(() => {
            fakeChild.emit("message", {
              id: msg.id,
              ok: true,
              buffer: Buffer.from(msg.buffer),
              mimeType: "image/jpeg",
            });
          });
          return true;
        });
        fakeChild.kill = vi.fn(() => true);
        return fakeChild;
      },
    );
    __setForkForTests(forkMock as never);

    const result = await compressImageForAgent(Buffer.from("payload"), "image/png");

    expect(result.ok).toBe(true);
    expect(result.compressed).toBe(false);
    expect(forkMock).toHaveBeenCalledTimes(1);
    const [, args, options] = forkMock.mock.calls[0];
    expect(args).toEqual([]);
    expect(options).toMatchObject({
      serialization: "advanced",
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    });
    expect((options.env as Record<string, string>).ELECTRON_RUN_AS_NODE).toBe("1");
  });

  it("ignores delayed events from a previous (dead) child (Fix 2)", async () => {
    // Scenario this test locks in:
    //   1. Spawn child A. A posts a delayed reply.
    //   2. Grab a handle to A. Manually crash A by emitting "error" -> the
    //      registered handler calls handleChildDeath() (queue already empty
    //      because request was in-flight), setting child = null and fail-
    //      opening the in-flight request.
    //   3. Spawn child B via a new compress call with a fresh delayed reply.
    //   4. Emit a spurious "exit" on A (simulating Node's delayed exit after
    //      error). Without the closure guard, this would call
    //      handleChildDeath() a second time and drain B's in-flight. With
    //      the guard (`w !== child`), A's handler is a no-op.
    //   5. Await B's reply — it must arrive normally, proving the stale
    //      event did not hijack the new child's state.
    const {
      compressImageForAgent,
      __setChildPathForTests,
      __getCurrentChildForTests,
    } = await import("./image-compressor.js");

    // Well-behaved child that replies with a smaller JPEG-mimetype buffer after
    // a short delay.
    const echoChild = writeFixtureChild(
      "echo-child.cjs",
      `
        process.on("message", async (msg) => {
          await new Promise((r) => setTimeout(r, 150));
          process.send({ id: msg.id, ok: true, buffer: Buffer.from("b"), mimeType: "image/jpeg" });
        });
      `,
    );
    __setChildPathForTests(echoChild);

    // Step 1-2: start request A and grab A's ChildProcess handle, then crash it.
    const reqA = compressImageForAgent(Buffer.from("a-payload"), "image/png");
    await new Promise((r) => setTimeout(r, 20));
    const workerA = __getCurrentChildForTests();
    expect(workerA).not.toBeNull();

    // Manually fire "error" on A — the registered listener drains in-flight
    // (fail-open with original buffer) and sets child = null.
    workerA!.emit("error", new Error("simulated crash"));
    const resultA = await reqA;
    expect(resultA.ok).toBe(false);
    expect(resultA.buffer).toEqual(Buffer.from("a-payload"));
    expect(resultA.mimeType).toBe("image/png");
    if (!resultA.ok) expect(resultA.error).toContain("simulated crash");
    workerA!.kill();

    // Step 3: start request B — this spawns a fresh child instance.
    const reqB = compressImageForAgent(Buffer.from("b-payload"), "image/png");
    await new Promise((r) => setTimeout(r, 20));
    const workerB = __getCurrentChildForTests();
    expect(workerB).not.toBeNull();
    expect(workerB).not.toBe(workerA);

    // Step 4: emit a spurious "exit" on the DEAD child A. Without the
    // closure guard this would invoke handleChildDeath() again and drain
    // B's in-flight request prematurely with the original buffer.
    workerA!.emit("exit", 1);

    // Step 5: request B must resolve from B's own (real, delayed) reply as
    // an echoed JPEG — not as a prematurely failed-open PNG.
    const resultB = await reqB;
    expect(resultB.ok).toBe(true);
    expect(resultB.compressed).toBe(true);
    expect(resultB.mimeType).toBe("image/jpeg");
    expect(Buffer.from(resultB.buffer).equals(Buffer.from("b"))).toBe(true);

    // Terminate B cleanly so the test process doesn't leak the child.
    workerB!.kill();
  }, 15_000);

  it("fail-opens when the child cannot load (Fix 3)", async () => {
    // Point the child at a non-existent path. Depending on Node/Electron,
    // failure may surface as spawn error or as a non-zero child exit. The
    // pending promise must resolve with the
    // original buffer instead of hanging forever.
    const { compressImageForAgent, __setChildPathForTests } = await import(
      "./image-compressor.js"
    );
    __setChildPathForTests("/definitely/does/not/exist/worker.cjs");

    const original = Buffer.from([9, 8, 7]);
    const result = await compressImageForAgent(original, "image/png");
    expect(result.ok).toBe(false);
    expect(result.buffer).toEqual(original);
    expect(result.mimeType).toBe("image/png");
    if (!result.ok) {
      expect(result.error).toMatch(/child process (dispatch failed|error:|exit code=)/);
    }
  }, 10_000);

  it("drains an entire queued batch when child startup fails (Fix 3)", async () => {
    // When startup fails, handleChildDeath() must fail-open every queued peer
    // too — not just the first one.
    const { compressImageForAgent, __setChildPathForTests } = await import(
      "./image-compressor.js"
    );
    __setChildPathForTests("/definitely/does/not/exist/worker.cjs");

    const inputs = [Buffer.from([1]), Buffer.from([2]), Buffer.from([3])];
    const results = await Promise.all(
      inputs.map((buf) => compressImageForAgent(buf, "image/png")),
    );
    for (let i = 0; i < inputs.length; i += 1) {
      expect(results[i].ok).toBe(false);
      expect(results[i].compressed).toBe(false);
      expect(results[i].buffer).toEqual(inputs[i]);
      expect(results[i].mimeType).toBe("image/png");
    }
  }, 10_000);

  it("keeps the original image when the child output is not smaller", async () => {
    const {
      compressImageForAgent,
      __setForkForTests,
    } = await import("./image-compressor.js");
    const fakeChild = new EventEmitter() as EventEmitter & {
      send: ReturnType<typeof vi.fn>;
      kill: ReturnType<typeof vi.fn>;
    };
    __setForkForTests(vi.fn(() => {
      fakeChild.send = vi.fn((msg: { id: number }) => {
        setImmediate(() => {
          fakeChild.emit("message", {
            id: msg.id,
            ok: true,
            buffer: Buffer.from("larger-than-original"),
            mimeType: "image/jpeg",
          });
        });
        return true;
      });
      fakeChild.kill = vi.fn(() => true);
      return fakeChild;
    }) as never);

    const original = Buffer.from("small");
    const result = await compressImageForAgent(original, "image/png");

    expect(result.ok).toBe(true);
    expect(result.compressed).toBe(false);
    expect(result.buffer).toEqual(original);
    expect(result.mimeType).toBe("image/png");
    if (result.ok && !result.compressed) {
      expect(result.reason).toBe("larger_than_input");
    }
  });
});
