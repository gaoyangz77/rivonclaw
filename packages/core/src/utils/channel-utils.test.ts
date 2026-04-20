import { describe, it, expect } from "vitest";
import { normalizeWeixinAccountId } from "./channel-utils.js";

describe("normalizeWeixinAccountId", () => {
  it("converts @im.bot suffix to -im-bot", () => {
    expect(normalizeWeixinAccountId("wxid_abc123@im.bot")).toBe("wxid_abc123-im-bot");
  });

  it("converts @im.wechat suffix to -im-wechat", () => {
    expect(normalizeWeixinAccountId("wxid_abc123@im.wechat")).toBe("wxid_abc123-im-wechat");
  });

  it("returns already-canonical -im-bot form unchanged", () => {
    expect(normalizeWeixinAccountId("wxid_abc123-im-bot")).toBe("wxid_abc123-im-bot");
  });

  it("returns already-canonical -im-wechat form unchanged", () => {
    expect(normalizeWeixinAccountId("wxid_abc123-im-wechat")).toBe("wxid_abc123-im-wechat");
  });

  it("returns non-weixin IDs unchanged", () => {
    expect(normalizeWeixinAccountId("acct_mnu9pene")).toBe("acct_mnu9pene");
    expect(normalizeWeixinAccountId("telegram-user-42")).toBe("telegram-user-42");
  });

  it("returns empty string unchanged", () => {
    expect(normalizeWeixinAccountId("")).toBe("");
  });

  it("does not strip mid-string matches (only suffix)", () => {
    expect(normalizeWeixinAccountId("@im.bot-prefix")).toBe("@im.bot-prefix");
    expect(normalizeWeixinAccountId("foo@im.bot.bar")).toBe("foo@im.bot.bar");
  });
});
