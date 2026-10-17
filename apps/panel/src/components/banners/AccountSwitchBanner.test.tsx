import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "../../i18n/index.js";
import { AccountSwitchBanner } from "./AccountSwitchBanner.js";
const mocks = vi.hoisted(() => ({
  fetchJson: vi.fn(),
  returnToOwner: vi.fn(),
  store: { currentUser: { userId: "bd-1" } },
}));
vi.mock("../../api/client.js", () => ({ fetchJson: mocks.fetchJson }));
vi.mock("../../api/account-switch.js", () => ({ returnToOwner: mocks.returnToOwner }));
vi.mock("../../store/EntityStoreProvider.js", () => ({ useEntityStore: () => mocks.store }));
beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage("en");
});
afterEach(cleanup);
describe("AccountSwitchBanner", () => {
  it("shows the actual member identity and restores the owner", async () => {
    mocks.fetchJson.mockResolvedValue({
      accountSwitch: { ownerLabel: "Owner", memberLabel: "Assigned BD" },
    });
    mocks.returnToOwner.mockResolvedValue(undefined);
    render(<AccountSwitchBanner />);
    expect(await screen.findByText("Signed in as Assigned BD")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Return to main account" }));
    await waitFor(() => expect(mocks.returnToOwner).toHaveBeenCalledOnce());
  });
  it("stays absent during an ordinary member login", async () => {
    mocks.fetchJson.mockResolvedValue({ accountSwitch: null });
    render(<AccountSwitchBanner />);
    await waitFor(() => expect(mocks.fetchJson).toHaveBeenCalledOnce());
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("keeps the return action visible and surfaces restoration errors", async () => {
    mocks.fetchJson.mockResolvedValue({
      accountSwitch: { ownerLabel: "Owner", memberLabel: "BD" },
    });
    mocks.returnToOwner.mockRejectedValue(new Error("Owner session unavailable"));
    render(<AccountSwitchBanner />);
    fireEvent.click(await screen.findByRole("button", { name: "Return to main account" }));
    expect(await screen.findByText(/Owner session unavailable/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Return to main account" })).toBeTruthy();
  });
});
