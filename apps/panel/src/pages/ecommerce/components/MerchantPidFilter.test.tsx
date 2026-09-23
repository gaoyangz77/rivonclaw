import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing/react";
import i18n from "../../../i18n/index.js";
import { PRODUCT_KNOWLEDGE_BY_MERCHANT_PID_QUERY } from "../../../api/product-knowledge-queries.js";
import { MerchantPidFilter } from "./MerchantPidFilter.js";

beforeEach(async () => {
  await i18n.changeLanguage("zh");
});
afterEach(cleanup);

function mockLookup(merchantPid: string, result: Record<string, unknown> | null) {
  return {
    request: {
      query: PRODUCT_KNOWLEDGE_BY_MERCHANT_PID_QUERY,
      variables: { merchantPid },
    },
    result: { data: { productKnowledgeByMerchantPid: result } },
  };
}

it("looks up one internal code and selects a Knowledge identity, not shop/product pairs", async () => {
  const onChange = vi.fn();
  render(
    <MockedProvider
      mocks={[
        mockLookup("BLENDER-1", {
          id: "knowledge-1",
          merchantPid: "BLENDER-1",
          name: "Blender",
          status: "ACTIVE",
          bindingCount: 3,
        }),
      ]}
    >
      <MerchantPidFilter value={null} onChange={onChange} shopScoped />
    </MockedProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "内部商品编号" }));
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: " BLENDER-1 " } });
  fireEvent.click(screen.getByRole("button", { name: "搜索" }));
  await screen.findByText("Blender");
  expect(
    screen.getByText(
      (_content, element) =>
        element?.textContent?.includes("已关联 3 个店铺商品") === true &&
        element.classList.contains("merchant-pid-filter-result"),
    ),
  ).toBeTruthy();
  expect(screen.getByText("结果仅包含当前选中的店铺。")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "按此产品筛选" }));
  expect(onChange).toHaveBeenCalledWith({
    id: "knowledge-1",
    merchantPid: "BLENDER-1",
    name: "Blender",
    bindingCount: 3,
  });
});

it("does not select archived or unbound knowledge", async () => {
  const onChange = vi.fn();
  render(
    <MockedProvider
      mocks={[
        mockLookup("OLD", {
          id: "old",
          merchantPid: "OLD",
          name: "Old",
          status: "ARCHIVED",
          bindingCount: 2,
        }),
        mockLookup("EMPTY", {
          id: "empty",
          merchantPid: "EMPTY",
          name: "Empty",
          status: "ACTIVE",
          bindingCount: 0,
        }),
      ]}
    >
      <MerchantPidFilter value={null} onChange={onChange} shopScoped={false} />
    </MockedProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "内部商品编号" }));
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "OLD" } });
  fireEvent.click(screen.getByRole("button", { name: "搜索" }));
  await screen.findByText("这份产品知识已归档，不能用于新的筛选。");
  expect((screen.getByRole("button", { name: "按此产品筛选" }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "EMPTY" } });
  fireEvent.click(screen.getByRole("button", { name: "搜索" }));
  await waitFor(() =>
    expect(screen.getByText("请先关联至少一个店铺商品，再筛选申样。")).toBeTruthy(),
  );
  expect((screen.getByRole("button", { name: "按此产品筛选" }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect(onChange).not.toHaveBeenCalled();
});
