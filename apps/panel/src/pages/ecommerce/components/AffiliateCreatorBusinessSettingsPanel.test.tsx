import type { ComponentProps } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing/react";
import { AffiliateWorkspaceModel } from "@rivonclaw/core/models";
import { SET_AFFILIATE_CREATOR_BUSINESS_SETTINGS_MUTATION } from "../../../api/shops-queries.js";
import { ToastProvider } from "../../../components/Toast.js";
import i18n from "../../../i18n/index.js";
import { AffiliateCreatorBusinessSettingsPanel } from "./AffiliateCreatorBusinessSettingsPanel.js";

const state = vi.hoisted(() => ({ store: null as unknown }));
vi.mock("../../../store/EntityStoreProvider.js", () => ({
  useEntityStore: () => state.store,
}));

const AUTO_CLAIM = /新达人申样通过时自动申领/;
const AUTO_RELEASE = /新达人拒绝\/忽略申样后自动释放到公海/;

let workspace: ReturnType<typeof AffiliateWorkspaceModel.create>;

function settings(overrides: Record<string, unknown> = {}) {
  return {
    id: "settings-1",
    userId: "seller-1",
    unrepliedMessageLookbackDays: 90,
    onboardingCompletedAt: null,
    ...overrides,
  };
}

function renderPanel(mocks: ComponentProps<typeof MockedProvider>["mocks"] = []) {
  return render(
    <MockedProvider mocks={mocks}>
      <ToastProvider>
        <AffiliateCreatorBusinessSettingsPanel />
      </ToastProvider>
    </MockedProvider>,
  );
}

const checkbox = (name: RegExp) => screen.getByRole("checkbox", { name }) as HTMLInputElement;
const saveButton = () => screen.getByRole("button", { name: "保存" }) as HTMLButtonElement;

beforeEach(async () => {
  await i18n.changeLanguage("zh");
  workspace = AffiliateWorkspaceModel.create({
    operationalSettings: settings(),
  });
  state.store = { affiliateWorkspace: workspace };
});
afterEach(cleanup);

it("defaults both rules to unchecked and keeps save disabled while nothing changed", () => {
  renderPanel();
  expect(checkbox(AUTO_CLAIM).checked).toBe(false);
  expect(checkbox(AUTO_RELEASE).checked).toBe(false);
  expect(checkbox(AUTO_CLAIM).disabled).toBe(false);
  expect(saveButton().disabled).toBe(true);
  expect(screen.getByText("以下规则对本卖家账号下的所有店铺生效，默认均为关闭。")).toBeTruthy();
});

it("shows the persisted values from the store", () => {
  workspace.setAffiliateOperationalSettings(
    settings({
      autoClaimOnSampleApproval: true,
      autoReleaseOnSampleRejection: false,
    }) as never,
  );
  renderPanel();
  expect(checkbox(AUTO_CLAIM).checked).toBe(true);
  expect(checkbox(AUTO_RELEASE).checked).toBe(false);
  expect(saveButton().disabled).toBe(true);
});

it("disables the controls until the settings have loaded", () => {
  workspace.setAffiliateOperationalSettings(null);
  renderPanel();
  expect(checkbox(AUTO_CLAIM).disabled).toBe(true);
  expect(checkbox(AUTO_RELEASE).disabled).toBe(true);
  expect(saveButton().disabled).toBe(true);

  // Settings arriving later enable the controls without a remount.
  workspace.setAffiliateOperationalSettings(settings() as never);
  return waitFor(() => {
    expect(checkbox(AUTO_CLAIM).disabled).toBe(false);
    expect(checkbox(AUTO_RELEASE).disabled).toBe(false);
  });
});

it("enables save only while the draft differs from the stored values", () => {
  renderPanel();
  fireEvent.click(checkbox(AUTO_CLAIM));
  expect(saveButton().disabled).toBe(false);
  fireEvent.click(checkbox(AUTO_CLAIM));
  expect(saveButton().disabled).toBe(true);
});

it("sends both booleans and writes the response into the current MST settings", async () => {
  const result = vi.fn(() => ({
    data: {
      setAffiliateCreatorBusinessSettings: settings({
        autoClaimOnSampleApproval: true,
        autoReleaseOnSampleRejection: false,
      }),
    },
  }));
  renderPanel([
    {
      request: {
        query: SET_AFFILIATE_CREATOR_BUSINESS_SETTINGS_MUTATION,
        variables: {
          input: {
            autoClaimOnSampleApproval: true,
            autoReleaseOnSampleRejection: false,
          },
        },
      },
      result,
    },
  ]);
  fireEvent.click(checkbox(AUTO_CLAIM));
  // A store refresh destroys the previous settings node while the draft is open.
  workspace.setAffiliateOperationalSettings(settings({ id: "settings-2" }) as never);
  fireEvent.click(saveButton());
  await waitFor(() => expect(workspace.operationalSettings?.autoClaimOnSampleApproval).toBe(true));
  expect(result).toHaveBeenCalledOnce();
  expect(workspace.operationalSettings?.autoReleaseOnSampleRejection).toBe(false);
  expect(screen.getByText("达人业务配置已保存。")).toBeTruthy();
  expect(checkbox(AUTO_CLAIM).checked).toBe(true);
  expect(saveButton().disabled).toBe(true);
});

it("keeps the persisted values and the editable draft when saving fails", async () => {
  renderPanel([
    {
      request: {
        query: SET_AFFILIATE_CREATOR_BUSINESS_SETTINGS_MUTATION,
        variables: {
          input: {
            autoClaimOnSampleApproval: false,
            autoReleaseOnSampleRejection: true,
          },
        },
      },
      error: new Error("network failure"),
    },
  ]);
  fireEvent.click(checkbox(AUTO_RELEASE));
  fireEvent.click(saveButton());
  await waitFor(() => expect(screen.getByText("达人业务配置保存失败，请重试。")).toBeTruthy());
  expect(workspace.operationalSettings?.autoReleaseOnSampleRejection).toBe(false);
  expect(checkbox(AUTO_RELEASE).checked).toBe(true);
  expect(saveButton().disabled).toBe(false);
});
