import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing/react";
import i18n from "../../../i18n/index.js";
import { ToastProvider } from "../../../components/Toast.js";
import {
  AFFILIATE_WORKBENCH_PENDING_CONVERSATION_PAGE_QUERY,
  AFFILIATE_WORKBENCH_SAMPLE_PAGE_QUERY,
} from "../../../api/shops-queries.js";
import { AffiliateWorkbenchEntityTabs } from "./AffiliateWorkbenchEntityTabs.js";
import {
  AffiliateProtectionFilter,
  workbenchProtectionValue,
} from "./AffiliateProtectionFilter.js";

beforeEach(async () => {
  await i18n.changeLanguage("zh");
});
afterEach(cleanup);

describe("workbench protection filter", () => {
  it("distinguishes false from no filter", () => {
    expect(workbenchProtectionValue("ALL")).toBeNull();
    expect(workbenchProtectionValue("PROTECTED")).toBe(true);
    expect(workbenchProtectionValue("UNPROTECTED")).toBe(false);
  });

  it.each(["zh", "en"])("uses a styled, localized selector in %s", async (language) => {
    await i18n.changeLanguage(language);
    const onChange = vi.fn();
    render(<AffiliateProtectionFilter value="ALL" onChange={onChange} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: i18n.t("ecommerce.affiliateWorkspace.workbench.protectionFilter"),
      }),
    );
    expect(document.querySelector("select")).toBeNull();
    fireEvent.click(
      screen.getByText(i18n.t("ecommerce.affiliateWorkspace.workbench.unprotectedCreators")),
    );
    expect(onChange).toHaveBeenCalledWith("UNPROTECTED");
    expect(document.querySelector(".custom-select-dropdown")).toBeNull();
  });

  it.each(["SAMPLES", "MESSAGES"] as const)(
    "sends protection for %s queries and pagination, resetting the cursor on changes",
    async (tab) => {
      const samples = tab === "SAMPLES";
      const query = samples
        ? AFFILIATE_WORKBENCH_SAMPLE_PAGE_QUERY
        : AFFILIATE_WORKBENCH_PENDING_CONVERSATION_PAGE_QUERY;
      const field = samples
        ? "affiliateWorkbenchSamplePage"
        : "affiliateWorkbenchPendingConversationPage";
      const input = {
        shopId: null,
        businessDeveloperId: "bd-1",
        sortOrder: "ASC",
        limit: 25,
        ...(samples ? { reviewDisposition: "OPEN" } : { channel: null }),
      };
      const counts = samples
        ? { openCount: 0, expiringSoonCount: 0 }
        : {
            totalCount: 0,
            platformCount: 0,
            whatsappCount: 0,
            emailCount: 0,
            waitingOver24hCount: 0,
          };
      const steps = [
        { protected: null, cursor: null, nextCursor: "all-cursor" },
        { protected: true, cursor: null, nextCursor: "protected-cursor" },
        { protected: true, cursor: "protected-cursor", nextCursor: null },
        { protected: false, cursor: null, nextCursor: null },
        { protected: null, cursor: null, nextCursor: null },
      ];
      const results = steps.map((step) =>
        vi.fn(() => ({
          data: {
            [field]: {
              items: [],
              hasMore: Boolean(step.nextCursor),
              nextCursor: step.nextCursor,
              ...counts,
            },
          },
        })),
      );
      const mocks = steps.map((step, index) => ({
        request: {
          query,
          variables: { input: { ...input, protected: step.protected, cursor: step.cursor } },
        },
        result: results[index],
        delay: 0,
      }));
      render(
        <MockedProvider mocks={mocks}>
          <ToastProvider>
            <AffiliateWorkbenchEntityTabs
              tab={tab}
              selectedShopId=""
              shopOptions={[{ value: "", label: "全部店铺" }]}
              onSelectShop={vi.fn()}
              businessDeveloperOptions={[{ value: "bd-1", label: "BD 1" }]}
              selectedBusinessDeveloperId="bd-1"
              onSelectBusinessDeveloper={vi.fn()}
              refreshRevision={0}
              onOpen={vi.fn()}
            />
          </ToastProvider>
        </MockedProvider>,
      );
      const selectProtection = (label: string) => {
        fireEvent.click(screen.getByRole("button", { name: "达人保护状态" }));
        // All is also a message-channel chip, so scope selection to the popup.
        const popup = document.querySelector(".custom-select-dropdown")!;
        const option = Array.from(popup.querySelectorAll(".custom-select-option")).find(
          (node) => node.textContent === label,
        )!;
        fireEvent.click(option);
      };
      await waitFor(() => expect(results[0]).toHaveBeenCalledOnce());
      selectProtection("受保护达人");
      await waitFor(() => expect(results[1]).toHaveBeenCalledOnce());
      fireEvent.click(
        await screen.findByRole("button", {
          name: i18n.t("ecommerce.affiliateWorkspace.loadMoreProposals"),
        }),
      );
      await waitFor(() => expect(results[2]).toHaveBeenCalledOnce());
      selectProtection("未保护达人");
      await waitFor(() => expect(results[3]).toHaveBeenCalledOnce());
      selectProtection("全部");
      await waitFor(() => expect(results[4]).toHaveBeenCalledOnce());
    },
  );
});
