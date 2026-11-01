import { describe, it, expect, vi } from "vitest";
import { handleMobileSessionResetRequest } from "./session-reset.js";

vi.mock("@rivonclaw/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

const req = { pairingId: "pairing-1", sessionKey: "agent:main:mobile:direct:m1", requestId: "req-1" };

function setup(request: (method: string, params: unknown) => Promise<unknown>) {
  const calls: Array<{ method: string; params: unknown }> = [];
  const deps = {
    request: vi.fn(async (method: string, params: unknown) => {
      calls.push({ method, params });
      return request(method, params);
    }),
    broadcastEvent: vi.fn(),
  };
  return { deps, calls };
}

describe("handleMobileSessionResetRequest", () => {
  it("calls sessions.reset, notifies Panel, then reports ok to the plugin", async () => {
    const { deps, calls } = setup(async () => ({ ok: true }));
    await handleMobileSessionResetRequest(req, deps);

    expect(calls).toEqual([
      { method: "sessions.reset", params: { key: req.sessionKey } },
      {
        method: "mobile_chat_reset_result",
        params: { pairingId: "pairing-1", requestId: "req-1", ok: true },
      },
    ]);
    expect(deps.broadcastEvent).toHaveBeenCalledWith("session-reset", {
      sessionKey: req.sessionKey,
    });
  });

  it("reports the gateway error to the plugin and skips the Panel broadcast", async () => {
    const { deps, calls } = setup(async (method) => {
      if (method === "sessions.reset") throw new Error("session busy");
      return {};
    });
    await handleMobileSessionResetRequest(req, deps);

    expect(calls[1]).toEqual({
      method: "mobile_chat_reset_result",
      params: { pairingId: "pairing-1", requestId: "req-1", ok: false, error: "session busy" },
    });
    expect(deps.broadcastEvent).not.toHaveBeenCalled();
  });

  it("does not reject when the plugin cannot be reached", async () => {
    const { deps } = setup(async (method) => {
      if (method === "mobile_chat_reset_result") throw new Error("rpc down");
      return {};
    });
    await expect(handleMobileSessionResetRequest(req, deps)).resolves.toBeUndefined();
  });
});
