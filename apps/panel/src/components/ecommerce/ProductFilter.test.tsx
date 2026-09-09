import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing/react";
import i18n from "../../i18n/index.js";
import { ECOMMERCE_PRODUCT_FILTER_OPTIONS_QUERY } from "../../api/shops-queries.js";
import { ProductFilter, type ProductFilterValue } from "./ProductFilter.js";

vi.mock("../../store/EntityStoreProvider.js", () => ({
  useEntityStore: () => ({
    shops: Array.from({ length: 80 }, (_, i) => ({
      id: `shop-${i}`,
      alias: `Shop ${i}`,
      authStatus: "AUTHORIZED",
    })),
  }),
}));
beforeEach(async () => {
  await i18n.changeLanguage("zh");
});
afterEach(cleanup);

const request = (keywordOrId: string) => ({
  query: ECOMMERCE_PRODUCT_FILTER_OPTIONS_QUERY,
  variables: { keywordOrId },
});
const data = (
  products: Array<{ shopId: string; productId: string; title: string }>,
  failedShopIds: string[] = [],
) => ({
  data: { searchProductsForUser: { products, totalShops: 80, failedShopIds } },
});
function submit(keyword: string) {
  fireEvent.click(screen.getByRole("button", { name: "筛选商品" }));
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: keyword } });
  fireEvent.click(screen.getByRole("button", { name: "搜索" }));
}

it("opens/types without fetching, submits once for 80 shops and selects exact pairs", async () => {
  const onChange = vi.fn();
  const result = vi.fn(() =>
    data([
      { shopId: "shop-0", productId: "1", title: "Collagen" },
      { shopId: "shop-1", productId: "1", title: "Collagen" },
    ]),
  );
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
    <MockedProvider mocks={[{ request: request("LAGEN"), result, delay: 10 }]}>
      <Harness />
    </MockedProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "筛选商品" }));
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "  LAGEN  " } });
  expect(result).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "搜索" }));
  fireEvent.submit(screen.getByRole("searchbox").closest("form")!);
  expect(screen.getByRole("status").textContent).not.toContain("/ 80");
  fireEvent.click(await screen.findByRole("button", { name: /Collagen.*Shop 0/ }));
  fireEvent.click(await screen.findByRole("button", { name: /Collagen.*Shop 1/ }));
  expect(onChange).toHaveBeenLastCalledWith([
    { shopId: "shop-0", productId: "1" },
    { shopId: "shop-1", productId: "1" },
  ]);
  expect(result).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "完成" }));
  fireEvent.click(screen.getByRole("button", { name: "筛选商品 (2)" }));
  expect(result).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "清空" }));
  expect(onChange).toHaveBeenLastCalledWith([]);
});

it("still uses one user-level request with a selected shop and filters returned pairs locally", async () => {
  const result = vi.fn(() =>
    data([
      { shopId: "shop-0", productId: "1", title: "Match A" },
      { shopId: "shop-1", productId: "2", title: "Match B" },
    ]),
  );
  render(
    <MockedProvider mocks={[{ request: request("Match"), result, delay: 0 }]}>
      <ProductFilter shopId="shop-1" value={[]} onChange={vi.fn()} />
    </MockedProvider>,
  );
  submit("Match");
  await screen.findByText("Match B");
  expect(screen.queryByText("Match A")).toBeNull();
  expect(result).toHaveBeenCalledOnce();
});

it("keeps matches but marks partial failures incomplete", async () => {
  render(
    <MockedProvider
      mocks={[
        {
          request: request("collagen"),
          delay: 0,
          result: data([{ shopId: "shop-0", productId: "1", title: "Collagen" }], ["shop-1"]),
        },
      ]}
    >
      <ProductFilter value={[]} onChange={vi.fn()} />
    </MockedProvider>,
  );
  submit("collagen");
  expect((await screen.findByRole("alert")).textContent).toContain("结果可能不完整");
  expect(screen.getByText("Collagen")).toBeTruthy();
  expect(screen.queryByText("没有匹配的商品")).toBeNull();
});

it("retries a failed request only when explicitly clicked", async () => {
  const result = vi.fn(() => data([]));
  render(
    <MockedProvider
      mocks={[
        { request: request("name"), error: new Error("Unavailable"), delay: 0 },
        { request: request("name"), result, delay: 0 },
      ]}
    >
      <ProductFilter value={[]} onChange={vi.fn()} />
    </MockedProvider>,
  );
  submit("name");
  await screen.findByRole("alert");
  expect(result).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "重新加载商品" }));
  await screen.findByText("没有匹配的商品");
  expect(result).toHaveBeenCalledOnce();
});

it("discards an old in-flight response on scope change without launching a new request", async () => {
  const result = vi.fn(() => data([{ shopId: "shop-0", productId: "1", title: "Old result" }]));
  function Harness() {
    const [shopId, setShopId] = useState("shop-0");
    return (
      <>
        <button onClick={() => setShopId("shop-1")}>Switch shop</button>
        <ProductFilter shopId={shopId} value={[]} onChange={vi.fn()} />
      </>
    );
  }
  render(
    <MockedProvider mocks={[{ request: request("name"), result, delay: 100 }]}>
      <Harness />
    </MockedProvider>,
  );
  submit("name");
  fireEvent.click(screen.getByText("Switch shop"));
  await waitFor(() => expect(screen.queryByText("正在搜索您的已授权店铺商品…")).toBeNull());
  expect(screen.queryByText("Old result")).toBeNull();
  expect(result).not.toHaveBeenCalled();
});

it("cancels a pending search and restores the search button", async () => {
  render(
    <MockedProvider mocks={[{ request: request("name"), result: data([]), delay: Infinity }]}>
      <ProductFilter value={[]} onChange={vi.fn()} />
    </MockedProvider>,
  );
  submit("name");
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(screen.getByText(/搜索已取消/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "搜索" }).hasAttribute("disabled")).toBe(false);
});
