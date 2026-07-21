// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformApp } from "@rivonclaw/core/models";
import i18n from "../../../i18n/index.js";
import { ConnectShopModal } from "./ConnectShopModal.js";

const stalePlatformApps = [
  {
    id: "us-app",
    market: "US",
    platform: "TIKTOK_SHOP",
    sellerType: "LOCAL",
    status: "ACTIVE",
    label: "TikTok Shop US",
    apiBaseUrl: "https://open-api.tiktokglobalshop.com",
    authLinkUrl: "https://services.tiktokshop.com/open/authorize",
  },
  {
    id: "gb-shared-app",
    market: "GB",
    platform: "TIKTOK_SHOP",
    sellerType: "LOCAL",
    status: "ACTIVE",
    label: "TikTok Shop Global",
    apiBaseUrl: "https://open-api.tiktokglobalshop.com",
    authLinkUrl: "https://services.tiktokshop.com/open/authorize",
  },
] as unknown as PlatformApp[];

describe("ConnectShopModal", () => {
  afterEach(cleanup);

  beforeEach(async () => {
    await i18n.changeLanguage("zh");
  });

  it("shows the US and other-regions OAuth groups without search", async () => {
    const onConnectShop = vi.fn();
    render(
      <ConnectShopModal
        isOpen
        onClose={() => {}}
        platformApps={stalePlatformApps}
        oauthLoading={false}
        oauthWaiting={false}
        oauthAuthUrl={null}
        linkCopied={false}
        onConnectShop={onConnectShop}
        onCopyAuthUrl={() => {}}
        onCancelOAuth={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "地区 / 市场" }));
    expect(screen.getByRole("button", { name: "美国" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "其他地区" })).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "其他地区" }));

    await waitFor(() => {
      expect((screen.getByRole("button", { name: "授权" }) as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(screen.getByRole("button", { name: "授权" }));
    expect(onConnectShop).toHaveBeenCalledWith("gb-shared-app");
  });

  it("selects the dedicated Mexico cross-border PlatformApp", async () => {
    const onConnectShop = vi.fn();
    const mexicoApps = [
      ...stalePlatformApps,
      {
        ...stalePlatformApps[1],
        id: "mx-local-app",
        market: "MX",
        sellerType: "LOCAL",
        label: "TikTok Shop MX Local",
      },
      {
        ...stalePlatformApps[1],
        id: "mx-cross-border-app",
        market: "MX",
        sellerType: "CROSS_BORDER",
        label: "TikTok Shop MX Cross-Border",
      },
    ] as PlatformApp[];
    render(
      <ConnectShopModal
        isOpen
        onClose={() => {}}
        platformApps={mexicoApps}
        oauthLoading={false}
        oauthWaiting={false}
        oauthAuthUrl={null}
        linkCopied={false}
        onConnectShop={onConnectShop}
        onCopyAuthUrl={() => {}}
        onCancelOAuth={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "地区 / 市场" }));
    fireEvent.click(screen.getByRole("button", { name: "墨西哥" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "卖家类型" }).textContent).toContain("本土卖家");
    });
    fireEvent.click(screen.getByRole("button", { name: "卖家类型" }));
    fireEvent.click(screen.getByRole("button", { name: "跨境卖家" }));

    await waitFor(() => {
      expect((screen.getByRole("button", { name: "授权" }) as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(screen.getByRole("button", { name: "授权" }));
    expect(onConnectShop).toHaveBeenCalledWith("mx-cross-border-app");
  });
});
