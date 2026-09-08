import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing/react";
import i18n from "../../i18n/index.js";
import { ECOMMERCE_PRODUCT_FILTER_OPTIONS_QUERY } from "../../api/shops-queries.js";
import { ProductFilter, type ProductFilterValue } from "./ProductFilter.js";

vi.mock("../../store/EntityStoreProvider.js", () => ({
  useEntityStore: () => ({
    shops: [
      { id: "shop-a", alias: "A店", authStatus: "AUTHORIZED" },
      { id: "shop-b", alias: "B店", authStatus: "AUTHORIZED" },
    ],
  }),
}));
beforeEach(async () => {
  await i18n.changeLanguage("zh");
});
afterEach(cleanup);

it("requests only on submit, matches names and selects exact shop/product pairs", async () => {
  const onChange = vi.fn();
  const result = vi.fn(() => ({
    data: {
      ecommerceSearchProducts: [
        { shopId: "shop-a", productId: "1", title: "Collagen gummies" },
        { shopId: "shop-a", productId: "2", title: "Necklace" },
      ],
    },
  }));
  function Harness() {
    const [value, setValue] = useState<ProductFilterValue[]>([]);
    return (
      <ProductFilter
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    );
  }
  render(
    <MockedProvider
      mocks={[
        {
          request: {
            query: ECOMMERCE_PRODUCT_FILTER_OPTIONS_QUERY,
            variables: { shopIds: ["shop-a"] },
          },
          result,
          delay: 0,
        },
        {
          request: {
            query: ECOMMERCE_PRODUCT_FILTER_OPTIONS_QUERY,
            variables: { shopIds: ["shop-b"] },
          },
          result: {
            data: {
              ecommerceSearchProducts: [
                { shopId: "shop-b", productId: "1", title: "Collagen gummies" },
              ],
            },
          },
          delay: 0,
        },
      ]}
    >
      <Harness />
    </MockedProvider>,
  );
  expect(result).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "筛选商品" }));
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "LAGEN" } });
  expect(result).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "搜索" }));
  await screen.findAllByText("Collagen gummies");
  expect(screen.queryByText("Necklace")).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole("button", { name: /Collagen gummies.*A店/ }));
  expect(onChange).toHaveBeenLastCalledWith([{ shopId: "shop-a", productId: "1" }]);
  fireEvent.click(await screen.findByRole("button", { name: /Collagen gummies.*B店/ }));
  expect(onChange).toHaveBeenLastCalledWith([
    { shopId: "shop-a", productId: "1" },
    { shopId: "shop-b", productId: "1" },
  ]);
  expect(result).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "完成" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "筛选商品 (2)" }));
  fireEvent.click(screen.getByRole("button", { name: "清空" }));
  expect(onChange).toHaveBeenLastCalledWith([]);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(result).toHaveBeenCalledOnce();
});

it("requests the selected shop, shows failure rather than incomplete results and retries", async () => {
  const request = {
    query: ECOMMERCE_PRODUCT_FILTER_OPTIONS_QUERY,
    variables: { shopIds: ["shop-a"] },
  };
  render(
    <MockedProvider
      mocks={[
        { request, error: new Error("Unavailable"), delay: 0 },
        { request, result: { data: { ecommerceSearchProducts: [] } }, delay: 0 },
      ]}
    >
      <ProductFilter shopId="shop-a" value={[]} onChange={vi.fn()} />
    </MockedProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "筛选商品" }));
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "name" } });
  fireEvent.click(screen.getByRole("button", { name: "搜索" }));
  expect((await screen.findByRole("alert")).textContent).toContain("结果可能不完整");
  fireEvent.click(screen.getByRole("button", { name: "重新加载商品" }));
  await screen.findByText("没有匹配的商品");
  fireEvent.pointerDown(document.body);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("does not apply a delayed response from the previous shop", async () => {
  function Harness() {
    const [shopId, setShopId] = useState("shop-a");
    return (
      <>
        <button onClick={() => setShopId("shop-b")}>Switch shop</button>
        <ProductFilter shopId={shopId} value={[]} onChange={vi.fn()} />
      </>
    );
  }
  render(
    <MockedProvider
      mocks={[
        {
          request: {
            query: ECOMMERCE_PRODUCT_FILTER_OPTIONS_QUERY,
            variables: { shopIds: ["shop-a"] },
          },
          result: {
            data: {
              ecommerceSearchProducts: [{ shopId: "shop-a", productId: "1", title: "Old shop" }],
            },
          },
          delay: 100,
        },
        {
          request: {
            query: ECOMMERCE_PRODUCT_FILTER_OPTIONS_QUERY,
            variables: { shopIds: ["shop-b"] },
          },
          result: {
            data: {
              ecommerceSearchProducts: [{ shopId: "shop-b", productId: "2", title: "New shop" }],
            },
          },
          delay: 0,
        },
      ]}
    >
      <Harness />
    </MockedProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "筛选商品" }));
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "shop" } });
  fireEvent.click(screen.getByRole("button", { name: "搜索" }));
  fireEvent.click(screen.getByText("Switch shop"));
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "筛选商品" }));
  expect(screen.getByText("输入产品名或商品 ID，点击搜索后请求。")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "搜索" }));
  expect(await within(screen.getByRole("dialog")).findByText("New shop")).toBeTruthy();
  expect(screen.queryByText("Old shop")).toBeNull();
});

it("preserves completed-shop matches but marks a failed multi-shop search incomplete", async () => {
  render(
    <MockedProvider
      mocks={[
        {
          request: {
            query: ECOMMERCE_PRODUCT_FILTER_OPTIONS_QUERY,
            variables: { shopIds: ["shop-a"] },
          },
          result: {
            data: {
              ecommerceSearchProducts: [{ shopId: "shop-a", productId: "1", title: "Collagen" }],
            },
          },
          delay: 0,
        },
        {
          request: {
            query: ECOMMERCE_PRODUCT_FILTER_OPTIONS_QUERY,
            variables: { shopIds: ["shop-b"] },
          },
          error: new Error("Unavailable"),
          delay: 0,
        },
      ]}
    >
      <ProductFilter value={[]} onChange={vi.fn()} />
    </MockedProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "筛选商品" }));
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "collagen" } });
  fireEvent.submit(screen.getByRole("searchbox").closest("form")!);
  expect((await screen.findByRole("alert")).textContent).toContain("结果可能不完整");
  expect(screen.getByText("Collagen")).toBeTruthy();
  expect(screen.queryByText("没有匹配的商品")).toBeNull();
});

it("cancels a pending search and restores the search button", async () => {
  render(
    <MockedProvider
      mocks={[
        {
          request: {
            query: ECOMMERCE_PRODUCT_FILTER_OPTIONS_QUERY,
            variables: { shopIds: ["shop-a"] },
          },
          result: { data: { ecommerceSearchProducts: [] } },
          delay: Infinity,
        },
      ]}
    >
      <ProductFilter shopId="shop-a" value={[]} onChange={vi.fn()} />
    </MockedProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "筛选商品" }));
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "collagen" } });
  fireEvent.click(screen.getByRole("button", { name: "搜索" }));
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(screen.getByText(/搜索已取消/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "搜索" }).hasAttribute("disabled")).toBe(false);
});
