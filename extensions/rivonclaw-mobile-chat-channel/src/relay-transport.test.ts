import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RelayTransport } from "./relay-transport";
import { WebSocket } from "ws";

// We test the ack-matching logic by directly exercising the private handleIncoming
// method and the public joinPairing API with a fake WebSocket.

describe("RelayTransport joinPairing ack matching", () => {
  let transport: RelayTransport;
  let fakeWs: any;

  beforeEach(() => {
    vi.useFakeTimers();
    transport = new RelayTransport();

    // Create a minimal fake WebSocket that looks OPEN
    fakeWs = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
    };

    // Inject the fake WebSocket into the transport
    (transport as any).ws = fakeWs;
    (transport as any).status = "online";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function simulateIncoming(data: object) {
    (transport as any).handleIncoming(data);
  }

  it("should resolve a single joinPairing on matching join_ack", async () => {
    const joinPromise = transport.joinPairing("pairing-A", "token-A");

    simulateIncoming({
      type: "join_ack",
      accessToken: "token-A",
      pairingId: "pairing-A",
      peerOnline: true,
    });

    const result = await joinPromise;
    expect(result).toEqual({ pairingId: "pairing-A", peerOnline: true });
  });

  it("should resolve two concurrent joinPairing calls correctly when acks arrive in reverse order", async () => {
    const joinA = transport.joinPairing("pairing-A", "token-A");
    const joinB = transport.joinPairing("pairing-B", "token-B");

    // Acks arrive in reverse order: B first, then A
    simulateIncoming({
      type: "join_ack",
      accessToken: "token-B",
      pairingId: "pairing-B",
      peerOnline: false,
    });

    simulateIncoming({
      type: "join_ack",
      accessToken: "token-A",
      pairingId: "pairing-A",
      peerOnline: true,
    });

    const resultA = await joinA;
    const resultB = await joinB;

    expect(resultA).toEqual({ pairingId: "pairing-A", peerOnline: true });
    expect(resultB).toEqual({ pairingId: "pairing-B", peerOnline: false });
  });

  it("should reject only the matching joinPairing on join_err without affecting the other", async () => {
    const joinA = transport.joinPairing("pairing-A", "token-A");
    const joinB = transport.joinPairing("pairing-B", "token-B");

    // Error for A only
    simulateIncoming({
      type: "join_err",
      accessToken: "token-A",
      error: "pairing not found",
    });

    // Ack for B
    simulateIncoming({
      type: "join_ack",
      accessToken: "token-B",
      pairingId: "pairing-B",
      peerOnline: true,
    });

    await expect(joinA).rejects.toThrow("pairing not found");
    const resultB = await joinB;
    expect(resultB).toEqual({ pairingId: "pairing-B", peerOnline: true });
  });

  it("should timeout each pending join independently", async () => {
    const joinA = transport.joinPairing("pairing-A", "token-A");
    const joinB = transport.joinPairing("pairing-B", "token-B");

    // Advance past the 10s timeout
    vi.advanceTimersByTime(10_001);

    await expect(joinA).rejects.toThrow("join timeout");
    await expect(joinB).rejects.toThrow("join timeout");
  });

  it("should ignore a join_ack with an unknown accessToken", async () => {
    const joinA = transport.joinPairing("pairing-A", "token-A");

    // Ack with a non-matching token — should not resolve joinA
    simulateIncoming({
      type: "join_ack",
      accessToken: "token-unknown",
      pairingId: "pairing-unknown",
      peerOnline: false,
    });

    // joinA should still be pending; advance past timeout to confirm
    vi.advanceTimersByTime(10_001);
    await expect(joinA).rejects.toThrow("join timeout");
  });

  it("should return immediately with peerOnline false when WebSocket is not open", async () => {
    // Set ws to null to simulate no connection
    (transport as any).ws = null;

    const result = await transport.joinPairing("pairing-X", "token-X");
    expect(result).toEqual({ pairingId: "pairing-X", peerOnline: false });
  });
});
