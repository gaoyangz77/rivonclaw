// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import i18n from "../../../i18n/index.js";
import type { SpsScopeShop } from "../sps-analytics.js";
import { SpsShopScopeControl } from "./SpsShopScopeControl.js";

const shops: SpsScopeShop[] = Array.from({ length: 51 }, (_, index) => ({
  id: `shop-${index}`,
  shopName: `Shop ${index}`,
  alias: null,
  region: "US",
  platform: "TIKTOK_SHOP",
  authStatus: "AUTHORIZED",
}));

function Harness() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  return <SpsShopScopeControl shops={shops} selectedIds={selectedIds} onChange={setSelectedIds} />;
}

describe("SpsShopScopeControl", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  afterEach(() => {
    cleanup();
  });

  it("selects at most 50 visible shops and disables the remaining choice", () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("0 of 51 shops selected"));
    fireEvent.click(screen.getByRole("button", { name: "Select visible (up to 50)" }));

    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(50);
    expect((screen.getByRole("checkbox", { name: "Shop 50" }) as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(screen.getAllByText("50 of 51 shops selected")).not.toHaveLength(0);
  });

  it("filters the picker before selecting the visible result", () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("0 of 51 shops selected"));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Shop 50" } });
    fireEvent.click(screen.getByRole("button", { name: "Select visible (up to 50)" }));

    expect((screen.getByRole("checkbox", { name: "Shop 50" }) as HTMLInputElement).checked).toBe(
      true,
    );
    expect(screen.getAllByText("1 of 51 shops selected")).not.toHaveLength(0);
  });
});
