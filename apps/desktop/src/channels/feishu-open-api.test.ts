import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readExistingConfig = vi.fn();

vi.mock("@rivonclaw/gateway", () => ({
  resolveOpenClawConfigPath: () => "/tmp/openclaw.json",
  readExistingConfig,
}));

const {
  FeishuCallbackPermissionRequiredError,
  configureFeishuCardActionCallback,
  getFeishuCallbackPermissionUrl,
  getFeishuTenantAccessToken,
  nextFeishuApplicationVersion,
  resetFeishuTokenCacheForTests,
  resolveFeishuAccountCredentials,
} = await import("./feishu-open-api.js");

const TOKEN_OK = { code: 0, msg: "ok", tenant_access_token: "t-abc", expire: 7200 };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function mockFetch(...responses: Response[]) {
  const fetchMock = vi.fn();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetFeishuTokenCacheForTests();
  readExistingConfig.mockReturnValue({
    channels: {
      feishu: {
        appId: "cli_root",
        appSecret: "secret_root",
        domain: "feishu",
        accounts: {
          "account-1": { appId: "cli_one", appSecret: "secret_one" },
          "account-lark": { appId: "cli_two", appSecret: "secret_two", domain: "lark" },
        },
      },
    },
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("resolveFeishuAccountCredentials", () => {
  it("lets the account override the mirrored channel-root credentials", () => {
    expect(resolveFeishuAccountCredentials("account-1")).toEqual({
      appId: "cli_one",
      appSecret: "secret_one",
      domain: "feishu",
    });
    expect(resolveFeishuAccountCredentials("account-lark").domain).toBe("lark");
  });

  it("falls back to the channel root for an account with no own entry", () => {
    expect(resolveFeishuAccountCredentials("unknown-account")).toEqual({
      appId: "cli_root",
      appSecret: "secret_root",
      domain: "feishu",
    });
  });

  it("throws when no credentials exist anywhere", () => {
    readExistingConfig.mockReturnValue({ channels: { feishu: { accounts: {} } } });
    expect(() => resolveFeishuAccountCredentials("account-1")).toThrow(/no appId\/appSecret/);
  });
});

describe("getFeishuTenantAccessToken", () => {
  it("caches per appId and domain instead of in one shared slot", async () => {
    const fetchMock = mockFetch(
      jsonResponse({ ...TOKEN_OK, tenant_access_token: "t-one" }),
      jsonResponse({ ...TOKEN_OK, tenant_access_token: "t-two" }),
    );

    expect(await getFeishuTenantAccessToken("cli_one", "s1", "feishu")).toBe("t-one");
    expect(await getFeishuTenantAccessToken("cli_two", "s2", "feishu")).toBe("t-two");
    expect(await getFeishuTenantAccessToken("cli_one", "s1", "feishu")).toBe("t-one");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws on a non-zero code returned with HTTP 200", async () => {
    mockFetch(jsonResponse({ code: 10003, msg: "invalid app_secret" }));

    await expect(getFeishuTenantAccessToken("cli_one", "bad", "feishu")).rejects.toThrow(
      /code=10003 msg=invalid app_secret/,
    );
  });
});

describe("configureFeishuCardActionCallback", () => {
  it("subscribes, publishes, and verifies the v2 card callback", async () => {
    const fetchMock = mockFetch(
      jsonResponse(TOKEN_OK),
      jsonResponse({ code: 0, msg: "success" }),
      jsonResponse({ code: 0, msg: "success" }),
      jsonResponse({
        code: 0,
        msg: "success",
        data: { items: [{ version: "1.0.3" }, { version: "1.0.2" }] },
      }),
      jsonResponse({ code: 0, msg: "success", data: { version: "1.0.4" } }),
      jsonResponse({
        code: 0,
        msg: "success",
        data: {
          app: {
            callback_info: {
              callback_type: "webhook",
              request_url: "https://api.example.com/api/webhooks/feishu/cs-escalation-card",
              subscribed_callbacks: ["card.action.trigger"],
            },
          },
        },
      }),
    );

    await configureFeishuCardActionCallback({
      appId: "cli_one",
      appSecret: "secret_one",
      domain: "feishu",
      callbackUrl: "https://api.example.com/api/webhooks/feishu/cs-escalation-card",
    });

    const [configUrl, configInit] = fetchMock.mock.calls[1];
    expect(configUrl).toBe(
      "https://open.feishu.cn/open-apis/application/v7/applications/cli_one/config",
    );
    expect(configInit.method).toBe("PATCH");
    expect(configInit.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer t-abc",
    });
    expect(JSON.parse(configInit.body)).toEqual({
      callback: {
        callback_type: "webhook",
        request_url: "https://api.example.com/api/webhooks/feishu/cs-escalation-card",
        add_callbacks: ["card.action.trigger"],
      },
    });

    const [abilityUrl, abilityInit] = fetchMock.mock.calls[2];
    expect(abilityUrl).toBe(
      "https://open.feishu.cn/open-apis/application/v7/applications/cli_one/ability",
    );
    expect(abilityInit.method).toBe("PATCH");
    expect(abilityInit.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer t-abc",
    });
    expect(JSON.parse(abilityInit.body)).toEqual({
      bot: {
        enable: true,
        message_card_callback_url: "",
      },
    });

    const [versionsUrl, versionsInit] = fetchMock.mock.calls[3];
    expect(versionsUrl).toBe(
      "https://open.feishu.cn/open-apis/application/v6/applications/cli_one/app_versions?lang=zh_cn&page_size=20",
    );
    expect(versionsInit).toEqual(
      expect.objectContaining({ headers: { Authorization: "Bearer t-abc" } }),
    );

    const [publishUrl, publishInit] = fetchMock.mock.calls[4];
    expect(publishUrl).toBe(
      "https://open.feishu.cn/open-apis/application/v7/applications/cli_one/publish",
    );
    expect(publishInit.method).toBe("POST");
    expect(JSON.parse(publishInit.body)).toEqual({
      mobile_default_ability: "bot",
      pc_default_ability: "bot",
      remark: "Enable RivonClaw customer-service card callback",
      changelog: "Route customer-service card actions to RivonClaw backend",
      version: "1.0.4",
    });

    expect(fetchMock.mock.calls[5][0]).toBe(
      "https://open.feishu.cn/open-apis/application/v6/applications/cli_one?lang=zh_cn",
    );
  });

  it("increments the highest semantic application version", () => {
    expect(nextFeishuApplicationVersion(["1.0.3", "2.4.8", "2.4.10", "draft"])).toBe("2.4.11");
  });

  it("does not accept an HTTP-200 API error as configured", async () => {
    mockFetch(jsonResponse(TOKEN_OK), jsonResponse({ code: 99991663, msg: "permission denied" }));

    await expect(
      configureFeishuCardActionCallback({
        appId: "cli_one",
        appSecret: "secret_one",
        domain: "feishu",
        callbackUrl: "https://api.example.com/callback",
      }),
    ).rejects.toThrow(/code=99991663 msg=permission denied/);
  });

  it("surfaces the one-click permission URL for the required application scope", async () => {
    mockFetch(
      jsonResponse(TOKEN_OK),
      jsonResponse({
        code: 99991672,
        msg: "Access denied. Required: application:application:patch",
      }),
    );

    const request = configureFeishuCardActionCallback({
      appId: "cli_one",
      appSecret: "secret_one",
      domain: "feishu",
      callbackUrl: "https://api.example.com/callback",
    });

    await expect(request).rejects.toBeInstanceOf(FeishuCallbackPermissionRequiredError);
    await expect(request).rejects.toMatchObject({
      appId: "cli_one",
      permissionUrl: getFeishuCallbackPermissionUrl({ appId: "cli_one", domain: "feishu" }),
    });
    const permissionUrl = new URL(
      getFeishuCallbackPermissionUrl({ appId: "cli_one", domain: "feishu" }),
    );
    expect(permissionUrl.searchParams.get("q")).toBe("application:application:patch");
    expect(permissionUrl.searchParams.get("token_type")).toBe("tenant");
  });

  it("surfaces the permission URL when Feishu returns the scope error with HTTP 400", async () => {
    mockFetch(
      jsonResponse(TOKEN_OK),
      jsonResponse(
        {
          code: 99991672,
          msg: "Access denied. Required: application:application:patch",
        },
        400,
      ),
    );

    await expect(
      configureFeishuCardActionCallback({
        appId: "cli_one",
        appSecret: "secret_one",
        domain: "feishu",
        callbackUrl: "https://api.example.com/callback",
      }),
    ).rejects.toMatchObject({
      name: "FeishuCallbackPermissionRequiredError",
      appId: "cli_one",
      permissionUrl: getFeishuCallbackPermissionUrl({ appId: "cli_one", domain: "feishu" }),
    });
  });
});
