import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readExistingConfig = vi.fn();

vi.mock("@rivonclaw/gateway", () => ({
  resolveOpenClawConfigPath: () => "/tmp/openclaw.json",
  readExistingConfig,
}));

const {
  getFeishuTenantAccessToken,
  patchFeishuCardMessage,
  resetFeishuTokenCacheForTests,
  resolveFeishuAccountCredentials,
  resolveFeishuReceiveIdType,
  sendFeishuTextMessage,
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

describe("resolveFeishuReceiveIdType", () => {
  it("maps the id prefix the same way the vendored plugin does", () => {
    expect(resolveFeishuReceiveIdType("oc_chat")).toBe("chat_id");
    expect(resolveFeishuReceiveIdType("ou_staff")).toBe("open_id");
    expect(resolveFeishuReceiveIdType("7213-legacy")).toBe("user_id");
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

describe("patchFeishuCardMessage", () => {
  it("PATCHes the card as a JSON string on the message path", async () => {
    const fetchMock = mockFetch(jsonResponse(TOKEN_OK), jsonResponse({ code: 0, msg: "success" }));
    const card = { config: { update_multi: true }, header: { template: "green" } };

    await patchFeishuCardMessage({ accountId: "account-1", messageId: "om_card", card });

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("https://open.feishu.cn/open-apis/im/v1/messages/om_card");
    expect(init.method).toBe("PATCH");
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer t-abc",
    });
    expect(JSON.parse(init.body)).toEqual({ content: JSON.stringify(card) });
  });

  it("treats a non-zero code in a 200 response as a failure", async () => {
    mockFetch(
      jsonResponse(TOKEN_OK),
      jsonResponse({ code: 232013, msg: "message can not be updated" }),
    );

    await expect(
      patchFeishuCardMessage({ accountId: "account-1", messageId: "om_card", card: {} }),
    ).rejects.toThrow(/code=232013 msg=message can not be updated/);
  });

  it("surfaces a transport-level failure", async () => {
    mockFetch(jsonResponse(TOKEN_OK), jsonResponse({ code: 0 }, 502));

    await expect(
      patchFeishuCardMessage({ accountId: "account-1", messageId: "om_card", card: {} }),
    ).rejects.toThrow(/HTTP 502/);
  });
});

describe("sendFeishuTextMessage", () => {
  it("derives receive_id_type from an oc_-prefixed chat id", async () => {
    const fetchMock = mockFetch(jsonResponse(TOKEN_OK), jsonResponse({ code: 0 }));

    await sendFeishuTextMessage({
      accountId: "account-1",
      receiveId: "oc_chat",
      text: "Response submitted successfully.",
    });

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id");
    expect(JSON.parse(init.body)).toEqual({
      receive_id: "oc_chat",
      msg_type: "text",
      content: JSON.stringify({ text: "Response submitted successfully." }),
    });
  });

  it("uses open_id for an ou_-prefixed operator id", async () => {
    const fetchMock = mockFetch(jsonResponse(TOKEN_OK), jsonResponse({ code: 0 }));

    await sendFeishuTextMessage({ accountId: "account-1", receiveId: "ou_staff", text: "hi" });

    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id",
    );
  });

  it("bounds every request so a hung Feishu call cannot stall the caller", async () => {
    const fetchMock = mockFetch(jsonResponse(TOKEN_OK), jsonResponse({ code: 0 }));

    await patchFeishuCardMessage({ accountId: "account-1", messageId: "om_1", card: { a: 1 } });

    // The processor releases its per-card `inflight` key in a `finally`, so an unbounded
    // request would leave that card permanently unsubmittable.
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("reports a timed-out request as a plain error, not a bare DOMException", async () => {
    const timeout = Object.assign(new Error("The operation was aborted due to timeout"), {
      name: "TimeoutError",
    });
    const fetchMock = vi.fn().mockRejectedValue(timeout);
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      patchFeishuCardMessage({ accountId: "account-1", messageId: "om_1", card: { a: 1 } }),
    ).rejects.toThrow(/timed out after \d+ms/);
  });
});
