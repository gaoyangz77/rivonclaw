import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readExistingConfig = vi.fn();

vi.mock("@rivonclaw/gateway", () => ({
  resolveOpenClawConfigPath: () => "/tmp/openclaw.json",
  readExistingConfig,
}));

const {
  getFeishuTenantAccessToken,
  patchFeishuMessageCardCallbackUrl,
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

describe("patchFeishuMessageCardCallbackUrl", () => {
  it("PATCHes the application ability with the Backend callback URL", async () => {
    const fetchMock = mockFetch(jsonResponse(TOKEN_OK), jsonResponse({ code: 0, msg: "success" }));

    await patchFeishuMessageCardCallbackUrl({
      appId: "cli_one",
      appSecret: "secret_one",
      domain: "feishu",
      callbackUrl: "https://api.example.com/api/webhooks/feishu/cs-escalation-card",
    });

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(
      "https://open.feishu.cn/open-apis/application/v7/applications/cli_one/ability",
    );
    expect(init.method).toBe("PATCH");
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer t-abc",
    });
    expect(JSON.parse(init.body)).toEqual({
      bot: {
        enable: true,
        message_card_callback_url: "https://api.example.com/api/webhooks/feishu/cs-escalation-card",
      },
    });
  });

  it("does not accept an HTTP-200 API error as configured", async () => {
    mockFetch(jsonResponse(TOKEN_OK), jsonResponse({ code: 99991663, msg: "permission denied" }));

    await expect(
      patchFeishuMessageCardCallbackUrl({
        appId: "cli_one",
        appSecret: "secret_one",
        domain: "feishu",
        callbackUrl: "https://api.example.com/callback",
      }),
    ).rejects.toThrow(/code=99991663 msg=permission denied/);
  });
});
