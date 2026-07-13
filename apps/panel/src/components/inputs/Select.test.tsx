// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Select } from "./Select.js";

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
