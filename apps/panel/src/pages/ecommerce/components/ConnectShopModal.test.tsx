// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformApp } from "@rivonclaw/core/models";
import i18n from "../../../i18n/index.js";
import { ConnectShopModal } from "./ConnectShopModal.js";

const stalePlatformApps = [
  {
    id: "us-app",
    market: "US",
    platform: "TIKTOK_SHOP",
    status: "ACTIVE",
    label: "TikTok Shop US",
    apiBaseUrl: "https://open-api.tiktokglobalshop.com",
    authLinkUrl: "https://services.tiktokshop.com/open/authorize",
  },
  {
    id: "gb-shared-app",
    market: "GB",
    platform: "TIKTOK_SHOP",
    status: "ACTIVE",
    label: "TikTok Shop Global",
    apiBaseUrl: "https://open-api.tiktokglobalshop.com",
    authLinkUrl: "https://services.tiktokshop.com/open/authorize",
  },
] as unknown as PlatformApp[];

describe("ConnectShopModal", () => {
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
});
