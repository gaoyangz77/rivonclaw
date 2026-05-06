import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addAllowFromEntry,
  readAllowFromList,
} from "./channel-allowlist-store.js";
import { WEIXIN_CHANNEL_ID } from "./weixin-account-dedupe.js";

describe("channel allowFrom account scoping", () => {
  let previousStateDir: string | undefined;
  let tmpStateDir: string;

  beforeEach(async () => {
    previousStateDir = process.env.OPENCLAW_STATE_DIR;
    tmpStateDir = await mkdtemp(join(tmpdir(), "rivonclaw-allowlist-"));
    process.env.OPENCLAW_STATE_DIR = tmpStateDir;
  });

  afterEach(async () => {
    if (previousStateDir === undefined) {
      delete process.env.OPENCLAW_STATE_DIR;
    } else {
      process.env.OPENCLAW_STATE_DIR = previousStateDir;
    }
    await rm(tmpStateDir, { recursive: true, force: true });
  });

  it("keeps Weixin recipients isolated per account", async () => {
    await addAllowFromEntry(WEIXIN_CHANNEL_ID, "account-a-im-bot", "user-a@im.wechat");
    await addAllowFromEntry(WEIXIN_CHANNEL_ID, "account-b-im-bot", "user-b@im.wechat");

    expect(await readAllowFromList(WEIXIN_CHANNEL_ID, "account-a-im-bot")).toEqual(["user-a@im.wechat"]);
    expect(await readAllowFromList(WEIXIN_CHANNEL_ID, "account-b-im-bot")).toEqual(["user-b@im.wechat"]);
  });

});
