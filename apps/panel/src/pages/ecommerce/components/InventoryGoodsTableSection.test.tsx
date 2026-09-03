// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { applySnapshot } from "mobx-state-tree";
import type { InventoryGood } from "@rivonclaw/core/models";
import { runtimeStatusStore } from "../../../store/runtime-status-store.js";

// Interpolation values are appended so a masked substitution is observable in
// the rendered text; without them `t` would swallow the very value under test.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));

const goods = [
  {
    id: "good-1",
    sku: "SKU-1",
    name: "Merino wool base layer",
    imageUri: "https://cdn.example.test/good-1.jpg",
  },
] as unknown as InventoryGood[];

const inventory = {
  pagedInventoryGoods: goods,
  inventoryGoodsPageCount: 1,
  inventoryGoodsFilteredCount: 1,
  inventoryGoodsPage: 1,
  inventoryGoodsSearch: "",
  inventoryGoodsLoading: false,
  inventoryGoodsError: null,
  inventoryGoodsHasNextPage: false,
  selectedInventoryGoodIds: [] as string[],
  deletingInventoryGoodIds: [] as string[],
  isInventoryGoodSelected: () => false,
  isInventoryGoodDeleting: () => false,
  isInventoryGoodsColumnVisible: () => true,
  toggleInventoryGoodSelected: () => {},
  setAllInventoryGoodsSelected: () => {},
  toggleInventoryGoodsColumn: () => {},
  setInventoryGoodsSearch: () => {},
  openAddInventoryGoodModal: () => {},
  openEditInventoryGoodModal: () => {},
  fetchInventoryGoods: () => Promise.resolve(),
  applyInventoryGoodsFilters: () => Promise.resolve(),
  resetInventoryGoodsFilters: () => Promise.resolve(),
  previousInventoryGoodsPage: () => Promise.resolve(),
  nextInventoryGoodsPage: () => Promise.resolve(),
  goToInventoryGoodsPage: () => Promise.resolve(),
};

vi.mock("../../../store/EntityStoreProvider.js", () => ({
  useEntityStore: () => ({ ecommerceInventory: inventory }),
}));

const { InventoryGoodsTableSection } = await import("./InventoryGoodsTableSection.js");

function setPrivacyMode(enabled: boolean) {
  applySnapshot(runtimeStatusStore.appSettings, { privacyMode: enabled });
}

afterEach(() => {
  cleanup();
  setPrivacyMode(false);
});

describe("InventoryGoodsTableSection privacy masking", () => {
  it("renders the goods image and marks the name while privacy mode is off", () => {
    render(<InventoryGoodsTableSection />);

    const image = document.querySelector<HTMLImageElement>(".inventory-good-thumb img");
    expect(image?.getAttribute("src")).toBe("https://cdn.example.test/good-1.jpg");

    const name = screen.getByText("Merino wool base layer");
    expect(name.getAttribute("data-tk-private")).toBe("text");
    expect(name.getAttribute("title")).toBe("Merino wool base layer");
  });

  it("drops the <img> entirely while privacy mode is on", () => {
    // CSS cannot un-render a plain <img>: the element would still be fetched
    // and painted underneath any overlay, so the source is withheld and the
    // preview falls back to its own empty branch.
    setPrivacyMode(true);
    render(<InventoryGoodsTableSection />);

    expect(document.querySelector(".inventory-good-thumb img")).toBeNull();
    expect(document.querySelector(".image-asset-preview-empty")).not.toBeNull();
  });

  it("marks the SKU cell and drops its tooltip while privacy mode is on", () => {
    render(<InventoryGoodsTableSection />);

    const sku = screen.getByText("SKU-1");
    expect(sku.getAttribute("data-tk-private")).toBe("text");
    expect(sku.className).toBe("td-meta input-mono");
    expect(sku.getAttribute("title")).toBe("SKU-1");

    act(() => setPrivacyMode(true));

    expect(screen.getByText("SKU-1").getAttribute("title")).toBeNull();
  });

  it("substitutes the SKU in the delete confirmation, which cannot carry a marker", () => {
    render(<InventoryGoodsTableSection />);
    fireEvent.click(screen.getByText("common.delete"));

    expect(screen.getByText(/confirmDeleteInventoryGood/).textContent).toContain("SKU-1");

    act(() => setPrivacyMode(true));

    // `ConfirmDialog` takes a plain string, so the SKU is replaced rather than
    // blurred — the question around it has to stay readable.
    const message = screen.getByText(/confirmDeleteInventoryGood/).textContent ?? "";
    expect(message).toContain("••••");
    expect(message).not.toContain("SKU-1");
  });

  it("suppresses the goods-name tooltip while privacy mode is on", () => {
    render(<InventoryGoodsTableSection />);
    expect(screen.getByText("Merino wool base layer").getAttribute("title")).toBe(
      "Merino wool base layer",
    );

    act(() => setPrivacyMode(true));

    expect(screen.getByText("Merino wool base layer").getAttribute("title")).toBeNull();
  });
});
