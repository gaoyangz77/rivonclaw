import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { observable, runInAction } from "mobx";
import { applySnapshot } from "mobx-state-tree";
import i18n from "../../../i18n/index.js";
import { runtimeStatusStore } from "../../../store/runtime-status-store.js";
import {
  AffiliateSampleIgnoreButton,
  AffiliateSampleShopIdentity,
} from "./AffiliateSampleReview.js";

const { mockStore } = vi.hoisted(() => ({
  mockStore: { shops: [] as Array<{ id: string; alias?: string; shopName?: string }> },
}));
vi.mock("../../../store/EntityStoreProvider.js", () => ({ useEntityStore: () => mockStore }));

beforeEach(async () => {
  await i18n.changeLanguage("zh");
  mockStore.shops = observable([{ id: "shop-1", alias: "意大利01", shopName: "Windboss Italia" }]);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  applySnapshot(runtimeStatusStore.appSettings, { privacyMode: false });
});

describe("sample application shop identity", () => {
  it("shows the alias and platform name together and reacts to shop updates", () => {
    render(<AffiliateSampleShopIdentity shopId="shop-1" />);
    expect(screen.getByText("意大利01")).toBeTruthy();
    expect(screen.getByText("Windboss Italia")).toBeTruthy();
    act(() =>
      runInAction(() => {
        mockStore.shops[0].shopName = "Windboss Italy";
      }),
    );
    expect(screen.getByText("Windboss Italy")).toBeTruthy();
  });

  it("preserves privacy masking on the shop name without masking the alias", () => {
    applySnapshot(runtimeStatusStore.appSettings, { privacyMode: true });
    render(<AffiliateSampleShopIdentity shopId="shop-1" />);
    expect(screen.getByText("意大利01").getAttribute("data-tk-private")).toBeNull();
    expect(screen.getByText("Windboss Italia").getAttribute("data-tk-private")).toBe("text");
    expect(screen.getByText("Windboss Italia").getAttribute("title")).toBeNull();
  });

  it("still identifies a shop when its alias is absent or its record has not loaded", () => {
    runInAction(() => {
      mockStore.shops[0].alias = "";
    });
    const view = render(<AffiliateSampleShopIdentity shopId="shop-1" />);
    expect(screen.getByText("Windboss Italia")).toBeTruthy();
    view.rerender(<AffiliateSampleShopIdentity shopId="shop-missing" />);
    expect(screen.getByText("shop-missing")).toBeTruthy();
  });
});

describe("ignore sample application", () => {
  it("explains local ignore on keyboard focus and retains the command handler", () => {
    const onClick = vi.fn();
    render(<AffiliateSampleIgnoreButton onClick={onClick} />);
    const button = screen.getByRole("button", { name: "忽略" });
    fireEvent.focus(button);
    expect(screen.getByRole("tooltip").textContent).toContain("不会直接在 TikTok 上拒绝");
    expect(screen.getByRole("tooltip").textContent).toContain("等待其自然过期");
    expect(button.getAttribute("aria-describedby")).toBeTruthy();
    fireEvent.blur(button);
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
    expect(i18n.t("ecommerce.affiliateWorkspace.workbench.sampleSoftRejected")).toBe("已忽略");
    expect(i18n.t("ecommerce.affiliateWorkspace.workbench.platformReject")).toBe("拒绝");
  });

  it("shows the same explanation on hover", () => {
    vi.useFakeTimers();
    render(<AffiliateSampleIgnoreButton onClick={() => {}} />);
    fireEvent.pointerEnter(screen.getByRole("button", { name: "忽略" }));
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole("tooltip").textContent).toContain("不再继续审查");
  });

  it("localizes the English action and does not dispatch when disabled", async () => {
    await i18n.changeLanguage("en");
    const onClick = vi.fn();
    render(<AffiliateSampleIgnoreButton disabled onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Ignore" }));
    expect(onClick).not.toHaveBeenCalled();
    expect(i18n.t("ecommerce.affiliateWorkspace.workbench.sampleSoftRejected")).toBe("Ignored");
    expect(i18n.t("ecommerce.affiliateWorkspace.workbench.platformReject")).toBe("Reject");
  });
});
