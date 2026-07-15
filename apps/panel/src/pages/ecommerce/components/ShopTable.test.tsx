// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Shop } from "@rivonclaw/core/models";
import { ShopTable } from "./ShopTable.js";

const translations: Record<string, string> = {
  "billing.allowed": "Enabled",
  "chat.collapseMessage": "Collapse",
  "chat.expandMessage": "Expand",
  "ecommerce.shops": "Shops",
  "ecommerce.shopsSubtitle": "Connected shops",
  "ecommerce.refreshShops": "Refresh shops",
  "ecommerce.addShop": "Add shop",
  "ecommerce.table.headers.name": "Shop name",
  "ecommerce.table.headers.alias": "Alias",
  "ecommerce.table.headers.platform": "Platform",
  "ecommerce.table.headers.region": "Region",
  "ecommerce.table.headers.authStatus": "Authorization",
  "ecommerce.table.headers.csBalance": "AI customer service",
  "ecommerce.table.headers.actions": "Actions",
  "ecommerce.table.aliasPlaceholder": "Alias",
  "ecommerce.view": "View",
  "ecommerce.disconnect": "Disconnect",
  "tiktokShops.authStatus_AUTHORIZED": "Authorized",
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => translations[key] ?? key,
  }),
}));

vi.mock("./BalanceBadge.js", () => ({
  BalanceBadge: () => <span>Balance</span>,
}));

function createShop(input: {
  id: string;
  shopName: string;
  collectionKey?: string;
  authStatus?: "AUTHORIZED" | "TOKEN_EXPIRED";
  customerServiceEnabled?: boolean;
}): Shop {
  return {
    id: input.id,
    shopName: input.shopName,
    collectionKey: input.collectionKey,
    alias: null,
    platform: "TIKTOK_SHOP",
    region: "US",
    authStatus: input.authStatus ?? "AUTHORIZED",
    services: {
      customerService: { enabled: input.customerServiceEnabled ?? true },
    },
  } as unknown as Shop;
}

afterEach(() => {
  cleanup();
});

describe("ShopTable collection hierarchy", () => {
  it("shows semantic collection summaries, name sorting, and collapsible children", () => {
    render(
      <ShopTable
        shops={[
          createShop({ id: "solo", shopName: "Solo" }),
          createShop({
            id: "group-fr",
            shopName: "Group France",
            collectionKey: "group",
            customerServiceEnabled: false,
          }),
          createShop({ id: "group", shopName: "Group", collectionKey: "group" }),
        ]}
        oauthLoading={false}
        oauthWaiting={false}
        refreshing={false}
        onRefresh={vi.fn()}
        onAddShop={vi.fn()}
        onUpdateAlias={vi.fn().mockResolvedValue(undefined)}
        onOpenDrawer={vi.fn()}
        onReauthorize={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "Shop name" }).getAttribute("aria-sort")).toBe(
      "ascending",
    );
    expect(screen.queryByText("Group + 1")).toBeNull();
    expect(screen.getByText("2 Shops")).toBeTruthy();
    expect(screen.getByText("2/2 Authorized")).toBeTruthy();
    expect(screen.getByText("1/2 Enabled")).toBeTruthy();
    expect(screen.getByText("Group France")).toBeTruthy();

    const collapseButton = screen.getByRole("button", { name: "Collapse Group" });
    expect(collapseButton.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(collapseButton);

    expect(screen.queryByText("Group France")).toBeNull();
    const expandButton = screen.getByRole("button", { name: "Expand Group" });
    expect(expandButton.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(expandButton);
    expect(screen.getByText("Group France")).toBeTruthy();
  });
});
