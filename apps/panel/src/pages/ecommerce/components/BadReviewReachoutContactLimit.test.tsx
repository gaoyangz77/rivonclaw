import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n/index.js";
import { BadReviewReachoutContactLimit } from "./BadReviewReachoutContactLimit.js";

beforeEach(async () => {
  await i18n.changeLanguage("zh");
});

describe("bad-review contact limit", () => {
  it.each([
    ["1", "仅首次联系"],
    ["2", "首次联系 → 4 小时后再次跟进"],
    ["3", "首次联系 → 4 小时后再次跟进 → 再隔 8 小时最后跟进"],
  ])("shows the fixed schedule for %s contacts including the first", (value, summary) => {
    render(<BadReviewReachoutContactLimit value={value} disabled={false} onChange={vi.fn()} />);
    expect(screen.getByText(summary)).toBeTruthy();
    expect(screen.getByRole("button", { name: "最多触达次数（含首次）" }).textContent).toContain(
      `${value} 次`,
    );
  });

  it("offers exactly 1, 2, 3 and forwards the selected draft value", () => {
    const onChange = vi.fn();
    render(<BadReviewReachoutContactLimit value="3" disabled={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "最多触达次数（含首次）" }));
    const options = screen.getAllByRole("button", { name: /^[123] 次$/ });
    expect(options.map((option) => option.textContent)).toEqual(["1 次", "2 次", "3 次"]);
    fireEvent.click(options[0]!);
    expect(onChange).toHaveBeenCalledWith("1");
  });

  it("makes timing and conservative configuration semantics available by keyboard tooltip", async () => {
    render(<BadReviewReachoutContactLimit value="3" disabled={false} onChange={vi.fn()} />);
    fireEvent.focus(screen.getByRole("button", { name: /包含首次联系，仅成功发送才计数/ }));
    await waitFor(() =>
      expect(screen.getByRole("tooltip").textContent).toContain("客户回复后停止主动跟进"),
    );
    expect(screen.getByRole("tooltip").textContent).toContain("提高上限只对新计划生效");
    expect(screen.getByRole("tooltip").textContent).toContain("半小时调度");
  });

  it("disables editing while its parent feature is disabled or saving", () => {
    render(<BadReviewReachoutContactLimit value="3" disabled onChange={vi.fn()} />);
    expect(
      (screen.getByRole("button", { name: "最多触达次数（含首次）" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("uses singular wording and the fixed schedule in English", async () => {
    await i18n.changeLanguage("en");
    render(<BadReviewReachoutContactLimit value="1" disabled={false} onChange={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Maximum contacts (including first)" }).textContent,
    ).toContain("1 contact");
    expect(screen.getByText("First contact only")).toBeTruthy();
  });
});
