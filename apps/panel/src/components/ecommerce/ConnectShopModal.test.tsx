// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformApp } from "@rivonclaw/core/models";
import i18n from "../../i18n/index.js";
import { ConnectShopModal } from "./ConnectShopModal.js";

const platformApps = [
  {
    id: "us-local-app",
    market: "US",
    platform: "TIKTOK_SHOP",
    sellerType: "LOCAL",
    status: "ACTIVE",
    label: "TikTok Shop US Local",
    apiBaseUrl: "https://open-api.tiktokglobalshop.com",
    authLinkUrl: "https://services.tiktokshop.com/open/authorize",
  },
  {
    id: "gb-local-app",
    market: "GB",
    platform: "TIKTOK_SHOP",
    sellerType: "LOCAL",
    status: "ACTIVE",
    label: "TikTok Shop GB Local",
    apiBaseUrl: "https://open-api.tiktokglobalshop.com",
    authLinkUrl: "https://services.tiktokshop.com/open/authorize",
  },
  {
    id: "mx-local-app",
    market: "MX",
    platform: "TIKTOK_SHOP",
    sellerType: "LOCAL",
    status: "ACTIVE",
    label: "TikTok Shop MX Local",
    apiBaseUrl: "https://open-api.tiktokglobalshop.com",
    authLinkUrl: "https://services.tiktokshop.com/open/authorize",
  },
  {
    id: "mx-cross-border-app",
    market: "MX",
    platform: "TIKTOK_SHOP",
    sellerType: "CROSS_BORDER",
    status: "ACTIVE",
    label: "TikTok Shop MX Cross-Border",
    apiBaseUrl: "https://open-api.tiktokglobalshop.com",
    authLinkUrl: "https://services.tiktokshop.com/open/authorize",
  },
] as unknown as PlatformApp[];

function renderModal(onConnectShop = vi.fn()) {
  render(
    <ConnectShopModal
      isOpen
      onClose={() => {}}
      platformApps={platformApps}
      oauthLoading={false}
      oauthWaiting={false}
      oauthAuthUrl={null}
      linkCopied={false}
      onConnectShop={onConnectShop}
      onCopyAuthUrl={() => {}}
      onCancelOAuth={() => {}}
    />,
  );
  return onConnectShop;
}

function choose(label: string, option: string) {
  fireEvent.click(screen.getByRole("button", { name: label }));
  fireEvent.click(screen.getByRole("button", { name: option }));
}

describe("ConnectShopModal", () => {
  afterEach(cleanup);

  beforeEach(async () => {
    await i18n.changeLanguage("zh");
  });

  it("requires platform, market, and seller type before authorization", () => {
    const onConnectShop = renderModal();
    const platformSelect = screen.getByRole("button", { name: "平台" });
    const marketSelect = screen.getByRole("button", { name: "地区 / 市场" });
    const sellerTypeSelect = screen.getByRole("button", { name: "卖家类型" });
    const authorizeButton = screen.getByRole("button", { name: "授权" }) as HTMLButtonElement;

    expect(platformSelect.textContent).toContain("TikTok 商店");
    expect((marketSelect as HTMLButtonElement).disabled).toBe(false);
    expect((sellerTypeSelect as HTMLButtonElement).disabled).toBe(true);
    expect(authorizeButton.disabled).toBe(true);

    choose("地区 / 市场", "英国");
    expect((sellerTypeSelect as HTMLButtonElement).disabled).toBe(false);
    expect(sellerTypeSelect.textContent).toContain("本土卖家");
    expect(authorizeButton.disabled).toBe(false);
    fireEvent.click(authorizeButton);
    expect(onConnectShop).toHaveBeenCalledWith("gb-local-app");
  });

  it("exposes local and cross-border sellers only for Mexico", () => {
    const onConnectShop = renderModal();
    choose("平台", "TikTok 商店");
    choose("地区 / 市场", "墨西哥");

    expect(screen.getByRole("button", { name: "卖家类型" }).textContent).toContain("本土卖家");

    fireEvent.click(screen.getByRole("button", { name: "卖家类型" }));
    expect(screen.getByRole("button", { name: "本土卖家" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "跨境卖家" }));

    fireEvent.click(screen.getByRole("button", { name: "授权" }));
    expect(onConnectShop).toHaveBeenCalledWith("mx-cross-border-app");
  });

  it("exposes only local sellers for the United States", () => {
    renderModal();
    choose("平台", "TikTok 商店");
    choose("地区 / 市场", "美国");

    fireEvent.click(screen.getByRole("button", { name: "卖家类型" }));
    expect(screen.getByRole("button", { name: "本土卖家" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "跨境卖家" })).toBeNull();
  });

  it("searches markets by both raw region code and localized label", () => {
    renderModal();
    choose("平台", "TikTok 商店");
    fireEvent.click(screen.getByRole("button", { name: "地区 / 市场" }));

    const searchInput = screen.getByRole("textbox", { name: "搜索地区代码或名称..." });
    fireEvent.change(searchInput, { target: { value: "MX" } });
    expect(screen.getByRole("button", { name: "墨西哥" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "美国" })).toBeNull();

    fireEvent.change(searchInput, { target: { value: "墨西哥" } });
    expect(screen.getByRole("button", { name: "墨西哥" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "美国" })).toBeNull();
  });
});
