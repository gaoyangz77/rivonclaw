import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HostAdapter, HostCapability } from "./host-adapter.js";

function fakeHost(capabilities: HostCapability[]): HostAdapter {
  return {
    kind: "web",
    capabilities: new Set(capabilities),
  } as unknown as HostAdapter;
}

describe("host installation", () => {
  beforeEach(() => vi.resetModules());

  it("fails fast when read before a host is installed", async () => {
    const { getHost } = await import("./index.js");
    expect(() => getHost()).toThrow(/not installed/);
  });

  it("returns the installed host and answers capability questions against it", async () => {
    const { installHost, getHost, hostSupports } = await import("./index.js");
    const host = fakeHost(["channels", "localCron"]);
    installHost(host);
    expect(getHost()).toBe(host);
    expect(hostSupports()).toBe(true);
    expect(hostSupports("channels")).toBe(true);
    expect(hostSupports("channels", "localCron")).toBe(true);
    expect(hostSupports("channels", "stt")).toBe(false);
  });
});
