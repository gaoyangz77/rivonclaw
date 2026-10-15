import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing/react";
import { AffiliateWorkspaceModel } from "@rivonclaw/core/models";
import { SET_AFFILIATE_UNREPLIED_MESSAGE_LOOKBACK_MUTATION } from "../../../api/shops-queries.js";
import { ToastProvider } from "../../../components/Toast.js";
import i18n from "../../../i18n/index.js";
import { AffiliateMessageLookbackPanel } from "./AffiliateMessageLookbackPanel.js";

const state = vi.hoisted(() => ({ store: null as unknown }));
vi.mock("../../../store/EntityStoreProvider.js", () => ({ useEntityStore: () => state.store }));
let workspace: ReturnType<typeof AffiliateWorkspaceModel.create>;
beforeEach(async () => {
  await i18n.changeLanguage("zh");
  workspace = AffiliateWorkspaceModel.create({
    operationalSettings: { id: "settings-1", userId: "seller-1", unrepliedMessageLookbackDays: 90 },
  });
  state.store = { affiliateWorkspace: workspace };
});
afterEach(cleanup);

it("validates whole days and saves the selected range into the current MST settings", async () => {
  const result = vi.fn(() => ({
    data: {
      setAffiliateUnrepliedMessageLookback: {
        id: "settings-1",
        userId: "seller-1",
        unrepliedMessageLookbackDays: 14,
        onboardingCompletedAt: null,
      },
    },
  }));
  render(
    <MockedProvider
      mocks={[
        {
          request: {
            query: SET_AFFILIATE_UNREPLIED_MESSAGE_LOOKBACK_MUTATION,
            variables: { days: 14 },
          },
          result,
        },
      ]}
    >
      <ToastProvider>
        <AffiliateMessageLookbackPanel />
      </ToastProvider>
    </MockedProvider>,
  );
  const input = screen.getByRole("spinbutton", { name: "只处理最近多少天的未回复消息" });
  const save = screen.getByRole("button", { name: "保存" });
  expect((input as HTMLInputElement).value).toBe("90");
  expect((save as HTMLButtonElement).disabled).toBe(true);
  for (const value of ["0", "91", "1.5", ""]) {
    fireEvent.change(input, { target: { value } });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("请输入 1–90 之间的整数。")).toBeTruthy();
  }
  fireEvent.change(input, { target: { value: "14" } });
  // A store refresh destroys the previous settings node while the draft is open.
  workspace.setAffiliateOperationalSettings({
    id: "settings-2",
    userId: "seller-1",
    unrepliedMessageLookbackDays: 30,
  });
  fireEvent.click(save);
  await waitFor(() => expect(workspace.operationalSettings?.unrepliedMessageLookbackDays).toBe(14));
  expect(result).toHaveBeenCalledOnce();
  expect(screen.getByText("消息处理范围已保存。")).toBeTruthy();
});

it("keeps the persisted setting and editable draft when saving fails", async () => {
  render(
    <MockedProvider
      mocks={[
        {
          request: {
            query: SET_AFFILIATE_UNREPLIED_MESSAGE_LOOKBACK_MUTATION,
            variables: { days: 7 },
          },
          error: new Error("network failure"),
        },
      ]}
    >
      <ToastProvider>
        <AffiliateMessageLookbackPanel />
      </ToastProvider>
    </MockedProvider>,
  );
  const input = screen.getByRole("spinbutton");
  fireEvent.change(input, { target: { value: "7" } });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  await waitFor(() => expect(screen.getByText("消息处理范围保存失败，请重试。")).toBeTruthy());
  expect(workspace.operationalSettings?.unrepliedMessageLookbackDays).toBe(90);
  expect((input as HTMLInputElement).value).toBe("7");
});
