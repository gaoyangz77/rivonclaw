import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  WEIXIN_CHANNEL_ID,
  clearWeixinContextTokenFiles,
  hasWeixinContextTokenForRecipient,
  readWeixinAccountUserIdSync,
  readWeixinContextTokenRecipientIds,
  selectStaleWeixinAccountIdsForLogin,
  selectWeixinReplacementAccountName,
} from "./weixin-account-dedupe.js";

describe("selectStaleWeixinAccountIdsForLogin", () => {
  it("removes previous Weixin accounts for the same userId", () => {
    const stale = selectStaleWeixinAccountIdsForLogin({
      currentAccountId: "new-im-bot",
      userId: "wx-user-1",
      accountUserIds: new Map([
        ["new-im-bot", "wx-user-1"],
        ["old-im-bot", "wx-user-1"],
        ["other-im-bot", "wx-user-2"],
      ]),
      indexedAccountIds: new Set(["new-im-bot", "other-im-bot", "old-im-bot"]),
      accountFileExists: new Set(["new-im-bot", "other-im-bot", "old-im-bot"]),
      accounts: [
        { channelId: WEIXIN_CHANNEL_ID, accountId: "new-im-bot", config: {} },
        { channelId: WEIXIN_CHANNEL_ID, accountId: "old-im-bot", config: {} },
        { channelId: WEIXIN_CHANNEL_ID, accountId: "other-im-bot", config: {} },
      ],
    });

    expect(stale).toEqual(["old-im-bot"]);
  });

  it("removes orphaned Weixin rows that the upstream plugin no longer indexes", () => {
    const stale = selectStaleWeixinAccountIdsForLogin({
      currentAccountId: "new-im-bot",
      userId: "wx-user-1",
      accountUserIds: new Map([
        ["new-im-bot", "wx-user-1"],
        ["other-im-bot", "wx-user-2"],
      ]),
      indexedAccountIds: new Set(["new-im-bot", "other-im-bot"]),
      accountFileExists: new Set(["new-im-bot", "other-im-bot"]),
      accounts: [
        { channelId: WEIXIN_CHANNEL_ID, accountId: "new-im-bot", config: {} },
        { channelId: WEIXIN_CHANNEL_ID, accountId: "orphan-im-bot", config: {} },
        { channelId: WEIXIN_CHANNEL_ID, accountId: "other-im-bot", config: {} },
      ],
    });

    expect(stale).toEqual(["orphan-im-bot"]);
  });

  it("keeps different indexed Weixin accounts and non-Weixin accounts", () => {
    const stale = selectStaleWeixinAccountIdsForLogin({
      currentAccountId: "new-im-bot",
      userId: "wx-user-1",
      accountUserIds: new Map([
        ["other-im-bot", "wx-user-2"],
        ["orphan-im-bot", "wx-user-1"],
      ]),
      indexedAccountIds: new Set(["new-im-bot", "other-im-bot"]),
      accountFileExists: new Set(["new-im-bot", "other-im-bot"]),
      accounts: [
        { channelId: WEIXIN_CHANNEL_ID, accountId: "other-im-bot", config: {} },
        { channelId: "telegram", accountId: "orphan-im-bot", config: {} },
      ],
    });

    expect(stale).toEqual([]);
  });
});

describe("readWeixinAccountUserIdSync", () => {
  it("reads provider-owned userId from canonical and legacy raw account files", async () => {
    const stateDir = await mkdtemp(join(tmpdir(), "rivonclaw-weixin-userid-test-"));
    try {
      const accountsDir = join(stateDir, WEIXIN_CHANNEL_ID, "accounts");
      await mkdir(accountsDir, { recursive: true });
      await writeFile(
        join(accountsDir, "abc123@im.bot.json"),
        JSON.stringify({ userId: "owner@im.wechat" }),
        "utf-8",
      );

      expect(readWeixinAccountUserIdSync(stateDir, "abc123-im-bot")).toBe("owner@im.wechat");

      await writeFile(
        join(accountsDir, "abc123-im-bot.json"),
        JSON.stringify({ userId: "canonical@im.wechat" }),
        "utf-8",
      );

      expect(readWeixinAccountUserIdSync(stateDir, "abc123-im-bot")).toBe("canonical@im.wechat");
    } finally {
      await rm(stateDir, { recursive: true, force: true });
    }
  });
});

describe("readWeixinContextTokenRecipientIds", () => {
  it("reads recipients from canonical and legacy raw context token files", async () => {
    const stateDir = await mkdtemp(join(tmpdir(), "rivonclaw-weixin-dedupe-test-"));
    try {
      const accountsDir = join(stateDir, WEIXIN_CHANNEL_ID, "accounts");
      await mkdir(accountsDir, { recursive: true });
      await writeFile(
        join(accountsDir, "abc123-im-bot.context-tokens.json"),
        JSON.stringify({
          "manager@im.wechat": "context-token",
          "empty@im.wechat": "",
        }),
        "utf-8",
      );
      await writeFile(
        join(accountsDir, "abc123@im.bot.context-tokens.json"),
        JSON.stringify({
          "legacy@im.wechat": "legacy-context-token",
        }),
        "utf-8",
      );

      const recipients = await readWeixinContextTokenRecipientIds(stateDir, "abc123@im.bot");

      expect(new Set(recipients)).toEqual(new Set(["manager@im.wechat", "legacy@im.wechat"]));
      await expect(
        hasWeixinContextTokenForRecipient(stateDir, "abc123-im-bot", "manager@im.wechat"),
      ).resolves.toBe(true);
      await expect(
        hasWeixinContextTokenForRecipient(stateDir, "abc123-im-bot", "missing@im.wechat"),
      ).resolves.toBe(false);

      await clearWeixinContextTokenFiles(stateDir, "abc123-im-bot");
      await expect(readWeixinContextTokenRecipientIds(stateDir, "abc123-im-bot")).resolves.toEqual([]);
    } finally {
      await rm(stateDir, { recursive: true, force: true });
    }
  });
});

describe("selectWeixinReplacementAccountName", () => {
  it("preserves a custom display name from the account being replaced", () => {
    const name = selectWeixinReplacementAccountName({
      currentAccountId: "new-im-bot",
      staleAccountIds: ["old-im-bot"],
      accounts: [
        { channelId: WEIXIN_CHANNEL_ID, accountId: "old-im-bot", name: "赵总微信", config: {} },
        { channelId: WEIXIN_CHANNEL_ID, accountId: "other-im-bot", name: "Other", config: {} },
      ],
    });

    expect(name).toBe("赵总微信");
  });

  it("ignores default accountId names", () => {
    const name = selectWeixinReplacementAccountName({
      currentAccountId: "new-im-bot",
      staleAccountIds: ["old-im-bot"],
      accounts: [
        { channelId: WEIXIN_CHANNEL_ID, accountId: "old-im-bot", name: "old-im-bot", config: {} },
      ],
    });

    expect(name).toBeUndefined();
  });
});
