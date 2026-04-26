import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createStorage, type Storage } from "./index.js";
import { migrations } from "./db/migrations.js";

let storage: Storage;

beforeEach(() => {
  storage = createStorage(":memory:");
});

afterEach(() => {
  storage.close();
});

describe("ChannelsRepository", () => {
  it("should create and retrieve a channel", () => {
    const channel = storage.channels.create({
      id: "ch-1",
      channelType: "telegram",
      enabled: true,
      accountId: "account-123",
      settings: { webhookUrl: "https://example.com/hook" },
    });

    expect(channel.id).toBe("ch-1");

    const fetched = storage.channels.getById("ch-1");
    expect(fetched).toBeDefined();
    expect(fetched!.channelType).toBe("telegram");
    expect(fetched!.enabled).toBe(true);
    expect(fetched!.settings).toEqual({ webhookUrl: "https://example.com/hook" });
  });

  it("should return undefined for non-existent channel", () => {
    const result = storage.channels.getById("nonexistent");
    expect(result).toBeUndefined();
  });

  it("should get all channels", () => {
    storage.channels.create({
      id: "ch-1",
      channelType: "telegram",
      enabled: true,
      accountId: "acc-1",
      settings: {},
    });
    storage.channels.create({
      id: "ch-2",
      channelType: "discord",
      enabled: false,
      accountId: "acc-2",
      settings: {},
    });

    const all = storage.channels.getAll();
    expect(all).toHaveLength(2);
  });

  it("should update a channel", () => {
    storage.channels.create({
      id: "ch-1",
      channelType: "telegram",
      enabled: true,
      accountId: "acc-1",
      settings: {},
    });

    const updated = storage.channels.update("ch-1", {
      enabled: false,
      settings: { newSetting: "value" },
    });

    expect(updated).toBeDefined();
    expect(updated!.enabled).toBe(false);
    expect(updated!.settings).toEqual({ newSetting: "value" });
    expect(updated!.channelType).toBe("telegram"); // unchanged
  });

  it("should return undefined when updating non-existent channel", () => {
    const result = storage.channels.update("nonexistent", { enabled: false });
    expect(result).toBeUndefined();
  });

  it("should delete a channel", () => {
    storage.channels.create({
      id: "ch-1",
      channelType: "telegram",
      enabled: true,
      accountId: "acc-1",
      settings: {},
    });

    const deleted = storage.channels.delete("ch-1");
    expect(deleted).toBe(true);

    const fetched = storage.channels.getById("ch-1");
    expect(fetched).toBeUndefined();
  });

  it("should return false when deleting non-existent channel", () => {
    const deleted = storage.channels.delete("nonexistent");
    expect(deleted).toBe(false);
  });
});

describe("PermissionsRepository", () => {
  it("should return default empty permissions", () => {
    const perms = storage.permissions.get();
    expect(perms.readPaths).toEqual([]);
    expect(perms.writePaths).toEqual([]);
  });

  it("should update permissions", () => {
    const updated = storage.permissions.update({
      readPaths: ["/home/user/docs", "/tmp"],
      writePaths: ["/home/user/output"],
    });

    expect(updated.readPaths).toEqual(["/home/user/docs", "/tmp"]);
    expect(updated.writePaths).toEqual(["/home/user/output"]);

    const fetched = storage.permissions.get();
    expect(fetched.readPaths).toEqual(["/home/user/docs", "/tmp"]);
    expect(fetched.writePaths).toEqual(["/home/user/output"]);
  });

  it("should overwrite permissions completely", () => {
    storage.permissions.update({
      readPaths: ["/old/path"],
      writePaths: ["/old/write"],
    });

    storage.permissions.update({
      readPaths: ["/new/path"],
      writePaths: [],
    });

    const fetched = storage.permissions.get();
    expect(fetched.readPaths).toEqual(["/new/path"]);
    expect(fetched.writePaths).toEqual([]);
  });
});

describe("SettingsRepository", () => {
  it("should return undefined for non-existent setting", () => {
    const value = storage.settings.get("nonexistent");
    expect(value).toBeUndefined();
  });

  it("should set and get a setting", () => {
    storage.settings.set("region", "cn");

    const value = storage.settings.get("region");
    expect(value).toBe("cn");
  });

  it("should overwrite existing setting", () => {
    storage.settings.set("region", "cn");
    storage.settings.set("region", "us");

    const value = storage.settings.get("region");
    expect(value).toBe("us");
  });

  it("should get all settings", () => {
    storage.settings.set("region", "cn");
    storage.settings.set("language", "zh");
    storage.settings.set("theme", "dark");

    const all = storage.settings.getAll();
    expect(all).toEqual({
      "file-permissions-full-access": "true",
      language: "zh",
      region: "cn",
      theme: "dark",
    });
  });

  it("should delete a setting", () => {
    storage.settings.set("region", "cn");

    const deleted = storage.settings.delete("region");
    expect(deleted).toBe(true);

    const value = storage.settings.get("region");
    expect(value).toBeUndefined();
  });

  it("should return false when deleting non-existent setting", () => {
    const deleted = storage.settings.delete("nonexistent");
    expect(deleted).toBe(false);
  });
});

describe("ProviderKeysRepository", () => {
  it("should create and retrieve a provider key", () => {
    const key = storage.providerKeys.create({
      id: "key-1",
      provider: "openai",
      label: "Default",
      model: "gpt-4o",
      isDefault: true,
      createdAt: "",
      updatedAt: "",
    });

    expect(key.id).toBe("key-1");
    expect(key.provider).toBe("openai");
    expect(key.label).toBe("Default");
    expect(key.model).toBe("gpt-4o");
    expect(key.isDefault).toBe(true);
    expect(key.createdAt).toBeTruthy();

    const fetched = storage.providerKeys.getById("key-1");
    expect(fetched).toMatchObject(key);
  });

  it("should return undefined for non-existent key", () => {
    expect(storage.providerKeys.getById("nope")).toBeUndefined();
  });

  it("should get all keys", () => {
    storage.providerKeys.create({ id: "k1", provider: "openai", label: "A", model: "gpt-4o", isDefault: true, createdAt: "", updatedAt: "" });
    storage.providerKeys.create({ id: "k2", provider: "anthropic", label: "B", model: "claude-sonnet-4-5-20250929", isDefault: true, createdAt: "", updatedAt: "" });

    const all = storage.providerKeys.getAll();
    expect(all).toHaveLength(2);
  });

  it("should get keys by provider", () => {
    storage.providerKeys.create({ id: "k1", provider: "openai", label: "A", model: "gpt-4o", isDefault: true, createdAt: "", updatedAt: "" });
    storage.providerKeys.create({ id: "k2", provider: "openai", label: "B", model: "gpt-4o-mini", isDefault: false, createdAt: "", updatedAt: "" });
    storage.providerKeys.create({ id: "k3", provider: "anthropic", label: "C", model: "claude-sonnet-4-5-20250929", isDefault: true, createdAt: "", updatedAt: "" });

    const openaiKeys = storage.providerKeys.getByProvider("openai");
    expect(openaiKeys).toHaveLength(2);
    expect(openaiKeys[0].provider).toBe("openai");
  });

  it("should get default key for provider", () => {
    storage.providerKeys.create({ id: "k1", provider: "openai", label: "A", model: "gpt-4o", isDefault: false, createdAt: "", updatedAt: "" });
    storage.providerKeys.create({ id: "k2", provider: "openai", label: "B", model: "gpt-4o-mini", isDefault: true, createdAt: "", updatedAt: "" });

    const def = storage.providerKeys.getDefault("openai");
    expect(def?.id).toBe("k2");
  });

  it("should update a key", () => {
    storage.providerKeys.create({ id: "k1", provider: "openai", label: "Old", model: "gpt-4o", isDefault: true, createdAt: "", updatedAt: "" });

    const updated = storage.providerKeys.update("k1", { label: "New", model: "gpt-4o-mini" });
    expect(updated?.label).toBe("New");
    expect(updated?.model).toBe("gpt-4o-mini");
  });

  it("should set default and clear others within same provider", () => {
    storage.providerKeys.create({ id: "k1", provider: "openai", label: "A", model: "gpt-4o", isDefault: true, createdAt: "", updatedAt: "" });
    storage.providerKeys.create({ id: "k2", provider: "openai", label: "B", model: "gpt-4o-mini", isDefault: false, createdAt: "", updatedAt: "" });

    storage.providerKeys.setDefault("k2");

    expect(storage.providerKeys.getById("k1")?.isDefault).toBe(false);
    expect(storage.providerKeys.getById("k2")?.isDefault).toBe(true);
  });

  it("should set default and clear keys across ALL providers (global unique)", () => {
    storage.providerKeys.create({ id: "k1", provider: "openai", label: "A", model: "gpt-4o", isDefault: true, createdAt: "", updatedAt: "" });
    storage.providerKeys.create({ id: "k2", provider: "anthropic", label: "B", model: "claude-sonnet-4-5-20250929", isDefault: false, createdAt: "", updatedAt: "" });

    // Activate anthropic key — should clear openai's default
    storage.providerKeys.setDefault("k2");

    expect(storage.providerKeys.getById("k1")?.isDefault).toBe(false);
    expect(storage.providerKeys.getById("k2")?.isDefault).toBe(true);
    expect(storage.providerKeys.getActive()?.id).toBe("k2");
  });

  it("getActive() should return the single globally active key", () => {
    expect(storage.providerKeys.getActive()).toBeUndefined();

    storage.providerKeys.create({ id: "k1", provider: "openai", label: "A", model: "gpt-4o", isDefault: false, createdAt: "", updatedAt: "" });
    expect(storage.providerKeys.getActive()).toBeUndefined();

    storage.providerKeys.create({ id: "k2", provider: "anthropic", label: "B", model: "claude-sonnet-4-5-20250929", isDefault: true, createdAt: "", updatedAt: "" });
    expect(storage.providerKeys.getActive()?.id).toBe("k2");
  });

  it("should delete a key", () => {
    storage.providerKeys.create({ id: "k1", provider: "openai", label: "A", model: "gpt-4o", isDefault: true, createdAt: "", updatedAt: "" });
    expect(storage.providerKeys.delete("k1")).toBe(true);
    expect(storage.providerKeys.getById("k1")).toBeUndefined();
  });

  it("should return false when deleting non-existent key", () => {
    expect(storage.providerKeys.delete("nope")).toBe(false);
  });

  it("should create and update a local provider key with baseUrl", () => {
    const key = storage.providerKeys.create({
      id: "local-1",
      provider: "ollama",
      label: "Ollama",
      model: "llama3.2",
      isDefault: true,
      authType: "local",
      baseUrl: "http://localhost:11434",
      createdAt: "",
      updatedAt: "",
    });

    expect(key.provider).toBe("ollama");
    expect(key.authType).toBe("local");
    expect(key.baseUrl).toBe("http://localhost:11434");

    const fetched = storage.providerKeys.getById("local-1");
    expect(fetched?.baseUrl).toBe("http://localhost:11434");
    expect(fetched?.authType).toBe("local");

    // Update baseUrl
    const updated = storage.providerKeys.update("local-1", { baseUrl: "http://192.168.1.100:11434" });
    expect(updated?.baseUrl).toBe("http://192.168.1.100:11434");

    // Verify persisted
    const refetched = storage.providerKeys.getById("local-1");
    expect(refetched?.baseUrl).toBe("http://192.168.1.100:11434");
  });
});

describe("UsageSnapshotsRepository", () => {
  it("should insert and getLatest", () => {
    storage.usageSnapshots.insert({
      keyId: "key-1",
      provider: "openai",
      model: "gpt-4o",
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadTokens: 100,
      cacheWriteTokens: 50,
      totalCostUsd: "0.05",
      snapshotTime: 1000000,
    });

    const latest = storage.usageSnapshots.getLatest("key-1", "gpt-4o");
    expect(latest).toBeDefined();
    expect(latest!.keyId).toBe("key-1");
    expect(latest!.provider).toBe("openai");
    expect(latest!.model).toBe("gpt-4o");
    expect(latest!.inputTokens).toBe(1000);
    expect(latest!.outputTokens).toBe(500);
    expect(latest!.cacheReadTokens).toBe(100);
    expect(latest!.cacheWriteTokens).toBe(50);
    expect(latest!.totalCostUsd).toBe("0.05");
    expect(latest!.snapshotTime).toBe(1000000);
  });

  it("should return undefined when no snapshots exist", () => {
    const latest = storage.usageSnapshots.getLatest("key-1", "gpt-4o");
    expect(latest).toBeUndefined();
  });

  it("should getRecent with limit", () => {
    storage.usageSnapshots.insert({
      keyId: "key-1",
      provider: "openai",
      model: "gpt-4o",
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 10,
      cacheWriteTokens: 5,
      totalCostUsd: "0.01",
      snapshotTime: 1000000,
    });
    storage.usageSnapshots.insert({
      keyId: "key-1",
      provider: "openai",
      model: "gpt-4o",
      inputTokens: 200,
      outputTokens: 100,
      cacheReadTokens: 20,
      cacheWriteTokens: 10,
      totalCostUsd: "0.02",
      snapshotTime: 2000000,
    });
    storage.usageSnapshots.insert({
      keyId: "key-1",
      provider: "openai",
      model: "gpt-4o",
      inputTokens: 300,
      outputTokens: 150,
      cacheReadTokens: 30,
      cacheWriteTokens: 15,
      totalCostUsd: "0.03",
      snapshotTime: 3000000,
    });

    const recent = storage.usageSnapshots.getRecent("key-1", "gpt-4o", 2);
    expect(recent).toHaveLength(2);
    // newest first
    expect(recent[0].snapshotTime).toBe(3000000);
    expect(recent[1].snapshotTime).toBe(2000000);
  });

  it("should pruneOld keeping only N newest", () => {
    for (let i = 1; i <= 6; i++) {
      storage.usageSnapshots.insert({
        keyId: "key-1",
        provider: "openai",
        model: "gpt-4o",
        inputTokens: i * 100,
        outputTokens: i * 50,
        cacheReadTokens: i * 10,
        cacheWriteTokens: i * 5,
        totalCostUsd: `${(i * 0.01).toFixed(2)}`,
        snapshotTime: i * 1000000,
      });
    }

    const deleted = storage.usageSnapshots.pruneOld("key-1", "gpt-4o", 5);
    expect(deleted).toBe(1);

    const remaining = storage.usageSnapshots.getRecent("key-1", "gpt-4o", 10);
    expect(remaining).toHaveLength(5);
    // oldest (snapshotTime=1000000) should be gone
    expect(remaining.every((s) => s.snapshotTime >= 2000000)).toBe(true);
  });

  it("should not interfere between different key/model pairs", () => {
    storage.usageSnapshots.insert({
      keyId: "keyA",
      provider: "openai",
      model: "modelX",
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 10,
      cacheWriteTokens: 5,
      totalCostUsd: "0.01",
      snapshotTime: 1000000,
    });
    storage.usageSnapshots.insert({
      keyId: "keyB",
      provider: "anthropic",
      model: "modelY",
      inputTokens: 200,
      outputTokens: 100,
      cacheReadTokens: 20,
      cacheWriteTokens: 10,
      totalCostUsd: "0.02",
      snapshotTime: 2000000,
    });

    const latestA = storage.usageSnapshots.getLatest("keyA", "modelX");
    expect(latestA).toBeDefined();
    expect(latestA!.keyId).toBe("keyA");
    expect(latestA!.inputTokens).toBe(100);

    const latestB = storage.usageSnapshots.getLatest("keyB", "modelY");
    expect(latestB).toBeDefined();
    expect(latestB!.keyId).toBe("keyB");
    expect(latestB!.inputTokens).toBe(200);

    // Cross-lookup returns undefined
    expect(storage.usageSnapshots.getLatest("keyA", "modelY")).toBeUndefined();
    expect(storage.usageSnapshots.getLatest("keyB", "modelX")).toBeUndefined();
  });
});

describe("KeyUsageHistoryRepository", () => {
  it("should insert and queryByWindow", () => {
    storage.keyUsageHistory.insert({
      keyId: "key-1",
      provider: "openai",
      model: "gpt-4o",
      startTime: 1000000,
      endTime: 2000000,
      inputTokens: 500,
      outputTokens: 200,
      cacheReadTokens: 50,
      cacheWriteTokens: 25,
      totalCostUsd: "0.03",
    });

    const results = storage.keyUsageHistory.queryByWindow({
      windowStart: 1000000,
      windowEnd: 3000000,
    });
    expect(results).toHaveLength(1);
    expect(results[0].keyId).toBe("key-1");
    expect(results[0].provider).toBe("openai");
    expect(results[0].model).toBe("gpt-4o");
    expect(results[0].startTime).toBe(1000000);
    expect(results[0].endTime).toBe(2000000);
    expect(results[0].inputTokens).toBe(500);
    expect(results[0].outputTokens).toBe(200);
    expect(results[0].cacheReadTokens).toBe(50);
    expect(results[0].cacheWriteTokens).toBe(25);
    expect(results[0].totalCostUsd).toBe("0.03");
  });

  it("should return empty when no records match", () => {
    const results = storage.keyUsageHistory.queryByWindow({
      windowStart: 1000000,
      windowEnd: 3000000,
    });
    expect(results).toHaveLength(0);
  });

  it("should filter by keyId", () => {
    storage.keyUsageHistory.insert({
      keyId: "key-1",
      provider: "openai",
      model: "gpt-4o",
      startTime: 1000000,
      endTime: 2000000,
      inputTokens: 500,
      outputTokens: 200,
      cacheReadTokens: 50,
      cacheWriteTokens: 25,
      totalCostUsd: "0.03",
    });
    storage.keyUsageHistory.insert({
      keyId: "key-2",
      provider: "openai",
      model: "gpt-4o",
      startTime: 1000000,
      endTime: 2000000,
      inputTokens: 300,
      outputTokens: 100,
      cacheReadTokens: 30,
      cacheWriteTokens: 15,
      totalCostUsd: "0.02",
    });

    const results = storage.keyUsageHistory.queryByWindow({
      windowStart: 1000000,
      windowEnd: 3000000,
      keyId: "key-1",
    });
    expect(results).toHaveLength(1);
    expect(results[0].keyId).toBe("key-1");
  });

  it("should filter by provider", () => {
    storage.keyUsageHistory.insert({
      keyId: "key-1",
      provider: "openai",
      model: "gpt-4o",
      startTime: 1000000,
      endTime: 2000000,
      inputTokens: 500,
      outputTokens: 200,
      cacheReadTokens: 50,
      cacheWriteTokens: 25,
      totalCostUsd: "0.03",
    });
    storage.keyUsageHistory.insert({
      keyId: "key-2",
      provider: "anthropic",
      model: "claude-sonnet-4-5-20250929",
      startTime: 1000000,
      endTime: 2000000,
      inputTokens: 400,
      outputTokens: 150,
      cacheReadTokens: 40,
      cacheWriteTokens: 20,
      totalCostUsd: "0.04",
    });

    const results = storage.keyUsageHistory.queryByWindow({
      windowStart: 1000000,
      windowEnd: 3000000,
      provider: "anthropic",
    });
    expect(results).toHaveLength(1);
    expect(results[0].provider).toBe("anthropic");
  });

  it("should filter by model", () => {
    storage.keyUsageHistory.insert({
      keyId: "key-1",
      provider: "openai",
      model: "gpt-4o",
      startTime: 1000000,
      endTime: 2000000,
      inputTokens: 500,
      outputTokens: 200,
      cacheReadTokens: 50,
      cacheWriteTokens: 25,
      totalCostUsd: "0.03",
    });
    storage.keyUsageHistory.insert({
      keyId: "key-1",
      provider: "openai",
      model: "gpt-4o-mini",
      startTime: 1000000,
      endTime: 2000000,
      inputTokens: 300,
      outputTokens: 100,
      cacheReadTokens: 30,
      cacheWriteTokens: 15,
      totalCostUsd: "0.01",
    });

    const results = storage.keyUsageHistory.queryByWindow({
      windowStart: 1000000,
      windowEnd: 3000000,
      model: "gpt-4o-mini",
    });
    expect(results).toHaveLength(1);
    expect(results[0].model).toBe("gpt-4o-mini");
  });

  it("should exclude records outside the window", () => {
    // Record with end_time outside the window
    storage.keyUsageHistory.insert({
      keyId: "key-1",
      provider: "openai",
      model: "gpt-4o",
      startTime: 1000000,
      endTime: 5000000,
      inputTokens: 500,
      outputTokens: 200,
      cacheReadTokens: 50,
      cacheWriteTokens: 25,
      totalCostUsd: "0.03",
    });
    // Record with end_time inside the window
    storage.keyUsageHistory.insert({
      keyId: "key-1",
      provider: "openai",
      model: "gpt-4o",
      startTime: 1000000,
      endTime: 2000000,
      inputTokens: 300,
      outputTokens: 100,
      cacheReadTokens: 30,
      cacheWriteTokens: 15,
      totalCostUsd: "0.02",
    });

    const results = storage.keyUsageHistory.queryByWindow({
      windowStart: 1000000,
      windowEnd: 3000000,
    });
    expect(results).toHaveLength(1);
    expect(results[0].endTime).toBe(2000000);
  });

  it("should return multiple records ordered by end_time DESC", () => {
    storage.keyUsageHistory.insert({
      keyId: "key-1",
      provider: "openai",
      model: "gpt-4o",
      startTime: 1000000,
      endTime: 2000000,
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 10,
      cacheWriteTokens: 5,
      totalCostUsd: "0.01",
    });
    storage.keyUsageHistory.insert({
      keyId: "key-1",
      provider: "openai",
      model: "gpt-4o",
      startTime: 2000000,
      endTime: 3000000,
      inputTokens: 200,
      outputTokens: 100,
      cacheReadTokens: 20,
      cacheWriteTokens: 10,
      totalCostUsd: "0.02",
    });
    storage.keyUsageHistory.insert({
      keyId: "key-1",
      provider: "openai",
      model: "gpt-4o",
      startTime: 3000000,
      endTime: 4000000,
      inputTokens: 300,
      outputTokens: 150,
      cacheReadTokens: 30,
      cacheWriteTokens: 15,
      totalCostUsd: "0.03",
    });

    const results = storage.keyUsageHistory.queryByWindow({
      windowStart: 1000000,
      windowEnd: 5000000,
    });
    expect(results).toHaveLength(3);
    // Ordered by end_time DESC
    expect(results[0].endTime).toBe(4000000);
    expect(results[1].endTime).toBe(3000000);
    expect(results[2].endTime).toBe(2000000);
  });
});

describe("Database", () => {
  it("should create storage with in-memory database", () => {
    expect(storage.db).toBeDefined();
    expect(storage.channels).toBeDefined();
    expect(storage.permissions).toBeDefined();
    expect(storage.settings).toBeDefined();
    expect(storage.providerKeys).toBeDefined();
  });

  it("should track applied migrations", () => {
    const rows = storage.db
      .prepare("SELECT * FROM _migrations")
      .all() as Array<{ id: number; name: string; applied_at: string }>;
    const byId = new Map(rows.map((row) => [row.id, row.name]));

    expect(rows).toHaveLength(migrations.length);
    expect(byId.get(1)).toBe("initial_schema");
    expect(byId.get(2)).toBe("add_provider_keys_table");
    expect(byId.get(6)).toBe("add_auth_type_to_provider_keys");
    expect(byId.get(7)).toBe("add_budget_columns_to_provider_keys");
    expect(byId.get(8)).toBe("add_usage_snapshots_and_history");
    expect(byId.get(9)).toBe("add_base_url_to_provider_keys");
    expect(byId.get(10)).toBe("add_custom_provider_columns");
    expect(byId.get(12)).toBe("add_chat_sessions_table");
    expect(byId.get(15)).toBe("add_is_owner_to_channel_recipients");
    expect(byId.get(16)).toBe("add_multi_phone_columns_to_mobile_pairings");
    expect(byId.get(17)).toBe("add_pairing_id_to_mobile_pairings");
    expect(byId.get(18)).toBe("add_status_to_mobile_pairings");
    expect(byId.get(22)).toBe("add_tool_selections_table");
  });

  it("should not re-apply migrations on second open", () => {
    // Close and reopen - migrations should be idempotent
    storage.close();
    storage = createStorage(":memory:");

    const rows = storage.db
      .prepare("SELECT * FROM _migrations")
      .all() as Array<{ id: number; name: string }>;

    expect(rows).toHaveLength(migrations.length);
  });

  it("does not drop legacy rules or artifacts tables during policy removal", () => {
    const migrationSql = migrations.map((migration) => migration.sql).join("\n");

    expect(migrationSql).not.toMatch(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?rules/i);
    expect(migrationSql).not.toMatch(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?artifacts/i);
  });
});

describe("ToolSelections", () => {
  it("should save and retrieve selections for a scope", () => {
    storage.toolSelections.setForScope("chat_session", "sess-1", [
      { toolId: "tool-a", enabled: true },
      { toolId: "tool-b", enabled: false },
    ]);

    const selections = storage.toolSelections.getForScope("chat_session", "sess-1");
    expect(selections).toHaveLength(2);
    expect(selections).toContainEqual({ toolId: "tool-a", enabled: true });
    expect(selections).toContainEqual({ toolId: "tool-b", enabled: false });
  });

  it("should overwrite existing selections (setForScope replaces all)", () => {
    storage.toolSelections.setForScope("chat_session", "sess-1", [
      { toolId: "tool-a", enabled: true },
      { toolId: "tool-b", enabled: true },
    ]);

    storage.toolSelections.setForScope("chat_session", "sess-1", [
      { toolId: "tool-c", enabled: false },
    ]);

    const selections = storage.toolSelections.getForScope("chat_session", "sess-1");
    expect(selections).toHaveLength(1);
    expect(selections[0]).toEqual({ toolId: "tool-c", enabled: false });
  });

  it("should delete selections for a scope", () => {
    storage.toolSelections.setForScope("cron_job", "cron-1", [
      { toolId: "tool-a", enabled: true },
    ]);

    storage.toolSelections.deleteForScope("cron_job", "cron-1");

    const selections = storage.toolSelections.getForScope("cron_job", "cron-1");
    expect(selections).toHaveLength(0);
  });

  it("should isolate selections between different scopes", () => {
    storage.toolSelections.setForScope("chat_session", "sess-1", [
      { toolId: "tool-a", enabled: true },
    ]);
    storage.toolSelections.setForScope("cron_job", "cron-1", [
      { toolId: "tool-b", enabled: false },
    ]);
    storage.toolSelections.setForScope("chat_session", "sess-2", [
      { toolId: "tool-c", enabled: true },
    ]);

    const sess1 = storage.toolSelections.getForScope("chat_session", "sess-1");
    expect(sess1).toHaveLength(1);
    expect(sess1[0].toolId).toBe("tool-a");

    const cron1 = storage.toolSelections.getForScope("cron_job", "cron-1");
    expect(cron1).toHaveLength(1);
    expect(cron1[0].toolId).toBe("tool-b");

    const sess2 = storage.toolSelections.getForScope("chat_session", "sess-2");
    expect(sess2).toHaveLength(1);
    expect(sess2[0].toolId).toBe("tool-c");
  });

  it("should return empty array for non-existent scope", () => {
    const selections = storage.toolSelections.getForScope("unknown", "nonexistent");
    expect(selections).toHaveLength(0);
  });

  it("listScopes returns distinct scope pairs", () => {
    storage.toolSelections.setForScope("chat_session", "s1", [
      { toolId: "browser_profiles_list", enabled: true },
    ]);
    storage.toolSelections.setForScope("cron_job", "c1", [
      { toolId: "browser_profiles_get", enabled: true },
    ]);
    storage.toolSelections.setForScope("chat_session", "s1", [
      { toolId: "browser_profiles_list", enabled: true },
      { toolId: "browser_profiles_manage", enabled: false },
    ]);

    const scopes = storage.toolSelections.listScopes();
    expect(scopes).toHaveLength(2);
    expect(scopes).toContainEqual({ scopeType: "chat_session", scopeKey: "s1" });
    expect(scopes).toContainEqual({ scopeType: "cron_job", scopeKey: "c1" });
  });

  it("should handle setForScope with empty selections", () => {
    storage.toolSelections.setForScope("chat_session", "sess-1", [
      { toolId: "tool-a", enabled: true },
    ]);

    storage.toolSelections.setForScope("chat_session", "sess-1", []);

    const selections = storage.toolSelections.getForScope("chat_session", "sess-1");
    expect(selections).toHaveLength(0);
  });
});

describe("ChannelRecipientsRepository", () => {
  it("should ensureExists and retrieve recipient", () => {
    storage.channelRecipients.ensureExists("telegram", "12345");
    const meta = storage.channelRecipients.getRecipientMeta("telegram");
    expect(meta["12345"]).toBeDefined();
    expect(meta["12345"].label).toBe("");
    expect(meta["12345"].isOwner).toBe(false);
  });

  it("should return true on first ensureExists and false on repeat", () => {
    // First call inserts a fresh row → true
    expect(storage.channelRecipients.ensureExists("telegram", "42")).toBe(true);
    // Second call with the same (channelId, recipientId) is a no-op → false
    expect(storage.channelRecipients.ensureExists("telegram", "42")).toBe(false);
    // Different recipient on same channel → true
    expect(storage.channelRecipients.ensureExists("telegram", "43")).toBe(true);
    // Same recipient on a different channel → true (composite key differs)
    expect(storage.channelRecipients.ensureExists("discord", "42")).toBe(true);
  });

  it("should ensureExists with isOwner flag", () => {
    storage.channelRecipients.ensureExists("telegram", "12345", true);
    const meta = storage.channelRecipients.getRecipientMeta("telegram");
    expect(meta["12345"].isOwner).toBe(true);
  });

  it("should not overwrite existing row on ensureExists", () => {
    storage.channelRecipients.ensureExists("telegram", "12345", true);
    storage.channelRecipients.setLabel("telegram", "12345", "Alice");
    // Calling ensureExists again should not overwrite
    storage.channelRecipients.ensureExists("telegram", "12345", false);
    const meta = storage.channelRecipients.getRecipientMeta("telegram");
    expect(meta["12345"].isOwner).toBe(true);
    expect(meta["12345"].label).toBe("Alice");
  });

  it("should set and revoke owner status", () => {
    storage.channelRecipients.ensureExists("telegram", "12345");
    expect(storage.channelRecipients.hasAnyOwner()).toBe(false);

    storage.channelRecipients.setOwner("telegram", "12345", true);
    expect(storage.channelRecipients.hasAnyOwner()).toBe(true);

    const owners = storage.channelRecipients.getOwners();
    expect(owners).toEqual([{ channelId: "telegram", recipientId: "12345" }]);

    storage.channelRecipients.setOwner("telegram", "12345", false);
    expect(storage.channelRecipients.hasAnyOwner()).toBe(false);
    expect(storage.channelRecipients.getOwners()).toEqual([]);
  });

  it("should getOwners across multiple channels", () => {
    storage.channelRecipients.ensureExists("telegram", "111", true);
    storage.channelRecipients.ensureExists("telegram", "222", false);
    storage.channelRecipients.ensureExists("discord", "333", true);

    const owners = storage.channelRecipients.getOwners();
    expect(owners).toHaveLength(2);
    expect(owners).toContainEqual({ channelId: "telegram", recipientId: "111" });
    expect(owners).toContainEqual({ channelId: "discord", recipientId: "333" });
  });

  it("should preserve is_owner when setLabel is called", () => {
    storage.channelRecipients.ensureExists("telegram", "12345", true);
    storage.channelRecipients.setLabel("telegram", "12345", "Updated Label");

    const meta = storage.channelRecipients.getRecipientMeta("telegram");
    expect(meta["12345"].label).toBe("Updated Label");
    expect(meta["12345"].isOwner).toBe(true);
  });

  it("should set default isOwner=false when setLabel creates a new row", () => {
    // setLabel creates row if it doesn't exist, is_owner should be 0
    storage.channelRecipients.setLabel("telegram", "99999", "New User");
    const meta = storage.channelRecipients.getRecipientMeta("telegram");
    expect(meta["99999"].label).toBe("New User");
    expect(meta["99999"].isOwner).toBe(false);
  });

  it("should hasAnyOwner return false on empty database", () => {
    expect(storage.channelRecipients.hasAnyOwner()).toBe(false);
  });

  it("should delete recipient and remove from owners", () => {
    storage.channelRecipients.ensureExists("telegram", "12345", true);
    expect(storage.channelRecipients.hasAnyOwner()).toBe(true);

    storage.channelRecipients.delete("telegram", "12345");
    expect(storage.channelRecipients.hasAnyOwner()).toBe(false);
  });

  it("should list recipients with isOwner flag", () => {
    storage.channelRecipients.ensureExists("telegram", "111", true);
    storage.channelRecipients.ensureExists("telegram", "222", false);

    const list = storage.channelRecipients.list("telegram");
    expect(list).toHaveLength(2);
    const owner = list.find((r) => r.recipientId === "111");
    const nonOwner = list.find((r) => r.recipientId === "222");
    expect(owner?.isOwner).toBe(true);
    expect(nonOwner?.isOwner).toBe(false);
  });
});

describe("migration 27: canonicalize_weixin_account_ids", () => {
  // Exercises the migration SQL directly against a fresh in-memory DB with
  // pre-seeded @-form and dash-form rows. Uses the migration definition from
  // `migrations.ts` so this test stays in lock-step with the real SQL.
  function runMigration27(): Storage {
    const s = createStorage(":memory:");
    const migration = migrations.find((m) => m.id === 27);
    if (!migration) throw new Error("migration 27 not found");
    // Seed rows BEFORE re-running the migration so we can observe the rewrite.
    // (The migration already ran once during openDatabase; re-running is
    // idempotent — that's the property we're verifying as a side effect.)
    return s;
  }

  it("rewrites @im.bot suffix rows to -im-bot dash form", () => {
    const s = runMigration27();
    // Seed legacy @-form row directly (bypassing the repo so we can insert
    // the raw form without any caller-side normalization).
    s.db.prepare(
      `INSERT INTO channel_accounts (channel_id, account_id, name, config, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("openclaw-weixin", "abc123@im.bot", "abc123@im.bot", "{}", 1, 1);

    // Re-run migration 27 (idempotent)
    const migration = migrations.find((m) => m.id === 27)!;
    s.db.exec(migration.sql);

    const got = s.db
      .prepare("SELECT account_id FROM channel_accounts WHERE channel_id = 'openclaw-weixin'")
      .all() as Array<{ account_id: string }>;
    expect(got).toHaveLength(1);
    expect(got[0].account_id).toBe("abc123-im-bot");
    s.close();
  });

  it("rewrites @im.wechat suffix rows to -im-wechat dash form", () => {
    const s = runMigration27();
    s.db.prepare(
      `INSERT INTO channel_accounts (channel_id, account_id, name, config, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("openclaw-weixin", "abc123@im.wechat", null, "{}", 1, 1);

    const migration = migrations.find((m) => m.id === 27)!;
    s.db.exec(migration.sql);

    const got = s.db
      .prepare("SELECT account_id FROM channel_accounts WHERE channel_id = 'openclaw-weixin'")
      .all() as Array<{ account_id: string }>;
    expect(got).toHaveLength(1);
    expect(got[0].account_id).toBe("abc123-im-wechat");
    s.close();
  });

  it("leaves already-canonical dash-form rows untouched", () => {
    const s = runMigration27();
    s.db.prepare(
      `INSERT INTO channel_accounts (channel_id, account_id, name, config, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("openclaw-weixin", "xyz-im-bot", null, '{"foo":"bar"}', 42, 42);

    const migration = migrations.find((m) => m.id === 27)!;
    s.db.exec(migration.sql);

    const row = s.db
      .prepare("SELECT account_id, created_at, updated_at, config FROM channel_accounts WHERE account_id = 'xyz-im-bot'")
      .get() as { account_id: string; created_at: number; updated_at: number; config: string };
    expect(row.account_id).toBe("xyz-im-bot");
    // Neither timestamp nor config should have been rewritten
    expect(row.created_at).toBe(42);
    expect(row.updated_at).toBe(42);
    expect(row.config).toBe('{"foo":"bar"}');
    s.close();
  });

  it("resolves conflict by dropping @ form and keeping dash form", () => {
    const s = runMigration27();
    // Both forms co-exist: dash wins, @ is dropped.
    s.db.prepare(
      `INSERT INTO channel_accounts (channel_id, account_id, name, config, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("openclaw-weixin", "collide-im-bot", "dash-wins", '{"keep":"dash"}', 100, 100);
    s.db.prepare(
      `INSERT INTO channel_accounts (channel_id, account_id, name, config, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("openclaw-weixin", "collide@im.bot", "at-loses", '{"keep":"at"}', 200, 200);

    const migration = migrations.find((m) => m.id === 27)!;
    s.db.exec(migration.sql);

    const rows = s.db
      .prepare("SELECT account_id, name, config FROM channel_accounts WHERE channel_id = 'openclaw-weixin'")
      .all() as Array<{ account_id: string; name: string | null; config: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].account_id).toBe("collide-im-bot");
    expect(rows[0].name).toBe("dash-wins");
    expect(rows[0].config).toBe('{"keep":"dash"}');
    s.close();
  });

  it("is idempotent: a second run of the SQL is a no-op", () => {
    const s = runMigration27();
    s.db.prepare(
      `INSERT INTO channel_accounts (channel_id, account_id, name, config, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("openclaw-weixin", "idem@im.bot", null, "{}", 1, 1);

    const migration = migrations.find((m) => m.id === 27)!;
    s.db.exec(migration.sql); // first rewrite
    const after1 = s.db
      .prepare("SELECT account_id, updated_at FROM channel_accounts WHERE channel_id = 'openclaw-weixin'")
      .get() as { account_id: string; updated_at: number };
    expect(after1.account_id).toBe("idem-im-bot");

    s.db.exec(migration.sql); // second run
    const after2 = s.db
      .prepare("SELECT account_id, updated_at FROM channel_accounts WHERE channel_id = 'openclaw-weixin'")
      .get() as { account_id: string; updated_at: number };
    // account_id must not change (already canonical) and updated_at must not
    // be bumped because the UPDATE's WHERE clause excludes canonical rows.
    expect(after2.account_id).toBe("idem-im-bot");
    expect(after2.updated_at).toBe(after1.updated_at);
    s.close();
  });

  it("does not touch non-weixin channels", () => {
    const s = runMigration27();
    s.db.prepare(
      `INSERT INTO channel_accounts (channel_id, account_id, name, config, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("telegram", "bot@im.bot", null, "{}", 1, 1);

    const migration = migrations.find((m) => m.id === 27)!;
    s.db.exec(migration.sql);

    const row = s.db
      .prepare("SELECT account_id FROM channel_accounts WHERE channel_id = 'telegram'")
      .get() as { account_id: string };
    expect(row.account_id).toBe("bot@im.bot");
    s.close();
  });
});

describe("migration 28: remove_stale_feishu_bot_name", () => {
  function runMigration28(): Storage {
    const s = createStorage(":memory:");
    const migration = migrations.find((m) => m.id === 28);
    if (!migration) throw new Error("migration 28 not found");
    return s;
  }

  it("removes botName from feishu channel account configs", () => {
    const s = runMigration28();
    s.db.prepare(
      `INSERT INTO channel_accounts (channel_id, account_id, name, config, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("feishu", "default", "Feishu", '{"appId":"cli_test","botName":"My Bot","enabled":true}', 1, 1);

    const migration = migrations.find((m) => m.id === 28)!;
    s.db.exec(migration.sql);

    const row = s.db
      .prepare("SELECT config FROM channel_accounts WHERE channel_id = 'feishu' AND account_id = 'default'")
      .get() as { config: string };
    expect(row.config).toBe('{"appId":"cli_test","enabled":true}');
    s.close();
  });

  it("does not touch already-clean feishu configs", () => {
    const s = runMigration28();
    s.db.prepare(
      `INSERT INTO channel_accounts (channel_id, account_id, name, config, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("feishu", "default", null, '{"appId":"cli_test","enabled":true}', 42, 42);

    const migration = migrations.find((m) => m.id === 28)!;
    s.db.exec(migration.sql);

    const row = s.db
      .prepare("SELECT config, updated_at FROM channel_accounts WHERE channel_id = 'feishu' AND account_id = 'default'")
      .get() as { config: string; updated_at: number };
    expect(row.config).toBe('{"appId":"cli_test","enabled":true}');
    expect(row.updated_at).toBe(42);
    s.close();
  });

  it("does not touch non-feishu channels", () => {
    const s = runMigration28();
    s.db.prepare(
      `INSERT INTO channel_accounts (channel_id, account_id, name, config, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("telegram", "default", null, '{"botName":"Keep Me"}', 1, 1);

    const migration = migrations.find((m) => m.id === 28)!;
    s.db.exec(migration.sql);

    const row = s.db
      .prepare("SELECT config FROM channel_accounts WHERE channel_id = 'telegram' AND account_id = 'default'")
      .get() as { config: string };
    expect(row.config).toBe('{"botName":"Keep Me"}');
    s.close();
  });
});
