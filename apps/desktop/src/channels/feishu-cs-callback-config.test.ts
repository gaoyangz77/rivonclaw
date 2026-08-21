import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetFirstPartyDomainRouteForTests,
  setApiBaseUrlOverride,
  setFirstPartyDomainRoute,
  setStagingDevMode,
} from "@rivonclaw/core";

const patchFeishuMessageCardCallbackUrl = vi.fn();
const resolveFeishuAccountCredentials = vi.fn(() => ({
  appId: "cli_test",
  appSecret: "secret_test",
  domain: "feishu",
}));

vi.mock("./feishu-open-api.js", () => ({
  patchFeishuMessageCardCallbackUrl,
  resolveFeishuAccountCredentials,
}));

const {
  configureFeishuCsCallbackRuntime,
  ensureFeishuCsCallbackConfigured,
  getFeishuCsCallbackWarning,
  resetFeishuCsCallbackRuntimeForTests,
  resolveFeishuCsCallbackUrl,
} = await import("./feishu-cs-callback-config.js");

function createStorage() {
  const values = new Map<string, string>();
  return {
    values,
    storage: {
      settings: {
        get: (key: string) => values.get(key),
        set: (key: string, value: string) => values.set(key, value),
        delete: (key: string) => values.delete(key),
      },
    } as any,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetFirstPartyDomainRouteForTests();
  setStagingDevMode(false);
  resetFeishuCsCallbackRuntimeForTests();
  patchFeishuMessageCardCallbackUrl.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  resetFirstPartyDomainRouteForTests();
  resetFeishuCsCallbackRuntimeForTests();
});

describe("Feishu CS callback configuration", () => {
  it("resolves production, staging, and CN relay Backend URLs", () => {
    expect(resolveFeishuCsCallbackUrl("en")).toBe(
      "https://api.rivonclaw.com/api/webhooks/feishu/cs-escalation-card",
    );
    setStagingDevMode(true);
    expect(resolveFeishuCsCallbackUrl("en")).toContain("/api/webhooks/feishu/cs-escalation-card");
    expect(resolveFeishuCsCallbackUrl("en")).toContain("api-stg.rivonclaw.com");
    setFirstPartyDomainRoute("cn-relay");
    expect(resolveFeishuCsCallbackUrl("zh")).toContain("zhuazhuaai.cn");
  });

  it("stores an idempotency marker and reconfigures when the URL changes", async () => {
    const { storage } = createStorage();
    configureFeishuCsCallbackRuntime({ storage, locale: "en" });

    await ensureFeishuCsCallbackConfigured("account-one");
    await ensureFeishuCsCallbackConfigured("account-one");
    expect(patchFeishuMessageCardCallbackUrl).toHaveBeenCalledTimes(1);

    setApiBaseUrlOverride("https://new-api.example.com");
    await ensureFeishuCsCallbackConfigured("account-one");
    expect(patchFeishuMessageCardCallbackUrl).toHaveBeenCalledTimes(2);
    expect(patchFeishuMessageCardCallbackUrl).toHaveBeenLastCalledWith(
      expect.objectContaining({
        callbackUrl: "https://new-api.example.com/api/webhooks/feishu/cs-escalation-card",
      }),
    );
  });

  it("keeps the account unmarked and exposes a warning after bounded retries fail", async () => {
    vi.useFakeTimers();
    const { storage, values } = createStorage();
    configureFeishuCsCallbackRuntime({ storage, locale: "en" });
    patchFeishuMessageCardCallbackUrl.mockRejectedValue(new Error("permission denied"));

    const request = ensureFeishuCsCallbackConfigured("account-one");
    const rejection = expect(request).rejects.toThrow("not configured");
    await vi.runAllTimersAsync();
    await rejection;

    expect(patchFeishuMessageCardCallbackUrl).toHaveBeenCalledTimes(3);
    expect([...values.keys()].some((key) => key.includes("callback-v2"))).toBe(false);
    expect(
      getFeishuCsCallbackWarning(storage, {
        appId: "cli_test",
        domain: "feishu",
      }),
    ).toBe("Customer-service card callback is not configured");
  });
});
