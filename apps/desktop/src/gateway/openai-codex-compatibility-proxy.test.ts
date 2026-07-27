import { afterEach, describe, expect, it, vi } from "vitest";
import {
  adaptOpenAICodexRequestForResponsesLite,
  OPENAI_CODEX_COMPATIBILITY_CLIENT_VERSION,
  OPENAI_CODEX_COMPATIBILITY_ORIGINATOR,
  OpenAICodexCompatibilityProxy,
} from "./openai-codex-compatibility-proxy.js";

describe("OpenAICodexCompatibilityProxy", () => {
  let proxy: OpenAICodexCompatibilityProxy | undefined;

  afterEach(async () => {
    await proxy?.stop();
    proxy = undefined;
  });

  it("forwards only the fixed Codex endpoint with a versioned client identity", async () => {
    const fetchFn = vi.fn(
      async (_url: string | URL, _init?: RequestInit) =>
        new Response('data: {"type":"response.completed"}\n\n', {
          status: 200,
          headers: {
            "content-type": "text/event-stream",
            "x-upstream": "kept",
          },
        }),
    );
    proxy = new OpenAICodexCompatibilityProxy({ fetchFn });
    await proxy.start();

    const baseUrl = proxy.getBaseUrl();
    expect(baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    const response = await fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "chatgpt-account-id": "acct-test",
        originator: "openclaw",
        "user-agent": "openclaw (test)",
        "x-client-request-id": "request-test",
      },
      body: JSON.stringify({ model: "gpt-5.6-terra" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-upstream")).toBe("kept");
    expect(await response.text()).toContain("response.completed");
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://chatgpt.com/backend-api/codex/responses");
    const body = init?.body;
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(JSON.parse((body as Buffer).toString("utf8"))).toMatchObject({
      model: "gpt-5.6-terra",
      input: [{ type: "additional_tools", role: "developer", tools: [] }],
      parallel_tool_calls: false,
    });
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer test-token");
    expect(headers.get("chatgpt-account-id")).toBe("acct-test");
    expect(headers.get("x-client-request-id")).toBe("request-test");
    expect(headers.get("originator")).toBe(OPENAI_CODEX_COMPATIBILITY_ORIGINATOR);
    expect(headers.get("version")).toBe(OPENAI_CODEX_COMPATIBILITY_CLIENT_VERSION);
    expect(headers.get("x-openai-internal-codex-responses-lite")).toBe("true");
    expect(headers.get("user-agent")).toContain(
      `${OPENAI_CODEX_COMPATIBILITY_ORIGINATOR}/${OPENAI_CODEX_COMPATIBILITY_CLIENT_VERSION}`,
    );
    expect(headers.get("user-agent")).toContain(
      `(codex_exec; ${OPENAI_CODEX_COMPATIBILITY_CLIENT_VERSION})`,
    );
    expect(headers.get("accept-encoding")).toBe("identity");
  });

  it("projects full Responses requests into the GPT-5.6 Responses Lite shape", () => {
    expect(
      adaptOpenAICodexRequestForResponsesLite(
        {
          model: "gpt-5.6-terra",
          instructions: "Be concise.",
          input: [{ type: "message", role: "user", content: [] }],
          tools: [{ type: "function", name: "lookup" }],
          reasoning: { effort: "high", summary: "auto" },
          max_output_tokens: 32_000,
          parallel_tool_calls: true,
          stream: true,
        },
        "session-test",
      ),
    ).toEqual({
      model: "gpt-5.6-terra",
      input: [
        {
          type: "additional_tools",
          role: "developer",
          tools: [{ type: "function", name: "lookup" }],
        },
        {
          type: "message",
          role: "developer",
          content: [{ type: "input_text", text: "Be concise." }],
        },
        { type: "message", role: "user", content: [] },
      ],
      reasoning: { effort: "high", context: "all_turns" },
      parallel_tool_calls: false,
      stream: true,
      client_metadata: {
        session_id: "session-test",
        thread_id: "session-test",
        "x-codex-window-id": "session-test:0",
      },
    });
  });

  it("does not expose a general-purpose reverse proxy", async () => {
    const fetchFn = vi.fn(async () => new Response("unexpected"));
    proxy = new OpenAICodexCompatibilityProxy({ fetchFn });
    await proxy.start();

    const response = await fetch(`${proxy.getBaseUrl()}/https://example.com`, {
      method: "POST",
    });

    expect(response.status).toBe(404);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
