import { MemorySecretStore } from "@rivonclaw/secrets";
import { createStorage } from "@rivonclaw/storage";
import { describe, expect, it } from "vitest";
import {
  cleanupRemovedGeminiOAuthSecrets,
  REMOVED_GEMINI_OAUTH_KEY_IDS_SETTING,
} from "./removed-gemini-oauth-cleanup.js";

describe("cleanupRemovedGeminiOAuthSecrets", () => {
  it("deletes every credential namespace and consumes the migration marker", async () => {
    const storage = createStorage(":memory:");
    const secrets = new MemorySecretStore();
    try {
      storage.settings.set(REMOVED_GEMINI_OAUTH_KEY_IDS_SETTING, '["gemini-key"]');
      await secrets.set("oauth-cred-gemini-key", "oauth");
      await secrets.set("provider-key-gemini-key", "token");
      await secrets.set("proxy-auth-gemini-key", "proxy");

      await expect(cleanupRemovedGeminiOAuthSecrets(storage, secrets)).resolves.toBe(1);
      await expect(secrets.get("oauth-cred-gemini-key")).resolves.toBeNull();
      await expect(secrets.get("provider-key-gemini-key")).resolves.toBeNull();
      await expect(secrets.get("proxy-auth-gemini-key")).resolves.toBeNull();
      expect(storage.settings.get(REMOVED_GEMINI_OAUTH_KEY_IDS_SETTING)).toBeUndefined();
    } finally {
      storage.close();
    }
  });
});
