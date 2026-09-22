import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobilePage } from "../../src/pages/MobilePage.js";
import * as mobileApi from "../../src/api/mobile-chat.js";

// Mock i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock QR Code module
vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,mockqrcodedata"),
  },
}));

describe("MobilePage component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show disconnected state with a generated pairing code and QR code", async () => {
    vi.spyOn(mobileApi, "getMobilePairingStatus").mockResolvedValue({});
    vi.spyOn(mobileApi, "generateMobilePairingCode").mockResolvedValue({ pairingCode: "123456" });

    render(<MobilePage />);

    // Initial loading state
    expect(screen.getByText("common.loading")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("mobile.waitingForConnection")).toBeInTheDocument();
    });

    // Code is displayed
    const codeEl = screen.getByText("123456");
    expect(codeEl).toBeInTheDocument();

    // QR code is displayed
    const qrImage = screen.getByAltText("Pairing QR Code");
    expect(qrImage).toHaveAttribute("src", "data:image/png;base64,mockqrcodedata");
  });

  it("should show connected state if already paired", async () => {
    vi.spyOn(mobileApi, "getMobilePairingStatus").mockResolvedValue({
      status: "connected",
      mobileDeviceId: "iPhone-15",
    } as any);

    render(<MobilePage />);

    await waitFor(() => {
      expect(screen.getByText("common.connected")).toBeInTheDocument();
    });

    // Uses the mobile.connectedDesc key
    // We mocked t(key) -> key, so it doesn't interpolate the args. The text would just be the key name.
    expect(screen.getByText("mobile.connectedDesc")).toBeInTheDocument();
    expect(screen.queryByAltText("Pairing QR Code")).not.toBeInTheDocument();
  });

  it("should allow disconnecting", async () => {
    vi.spyOn(mobileApi, "getMobilePairingStatus").mockResolvedValue({
      status: "connected",
      mobileDeviceId: "My-Phone",
    } as any);
    const disconnectSpy = vi.spyOn(mobileApi, "disconnectMobilePairing").mockResolvedValue({});

    // We must mock window.confirm to return true since it's used in handleDisconnect
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<MobilePage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "mobile.disconnect" })).toBeInTheDocument();
    });

    // Mock regenerating code post-disconnect
    const generateSpy = vi
      .spyOn(mobileApi, "generateMobilePairingCode")
      .mockResolvedValue({ pairingCode: "654321" });

    // Now simulate disconnect
    vi.spyOn(mobileApi, "getMobilePairingStatus").mockResolvedValue({});

    await userEvent.click(screen.getByRole("button", { name: "mobile.disconnect" }));

    expect(confirmSpy).toHaveBeenCalledWith("mobile.disconnectConfirm");
    expect(disconnectSpy).toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByText("mobile.waitingForConnection")).toBeInTheDocument();
    });

    expect(generateSpy).toHaveBeenCalled();
  });
});
