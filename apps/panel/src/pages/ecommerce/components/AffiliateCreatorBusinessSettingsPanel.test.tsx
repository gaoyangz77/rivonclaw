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
const DEADLINE_RELEASE = /申样临期未审自动释放到公海/;
const INVALID_HOURS = "请输入 1–142 之间的整数";

let workspace: ReturnType<typeof AffiliateWorkspaceModel.create>;

function settings(overrides: Record<string, unknown> = {}) {
  return {
    id: "settings-1",
    userId: "seller-1",
    unrepliedMessageLookbackDays: 90,
    onboardingCompletedAt: null,
    releaseBeforeSampleExpiryHours: null,
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
const hoursInput = () =>
  screen.getByRole("spinbutton", { name: "截止前（小时）" }) as HTMLInputElement;
const saveButton = () => screen.getByRole("button", { name: "保存" }) as HTMLButtonElement;

beforeEach(async () => {
  await i18n.changeLanguage("zh");
  workspace = AffiliateWorkspaceModel.create({
    operationalSettings: settings(),
  });
  state.store = { affiliateWorkspace: workspace };
});
afterEach(cleanup);

it("defaults all three rules to unchecked and keeps save disabled while nothing changed", () => {
  renderPanel();
  expect(checkbox(AUTO_CLAIM).checked).toBe(false);
  expect(checkbox(AUTO_RELEASE).checked).toBe(false);
  expect(checkbox(DEADLINE_RELEASE).checked).toBe(false);
  expect(screen.queryByRole("spinbutton")).toBeNull();
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
  expect(checkbox(DEADLINE_RELEASE).disabled).toBe(true);
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

it("sends the booleans with a null deadline release and writes the response into the current MST settings", async () => {
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
            releaseBeforeSampleExpiryHours: null,
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
            releaseBeforeSampleExpiryHours: null,
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

function deadlineMock(hours: number | null, onResult = vi.fn()) {
  const result = () => {
    onResult();
    return {
      data: {
        setAffiliateCreatorBusinessSettings: settings({ releaseBeforeSampleExpiryHours: hours }),
      },
    };
  };
  return {
    request: {
      query: SET_AFFILIATE_CREATOR_BUSINESS_SETTINGS_MUTATION,
      variables: {
        input: {
          autoClaimOnSampleApproval: false,
          autoReleaseOnSampleRejection: false,
          releaseBeforeSampleExpiryHours: hours,
        },
      },
    },
    result,
  };
}

it("pre-fills 72 hours when the deadline release is switched on and saves it", async () => {
  const onResult = vi.fn();
  renderPanel([deadlineMock(72, onResult)]);
  fireEvent.click(checkbox(DEADLINE_RELEASE));
  expect(hoursInput().value).toBe("72");
  expect(saveButton().disabled).toBe(false);
  fireEvent.click(saveButton());
  await waitFor(() =>
    expect(workspace.operationalSettings?.releaseBeforeSampleExpiryHours).toBe(72),
  );
  expect(onResult).toHaveBeenCalledOnce();
  expect(screen.getByText("达人业务配置已保存。")).toBeTruthy();
  expect(checkbox(DEADLINE_RELEASE).checked).toBe(true);
  expect(hoursInput().value).toBe("72");
  expect(saveButton().disabled).toBe(true);
});

it("sends an edited hours value", async () => {
  const onResult = vi.fn();
  renderPanel([deadlineMock(36, onResult)]);
  fireEvent.click(checkbox(DEADLINE_RELEASE));
  fireEvent.change(hoursInput(), { target: { value: "36" } });
  fireEvent.click(saveButton());
  await waitFor(() =>
    expect(workspace.operationalSettings?.releaseBeforeSampleExpiryHours).toBe(36),
  );
  expect(onResult).toHaveBeenCalledOnce();
});

it("accepts the 1 and 142 hour bounds", () => {
  renderPanel();
  fireEvent.click(checkbox(DEADLINE_RELEASE));
  for (const value of ["1", "142"]) {
    fireEvent.change(hoursInput(), { target: { value } });
    expect(saveButton().disabled).toBe(false);
    expect(screen.queryByText(INVALID_HOURS)).toBeNull();
  }
});

it("disables save with an inline hint while the hours are not an integer from 1 to 142", () => {
  renderPanel();
  fireEvent.click(checkbox(DEADLINE_RELEASE));
  for (const value of ["0", "143", "", "1.5"]) {
    fireEvent.change(hoursInput(), { target: { value } });
    expect(saveButton().disabled).toBe(true);
    expect(screen.getByText(INVALID_HOURS)).toBeTruthy();
  }
  fireEvent.change(hoursInput(), { target: { value: "48" } });
  expect(saveButton().disabled).toBe(false);
  expect(screen.queryByText(INVALID_HOURS)).toBeNull();
});

it("shows a persisted deadline release as on with its hours", () => {
  workspace.setAffiliateOperationalSettings(
    settings({ releaseBeforeSampleExpiryHours: 24 }) as never,
  );
  renderPanel();
  expect(checkbox(DEADLINE_RELEASE).checked).toBe(true);
  expect(hoursInput().value).toBe("24");
  expect(saveButton().disabled).toBe(true);
});

it("sends null when a persisted deadline release is switched off", async () => {
  workspace.setAffiliateOperationalSettings(
    settings({ releaseBeforeSampleExpiryHours: 24 }) as never,
  );
  const onResult = vi.fn();
  renderPanel([deadlineMock(null, onResult)]);
  fireEvent.click(checkbox(DEADLINE_RELEASE));
  expect(screen.queryByRole("spinbutton")).toBeNull();
  expect(saveButton().disabled).toBe(false);
  fireEvent.click(saveButton());
  await waitFor(() =>
    expect(workspace.operationalSettings?.releaseBeforeSampleExpiryHours).toBeNull(),
  );
  expect(onResult).toHaveBeenCalledOnce();
  expect(checkbox(DEADLINE_RELEASE).checked).toBe(false);
});

it("ignores an invalid hours draft once the deadline release is switched back off", () => {
  renderPanel();
  fireEvent.click(checkbox(DEADLINE_RELEASE));
  fireEvent.change(hoursInput(), { target: { value: "500" } });
  expect(saveButton().disabled).toBe(true);
  fireEvent.click(checkbox(DEADLINE_RELEASE));
  expect(screen.queryByText(INVALID_HOURS)).toBeNull();
  expect(saveButton().disabled).toBe(true);
});
