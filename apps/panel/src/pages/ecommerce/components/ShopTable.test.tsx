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
  "ecommerce.searchShops": "Search shops",
  "ecommerce.noMatchingShops": "No matching shops.",
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
  alias?: string | null;
  collectionKey?: string;
  authStatus?: "AUTHORIZED" | "TOKEN_EXPIRED";
  customerServiceEnabled?: boolean;
}): Shop {
  return {
    id: input.id,
    shopName: input.shopName,
    collectionKey: input.collectionKey,
    alias: input.alias ?? null,
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
  it("filters loaded shops by name or alias and restores all rows when cleared", () => {
    render(
      <ShopTable
        shops={[
          createShop({ id: "one", shopName: "Alpha Store", alias: "主店" }),
          createShop({ id: "two", shopName: "Beta Store", alias: "Outlet" }),
          createShop({ id: "three", shopName: "Gamma Store" }),
        ]}
        oauthLoading={false}
        oauthWaiting={false}
        refreshing={false}
        onRefresh={vi.fn()}
        onAddShop={vi.fn()}
        onUpdateAlias={vi.fn()}
        onOpenDrawer={vi.fn()}
        onReauthorize={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );

    const search = screen.getByRole("searchbox", { name: "Search shops" });
    fireEvent.change(search, { target: { value: "  aLPHa  " } });
    expect(screen.getByRole("row", { name: "View Alpha Store" })).toBeTruthy();
    expect(screen.queryByRole("row", { name: "View Beta Store" })).toBeNull();

    fireEvent.change(search, { target: { value: "主" } });
    expect(screen.getByRole("row", { name: "View Alpha Store" })).toBeTruthy();

    fireEvent.change(search, { target: { value: "outLET" } });
    expect(screen.getByRole("row", { name: "View Beta Store" })).toBeTruthy();
    expect(screen.queryByRole("row", { name: "View Alpha Store" })).toBeNull();

    fireEvent.change(search, { target: { value: "no match" } });
    expect(screen.getByRole("status").textContent).toBe("No matching shops.");
    expect(screen.queryByRole("table")).toBeNull();

    fireEvent.change(search, { target: { value: "" } });
    for (const name of ["Alpha Store", "Beta Store", "Gamma Store"]) {
      expect(screen.getByRole("row", { name: `View ${name}` })).toBeTruthy();
    }
  });

  it("reveals search matches in collapsed collections and restores the collapse state", () => {
    render(
      <ShopTable
        shops={[
          createShop({ id: "us", shopName: "Group", collectionKey: "group" }),
          createShop({ id: "fr", shopName: "Group France", collectionKey: "group" }),
        ]}
        oauthLoading={false}
        oauthWaiting={false}
        refreshing={false}
        onRefresh={vi.fn()}
        onAddShop={vi.fn()}
        onUpdateAlias={vi.fn()}
        onOpenDrawer={vi.fn()}
        onReauthorize={vi.fn()}
        onRequestDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Collapse Group" }));
    expect(screen.queryByRole("row", { name: "View Group France" })).toBeNull();
    const search = screen.getByRole("searchbox", { name: "Search shops" });
    fireEvent.change(search, { target: { value: "group" } });
    expect(screen.getByRole("row", { name: "View Group France" })).toBeTruthy();
    fireEvent.change(search, { target: { value: "" } });
    expect(screen.queryByRole("row", { name: "View Group France" })).toBeNull();
  });

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

  it("opens details from the row while keeping inline controls independent", () => {
    const onOpenDrawer = vi.fn();
    const onRequestDelete = vi.fn();
    render(
      <ShopTable
        shops={[createShop({ id: "solo", shopName: "Solo" })]}
        oauthLoading={false}
        oauthWaiting={false}
        refreshing={false}
        onRefresh={vi.fn()}
        onAddShop={vi.fn()}
        onUpdateAlias={vi.fn().mockResolvedValue(undefined)}
        onOpenDrawer={onOpenDrawer}
        onReauthorize={vi.fn()}
        onRequestDelete={onRequestDelete}
      />,
    );

    expect(screen.queryByRole("button", { name: "View" })).toBeNull();
    const row = screen.getByRole("row", { name: "View Solo" });
    fireEvent.click(row);
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: " " });
    expect(onOpenDrawer).toHaveBeenCalledTimes(3);
    expect(onOpenDrawer).toHaveBeenLastCalledWith("solo");

    fireEvent.click(screen.getByRole("textbox", { name: "Alias Solo" }));
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(onOpenDrawer).toHaveBeenCalledTimes(3);
    expect(onRequestDelete).toHaveBeenCalledWith("solo");
  });
});
