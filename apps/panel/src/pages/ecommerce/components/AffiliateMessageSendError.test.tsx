import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import i18n from "../../../i18n/index.js";
import { AffiliateMessageSendError } from "./AffiliateMessageSendError.js";

const providerError =
  "TikTok API error 16030101: Precondition Required. This operation requires the seller account to be in a normal state and the shop to meet the GMV requirement before contacting this creator. (request_id: 2026101514543257B003D5F8DAA11F7E58)";

beforeEach(async () => {
  await i18n.changeLanguage("zh");
});
afterEach(cleanup);

describe("Affiliate message send errors", () => {
  it("explains the platform restriction in Chinese and retains Provider evidence", () => {
    render(<AffiliateMessageSendError message={providerError} onDismiss={vi.fn()} />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("TikTok 平台限制发送（16030101）");
    expect(alert.textContent).toContain("卖家账号状态异常，或店铺未达到");
    expect(alert.textContent).toContain("与 BD 子账号权限无关");
    expect(alert.textContent).toContain("TikTok 未说明具体是哪项条件不满足");
    expect(alert.textContent).toContain("如果原生后台可以发送");
    const details = alert.querySelector("details")!;
    expect(details.querySelector("code")?.textContent).toBe(providerError);
    expect(details.textContent).toContain("原始错误与请求编号");
    // The entire actionable explanation is outside the optional raw-error disclosure.
    expect(details.textContent).not.toContain("与 BD 子账号权限无关");
  });

  it.each([
    "Business developers can only act on their own AffiliateCreatorRelationship.",
    "TikTok API error 16030100: Shop has reached IM send message quota with this creator",
    "Network error (request_id: 16030101)",
    "TikTok API error 160301010: Unknown Provider rejection",
  ])("preserves other errors without mislabeling permissions: %s", (message) => {
    render(<AffiliateMessageSendError message={message} onDismiss={vi.fn()} />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("消息发送失败");
    expect(alert.textContent).toContain(message);
    expect(alert.textContent).not.toContain("与 BD 子账号权限无关");
  });

  it("keeps long unrecognized errors intact and lets the employee dismiss the notice", () => {
    const onDismiss = vi.fn();
    const message = `Provider failure: ${"详细原因".repeat(300)} — 最后的排查建议`;
    render(<AffiliateMessageSendError message={message} onDismiss={onDismiss} />);
    expect(screen.getByRole("alert").textContent).toContain(message);
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("uses the employee's selected language", async () => {
    await i18n.changeLanguage("en");
    render(<AffiliateMessageSendError message={providerError} onDismiss={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toContain(
      "unrelated to BD sub-account permissions",
    );
  });
});
