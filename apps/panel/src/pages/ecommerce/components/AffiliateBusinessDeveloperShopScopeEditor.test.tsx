// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { GQL } from "@rivonclaw/core";
import {
  SHOP_REGIONS,
  type BusinessDeveloperShopScopeDraft,
} from "../../../lib/affiliate-bd-shop-scope.js";
import { AffiliateBusinessDeveloperShopScopeEditor } from "./AffiliateBusinessDeveloperShopScopeEditor.js";
import { AffiliateBusinessDeveloperShopScopeSummary } from "./AffiliateBusinessDeveloperShopScopeSummary.js";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options && "count" in options ? `${key}:${String(options.count)}` : key,
  }),
}));

const storeState = vi.hoisted(() => ({
  shops: [] as Array<Record<string, unknown>>,
}));
vi.mock("../../../store/EntityStoreProvider.js", () => ({
  useEntityStore: () => storeState,
}));

function shop(id: string, region: string | null, name: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    platform: "TIKTOK_SHOP",
    region,
    alias: null,
    shopName: name,
    platformShopId: `platform-${id}`,
    ...extra,
  };
}

function useShops(shops: Array<Record<string, unknown>>) {
  storeState.shops = shops;
}

const T = (key: string) => `ecommerce.affiliateTeam.${key}`;

function Harness({
  initial,
  onChange,
}: {
  initial: BusinessDeveloperShopScopeDraft;
  onChange?: (next: BusinessDeveloperShopScopeDraft) => void;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <AffiliateBusinessDeveloperShopScopeEditor
      value={draft}
      onChange={(next) => {
        setDraft(next);
        onChange?.(next);
      }}
    />
  );
}

const specific = (
  regions: GQL.ShopRegion[],
  shopIds: string[],
): BusinessDeveloperShopScopeDraft => ({ shopScopeMode: "SPECIFIC", regions, shopIds });

afterEach(() => {
  cleanup();
  storeState.shops = [];
});

function checkboxFor(label: string): HTMLInputElement {
  return screen.getByText(label).closest("label")!.querySelector("input") as HTMLInputElement;
}

describe("AffiliateBusinessDeveloperShopScopeEditor", () => {
  it("makes All shops an explicit choice with no region or shop checkboxes", () => {
    useShops([shop("us-1", "US", "Shop A")]);
    render(
      <Harness initial={{ shopScopeMode: "ALL", regions: [], shopIds: [] }} />,
    );
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    const [all, specificChoice] = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(all.checked).toBe(true);
    expect(specificChoice.checked).toBe(false);
    expect(screen.getByText(T("shopScopeAllHint"))).toBeTruthy();
  });

  it("switching to Specific reveals the groups and, with nothing picked, the blocking error", () => {
    useShops([shop("us-1", "US", "Shop A")]);
    const onChange = vi.fn();
    render(
      <Harness
        initial={{ shopScopeMode: "ALL", regions: [], shopIds: [] }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getAllByRole("radio")[1]);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ shopScopeMode: "SPECIFIC" }));
    expect(screen.getByRole("alert").textContent).toBe(T("shopScopeNothingSelected"));
    expect(screen.getByText("Shop A")).toBeTruthy();
  });

  it("does not show the empty-selection error once something is selected", () => {
    useShops([shop("us-1", "US", "Shop A")]);
    render(<Harness initial={specific([], ["us-1"])} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("grants a whole region: its shops show as included and individual ids are dropped", () => {
    useShops([shop("us-1", "US", "Shop A"), shop("us-2", "US", "Shop B"), shop("gb-1", "GB", "Shop C")]);
    const onChange = vi.fn();
    render(<Harness initial={specific([], ["us-1", "gb-1"])} onChange={onChange} />);

    const regionBoxes = screen.getAllByLabelText(T("shopScopeWholeRegion")) as HTMLInputElement[];
    // Groups render in region-code order: GB first, then US.
    fireEvent.click(regionBoxes[1]);
    const next = onChange.mock.calls.at(-1)![0] as BusinessDeveloperShopScopeDraft;
    expect(next.regions).toEqual([GQL.ShopRegion.Us]);
    expect(next.shopIds).toEqual(["gb-1"]);

    for (const name of ["Shop A", "Shop B"]) {
      const box = checkboxFor(name);
      expect(box.checked).toBe(true);
      expect(box.disabled).toBe(true);
    }
    expect(screen.getAllByText(T("shopScopeIncludedInRegion"))).toHaveLength(1);
    // The other region's shop stays individually editable.
    expect(checkboxFor("Shop C").disabled).toBe(false);
  });

  it("shows the region checkbox as indeterminate while only some shops are ticked", () => {
    useShops([shop("us-1", "US", "Shop A"), shop("us-2", "US", "Shop B")]);
    render(<Harness initial={specific([], ["us-1"])} />);
    const regionBox = screen.getByLabelText(T("shopScopeWholeRegion")) as HTMLInputElement;
    expect(regionBox.checked).toBe(false);
    expect(regionBox.indeterminate).toBe(true);
    expect(screen.queryByText(T("shopScopeEveryShopTicked"))).toBeNull();
  });

  it("warns that later shops are NOT included when every current shop is ticked, and offers the whole region", () => {
    useShops([shop("us-1", "US", "Shop A"), shop("us-2", "US", "Shop B")]);
    const onChange = vi.fn();
    render(<Harness initial={specific([], ["us-1", "us-2"])} onChange={onChange} />);

    // Ticking every shop is not a region grant: the region box stays unticked.
    expect((screen.getByLabelText(T("shopScopeWholeRegion")) as HTMLInputElement).checked).toBe(
      false,
    );
    expect(screen.getByText(T("shopScopeEveryShopTicked"))).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: T("shopScopeGrantWholeRegion") }));
    const next = onChange.mock.calls.at(-1)![0] as BusinessDeveloperShopScopeDraft;
    expect(next.regions).toEqual([GQL.ShopRegion.Us]);
    expect(next.shopIds).toEqual([]);
    expect(screen.queryByText(T("shopScopeEveryShopTicked"))).toBeNull();
  });

  it("ticking the last shop by hand raises the warning instead of granting the region", () => {
    useShops([shop("us-1", "US", "Shop A"), shop("us-2", "US", "Shop B")]);
    const onChange = vi.fn();
    render(<Harness initial={specific([], ["us-1"])} onChange={onChange} />);
    fireEvent.click(checkboxFor("Shop B"));
    const next = onChange.mock.calls.at(-1)![0] as BusinessDeveloperShopScopeDraft;
    expect(next.regions).toEqual([]);
    expect(next.shopIds).toEqual(["us-1", "us-2"]);
    expect(screen.getByText(T("shopScopeEveryShopTicked"))).toBeTruthy();
  });

  it("lists regions without shops separately and still grants them as whole regions", () => {
    useShops([shop("us-1", "US", "Shop A")]);
    const onChange = vi.fn();
    const { container } = render(<Harness initial={specific([], ["us-1"])} onChange={onChange} />);
    const details = container.querySelector("details")!;
    expect(details.open).toBe(false);
    const grid = within(details);
    // Every region except the one that has shops.
    expect(grid.getAllByRole("checkbox", { hidden: true })).toHaveLength(SHOP_REGIONS.length - 1);
    expect(details.textContent).not.toContain("ecommerce.market.US");

    const gb = grid.getByText("ecommerce.market.GB").closest("label")!.querySelector("input")!;
    fireEvent.click(gb);
    const next = onChange.mock.calls.at(-1)![0] as BusinessDeveloperShopScopeDraft;
    expect(next.regions).toEqual([GQL.ShopRegion.Gb]);
    expect(next.shopIds).toEqual(["us-1"]);
  });

  it("selects every region that has shops as a whole-region grant, and clears", () => {
    useShops([shop("us-1", "US", "Shop A"), shop("gb-1", "GB", "Shop B"), shop("x-1", null, "Shop X")]);
    const onChange = vi.fn();
    render(<Harness initial={specific([], ["us-1"])} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: T("shopScopeSelectAllRegions") }));
    let next = onChange.mock.calls.at(-1)![0] as BusinessDeveloperShopScopeDraft;
    expect(next.regions).toEqual([GQL.ShopRegion.Gb, GQL.ShopRegion.Us]);
    // The region-less shop cannot be granted whole, so it is ticked itself.
    expect(next.shopIds).toEqual(["x-1"]);

    fireEvent.click(screen.getByRole("button", { name: T("shopScopeClear") }));
    next = onChange.mock.calls.at(-1)![0] as BusinessDeveloperShopScopeDraft;
    expect(next).toEqual({ shopScopeMode: "SPECIFIC", regions: [], shopIds: [] });
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("offers no whole-region grant for shops without a region", () => {
    useShops([shop("x-1", null, "Shop X")]);
    render(<Harness initial={specific([], [])} />);
    expect(screen.getByText(T("shopScopeShopsWithoutRegion"))).toBeTruthy();
    expect(screen.queryByLabelText(T("shopScopeWholeRegion"))).toBeNull();
  });

  it("offers expired-authorization TikTok shops but not other platforms", () => {
    useShops([
      shop("us-1", "US", "Expired shop", { authStatus: "EXPIRED" }),
      shop("us-2", "US", "Other platform", { platform: "OTHER" }),
    ]);
    render(<Harness initial={specific([], [])} />);
    expect(screen.getByText("Expired shop")).toBeTruthy();
    expect(screen.queryByText("Other platform")).toBeNull();
  });

  it("adds a search box once there are many shops and filters by name or alias", () => {
    useShops(
      Array.from({ length: 9 }, (_, index) =>
        shop(`us-${index}`, "US", `Shop ${index}`, index === 3 ? { alias: "Flagship" } : {}),
      ),
    );
    render(<Harness initial={specific([], [])} />);
    const search = screen.getByRole("searchbox", { name: "common.searchShops" });
    fireEvent.change(search, { target: { value: "Shop 3" } });
    // The alias is what is shown; the platform name still finds it.
    expect(screen.getByText("Flagship")).toBeTruthy();
    expect(screen.queryByText("Shop 4")).toBeNull();

    fireEvent.change(search, { target: { value: "nothing-like-this" } });
    expect(screen.getByText(T("shopScopeNoMatchingShops"))).toBeTruthy();
  });

  it("keeps the search box away when there are few shops", () => {
    useShops([shop("us-1", "US", "Shop A")]);
    render(<Harness initial={specific([], [])} />);
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
});

describe("AffiliateBusinessDeveloperShopScopeSummary", () => {
  const shops = [
    shop("us-1", "US", "Shop A"),
    shop("gb-1", "GB", "Shop B"),
    shop("gb-2", "GB", "Shop C"),
    shop("gb-3", "GB", "Shop D"),
    shop("gb-4", "GB", "Shop E"),
  ];

  it("says All shops for an unrestricted developer", () => {
    useShops(shops);
    const { container } = render(
      <AffiliateBusinessDeveloperShopScopeSummary regions={[]} shopIds={[]} />,
    );
    expect(container.textContent).toBe(T("shopScopeSummaryAll"));
  });

  it("lists whole regions, then named shops with the rest counted, never repeating a region's shops", () => {
    useShops(shops);
    const { container } = render(
      <AffiliateBusinessDeveloperShopScopeSummary
        regions={["US"]}
        shopIds={["us-1", "gb-1", "gb-2", "gb-3", "gone"]}
      />,
    );
    const text = container.textContent!;
    expect(text).toContain(T("shopScopeSummaryWholeRegion"));
    expect(text).toContain("Shop B");
    expect(text).toContain("Shop C");
    expect(text).not.toContain("Shop A");
    expect(text).not.toContain("Shop D");
    expect(text).toContain(`${T("shopScopeSummaryMore")}`);
    expect(text).toContain(T("shopScopeSummaryMissingShops"));
  });
});
