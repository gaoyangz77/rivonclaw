import { beforeEach, describe, expect, it } from "vitest";
import {
  buildGatewayDeviceAuthPayload,
  loadOrCreateGatewayDeviceIdentity,
} from "./gateway-device-identity.js";

describe("gateway device identity", () => {
  beforeEach(() => localStorage.clear());

  it("persists one Ed25519 identity and produces verifiable signatures", async () => {
    const first = await loadOrCreateGatewayDeviceIdentity();
    const second = await loadOrCreateGatewayDeviceIdentity();
    const payload = "v3|signed gateway challenge";
    const signature = await first.sign(payload);

    expect(first.deviceId).toMatch(/^[0-9a-f]{64}$/);
    expect(second.deviceId).toBe(first.deviceId);
    expect(second.publicKey).toBe(first.publicKey);
    expect(signature).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("builds the canonical v3 payload with normalized device metadata", () => {
    expect(
      buildGatewayDeviceAuthPayload({
        deviceId: "device",
        clientId: "openclaw-control-ui",
        clientMode: "webchat",
        role: "operator",
        scopes: ["operator.admin"],
        signedAtMs: 123,
        token: "token",
        nonce: "nonce",
        platform: "MacIntel",
      }),
    ).toBe(
      "v3|device|openclaw-control-ui|webchat|operator|operator.admin|123|token|nonce|macintel|",
    );
  });
});
