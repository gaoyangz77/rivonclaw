import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCreditsClient } from "../index.js";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("createCreditsClient", () => {
  const client = createCreditsClient("https://api.example.com");
  beforeEach(() => vi.clearAllMocks());

  it("deviceAuth: POST /api/auth/device and returns token + balance", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ token: "jwt-abc", balance: 100 }), { status: 200 })
    );
    const result = await client.deviceAuth("device-123");
    expect(result).toEqual({ token: "jwt-abc", balance: 100 });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/auth/device",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("getBalance: GET /api/credits/balance with auth header", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ balance: 42 }), { status: 200 })
    );
    const balance = await client.getBalance("jwt-token");
    expect(balance).toBe(42);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/credits/balance",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer jwt-token" }),
      })
    );
  });

  it("getBalance: throws on 401", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );
    await expect(client.getBalance("bad-token")).rejects.toThrow("Unauthorized");
  });

  it("proxyStream: returns Response from POST /api/proxy/openrouter/chat/completions", async () => {
    const mockRes = new Response("data: {}\n\n", { status: 200 });
    fetchMock.mockResolvedValueOnce(mockRes);
    const res = await client.proxyStream("jwt-token", { model: "openai/gpt-4o", messages: [] });
    expect(res.status).toBe(200);
  });

  it("proxyStream: returns raw Response without throwing on non-ok status", async () => {
    const mockRes = new Response(JSON.stringify({ error: "Insufficient credits" }), { status: 402 });
    fetchMock.mockResolvedValueOnce(mockRes);
    const res = await client.proxyStream("jwt-token", { model: "openai/gpt-4o", messages: [] });
    expect(res.status).toBe(402);
    // Must NOT throw — proxyStream returns raw Response regardless of status
  });
});
