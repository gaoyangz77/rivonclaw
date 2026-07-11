import { describe, it, expect, beforeEach } from "vitest";
import { MemorySecretStore } from "./stores/memory-store.js";
import { FileSecretStore } from "./stores/file-store.js";
import { createSecretStore } from "./factory.js";
import { SecretStoreAccessError, type SecretStore } from "./types.js";
import { KeychainSecretStore } from "./stores/keychain.js";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("MemorySecretStore", () => {
  let store: MemorySecretStore;

  beforeEach(() => {
    store = new MemorySecretStore();
  });

  it("should return null for non-existent key", async () => {
    const value = await store.get("llm-api-key");
    expect(value).toBeNull();
  });

  it("should set and get a secret", async () => {
    await store.set("llm-api-key", "sk-test-123");
    const value = await store.get("llm-api-key");
    expect(value).toBe("sk-test-123");
  });

  it("should overwrite existing secret", async () => {
    await store.set("llm-api-key", "old-value");
    await store.set("llm-api-key", "new-value");
    const value = await store.get("llm-api-key");
    expect(value).toBe("new-value");
  });

  it("should delete a secret", async () => {
    await store.set("llm-api-key", "sk-test-123");
    const deleted = await store.delete("llm-api-key");
    expect(deleted).toBe(true);
    const value = await store.get("llm-api-key");
    expect(value).toBeNull();
  });

  it("should return false when deleting non-existent key", async () => {
    const deleted = await store.delete("nonexistent");
    expect(deleted).toBe(false);
  });

  it("should list all keys", async () => {
    await store.set("llm-api-key", "val1");
    await store.set("stt-api-key", "val2");
    const keys = await store.listKeys();
    expect(keys).toHaveLength(2);
    expect(keys).toContain("llm-api-key");
    expect(keys).toContain("stt-api-key");
  });

  it("should return empty list when no secrets", async () => {
    const keys = await store.listKeys();
    expect(keys).toHaveLength(0);
  });
});

describe("FileSecretStore", () => {
  let store: FileSecretStore;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rivonclaw-secrets-test-"));
    store = new FileSecretStore(tempDir);
  });

  it("should return null for non-existent key", async () => {
    const value = await store.get("llm-api-key");
    expect(value).toBeNull();
  });

  it("should set and get a secret", async () => {
    await store.set("llm-api-key", "sk-test-encrypted");
    const value = await store.get("llm-api-key");
    expect(value).toBe("sk-test-encrypted");
  });

  it("should overwrite existing secret", async () => {
    await store.set("llm-api-key", "old");
    await store.set("llm-api-key", "new");
    const value = await store.get("llm-api-key");
    expect(value).toBe("new");
  });

  it("should delete a secret", async () => {
    await store.set("llm-api-key", "to-delete");
    const deleted = await store.delete("llm-api-key");
    expect(deleted).toBe(true);
    const value = await store.get("llm-api-key");
    expect(value).toBeNull();
  });

  it("should return false when deleting non-existent key", async () => {
    const deleted = await store.delete("nonexistent");
    expect(deleted).toBe(false);
  });

  it("should list all keys", async () => {
    await store.set("llm-api-key", "val1");
    await store.set("stt-api-key", "val2");
    const keys = await store.listKeys();
    expect(keys).toHaveLength(2);
    expect(keys).toContain("llm-api-key");
    expect(keys).toContain("stt-api-key");
  });

  it("should handle special characters in values", async () => {
    const specialValue = "sk-key!@#$%^&*()_+-={}[]|\\:\";<>?,./~`";
    await store.set("llm-api-key", specialValue);
    const value = await store.get("llm-api-key");
    expect(value).toBe(specialValue);
  });

  it("should handle unicode in values", async () => {
    const unicodeValue = "密钥-テスト-키";
    await store.set("llm-api-key", unicodeValue);
    const value = await store.get("llm-api-key");
    expect(value).toBe(unicodeValue);
  });
});

describe("KeychainSecretStore", () => {
  it("returns null only when the keychain item is missing", async () => {
    const store = new KeychainSecretStore(async () => {
      throw { stderr: "security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain." };
    });

    await expect(store.get("missing")).resolves.toBeNull();
    await expect(store.delete("missing")).resolves.toBe(false);
  });

  it("reports an unavailable keychain instead of treating every secret as missing", async () => {
    const store = new KeychainSecretStore(async () => {
      throw { stderr: "security: The user name or passphrase you entered is not correct." };
    });

    await expect(store.get("auth.accessToken")).rejects.toBeInstanceOf(SecretStoreAccessError);
    await expect(store.listKeys()).rejects.toBeInstanceOf(SecretStoreAccessError);
  });

  it("does not include a secret value in a write failure", async () => {
    const store = new KeychainSecretStore(async () => {
      throw new Error("command failed");
    });

    const error = await store.set("auth.accessToken", "super-secret-token").catch((cause) => cause);
    expect(error).toBeInstanceOf(SecretStoreAccessError);
    expect(String(error)).not.toContain("super-secret-token");
  });
});

describe("createSecretStore", () => {
  it("should create a secret store", () => {
    const store: SecretStore = createSecretStore();
    expect(store).toBeDefined();
    expect(typeof store.get).toBe("function");
    expect(typeof store.set).toBe("function");
    expect(typeof store.delete).toBe("function");
    expect(typeof store.listKeys).toBe("function");
  });
});
