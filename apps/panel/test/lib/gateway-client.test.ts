// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import { GatewayChatClient } from "../../src/lib/gateway-client.js";

describe("GatewayChatClient keepalive control", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("only starts keepalive after it is explicitly enabled on an authenticated connection", () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const client = new GatewayChatClient({
      url: "ws://127.0.0.1:59457",
      autoStartKeepalive: false,
    });

    client.setKeepaliveEnabled(true);
    expect(setIntervalSpy).not.toHaveBeenCalled();

    (client as { authenticated: boolean }).authenticated = true;
    client.setKeepaliveEnabled(true);
    expect(setIntervalSpy).toHaveBeenCalledOnce();

    client.setKeepaliveEnabled(false);
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
