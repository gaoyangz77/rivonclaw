import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getHost, installHost, type HostAdapter } from "../host/index.js";
import { cloudFetchJson } from "./cloud-client.js";

const desktop = getHost();
const cloudFetch = vi.fn();

beforeEach(() => {
  cloudFetch.mockReset();
  installHost({ ...desktop, cloud: { fetch: cloudFetch } } as HostAdapter);
});
afterEach(() => installHost(desktop));

describe("cloudFetchJson", () => {
  it("sends through the host with a JSON content type unless the caller sets headers", async () => {
    cloudFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    await expect(cloudFetchJson("/api/cloud/x", { method: "POST" })).resolves.toEqual({ ok: true });
    expect(cloudFetch).toHaveBeenCalledWith("/api/cloud/x", {
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  });

  it("raises the server's message and code on failure", async () => {
    cloudFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "nope", errorCode: "E1" }), { status: 400 }),
    );
    await expect(cloudFetchJson("/api/cloud/x")).rejects.toMatchObject({ message: "nope", code: "E1" });
  });
});
