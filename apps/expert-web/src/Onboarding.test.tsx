import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { I18nProvider } from "./i18n.js";
import {
  buildProfileMarkets,
  buildSupplementedAnswer,
  MarketMultiSelector,
} from "./Onboarding.js";

function SelectorHarness() {
  const [value, setValue] = useState<string[]>([]);
  return <MarketMultiSelector value={value} onChange={setValue} />;
}

describe("buildProfileMarkets", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/?lang=zh");
  });

  it("combines localized click selections with free-form context", () => {
    const names: Record<string, string> = {
      US: "美国",
      JP: "日本",
    };

    expect(
      buildProfileMarkets(
        ["US", "JP"],
        "我也可能考虑欧洲，但还没有决定",
        (code) => names[code] ?? code,
      ),
    ).toEqual(["美国 (US)", "日本 (JP)", "我也可能考虑欧洲，但还没有决定"]);
  });

  it("keeps a free-form market description as one natural-language statement", () => {
    expect(buildProfileMarkets([], "东南亚，优先考虑华人用户多的市场", (code) => code)).toEqual([
      "东南亚，优先考虑华人用户多的市场",
    ]);
  });

  it("combines a structured choice with an optional free-form supplement", () => {
    expect(buildSupplementedAnswer("有其他平台电商经验", "做过三年 Amazon 美国站")).toBe(
      "有其他平台电商经验；做过三年 Amazon 美国站",
    );
    expect(buildSupplementedAnswer("", "预算约 30 万人民币")).toBe("预算约 30 万人民币");
  });
});

describe("MarketMultiSelector", () => {
  it("keeps the panel open while the user selects several markets", () => {
    const { container } = render(
      <I18nProvider>
        <SelectorHarness />
      </I18nProvider>,
    );
    const details = container.querySelector("details");
    const summary = container.querySelector("summary");
    expect(details).not.toBeNull();
    expect(summary).not.toBeNull();

    fireEvent.click(summary!);
    expect(details!.open).toBe(true);

    const unitedStates = screen.getByRole("checkbox", { name: "美国 (US)" }) as HTMLInputElement;
    const japan = screen.getByRole("checkbox", { name: "日本 (JP)" }) as HTMLInputElement;
    fireEvent.click(unitedStates);
    fireEvent.click(japan);

    expect(unitedStates.checked).toBe(true);
    expect(japan.checked).toBe(true);
    expect(details!.open).toBe(true);
    expect(screen.getAllByText("已选择 2 个").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "完成" }));
    expect(details!.open).toBe(false);
  });

  it("closes the panel when the user clicks outside it", () => {
    const { container } = render(
      <I18nProvider>
        <SelectorHarness />
      </I18nProvider>,
    );
    const details = container.querySelector("details");
    const summary = container.querySelector("summary");
    fireEvent.click(summary!);
    expect(details!.open).toBe(true);

    fireEvent.pointerDown(document.body);
    expect(details!.open).toBe(false);
  });
});
