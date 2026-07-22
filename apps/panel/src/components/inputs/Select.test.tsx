// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Select } from "./Select.js";

const defaultInnerHeight = window.innerHeight;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(window, "innerHeight", { configurable: true, value: defaultInnerHeight });
});

describe("Select", () => {
  it("uses the caller-provided localized search placeholder", () => {
    render(
      <Select
        value=""
        onChange={() => {}}
        options={[{ value: "shop", label: "Shop" }]}
        placeholder="Select"
        searchable
        searchPlaceholder="搜索店铺"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Select/i }));
    expect(screen.getByPlaceholderText("搜索店铺")).toBeTruthy();
  });

  it("focuses searchable dropdowns without scrolling the page", async () => {
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, "focus");
    render(
      <Select
        value=""
        onChange={() => {}}
        options={[{ value: "MX", label: "墨西哥" }]}
        placeholder="选择地区"
        searchable
        searchPlaceholder="搜索地区代码或名称"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /选择地区/i }));

    await waitFor(() => {
      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    });
  });

  it("caps dropdown height and preserves a viewport gutter", () => {
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 820 });
    render(
      <Select
        value=""
        onChange={() => {}}
        options={[{ value: "shop", label: "Shop" }]}
        placeholder="Select"
        ariaLabel="height test select"
      />,
    );

    const trigger = screen.getByRole("button", { name: "height test select" });
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
      top: 436,
      bottom: 516,
      left: 100,
      right: 400,
      width: 300,
      height: 80,
      x: 100,
      y: 436,
      toJSON: () => ({}),
    });
    fireEvent.click(trigger);

    const dropdown = document.querySelector<HTMLElement>(".custom-select-dropdown");
    expect(dropdown?.style.top).toBe("520px");
    expect(dropdown?.style.maxHeight).toBe("280px");
  });

  it("shows option status badges in both the trigger and dropdown", () => {
    const onChange = vi.fn();
    render(
      <Select
        value="running"
        onChange={onChange}
        options={[
          {
            value: "running",
            label: "MXTK-05 · v2",
            badge: "Running",
            badgeTone: "success",
          },
          {
            value: "ended",
            label: "MXTK-05 · v1",
            badge: "Ended",
            badgeTone: "neutral",
          },
        ]}
      />,
    );

    expect(screen.getByText("Running").classList.contains("success")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /MXTK-05 · v2/i }));

    expect(screen.getAllByText("Running")).toHaveLength(2);
    expect(screen.getByText("Ended").classList.contains("neutral")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /MXTK-05 · v1/i }));
    expect(onChange).toHaveBeenCalledWith("ended");
  });
});
