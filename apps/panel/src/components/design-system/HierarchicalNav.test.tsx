// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TkHierarchicalNav, type TkHierarchicalNavItem } from "./HierarchicalNav.js";

const ITEMS: readonly TkHierarchicalNavItem[] = [
  { id: "chat", label: "对话" },
  {
    id: "affiliate",
    label: "达人联盟",
    flyoutLabel: "达人联盟二级导航",
    description: "推广执行、关系资产与增长洞察。",
    children: [
      { id: "campaigns", label: "推广计划", group: "执行" },
      { id: "workbench", label: "工作台", group: "执行" },
      { id: "analytics", label: "数据分析", group: "洞察" },
    ],
  },
];

beforeEach(() => {
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
});

describe("TkHierarchicalNav", () => {
  it("navigates leaf items directly and exposes the current page", () => {
    const onChange = vi.fn();
    render(
      <TkHierarchicalNav
        items={ITEMS}
        value="chat"
        onChange={onChange}
        label="主导航"
      />,
    );

    const chat = screen.getByRole("button", { name: "对话" });
    expect(chat.getAttribute("aria-current")).toBe("page");
    fireEvent.click(chat);
    expect(onChange).toHaveBeenCalledWith("chat");
  });

  it("pins parent flyouts on click until the parent is clicked again", () => {
    vi.useFakeTimers();
    render(
      <TkHierarchicalNav
        items={ITEMS}
        value="workbench"
        onChange={() => {}}
        label="主导航"
        hoverCloseDelay={20}
      />,
    );

    const affiliate = screen.getByRole("button", { name: "达人联盟" });
    fireEvent.click(affiliate);
    expect(screen.getByRole("navigation", { name: "达人联盟二级导航" })).toBeTruthy();

    fireEvent.pointerLeave(affiliate.closest("li") as HTMLElement);
    vi.advanceTimersByTime(30);
    expect(screen.getByRole("navigation", { name: "达人联盟二级导航" })).toBeTruthy();

    fireEvent.click(affiliate);
    expect(screen.queryByRole("navigation", { name: "达人联盟二级导航" })).toBeNull();
  });

  it("opens, traverses and closes a flyout from the keyboard after focus disclosure settles", async () => {
    const onChange = vi.fn();
    render(
      <TkHierarchicalNav
        items={ITEMS}
        value="chat"
        onChange={onChange}
        label="主导航"
      />,
    );

    const affiliate = screen.getByRole("button", { name: "达人联盟" });
    affiliate.focus();
    await Promise.resolve();
    expect(screen.getByRole("navigation", { name: "达人联盟二级导航" })).toBeTruthy();
    fireEvent.keyDown(affiliate, { key: "ArrowRight" });

    const campaigns = screen.getByRole("button", { name: "推广计划" });
    const workbench = screen.getByRole("button", { name: "工作台" });
    expect(document.activeElement).toBe(campaigns);

    fireEvent.keyDown(campaigns, { key: "ArrowDown" });
    expect(document.activeElement).toBe(workbench);

    fireEvent.keyDown(workbench, { key: "Escape" });
    expect(screen.queryByRole("navigation", { name: "达人联盟二级导航" })).toBeNull();
    expect(document.activeElement).toBe(affiliate);
  });

  it("keeps collapsed navigation labels accessible", () => {
    render(
      <TkHierarchicalNav
        items={ITEMS}
        value="workbench"
        onChange={() => {}}
        label="主导航"
        collapsed
        defaultOpenItemId="affiliate"
      />,
    );

    expect(screen.getByRole("button", { name: "达人联盟" }).getAttribute("title")).toBe(
      "达人联盟",
    );
    expect(screen.getByRole("button", { name: "工作台" }).getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("uses a compact grid without a redundant visual heading for large production menus", () => {
    render(
      <TkHierarchicalNav
        items={[
          {
            id: "affiliate",
            label: "达人联盟",
            flyoutLabel: "达人联盟二级导航",
            children: Array.from({ length: 8 }, (_, index) => ({
              id: `affiliate-${index}`,
              label: `入口 ${index + 1}`,
            })),
          },
        ]}
        value="affiliate-0"
        onChange={() => {}}
        label="主导航"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "达人联盟" }));
    const flyout = screen.getByRole("navigation", { name: "达人联盟二级导航" });
    expect(flyout.classList.contains("tk-v1-nav-flyout-grid")).toBe(true);
    expect(flyout.querySelector("header")).toBeNull();
  });
});
