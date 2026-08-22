import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetFirstPartyDomainRouteForTests,
  setApiBaseUrlOverride,
  setFirstPartyDomainRoute,
  setStagingDevMode,
} from "@rivonclaw/core";

const configureFeishuCardActionCallback = vi.fn();
const resolveFeishuAccountCredentials = vi.fn(() => ({
  appId: "cli_test",
  appSecret: "secret_test",
  domain: "feishu",
}));

class MockPermissionRequiredError extends Error {
  constructor(readonly permissionUrl: string) {
    super("permission required");
  }
}

vi.mock("./feishu-open-api.js", () => ({
  isFeishuCallbackPermissionRequiredError: (error: unknown) =>
    error instanceof MockPermissionRequiredError,
  configureFeishuCardActionCallback,
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
  configureFeishuCardActionCallback.mockResolvedValue(undefined);
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
    expect(configureFeishuCardActionCallback).toHaveBeenCalledTimes(1);

    setApiBaseUrlOverride("https://new-api.example.com");
    await ensureFeishuCsCallbackConfigured("account-one");
    expect(configureFeishuCardActionCallback).toHaveBeenCalledTimes(2);
    expect(configureFeishuCardActionCallback).toHaveBeenLastCalledWith(
      expect.objectContaining({
        callbackUrl: "https://new-api.example.com/api/webhooks/feishu/cs-escalation-card",
      }),
    );
  });

  it("ignores the pre-publish v3 marker so upgraded accounts publish the subscription", async () => {
    const { storage, values } = createStorage();
    values.set(
      "_internal.feishu-card-callback-v3:feishu:cli_test",
      JSON.stringify({ urlHash: "old-marker" }),
    );
    configureFeishuCsCallbackRuntime({ storage, locale: "en" });

    await ensureFeishuCsCallbackConfigured("account-one");

    expect(configureFeishuCardActionCallback).toHaveBeenCalledTimes(1);
    expect([...values.keys()]).toContain("_internal.feishu-card-callback-v4:feishu:cli_test");
  });

  it("keeps the account unmarked and exposes a warning after bounded retries fail", async () => {
    vi.useFakeTimers();
    const { storage, values } = createStorage();
    configureFeishuCsCallbackRuntime({ storage, locale: "en" });
    configureFeishuCardActionCallback.mockRejectedValue(new Error("permission denied"));

    const request = ensureFeishuCsCallbackConfigured("account-one");
    const rejection = expect(request).rejects.toThrow("not configured");
    await vi.runAllTimersAsync();
    await rejection;

    expect(configureFeishuCardActionCallback).toHaveBeenCalledTimes(3);
    expect([...values.keys()].some((key) => key.includes("callback-v4"))).toBe(false);
    expect(
      getFeishuCsCallbackWarning(storage, {
        appId: "cli_test",
        domain: "feishu",
      }),
    ).toEqual({
      kind: "configuration_failed",
      message: "Customer-service card callback is not configured",
    });
  });

  it("fails fast and exposes the permission remediation URL", async () => {
    const { storage } = createStorage();
    configureFeishuCsCallbackRuntime({ storage, locale: "zh-CN" });
    configureFeishuCardActionCallback.mockRejectedValue(
      new MockPermissionRequiredError("https://open.feishu.cn/app/cli_test/auth?q=permission"),
    );

    await expect(ensureFeishuCsCallbackConfigured("account-one")).rejects.toBeInstanceOf(
      MockPermissionRequiredError,
    );

    expect(configureFeishuCardActionCallback).toHaveBeenCalledTimes(1);
    expect(
      getFeishuCsCallbackWarning(storage, {
        appId: "cli_test",
        domain: "feishu",
      }),
    ).toMatchObject({
      kind: "permission_required",
      actionUrl: "https://open.feishu.cn/app/cli_test/auth?q=permission",
    });
  });
});
