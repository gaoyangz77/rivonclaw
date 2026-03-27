// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchJson, fetchVoid, cachedFetch, invalidateCache } from "../client.js";

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function networkError(): never {
  throw new TypeError("Failed to fetch");
}

// ---------------------------------------------------------------------------
// fetchJson
// ---------------------------------------------------------------------------

describe("fetchJson", () => {
  beforeEach(() => mockFetch.mockReset());

  it("returns parsed JSON on 200", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ items: [1, 2] }));

    const data = await fetchJson<{ items: number[] }>("/test");

    expect(mockFetch).toHaveBeenCalledWith("/api/test", expect.objectContaining({
      headers: { "Content-Type": "application/json" },
    }));
    expect(data).toEqual({ items: [1, 2] });
  });

  it("throws with server error message when body is JSON", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: "Not found", detail: "item 42" }, 404));

    await expect(fetchJson("/missing")).rejects.toThrow("Not found");

    // Also verify detail is attached
    try {
      await fetchJson("/missing");
    } catch (err) {
      expect((err as Error & { detail?: string }).detail).toBe("item 42");
    }
  });

  it("throws with status text when body is not JSON", async () => {
    const res = {
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    } as unknown as Response;
    mockFetch.mockResolvedValue(res);

    await expect(fetchJson("/fail")).rejects.toThrow("API error: 500 Internal Server Error");
  });
});

// ---------------------------------------------------------------------------
// fetchVoid
// ---------------------------------------------------------------------------

describe("fetchVoid", () => {
  beforeEach(() => mockFetch.mockReset());

  it("does not throw on fetch error", () => {
    // fetchVoid swallows all errors. Verify a resolved-but-error response
    // doesn't propagate (the .catch(() => {}) is the contract).
    mockFetch.mockResolvedValue(jsonResponse({ error: "gone" }, 500));

    expect(() => fetchVoid("/gone")).not.toThrow();
    expect(mockFetch).toHaveBeenCalled();
  });

  it("does not throw on non-2xx response", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: "bad" }, 500));

    expect(() => fetchVoid("/err")).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });

  it("calls fetch with the correct URL and headers", () => {
    mockFetch.mockResolvedValue(jsonResponse({}));

    fetchVoid("/ping", { method: "POST", body: "{}" });

    expect(mockFetch).toHaveBeenCalledWith("/api/ping", expect.objectContaining({
      method: "POST",
      body: "{}",
      headers: { "Content-Type": "application/json" },
    }));
  });
});

// ---------------------------------------------------------------------------
// cachedFetch + invalidateCache
// ---------------------------------------------------------------------------

describe("cachedFetch", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Clear internal cache between tests
    invalidateCache("test-key");
  });

  it("caches the result within TTL", async () => {
    let callCount = 0;
    const fn = async () => {
      callCount++;
      return { n: callCount };
    };

    const first = await cachedFetch("test-key", fn, 5000);
    const second = await cachedFetch("test-key", fn, 5000);

    expect(first).toEqual({ n: 1 });
    expect(second).toEqual({ n: 1 }); // cached, fn not called again
    expect(callCount).toBe(1);
  });

  it("re-fetches after TTL expires", async () => {
    let callCount = 0;
    const fn = async () => {
      callCount++;
      return { n: callCount };
    };

    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    await cachedFetch("test-key", fn, 100);
    expect(callCount).toBe(1);

    // Advance past TTL
    vi.spyOn(Date, "now").mockReturnValue(now + 200);

    const result = await cachedFetch("test-key", fn, 100);
    expect(result).toEqual({ n: 2 });
    expect(callCount).toBe(2);

    vi.restoreAllMocks();
  });

  it("deduplicates concurrent requests", async () => {
    let callCount = 0;
    let resolve!: (v: { n: number }) => void;
    const fn = () => {
      callCount++;
      return new Promise<{ n: number }>((r) => { resolve = r; });
    };

    const p1 = cachedFetch("test-key", fn, 5000);
    const p2 = cachedFetch("test-key", fn, 5000);

    // fn should only be called once
    expect(callCount).toBe(1);

    resolve({ n: 42 });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual({ n: 42 });
    expect(r2).toEqual({ n: 42 });
  });

  it("invalidateCache forces re-fetch", async () => {
    let callCount = 0;
    const fn = async () => {
      callCount++;
      return { n: callCount };
    };

    await cachedFetch("test-key", fn, 60_000);
    expect(callCount).toBe(1);

    invalidateCache("test-key");

    const result = await cachedFetch("test-key", fn, 60_000);
    expect(result).toEqual({ n: 2 });
    expect(callCount).toBe(2);
  });
});
