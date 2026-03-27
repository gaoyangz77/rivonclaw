import { describe, it, expect, vi, beforeEach } from "vitest";
import { panelServerFetch, panelServerFireAndForget } from "../panel-server-client.js";

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("panelServerFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds the correct URL from path", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await panelServerFetch("/api/tools/run-profile");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:3210/api/tools/run-profile");
  });

  it("sets Content-Type header by default", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await panelServerFetch("/api/test");

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("throws on non-2xx response", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(500, { error: "Internal" }));

    await expect(panelServerFetch("/api/fail")).rejects.toThrow(
      /Panel-server error 500/,
    );
  });

  it("returns parsed JSON on success", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { data: "result" }));

    const result = await panelServerFetch("/api/test");

    expect(result).toEqual({ data: "result" });
  });
});

describe("panelServerFireAndForget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not throw on fetch error", () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    // Should not throw
    expect(() => panelServerFireAndForget("/api/test")).not.toThrow();
  });

  it("calls fetch with the correct URL", () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {}));

    panelServerFireAndForget("/api/test", {
      method: "POST",
      body: JSON.stringify({ key: "value" }),
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:3210/api/test");
  });
});
