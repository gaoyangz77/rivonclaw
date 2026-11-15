// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "../../../i18n/index.js";
import type { CreatorListDraft } from "../affiliate-campaign-creator-list.js";

const { query, client } = vi.hoisted(() => {
  const query = vi.fn();
  // Stable like the real Apollo client: the panel's loader depends on its identity.
  return { query, client: { query } };
});
vi.mock("@apollo/client/react", () => ({ useApolloClient: () => client }));

import {
  AffiliateCampaignCreatorListPanel,
  AffiliateCampaignCreatorListSection,
  AffiliateCampaignCreatorListToggle,
  type CreatorListProgress,
} from "./AffiliateCampaignCreatorList.js";

const progress: CreatorListProgress = {
  total: 10,
  resolved: 6,
  pendingLookup: 1,
  notFound: 2,
  ambiguous: 1,
  lookupFailed: 0,
  fed: 4,
};

function section(draft: CreatorListDraft, existingTotal: number | null = null) {
  return render(
    <AffiliateCampaignCreatorListSection
      draft={draft}
      existingTotal={existingTotal}
      onFile={() => {}}
      onDownloadTemplate={() => {}}
    />,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("zh");
  query.mockReset();
});
afterEach(cleanup);

describe("creator list wizard section", () => {
  it("offers the template and an upload before any file is chosen", () => {
    section({ status: "empty" });
    expect(screen.getByText("下载模板")).toBeTruthy();
    expect(screen.getAllByText("上传名单").length).toBeGreaterThan(0);
  });

  it("hands a chosen file to the page and offers replacement afterwards", () => {
    const onFile = vi.fn();
    const { container } = render(
      <AffiliateCampaignCreatorListSection
        draft={{ status: "empty" }}
        existingTotal={null}
        onFile={onFile}
        onDownloadTemplate={() => {}}
      />,
    );
    const file = new File(["x"], "list.xlsx");
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("summarizes the parse: valid, duplicates and the first invalid rows", () => {
    const invalid = Array.from({ length: 12 }, (_, index) => ({
      rowNumber: index + 2,
      raw: `bad name ${index}`,
    }));
    section({
      status: "ready",
      fileName: "list.xlsx",
      prepared: { usernames: ["a", "b"], duplicateCount: 3, invalid, tooMany: false },
    });
    expect(screen.getByText("list.xlsx")).toBeTruthy();
    expect(screen.getByText("2 个用户名")).toBeTruthy();
    expect(screen.getByText("已去除 3 个重复")).toBeTruthy();
    expect(screen.getByText("12 行不是有效的用户名")).toBeTruthy();
    expect(screen.getByText("第 2 行：bad name 0")).toBeTruthy();
    expect(screen.getByText("第 11 行：bad name 9")).toBeTruthy();
    expect(screen.queryByText("第 12 行：bad name 10")).toBeNull();
    expect(screen.getByText("另有 2 行")).toBeTruthy();
    expect(screen.getByText("替换名单", { selector: "button span" })).toBeTruthy();
  });

  it("states the cap when the list is too large", () => {
    section({
      status: "ready",
      fileName: "big.csv",
      prepared: {
        usernames: Array.from({ length: 5001 }, (_, index) => `u${index}`),
        duplicateCount: 0,
        invalid: [],
        tooMany: true,
      },
    });
    expect(screen.getByText("名单最多 5000 个用户名，该文件有 5001 个。")).toBeTruthy();
  });

  it("reports an unreadable file and shows the stored list size when editing", () => {
    section({ status: "error", fileName: "x.txt", errorKey: "missingColumn" }, 42);
    expect(screen.getByText("第一行必须是表头 creator_username，请使用模板。")).toBeTruthy();
    expect(screen.getByText(/当前名单：42 个用户名/)).toBeTruthy();
  });
});

describe("creator list detail", () => {
  it("shows matched, pending and unmatched counts on the collapsed toggle", () => {
    render(
      <AffiliateCampaignCreatorListToggle open={false} progress={progress} onToggle={() => {}} />,
    );
    expect(screen.getByText("查看达人名单")).toBeTruthy();
    expect(screen.getByText("✓6")).toBeTruthy();
    expect(screen.getByText("…1")).toBeTruthy();
    expect(screen.getByText("✕3")).toBeTruthy();
  });

  it("shows the six counts and pages the usernames that could not be matched", async () => {
    query
      .mockResolvedValueOnce({
        data: {
          affiliateCampaignCreatorListEntries: {
            items: [
              { id: "e1", rowNumber: 3, username: "ghost", status: "NOT_FOUND" },
              { id: "e2", rowNumber: 5, username: "twin", status: "AMBIGUOUS" },
            ],
            nextCursor: "next-1",
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          affiliateCampaignCreatorListEntries: {
            items: [{ id: "e3", rowNumber: 9, username: "late", status: "NOT_FOUND" }],
            nextCursor: null,
          },
        },
      });
    render(<AffiliateCampaignCreatorListPanel campaignId="c1" progress={progress} />);
    for (const label of ["已匹配", "查找中", "未找到", "不唯一", "查找失败", "已进入联系流程"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(await screen.findByText("第 3 行：ghost")).toBeTruthy();
    expect(screen.getByText("第 5 行：twin")).toBeTruthy();
    expect(query.mock.calls[0]![0].variables.input).toMatchObject({
      campaignId: "c1",
      statuses: ["NOT_FOUND", "AMBIGUOUS", "LOOKUP_FAILED"],
      cursor: null,
    });
    fireEvent.click(screen.getByText("加载更多"));
    expect(await screen.findByText("第 9 行：late")).toBeTruthy();
    expect(query.mock.calls[1]![0].variables.input.cursor).toBe("next-1");
    await waitFor(() => expect(screen.queryByText("加载更多")).toBeNull());
  });

  it("does not query when nothing is unmatched", () => {
    render(
      <AffiliateCampaignCreatorListPanel
        campaignId="c1"
        progress={{ ...progress, notFound: 0, ambiguous: 0, lookupFailed: 0 }}
        stopReason="CREATOR_LIST_EXHAUSTED"
      />,
    );
    expect(query).not.toHaveBeenCalled();
    expect(screen.getByText("所有用户名都已匹配或仍在查找中。")).toBeTruthy();
    expect(screen.getByText(/名单中的达人已全部使用/)).toBeTruthy();
  });
});
