import { describe, it, expect, vi } from "vitest";
import { createCaptureUsage } from "./runtime.js";
import type { GatewayModelUsage } from "./sessions-usage.js";

function bucket(
  provider: string | undefined,
  model: string | undefined,
  totals: Partial<GatewayModelUsage["totals"]>,
): GatewayModelUsage {
  return {
    provider,
    model,
    count: 1,
    totals: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, totalCost: 0, ...totals },
  };
}

describe("createCaptureUsage", () => {
  it("asks the gateway for all-agent, all-time aggregates without per-session rows", async () => {
    const request = vi.fn().mockResolvedValue({ sessions: [], aggregates: { byModel: [] } });

    await createCaptureUsage(request)();

    expect(request).toHaveBeenCalledWith("sessions.usage", {
      agentScope: "all",
      range: "all",
      limit: 1,
    });
  });

  it("builds provider/model totals from aggregates.byModel", async () => {
    const request = vi.fn().mockResolvedValue({
      sessions: [],
      aggregates: {
        byModel: [
          bucket("rivonclaw-pro", "rivonclaw-flagship", {
            input: 4_300_000,
            output: 120_000,
            cacheRead: 9_000,
            cacheWrite: 1_000,
            totalCost: 1.5,
          }),
          bucket("anthropic", "claude-sonnet-4-5", { input: 10, output: 5, totalCost: 0.0000004 }),
        ],
      },
    });

    const usage = await createCaptureUsage(request)();

    expect(usage.get("rivonclaw-pro/rivonclaw-flagship")).toEqual({
      inputTokens: 4_300_000,
      outputTokens: 120_000,
      cacheReadTokens: 9_000,
      cacheWriteTokens: 1_000,
      totalCostUsd: "1.500000",
    });
    expect(usage.get("anthropic/claude-sonnet-4-5")).toEqual({
      inputTokens: 10,
      outputTokens: 5,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalCostUsd: "0.000000",
    });
    expect(usage.size).toBe(2);
  });

  it("buckets rows without provider/model under unknown and merges colliding keys", async () => {
    const request = vi.fn().mockResolvedValue({
      sessions: [],
      aggregates: {
        byModel: [
          bucket(undefined, undefined, { input: 1, totalCost: 0.25 }),
          bucket("unknown", "unknown", { input: 2, totalCost: 0.5 }),
        ],
      },
    });

    const usage = await createCaptureUsage(request)();

    expect(usage.get("unknown/unknown")).toMatchObject({
      inputTokens: 3,
      totalCostUsd: "0.750000",
    });
  });

  it("rejects when the gateway request fails instead of returning an empty map", async () => {
    const request = vi.fn().mockRejectedValue(new Error("OpenClawConnector: RPC client not connected"));

    await expect(createCaptureUsage(request)()).rejects.toThrow("RPC client not connected");
  });
});
