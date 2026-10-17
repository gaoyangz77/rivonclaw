import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import i18n from "../../i18n/index.js";
import { AffiliateBdDeviceBanner } from "./AffiliateBdDeviceBanner.js";

const mocks = vi.hoisted(() => ({
  store: {
    currentUser: { userId: "seller-1" } as { userId: string } | null,
    authBootstrap: { status: "ready" },
  },
  useQuery: vi.fn(),
}));
vi.mock("../../store/EntityStoreProvider.js", () => ({ useEntityStore: () => mocks.store }));
vi.mock("@apollo/client/react", () => ({ useQuery: mocks.useQuery }));

function developers() {
  return {
    data: {
      affiliateBusinessDevelopers: [
        { displayName: "Needs device", deviceId: "  ", archivedAt: null },
        { displayName: "Assigned", deviceId: "device-1", archivedAt: null },
        { displayName: "Archived", deviceId: null, archivedAt: "2026-10-01T00:00:00Z" },
      ],
    },
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.store.currentUser = { userId: "seller-1" };
  mocks.store.authBootstrap.status = "ready";
  mocks.useQuery.mockReturnValue(developers());
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

describe("AffiliateBdDeviceBanner", () => {
  it("shows active deviceless BDs and keeps the team navigation action", () => {
    const onNavigate = vi.fn();
    render(<AffiliateBdDeviceBanner onNavigate={onNavigate} />);
    expect(screen.getByRole("alert").textContent).toContain("Needs device");
    expect(screen.getByRole("alert").textContent).not.toContain("Assigned");
    expect(screen.getByRole("alert").textContent).not.toContain("Archived");
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("ecommerce.affiliateTeam.deviceBannerAction") }),
    );
    expect(onNavigate).toHaveBeenCalledWith("/commerce/affiliate/team");
  });

  it("stays dismissed across navigation rerenders and query updates during this launch", () => {
    const { rerender } = render(<AffiliateBdDeviceBanner onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: i18n.t("common.close") }));
    expect(screen.queryByRole("alert")).toBeNull();
    mocks.useQuery.mockReturnValue({
      data: { affiliateBusinessDevelopers: [{ displayName: "Another BD", deviceId: null }] },
    });
    rerender(<AffiliateBdDeviceBanner onNavigate={vi.fn()} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mocks.useQuery.mock.calls.at(-1)?.[1].skip).toBe(true);
  });

  it("shows the warning again on the next App mount", () => {
    const { unmount } = render(<AffiliateBdDeviceBanner onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: i18n.t("common.close") }));
    unmount();
    render(<AffiliateBdDeviceBanner onNavigate={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("does not hide a different account's warning after account switching", () => {
    const { rerender } = render(<AffiliateBdDeviceBanner onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: i18n.t("common.close") }));
    mocks.store.currentUser = { userId: "seller-2" };
    rerender(<AffiliateBdDeviceBanner onNavigate={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: i18n.t("common.close") }));
    mocks.store.currentUser = { userId: "seller-1" };
    rerender(<AffiliateBdDeviceBanner onNavigate={vi.fn()} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not show a warning without missing devices or before authentication is ready", () => {
    mocks.useQuery.mockReturnValue({ data: { affiliateBusinessDevelopers: [] } });
    const { rerender } = render(<AffiliateBdDeviceBanner onNavigate={vi.fn()} />);
    expect(screen.queryByRole("alert")).toBeNull();
    mocks.useQuery.mockReturnValue(developers());
    mocks.store.authBootstrap.status = "loading";
    rerender(<AffiliateBdDeviceBanner onNavigate={vi.fn()} />);
    expect(screen.queryByRole("alert")).toBeNull();
    mocks.store.authBootstrap.status = "ready";
    mocks.store.currentUser = null;
    rerender(<AffiliateBdDeviceBanner onNavigate={vi.fn()} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
