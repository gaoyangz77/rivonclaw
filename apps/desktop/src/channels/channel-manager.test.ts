import { describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applySnapshot, types } from "mobx-state-tree";
import { ChannelManagerModel, RIVONCLAW_TELEGRAM_DEBUG_ACCOUNT_ID } from "./channel-manager.js";
import { WEIXIN_CHANNEL_ID } from "./weixin-account-dedupe.js";
import { getVendorDir, setVendorDir } from "../gateway/vendor-dir-ref.js";

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
  it("syncs the app-managed Telegram debug proxy account without touching user accounts", () => {
    const stateDir = mkdtempSync(join(tmpdir(), "rivonclaw-channel-manager-telegram-debug-"));
    try {
      const configPath = join(stateDir, "openclaw.json");
      writeFileSync(configPath, JSON.stringify({ version: 1 }, null, 2), "utf-8");

      const accounts: Array<{
        channelId: string;
        accountId: string;
        name: string | null;
        config: Record<string, unknown>;
        createdAt: number;
        updatedAt: number;
      }> = [{
        channelId: "telegram",
        accountId: "owner-bot",
        name: "Owner Bot",
        config: { name: "Owner Bot", botToken: "real-user-token", streaming: "partial" },
        createdAt: 1,
        updatedAt: 1,
      }];

      const upsertAccount = vi.fn((channelId: string, accountId: string, name: string | null, config: Record<string, unknown>) => {
        const existingIndex = accounts.findIndex((account) => account.channelId === channelId && account.accountId === accountId);
        const record = {
          channelId,
          accountId,
          name,
          config,
          createdAt: 1,
          updatedAt: existingIndex >= 0 ? accounts[existingIndex]!.updatedAt + 1 : 1,
        };
        if (existingIndex >= 0) accounts[existingIndex] = record;
        else accounts.push(record);
        return record;
      });
      const deleteAccount = vi.fn((channelId: string, accountId: string) => {
        const index = accounts.findIndex((account) => account.channelId === channelId && account.accountId === accountId);
        if (index >= 0) accounts.splice(index, 1);
      });

      const root = TestRootModel.create({});
      root.channelManager.setEnv({
        storage: {
          channelAccounts: {
            list: (channelId?: string) => channelId ? accounts.filter((account) => account.channelId === channelId) : accounts,
            get: (channelId: string, accountId: string) => accounts.find((account) => account.channelId === channelId && account.accountId === accountId),
            upsert: upsertAccount,
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
          settings: { get: () => "1", set: vi.fn(), delete: vi.fn(() => false) },
        } as any,
        configPath,
        stateDir,
      });

      root.channelManager.init();

      expect(root.channelManager.syncTelegramDebugProxyAccount({
        proxyToken: "proxy-token",
        apiRoot: "https://relay.example.com/",
        deviceId: "device-a",
      }).changed).toBe(true);

      const supportAccount = accounts.find((account) => account.accountId === RIVONCLAW_TELEGRAM_DEBUG_ACCOUNT_ID);
      expect(supportAccount?.config).toMatchObject({
        name: "RivonClaw Support",
        botToken: "proxy-token",
        apiRoot: "https://relay.example.com/telegram-debug/devices/device-a",
        enabled: true,
        dmPolicy: "open",
        allowFrom: ["*"],
        groupPolicy: "disabled",
        direct: {
          "*": {
            systemPrompt: expect.stringContaining("RivonClaw Debugging media delivery rules"),
          },
        },
        actions: { sendMessage: true, poll: true },
        commands: { native: true, nativeSkills: false },
      });
      expect(accounts.find((account) => account.accountId === "owner-bot")).toBeTruthy();

      expect(root.channelManager.syncTelegramDebugProxyAccount({
        proxyToken: "proxy-token",
        apiRoot: "https://relay.example.com",
        deviceId: "device-a",
      }).changed).toBe(false);
      expect(upsertAccount).toHaveBeenCalledTimes(1);

      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.channels.telegram.defaultAccount).toBe("owner-bot");
      expect(config.channels.telegram.accounts[RIVONCLAW_TELEGRAM_DEBUG_ACCOUNT_ID].apiRoot).toBe("https://relay.example.com/telegram-debug/devices/device-a");
      expect(config.channels.telegram.accounts[RIVONCLAW_TELEGRAM_DEBUG_ACCOUNT_ID].streaming).toEqual({ mode: "block" });
      expect(config.channels.telegram.accounts[RIVONCLAW_TELEGRAM_DEBUG_ACCOUNT_ID].direct["*"].systemPrompt).toContain("Do not set timeoutMs");
      expect(config.channels.telegram.accounts["owner-bot"].botToken).toBe("real-user-token");
      expect(config.channels.telegram.accounts["owner-bot"].streaming).toEqual({ mode: "block" });
      expect(config.channels.telegram.accounts["owner-bot"].direct).toBeUndefined();

      expect(root.channelManager.syncTelegramDebugProxyAccount({
        proxyToken: null,
        apiRoot: "https://relay.example.com",
        deviceId: "device-a",
      }).changed).toBe(true);
      expect(deleteAccount).toHaveBeenCalledWith("telegram", RIVONCLAW_TELEGRAM_DEBUG_ACCOUNT_ID);
      expect(accounts.map((account) => account.accountId)).toEqual(["owner-bot"]);
    } finally {
      rmSync(stateDir, { recursive: true, force: true });
    }
  });

  it("does not leak Telegram support recipients into named user accounts", () => {
    const stateDir = mkdtempSync(join(tmpdir(), "rivonclaw-channel-manager-telegram-recipients-"));
    const previousStateDir = process.env.OPENCLAW_STATE_DIR;
    process.env.OPENCLAW_STATE_DIR = stateDir;
    try {
      const configPath = join(stateDir, "openclaw.json");
      const credentialsDir = join(stateDir, "credentials");
      mkdirSync(credentialsDir, { recursive: true });
      writeFileSync(configPath, JSON.stringify({ version: 1 }, null, 2), "utf-8");
      writeFileSync(
        join(credentialsDir, "telegram-owner-bot-allowFrom.json"),
        JSON.stringify({ version: 1, allowFrom: ["paired-user"] }, null, 2),
        "utf-8",
      );

      const accounts = [{
        channelId: "telegram",
        accountId: "owner-bot",
        name: "Owner Bot",
        config: { name: "Owner Bot", botToken: "real-user-token" },
        createdAt: 1,
        updatedAt: 1,
      }];

      const root = TestRootModel.create({});
      root.channelManager.setEnv({
        storage: {
          channelAccounts: {
            list: (channelId?: string) => channelId ? accounts.filter((account) => account.channelId === channelId) : accounts,
            get: (channelId: string, accountId: string) => accounts.find((account) => account.channelId === channelId && account.accountId === accountId),
            upsert: vi.fn(),
            delete: vi.fn(),
          },
          channelRecipients: {
            ensureExists: vi.fn(),
            getRecipientMeta: () => ({
              "paired-user": { label: "Paired", isOwner: true },
              "support-operator": { label: "Support", isOwner: true },
            }),
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

      const recipients = root.channelAccounts[0].recipients as {
        allowlist: string[];
        labels: Record<string, string>;
        owners: Record<string, boolean>;
      };
      expect(recipients.allowlist).toEqual(["paired-user"]);
      expect(recipients.labels).toEqual({ "paired-user": "Paired" });
      expect(recipients.owners).toEqual({ "paired-user": true });
    } finally {
      if (previousStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
      else process.env.OPENCLAW_STATE_DIR = previousStateDir;
      rmSync(stateDir, { recursive: true, force: true });
    }
  });

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

  it("keeps WeChat recipient snapshots scoped to each account", () => {
    const stateDir = mkdtempSync(join(tmpdir(), "rivonclaw-channel-manager-weixin-"));
    try {
      const firstAccountId = "acct-a-im-bot";
      const secondAccountId = "acct-b-im-bot";
      const firstRecipientId = "first@im.wechat";
      const secondRecipientId = "second@im.wechat";
      const accountsDir = join(stateDir, WEIXIN_CHANNEL_ID, "accounts");
      mkdirSync(accountsDir, { recursive: true });
      writeFileSync(
        join(accountsDir, `${firstAccountId}.context-tokens.json`),
        JSON.stringify({ [firstRecipientId]: "first-context-token" }),
        "utf-8",
      );
      writeFileSync(
        join(accountsDir, `${secondAccountId}.context-tokens.json`),
        JSON.stringify({ [secondRecipientId]: "second-context-token" }),
        "utf-8",
      );

      const accounts = [
        {
          channelId: WEIXIN_CHANNEL_ID,
          accountId: firstAccountId,
          name: "微信 A",
          config: { name: "微信 A" },
          createdAt: 1,
          updatedAt: 1,
        },
        {
          channelId: WEIXIN_CHANNEL_ID,
          accountId: secondAccountId,
          name: "微信 B",
          config: { name: "微信 B" },
          createdAt: 1,
          updatedAt: 1,
        },
      ];
      const root = TestRootModel.create({});
      root.channelManager.setEnv({
        storage: {
          channelAccounts: {
            list: (channelId?: string) =>
              channelId ? accounts.filter((account) => account.channelId === channelId) : accounts,
            get: () => undefined,
            upsert: vi.fn(),
            delete: vi.fn(),
          },
          channelRecipients: {
            ensureExists: vi.fn(),
            getRecipientMeta: () => ({
              [firstRecipientId]: { label: "First", isOwner: true },
              [secondRecipientId]: { label: "Second", isOwner: true },
            }),
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

      const firstRecipients = root.channelAccounts.find((account) => account.accountId === firstAccountId)
        ?.recipients as { allowlist: string[]; labels: Record<string, string> };
      const secondRecipients = root.channelAccounts.find((account) => account.accountId === secondAccountId)
        ?.recipients as { allowlist: string[]; labels: Record<string, string> };

      expect(firstRecipients.allowlist).toEqual([firstRecipientId]);
      expect(firstRecipients.labels).toEqual({ [firstRecipientId]: "First" });
      expect(secondRecipients.allowlist).toEqual([secondRecipientId]);
      expect(secondRecipients.labels).toEqual({ [secondRecipientId]: "Second" });
    } finally {
      rmSync(stateDir, { recursive: true, force: true });
    }
  });

  it("keeps Feishu recipient snapshots scoped to each account", () => {
    const stateDir = mkdtempSync(join(tmpdir(), "rivonclaw-channel-manager-feishu-recipients-"));
    try {
      const configPath = join(stateDir, "openclaw.json");
      writeFileSync(configPath, JSON.stringify({ version: 1 }, null, 2), "utf-8");
      const accounts = [
        {
          channelId: "feishu",
          accountId: "acct_legacy",
          name: "Legacy Feishu",
          config: { allowFrom: ["ou_legacy"] },
          createdAt: 1,
          updatedAt: 1,
        },
        {
          channelId: "feishu",
          accountId: "acct_official",
          name: "Feishu Official Bot",
          config: { allowFrom: ["*", "ou_official"], groupAllowFrom: ["ou_official"] },
          createdAt: 1,
          updatedAt: 1,
        },
      ];
      const root = TestRootModel.create({});
      root.channelManager.setEnv({
        storage: {
          channelAccounts: {
            list: (channelId?: string) =>
              channelId ? accounts.filter((account) => account.channelId === channelId) : accounts,
            get: (channelId: string, accountId: string) =>
              accounts.find((account) => account.channelId === channelId && account.accountId === accountId),
            upsert: vi.fn(),
            delete: vi.fn(),
          },
          channelRecipients: {
            ensureExists: vi.fn(),
            getRecipientMeta: () => ({
              ou_legacy: { label: "Legacy Owner", isOwner: true },
              ou_official: { label: "Official Owner", isOwner: true },
            }),
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

      const legacyRecipients = root.channelAccounts.find((account) => account.accountId === "acct_legacy")
        ?.recipients as { allowlist: string[]; labels: Record<string, string> };
      const officialRecipients = root.channelAccounts.find((account) => account.accountId === "acct_official")
        ?.recipients as { allowlist: string[]; labels: Record<string, string> };

      expect(legacyRecipients.allowlist).toEqual(["ou_legacy"]);
      expect(legacyRecipients.labels).toEqual({ ou_legacy: "Legacy Owner" });
      expect(officialRecipients.allowlist).toEqual(["ou_official"]);
      expect(officialRecipients.labels).toEqual({ ou_official: "Official Owner" });
    } finally {
      rmSync(stateDir, { recursive: true, force: true });
    }
  });

  it("records Feishu inbound senders in the matching account recipient list", () => {
    const stateDir = mkdtempSync(join(tmpdir(), "rivonclaw-channel-manager-feishu-seen-"));
    const previousStateDir = process.env.OPENCLAW_STATE_DIR;
    process.env.OPENCLAW_STATE_DIR = stateDir;
    try {
      const configPath = join(stateDir, "openclaw.json");
      writeFileSync(configPath, JSON.stringify({ version: 1 }, null, 2), "utf-8");
      const accounts = [{
        channelId: "feishu",
        accountId: "default",
        name: "Feishu Official Bot",
        config: { allowFrom: ["*"] },
        createdAt: 1,
        updatedAt: 1,
      }];
      const meta: Record<string, { label: string; isOwner: boolean }> = {};
      const ensureExists = vi.fn((channelId: string, recipientId: string, isOwner = false) => {
        expect(channelId).toBe("feishu");
        meta[recipientId] = { label: "", isOwner };
        return true;
      });
      const root = TestRootModel.create({});
      root.channelManager.setEnv({
        storage: {
          channelAccounts: {
            list: (channelId?: string) =>
              channelId ? accounts.filter((account) => account.channelId === channelId) : accounts,
            get: (channelId: string, accountId: string) =>
              accounts.find((account) => account.channelId === channelId && account.accountId === accountId),
            upsert: vi.fn(),
            delete: vi.fn(),
          },
          channelRecipients: {
            ensureExists,
            getRecipientMeta: () => meta,
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

      const result = root.channelManager.recordRecipientSeen({
        channelId: "feishu",
        accountId: "default",
        recipientId: "feishu:ou_seen",
      });

      expect(result).toEqual({ inserted: true, membershipChanged: true });
      expect(ensureExists).toHaveBeenCalledWith("feishu", "ou_seen", false);
      expect(JSON.parse(readFileSync(join(stateDir, "credentials", "feishu-default-allowFrom.json"), "utf-8"))).toEqual({
        version: 1,
        allowFrom: ["ou_seen"],
      });
      const recipients = root.channelAccounts[0].recipients as { allowlist: string[]; owners: Record<string, boolean> };
      expect(recipients.allowlist).toEqual(["ou_seen"]);
      expect(recipients.owners).toEqual({ ou_seen: false });
    } finally {
      if (previousStateDir === undefined) {
        delete process.env.OPENCLAW_STATE_DIR;
      } else {
        process.env.OPENCLAW_STATE_DIR = previousStateDir;
      }
      rmSync(stateDir, { recursive: true, force: true });
    }
  });

  it("hydrates the official Feishu plugin root during startup", () => {
    const stateDir = mkdtempSync(join(tmpdir(), "rivonclaw-channel-manager-feishu-hydrate-"));
    const previousVendorDir = getVendorDir();
    try {
      const configPath = join(stateDir, "openclaw.json");
      const pluginRoot = join(stateDir, "vendor", "openclaw", "dist", "extensions", "feishu");
      mkdirSync(pluginRoot, { recursive: true });
      writeFileSync(
        join(pluginRoot, "openclaw.plugin.json"),
        JSON.stringify({ contracts: { tools: ["feishu_send"] } }, null, 2),
        "utf-8",
      );
      writeFileSync(configPath, JSON.stringify({
        plugins: {
          load: { paths: [] },
        },
        }, null, 2), "utf-8");
      setVendorDir(join(stateDir, "vendor", "openclaw"));

      const accounts = [{
        channelId: "feishu",
        accountId: "default",
        name: "Feishu Official Bot",
        config: { appId: "app_123", appSecret: "secret_123" },
        createdAt: 1,
        updatedAt: 1,
      }];

      const root = TestRootModel.create({});
      root.channelManager.setEnv({
        storage: {
          channelAccounts: {
            list: (channelId?: string) => channelId ? accounts.filter((account) => account.channelId === channelId) : accounts,
            get: (channelId: string, accountId: string) =>
              accounts.find((account) => account.channelId === channelId && account.accountId === accountId),
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
        configPath,
        stateDir,
      });

      root.channelManager.init();

      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.plugins.entries.feishu.enabled).toBe(true);
      expect(config.plugins.entries["openclaw-lark"]).toBeUndefined();
      expect(config.plugins.allow).toContain("feishu");
      expect(config.plugins.load.paths).toContain(pluginRoot);
      expect(config.tools.alsoAllow).toContain("feishu_send");
    } finally {
      setVendorDir(previousVendorDir);
      rmSync(stateDir, { recursive: true, force: true });
    }
  });

  it("creates official Feishu QR accounts with open Feishu-scoped defaults", async () => {
    const stateDir = mkdtempSync(join(tmpdir(), "rivonclaw-channel-manager-feishu-qr-"));
    const previousStateDir = process.env.OPENCLAW_STATE_DIR;
    const previousFetch = globalThis.fetch;
    process.env.OPENCLAW_STATE_DIR = stateDir;

    try {
      const configPath = join(stateDir, "openclaw.json");
      writeFileSync(configPath, JSON.stringify({ version: 1 }, null, 2), "utf-8");

      const accounts: Array<{
        channelId: string;
        accountId: string;
        name: string | null;
        config: Record<string, unknown>;
        createdAt: number;
        updatedAt: number;
      }> = [];
      const upsertAccount = vi.fn((channelId: string, accountId: string, name: string | null, config: Record<string, unknown>) => {
        const record = {
          channelId,
          accountId,
          name,
          config,
          createdAt: 1,
          updatedAt: 1,
        };
        const index = accounts.findIndex((account) => account.channelId === channelId && account.accountId === accountId);
        if (index >= 0) accounts[index] = record;
        else accounts.push(record);
        return record;
      });
      const ensureExists = vi.fn(() => true);

      globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const params = new URLSearchParams(String(init?.body ?? ""));
        const action = params.get("action");
        const body = action === "init"
          ? { supported_auth_methods: ["client_secret"] }
          : action === "begin"
            ? {
                device_code: "device-code",
                verification_uri_complete: "https://accounts.feishu.cn/qr?token=abc",
                interval: 1,
                expire_in: 60,
              }
            : {
                client_id: "cli_test",
                client_secret: "secret_test",
                user_info: {
                  open_id: "ou_creator",
                  tenant_brand: "feishu",
                },
              };
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch;

      const root = TestRootModel.create({});
      root.channelManager.setEnv({
        storage: {
          channelAccounts: {
            list: (channelId?: string) =>
              channelId ? accounts.filter((account) => account.channelId === channelId) : accounts,
            get: (channelId: string, accountId: string) =>
              accounts.find((account) => account.channelId === channelId && account.accountId === accountId),
            upsert: upsertAccount,
            delete: vi.fn(),
          },
          channelRecipients: {
            ensureExists,
            getRecipientMeta: () => ({
              ou_creator: { label: "Creator", isOwner: true },
            }),
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

      const start = await root.channelManager.startFeishuSetup();
      expect(start.verificationUrl).toContain("from=onboard");

      const poll = await root.channelManager.pollFeishuSetup(start.sessionKey);
      expect(poll).toMatchObject({
        status: "connected",
        openId: "ou_creator",
        domain: "feishu",
      });
      expect(poll.accountId).toMatch(/^feishu-cli_test-[a-f0-9]{8}$/);

      const accountId = poll.accountId!;
      const official = accounts.find((account) => account.channelId === "feishu" && account.accountId === accountId);
      expect(official?.name).toBe("Feishu Official Bot (i_test)");
      expect(official?.config).toMatchObject({
        dmPolicy: "open",
        allowFrom: ["*"],
        groupPolicy: "open",
        groups: { "*": { enabled: true } },
      });
      expect(official?.config.groupAllowFrom).toBeUndefined();
      expect(ensureExists).toHaveBeenCalledWith("feishu", "ou_creator", true);

      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.channels.feishu.accounts[accountId].dmPolicy).toBe("open");
      expect(config.channels.feishu.accounts[accountId].allowFrom).toEqual(["*"]);
      expect(config.channels.feishu.accounts[accountId].groupPolicy).toBe("open");
      expect(config.channels.feishu.accounts[accountId].groupAllowFrom).toBeUndefined();
      expect(config.channels.feishu.dmPolicy).toBeUndefined();
      expect(config.channels.feishu.allowFrom).toBeUndefined();
      expect(config.channels.feishu.groupPolicy).toBeUndefined();
      expect(config.channels.feishu.groupAllowFrom).toBeUndefined();

      const allowFromFile = JSON.parse(readFileSync(join(stateDir, "credentials", `feishu-${accountId}-allowFrom.json`), "utf-8"));
      expect(allowFromFile.allowFrom).toEqual(["ou_creator"]);

      const recipients = root.channelAccounts.find((account) => account.channelId === "feishu" && account.accountId === accountId)
        ?.recipients as { allowlist: string[]; labels: Record<string, string>; owners: Record<string, boolean> };
      expect(recipients.allowlist).toEqual(["ou_creator"]);
      expect(recipients.allowlist).not.toContain("*");
      expect(recipients.labels).toEqual({ ou_creator: "Creator" });
      expect(recipients.owners).toEqual({ ou_creator: true });
    } finally {
      globalThis.fetch = previousFetch;
      if (previousStateDir === undefined) {
        delete process.env.OPENCLAW_STATE_DIR;
      } else {
        process.env.OPENCLAW_STATE_DIR = previousStateDir;
      }
      rmSync(stateDir, { recursive: true, force: true });
    }
  });

  it("adds a new official Feishu QR account instead of replacing an existing default account", async () => {
    const stateDir = mkdtempSync(join(tmpdir(), "rivonclaw-channel-manager-feishu-qr-existing-"));
    const previousStateDir = process.env.OPENCLAW_STATE_DIR;
    const previousFetch = globalThis.fetch;
    process.env.OPENCLAW_STATE_DIR = stateDir;

    try {
      const configPath = join(stateDir, "openclaw.json");
      writeFileSync(configPath, JSON.stringify({ version: 1 }, null, 2), "utf-8");

      const accounts: Array<{
        channelId: string;
        accountId: string;
        name: string | null;
        config: Record<string, unknown>;
        createdAt: number;
        updatedAt: number;
      }> = [{
        channelId: "feishu",
        accountId: "default",
        name: "Existing Feishu Bot",
        config: {
          enabled: true,
          appId: "cli_existing",
          appSecret: "existing_secret",
          domain: "feishu",
          dmPolicy: "pairing",
          groupPolicy: "allowlist",
        },
        createdAt: 1,
        updatedAt: 1,
      }];
      const upsertAccount = vi.fn((channelId: string, accountId: string, name: string | null, config: Record<string, unknown>) => {
        const record = {
          channelId,
          accountId,
          name,
          config,
          createdAt: 1,
          updatedAt: 2,
        };
        const index = accounts.findIndex((account) => account.channelId === channelId && account.accountId === accountId);
        if (index >= 0) accounts[index] = record;
        else accounts.push(record);
        return record;
      });

      globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const params = new URLSearchParams(String(init?.body ?? ""));
        const action = params.get("action");
        const body = action === "init"
          ? { supported_auth_methods: ["client_secret"] }
          : action === "begin"
            ? {
                device_code: "device-code",
                verification_uri_complete: "https://accounts.feishu.cn/qr?token=abc",
                interval: 1,
                expire_in: 60,
              }
            : {
                client_id: "cli_new_bot",
                client_secret: "new_secret",
                user_info: {
                  open_id: "ou_creator",
                  tenant_brand: "feishu",
                },
              };
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch;

      const root = TestRootModel.create({
        channelAccounts: accounts.map((account) => ({
          channelId: account.channelId,
          accountId: account.accountId,
          name: account.name,
          config: account.config,
          status: { hasContextToken: null },
          recipients: { allowlist: [], labels: {}, owners: {}, pairingRequests: [] },
        })),
      });
      root.channelManager.setEnv({
        storage: {
          channelAccounts: {
            list: (channelId?: string) =>
              channelId ? accounts.filter((account) => account.channelId === channelId) : accounts,
            get: (channelId: string, accountId: string) =>
              accounts.find((account) => account.channelId === channelId && account.accountId === accountId),
            upsert: upsertAccount,
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
        configPath,
        stateDir,
      });

      const start = await root.channelManager.startFeishuSetup();
      const poll = await root.channelManager.pollFeishuSetup(start.sessionKey);
      expect(poll).toMatchObject({
        status: "connected",
        openId: "ou_creator",
        domain: "feishu",
      });
      expect(poll.accountId).toMatch(/^feishu-cli_new_bot-[a-f0-9]{8}$/);
      expect(poll.accountId).not.toBe("default");
      const newAccountId = poll.accountId!;

      expect(accounts).toHaveLength(2);
      expect(accounts.find((account) => account.accountId === "default")?.config).toMatchObject({
        appId: "cli_existing",
        appSecret: "existing_secret",
        dmPolicy: "pairing",
        groupPolicy: "allowlist",
      });
      expect(accounts.find((account) => account.accountId === newAccountId)?.config).toMatchObject({
        appId: "cli_new_bot",
        appSecret: "new_secret",
        dmPolicy: "open",
        groupPolicy: "open",
      });

      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.channels.feishu.accounts.default.appId).toBe("cli_existing");
      expect(config.channels.feishu.accounts[newAccountId].appId).toBe("cli_new_bot");
      expect(config.channels.feishu.appId).toBe("cli_existing");
      expect(config.plugins.entries.feishu.enabled).toBe(true);
      expect(config.plugins.entries["openclaw-lark"]).toBeUndefined();
    } finally {
      globalThis.fetch = previousFetch;
      if (previousStateDir === undefined) {
        delete process.env.OPENCLAW_STATE_DIR;
      } else {
        process.env.OPENCLAW_STATE_DIR = previousStateDir;
      }
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

  it("marks WeChat runtime unhealthy when gateway reports sendmessage business failure", async () => {
    const stateDir = mkdtempSync(join(tmpdir(), "rivonclaw-channel-manager-weixin-health-"));
    try {
      const accountId = "acct123-im-bot";
      const configPath = join(stateDir, "openclaw.json");
      writeFileSync(configPath, JSON.stringify({
        channels: {
          [WEIXIN_CHANNEL_ID]: {
            accounts: {
              [accountId]: { dmPolicy: "pairing" },
            },
          },
        },
      }), "utf-8");

      const accounts = [{
        channelId: WEIXIN_CHANNEL_ID,
        accountId,
        name: "客服微信",
        config: { name: "客服微信" },
        createdAt: 1,
        updatedAt: 1,
      }, {
        channelId: WEIXIN_CHANNEL_ID,
        accountId: "other-im-bot",
        name: "另一个微信",
        config: { name: "另一个微信" },
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
        configPath,
        stateDir,
      });

      const rpcClient = {
        request: vi.fn(async () => ({
          ts: 1700000000000,
          channelOrder: [WEIXIN_CHANNEL_ID],
          channelLabels: { [WEIXIN_CHANNEL_ID]: "WeChat" },
          channels: {},
          channelAccounts: {
            [WEIXIN_CHANNEL_ID]: [{
              accountId,
              configured: true,
              running: true,
              connected: true,
              lastError: "WeChat sendmessage business failure: sendmessage result status=200 ret=-2 errcode= errmsg= clientId=client accountId=acct123-im-bot to=manager@im.wechat",
            }, {
              accountId: "other-im-bot",
              configured: true,
              running: true,
              connected: true,
            }],
          },
          channelDefaultAccountId: { [WEIXIN_CHANNEL_ID]: accountId },
        })),
      };

      const snapshot = await root.channelManager.getChannelStatus(rpcClient as any, false, 2000, 5000);
      const [account] = snapshot.channelAccounts[WEIXIN_CHANNEL_ID]!;
      expect(account).toMatchObject({
        accountId,
        configured: true,
        running: true,
        connected: true,
        healthy: false,
        healthState: "send-unavailable",
        dmPolicy: "pairing",
      });
      expect(snapshot.channelAccounts[WEIXIN_CHANNEL_ID]![1]).toMatchObject({
        accountId: "other-im-bot",
        configured: true,
        running: true,
        connected: true,
      });
    } finally {
      rmSync(stateDir, { recursive: true, force: true });
    }
  });

  it("defaults every WeChat recipient discovered from inbound traffic to owner", () => {
    const stateDir = mkdtempSync(join(tmpdir(), "rivonclaw-channel-manager-weixin-owner-"));
    try {
      const ensureExists = vi.fn(() => true);
      const root = TestRootModel.create({});
      root.channelManager.setEnv({
        storage: {
          channelAccounts: {
            list: () => [],
            get: () => undefined,
            upsert: vi.fn(),
            delete: vi.fn(),
          },
          channelRecipients: {
            ensureExists,
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

      root.channelManager.recordRecipientSeen({
        channelId: WEIXIN_CHANNEL_ID,
        accountId: "acct-1",
        recipientId: "first@im.wechat",
      });
      root.channelManager.recordRecipientSeen({
        channelId: WEIXIN_CHANNEL_ID,
        accountId: "acct-2",
        recipientId: "second@im.wechat",
      });

      expect(ensureExists).toHaveBeenNthCalledWith(1, WEIXIN_CHANNEL_ID, "first@im.wechat", true);
      expect(ensureExists).toHaveBeenNthCalledWith(2, WEIXIN_CHANNEL_ID, "second@im.wechat", true);
    } finally {
      rmSync(stateDir, { recursive: true, force: true });
    }
  });
});
