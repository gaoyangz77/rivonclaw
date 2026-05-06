import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  clearWeixinContextTokenFiles,
  hasWeixinContextTokenForRecipient,
  readWeixinAccountUserIdSync,
  readWeixinContextTokenRecipientIds,
  WEIXIN_CHANNEL_ID,
} from "./weixin-account-dedupe.js";

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
