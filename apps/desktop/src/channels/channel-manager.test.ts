import { describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applySnapshot, types } from "mobx-state-tree";
import { ChannelManagerModel } from "./channel-manager.js";
import { WEIXIN_CHANNEL_ID } from "./weixin-account-dedupe.js";

const TestRootModel = types
  .model("TestRoot", {
    channelAccounts: types.optional(types.array(types.frozen<Record<string, unknown>>()), []),
    channelManager: types.optional(ChannelManagerModel, {}),
  })
  .actions((self) => ({
    loadChannelAccounts(accounts: Record<string, unknown>[]) {
      applySnapshot(self.channelAccounts, accounts);
    },
    upsertChannelAccount(account: Record<string, unknown>) {
      const idx = self.channelAccounts.findIndex(
        (candidate) =>
          candidate.channelId === account.channelId && candidate.accountId === account.accountId,
      );
      if (idx >= 0) self.channelAccounts[idx] = account;
      else self.channelAccounts.push(account);
    },
    updateChannelAccountStatus(
      channelId: string,
      accountId: string,
      status: Record<string, unknown>,
    ) {
      const idx = self.channelAccounts.findIndex(
        (candidate) => candidate.channelId === channelId && candidate.accountId === accountId,
      );
      if (idx < 0) return;
      const current = self.channelAccounts[idx] as Record<string, unknown>;
      self.channelAccounts[idx] = {
        ...current,
        status: {
          ...(current.status as Record<string, unknown>),
          ...status,
        },
      };
    },
    updateChannelAccountRecipients(
      channelId: string,
      accountId: string,
      recipients: Record<string, unknown>,
    ) {
      const idx = self.channelAccounts.findIndex(
        (candidate) => candidate.channelId === channelId && candidate.accountId === accountId,
      );
      if (idx < 0) return;
      self.channelAccounts[idx] = {
        ...(self.channelAccounts[idx] as Record<string, unknown>),
        recipients,
      };
    },
    removeChannelAccount(channelId: string, accountId: string) {
      const idx = self.channelAccounts.findIndex(
        (candidate) => candidate.channelId === channelId && candidate.accountId === accountId,
      );
      if (idx >= 0) self.channelAccounts.splice(idx, 1);
    },
  }));

describe("ChannelManagerModel WeChat provider-owned identity", () => {
  it("treats WeChat already-connected QR results as an existing account", async () => {
    const stateDir = mkdtempSync(join(tmpdir(), "rivonclaw-channel-manager-weixin-"));
    try {
      const accountId = "acct123-im-bot";
      const accounts = [{
        channelId: WEIXIN_CHANNEL_ID,
        accountId,
        name: "赵总",
        config: { name: "赵总" },
        createdAt: 1,
        updatedAt: 1,
      }];
      const root = TestRootModel.create({});
      root.channelManager.setEnv({
        storage: {
          channelAccounts: {
            list: (channelId?: string) => channelId ? accounts.filter((account) => account.channelId === channelId) : accounts,
            get: () => accounts[0],
            upsert: vi.fn(),
            delete: vi.fn(),
          },
          channelRecipients: {
            ensureExists: vi.fn(),
            getRecipientMeta: () => ({}),
            setLabel: vi.fn(),
            delete: vi.fn(),
            setOwner: vi.fn(),
            getOwners: vi.fn(() => []),
          },
          mobilePairings: { getAllPairings: () => [] },
          settings: { get: () => "1", set: vi.fn() },
        } as any,
        configPath: join(stateDir, "openclaw.json"),
        stateDir,
      });
      root.channelManager.init();

      const rpcClient = {
        request: vi.fn(async () => ({
          connected: false,
          message: "已连接过此 OpenClaw，无需重复连接。",
        })),
      };

      const result = await root.channelManager.waitQrLogin(
        rpcClient as any,
        undefined,
        90_000,
        "session-existing",
      );

      expect(rpcClient.request).toHaveBeenCalledWith(
        "rivonclaw.weixin.login.wait",
        { accountId: undefined, timeoutMs: 90_000, sessionKey: "session-existing" },
        105_000,
      );
      expect(result).toMatchObject({
        connected: true,
        accountId,
        accountName: accountId,
        accountStatus: "existing",
      });
    } finally {
      rmSync(stateDir, { recursive: true, force: true });
    }
  });

  it("derives context token readiness from WeChat sidecar files and strips SQLite userId", () => {
    const stateDir = mkdtempSync(join(tmpdir(), "rivonclaw-channel-manager-weixin-"));
    try {
      const accountId = "acct123-im-bot";
      const userId = "owner@im.wechat";
      const accountsDir = join(stateDir, WEIXIN_CHANNEL_ID, "accounts");
      mkdirSync(accountsDir, { recursive: true });
      writeFileSync(join(accountsDir, `${accountId}.json`), JSON.stringify({ userId }), "utf-8");
      writeFileSync(
        join(accountsDir, `${accountId}.context-tokens.json`),
        JSON.stringify({ [userId]: "context-token" }),
        "utf-8",
      );

      let accounts: Array<{
        channelId: string;
        accountId: string;
        name: string | null;
        config: Record<string, unknown>;
        createdAt: number;
        updatedAt: number;
      }> = [
        {
          channelId: WEIXIN_CHANNEL_ID,
          accountId,
          name: "赵总",
          config: { name: "赵总", userId: "stale-sqlite-cache" },
          createdAt: 1,
          updatedAt: 1,
        },
      ];
      const upsert = vi.fn(
        (
          channelId: string,
          nextAccountId: string,
          name: string | null,
          config: Record<string, unknown>,
        ) => {
          const saved = {
            channelId,
            accountId: nextAccountId,
            name,
            config,
            createdAt: 1,
            updatedAt: 2,
          };
          accounts = [saved];
          return saved;
        },
      );

      const root = TestRootModel.create({});
      root.channelManager.setEnv({
        storage: {
          channelAccounts: {
            list: (channelId?: string) =>
              channelId ? accounts.filter((account) => account.channelId === channelId) : accounts,
            get: () => undefined,
            upsert,
            delete: vi.fn(),
          },
          channelRecipients: {
            ensureExists: vi.fn(),
            getRecipientMeta: () => ({}),
            setLabel: vi.fn(),
            delete: vi.fn(),
            setOwner: vi.fn(),
            getOwners: vi.fn(() => []),
          },
          mobilePairings: { getAllPairings: () => [] },
          settings: { get: () => "1", set: vi.fn() },
        } as any,
        configPath: join(stateDir, "openclaw.json"),
        stateDir,
      });

      root.channelManager.init();

      expect(upsert).toHaveBeenCalledWith(WEIXIN_CHANNEL_ID, accountId, "赵总", { name: "赵总" });
      expect(root.channelAccounts[0].config).toEqual({ name: "赵总" });
      expect(root.channelManager.buildConfigAccounts()).toEqual([{
        channelId: WEIXIN_CHANNEL_ID,
        accountId,
        config: { name: "赵总", userId },
      }]);
      expect(root.channelAccounts[0].status).toEqual({ hasContextToken: true });
    } finally {
      rmSync(stateDir, { recursive: true, force: true });
    }
  });

  it("treats WeChat account as context-token ready when any provider context token exists", () => {
    const stateDir = mkdtempSync(join(tmpdir(), "rivonclaw-channel-manager-weixin-"));
    try {
      const accountId = "acct123-im-bot";
      const staleUserId = "stale@im.wechat";
      const activeRecipientId = "active@im.wechat";
      const accountsDir = join(stateDir, WEIXIN_CHANNEL_ID, "accounts");
      mkdirSync(accountsDir, { recursive: true });
      writeFileSync(join(accountsDir, `${accountId}.json`), JSON.stringify({ userId: staleUserId }), "utf-8");
      writeFileSync(
        join(accountsDir, `${accountId}.context-tokens.json`),
        JSON.stringify({ [activeRecipientId]: "context-token" }),
        "utf-8",
      );

      const accounts = [{
        channelId: WEIXIN_CHANNEL_ID,
        accountId,
        name: "赵总",
        config: { name: "赵总" },
        createdAt: 1,
        updatedAt: 1,
      }];
      const root = TestRootModel.create({});
      root.channelManager.setEnv({
        storage: {
          channelAccounts: {
            list: (channelId?: string) => channelId ? accounts.filter((account) => account.channelId === channelId) : accounts,
            get: () => undefined,
            upsert: vi.fn(),
            delete: vi.fn(),
          },
          channelRecipients: {
            ensureExists: vi.fn(),
            getRecipientMeta: () => ({}),
            setLabel: vi.fn(),
            delete: vi.fn(),
            setOwner: vi.fn(),
            getOwners: vi.fn(() => []),
          },
          mobilePairings: { getAllPairings: () => [] },
          settings: { get: () => "1", set: vi.fn() },
        } as any,
        configPath: join(stateDir, "openclaw.json"),
        stateDir,
      });

      root.channelManager.init();

      expect(root.channelAccounts[0].status).toEqual({ hasContextToken: true });
      expect((root.channelAccounts[0].recipients as { allowlist: string[] }).allowlist).toContain(activeRecipientId);
    } finally {
      rmSync(stateDir, { recursive: true, force: true });
    }
  });

  it("merges duplicate WeChat QR accounts by provider userId without reusing stale context tokens", async () => {
    const stateDir = mkdtempSync(join(tmpdir(), "rivonclaw-channel-manager-weixin-"));
    try {
      const oldAccountId = "old123-im-bot";
      const newAccountId = "new456-im-bot";
      const userId = "owner@im.wechat";
      const accountsDir = join(stateDir, WEIXIN_CHANNEL_ID, "accounts");
      const configPath = join(stateDir, "openclaw.json");
      mkdirSync(accountsDir, { recursive: true });
      writeFileSync(configPath, JSON.stringify({ channels: { [WEIXIN_CHANNEL_ID]: { accounts: {} } } }), "utf-8");
      writeFileSync(join(stateDir, WEIXIN_CHANNEL_ID, "accounts.json"), JSON.stringify([oldAccountId, newAccountId]), "utf-8");
      writeFileSync(join(accountsDir, `${oldAccountId}.json`), JSON.stringify({ userId }), "utf-8");
      writeFileSync(join(accountsDir, `${newAccountId}.json`), JSON.stringify({ userId }), "utf-8");
      writeFileSync(join(accountsDir, `${oldAccountId}.context-tokens.json`), JSON.stringify({ [userId]: "old-context-token" }), "utf-8");

      let accounts: Array<{
        channelId: string;
        accountId: string;
        name: string | null;
        config: Record<string, unknown>;
        createdAt: number;
        updatedAt: number;
      }> = [{
        channelId: WEIXIN_CHANNEL_ID,
        accountId: oldAccountId,
        name: "客服微信",
        config: { name: "客服微信" },
        createdAt: 1,
        updatedAt: 1,
      }];
      const upsert = vi.fn((channelId: string, accountId: string, name: string | null, config: Record<string, unknown>) => {
        const saved = { channelId, accountId, name, config, createdAt: 1, updatedAt: 2 };
        accounts = accounts.filter((account) => !(account.channelId === channelId && account.accountId === accountId));
        accounts.push(saved);
        return saved;
      });
      const deleteAccount = vi.fn((channelId: string, accountId: string) => {
        accounts = accounts.filter((account) => !(account.channelId === channelId && account.accountId === accountId));
      });
      const root = TestRootModel.create({});
      root.channelManager.setEnv({
        storage: {
          channelAccounts: {
            list: (channelId?: string) => channelId ? accounts.filter((account) => account.channelId === channelId) : accounts,
            get: (channelId: string, accountId: string) =>
              accounts.find((account) => account.channelId === channelId && account.accountId === accountId),
            upsert,
            delete: deleteAccount,
          },
          channelRecipients: {
            ensureExists: vi.fn(),
            getRecipientMeta: () => ({}),
            setLabel: vi.fn(),
            delete: vi.fn(),
            setOwner: vi.fn(),
            getOwners: vi.fn(() => []),
          },
          mobilePairings: { getAllPairings: () => [] },
          settings: { get: () => "1", set: vi.fn() },
        } as any,
        configPath,
        stateDir,
      });
      root.channelManager.init();

      const rpcClient = {
        request: vi.fn(async () => ({
          connected: true,
          message: "connected",
          accountId: newAccountId,
          userId,
        })),
      };

      const result = await root.channelManager.waitQrLogin(rpcClient as any, undefined, 90_000, "session-new");

      expect(result).toMatchObject({
        accountId: newAccountId,
        accountName: "客服微信",
        userId,
      });
      expect(accounts.map((account) => account.accountId)).toEqual([newAccountId]);
      expect(deleteAccount).toHaveBeenCalledWith(WEIXIN_CHANNEL_ID, oldAccountId);
      expect(root.channelAccounts.map((account) => account.accountId)).toEqual([newAccountId]);
      expect(root.channelAccounts[0].name).toBe("客服微信");
      expect(root.channelAccounts[0].status).toEqual({ hasContextToken: false });
      expect(existsSync(join(accountsDir, `${newAccountId}.context-tokens.json`))).toBe(false);
    } finally {
      rmSync(stateDir, { recursive: true, force: true });
    }
  });

  it("refreshes WeChat context token readiness when recipient-seen follows the first inbound message", () => {
    const stateDir = mkdtempSync(join(tmpdir(), "rivonclaw-channel-manager-weixin-"));
    try {
      const accountId = "acct123-im-bot";
      const userId = "owner@im.wechat";
      const accountsDir = join(stateDir, WEIXIN_CHANNEL_ID, "accounts");
      mkdirSync(accountsDir, { recursive: true });
      writeFileSync(join(accountsDir, `${accountId}.json`), JSON.stringify({ userId }), "utf-8");

      const accounts = [{
        channelId: WEIXIN_CHANNEL_ID,
        accountId,
        name: "赵总",
        config: { name: "赵总" },
        createdAt: 1,
        updatedAt: 1,
      }];
      const root = TestRootModel.create({});
      root.channelManager.setEnv({
        storage: {
          channelAccounts: {
            list: (channelId?: string) => channelId ? accounts.filter((account) => account.channelId === channelId) : accounts,
            get: () => undefined,
            upsert: vi.fn(),
            delete: vi.fn(),
          },
          channelRecipients: {
            ensureExists: vi.fn(() => true),
            getRecipientMeta: () => ({}),
            setLabel: vi.fn(),
            delete: vi.fn(),
            setOwner: vi.fn(),
            getOwners: vi.fn(() => []),
          },
          mobilePairings: { getAllPairings: () => [] },
          settings: { get: () => "1", set: vi.fn() },
        } as any,
        configPath: join(stateDir, "openclaw.json"),
        stateDir,
      });

      root.channelManager.init();
      expect(root.channelAccounts[0].status).toEqual({ hasContextToken: false });

      writeFileSync(
        join(accountsDir, `${accountId}.context-tokens.json`),
        JSON.stringify({ [userId]: "context-token" }),
        "utf-8",
      );

      root.channelManager.recordRecipientSeen({
        channelId: WEIXIN_CHANNEL_ID,
        accountId,
        recipientId: userId,
      });

      expect(root.channelAccounts[0].status).toEqual({ hasContextToken: true });
      expect(root.channelAccounts[0].recipients).toMatchObject({
        allowlist: [userId],
      });
      expect(root.channelManager.getWeixinContextTokenForRecipient(accountId, userId)).toBe("context-token");
    } finally {
      rmSync(stateDir, { recursive: true, force: true });
    }
  });
});
