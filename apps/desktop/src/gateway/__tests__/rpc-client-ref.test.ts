import { describe, it, expect, beforeEach } from "vitest";
import { getRpcClient, setRpcClient } from "../rpc-client-ref.js";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("rpc-client-ref", () => {
  beforeEach(() => {
    setRpcClient(null);
  });

  it("returns null initially", () => {
    expect(getRpcClient()).toBeNull();
  });

  it("returns the mock client after setRpcClient()", () => {
    const mockClient = { request: () => {} } as any;
    setRpcClient(mockClient);
    expect(getRpcClient()).toBe(mockClient);
  });

  it("clears back to null after setRpcClient(null)", () => {
    const mockClient = { request: () => {} } as any;
    setRpcClient(mockClient);
    expect(getRpcClient()).toBe(mockClient);

    setRpcClient(null);
    expect(getRpcClient()).toBeNull();
  });
});
