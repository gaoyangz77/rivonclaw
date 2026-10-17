import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { returnToOwner, switchToMember } from "./account-switch.js";

const mocks = vi.hoisted(() => ({ fetchJson: vi.fn(), assign: vi.fn() }));
vi.mock("./client.js", () => ({ fetchJson: mocks.fetchJson }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("window", { location: { assign: mocks.assign } });
});
afterEach(() => vi.unstubAllGlobals());

describe("account switching navigation", () => {
  it("reloads the actual account route after switching identity", async () => {
    mocks.fetchJson.mockResolvedValueOnce({ memberLoginAvailable: true });
    mocks.fetchJson.mockResolvedValue({ ok: true });
    await switchToMember("bd-1");
    expect(mocks.fetchJson.mock.calls[1][1]).toEqual({
      method: "POST",
      body: JSON.stringify({ memberId: "bd-1" }),
    });
    expect(mocks.assign).toHaveBeenCalledWith("/account/profile");
    await returnToOwner();
    expect(mocks.assign).toHaveBeenCalledTimes(2);
  });

  it("keeps the current page when the identity change fails", async () => {
    mocks.fetchJson.mockResolvedValueOnce({ memberLoginAvailable: true });
    mocks.fetchJson.mockRejectedValue(new Error("Member disabled"));
    await expect(switchToMember("disabled-bd")).rejects.toThrow("Member disabled");
    expect(mocks.assign).not.toHaveBeenCalled();
  });

  it("reports an old Desktop without attempting the missing switch endpoint", async () => {
    mocks.fetchJson.mockResolvedValueOnce({ authenticated: true });
    await expect(switchToMember("bd-1")).rejects.toMatchObject({
      code: "ACCOUNT_SWITCH_CLIENT_UNAVAILABLE",
    });
    expect(mocks.fetchJson).toHaveBeenCalledTimes(1);
    expect(mocks.assign).not.toHaveBeenCalled();
  });
});
