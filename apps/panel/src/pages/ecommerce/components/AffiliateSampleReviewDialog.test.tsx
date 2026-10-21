import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import i18n from "../../../i18n/index.js";
import { AffiliateSampleReviewDialog } from "./AffiliateSampleReviewDialog.js";

beforeEach(async () => {
  await i18n.changeLanguage("zh");
});
afterEach(cleanup);
const props = () => ({
  open: true,
  kind: "SOFT_REJECT" as const,
  busy: false,
  ignorePhase: "idle" as const,
  rejectReason: GQL.AffiliateSampleRejectReason.NotMatch,
  rejectExplanation: "",
  reviewNote: "",
  onRejectReason: vi.fn(),
  onRejectExplanation: vi.fn(),
  onReviewNote: vi.fn(),
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  onCheck: vi.fn(),
});

it("explains checking and locks submission and dismissal while the bounded read runs", () => {
  const handlers = props();
  render(<AffiliateSampleReviewDialog {...handlers} busy ignorePhase="checking" />);
  expect(screen.getByText(/正在核对忽略操作是否已经保存/)).toBeTruthy();
  expect((screen.getByRole("button", { name: "加载中..." }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(handlers.onClose).not.toHaveBeenCalled();
  expect(handlers.onConfirm).not.toHaveBeenCalled();
});

it("stops loading when unconfirmed, offers only a status check, and allows closing", () => {
  const handlers = props();
  render(<AffiliateSampleReviewDialog {...handlers} ignorePhase="unconfirmed" />);
  expect(screen.getByText(/操作可能已经保存/)).toBeTruthy();
  expect(screen.queryByText("加载中...")).toBeNull();
  expect((screen.getByRole("button", { name: "确认" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "核对状态" }));
  expect(handlers.onCheck).toHaveBeenCalledOnce();
  expect(handlers.onConfirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(handlers.onClose).toHaveBeenCalledOnce();
});

it("keeps normal review working and does not apply rejection validation to reopening", () => {
  const handlers = props();
  const view = render(<AffiliateSampleReviewDialog {...handlers} />);
  fireEvent.click(screen.getByRole("button", { name: "确认" }));
  expect(handlers.onConfirm).toHaveBeenCalledOnce();
  view.rerender(
    <AffiliateSampleReviewDialog
      {...handlers}
      kind="REOPEN"
      rejectReason={GQL.AffiliateSampleRejectReason.Other}
    />,
  );
  expect((screen.getByRole("button", { name: "确认" }) as HTMLButtonElement).disabled).toBe(false);
});
