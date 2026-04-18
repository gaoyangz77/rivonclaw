import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { chatCompletion, type LLMConfig } from "./llm-client.js";

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;

const fakeLLMConfig: LLMConfig = {
  gatewayUrl: "http://127.0.0.1:18789",
  authToken: "test-auth-token",
};

function mockFetchResponse(
  body: unknown,
  status = 200,
  statusText = "OK",
): void {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("chatCompletion", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends correct request to the gateway", async () => {
    mockFetchResponse({
      choices: [{ message: { content: "Hello!" } }],
    });

    await chatCompletion(fakeLLMConfig, [
      { role: "system", content: "You are a helper." },
      { role: "user", content: "Say hello" },
    ]);

    const fetchFn = globalThis.fetch as ReturnType<typeof vi.fn>;
    expect(fetchFn).toHaveBeenCalledOnce();

    const [url, options] = fetchFn.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:18789/v1/chat/completions");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.headers.Authorization).toBe("Bearer test-auth-token");

    const body = JSON.parse(options.body);
    expect(body.model).toBe("openclaw");
    expect(body.temperature).toBe(0);
    expect(body.messages).toHaveLength(2);
  });

  it("returns content from a valid response", async () => {
    mockFetchResponse({
      choices: [{ message: { content: "The generated text" } }],
    });

    const result = await chatCompletion(fakeLLMConfig, [
      { role: "user", content: "test" },
    ]);

    expect(result.content).toBe("The generated text");
  });

  it("throws on HTTP error response", async () => {
    mockFetchResponse("Unauthorized", 401, "Unauthorized");

    await expect(
      chatCompletion(fakeLLMConfig, [{ role: "user", content: "test" }]),
    ).rejects.toThrow("Gateway LLM error: 401 Unauthorized");
  });

  it("throws on embedded OpenAI-format error in 200 response", async () => {
    mockFetchResponse({
      error: {
        type: "rate_limit_error",
        message: "Too many requests",
      },
    });

    await expect(
      chatCompletion(fakeLLMConfig, [{ role: "user", content: "test" }]),
    ).rejects.toThrow("Gateway LLM error: rate_limit_error — Too many requests");
  });

  it("throws when response is missing content", async () => {
    mockFetchResponse({
      choices: [{ message: {} }],
    });

    await expect(
      chatCompletion(fakeLLMConfig, [{ role: "user", content: "test" }]),
    ).rejects.toThrow("Gateway response missing content");
  });

  it("throws when choices array is empty", async () => {
    mockFetchResponse({ choices: [] });

    await expect(
      chatCompletion(fakeLLMConfig, [{ role: "user", content: "test" }]),
    ).rejects.toThrow("Gateway response missing content");
  });

  it("throws when choices is missing entirely", async () => {
    mockFetchResponse({});

    await expect(
      chatCompletion(fakeLLMConfig, [{ role: "user", content: "test" }]),
    ).rejects.toThrow("Gateway response missing content");
  });

  it("detects upstream provider errors forwarded as content", async () => {
    mockFetchResponse({
      choices: [
        {
          message: {
            content: "HTTP 401 authentication_error: invalid api key",
          },
        },
      ],
    });

    await expect(
      chatCompletion(fakeLLMConfig, [{ role: "user", content: "test" }]),
    ).rejects.toThrow("Gateway upstream error");
  });

  it("does not throw for normal content starting with HTTP", async () => {
    // Content starts with "HTTP" but doesn't match the error pattern
    mockFetchResponse({
      choices: [
        {
          message: {
            content: "HTTP is a protocol used for web communication.",
          },
        },
      ],
    });

    const result = await chatCompletion(fakeLLMConfig, [
      { role: "user", content: "What is HTTP?" },
    ]);

    // This should not throw because there's no "error" in the content
    // Actually, looking at the code: content.startsWith("HTTP ") && content.includes("error")
    // "HTTP is a protocol used for web communication." doesn't start with "HTTP "
    // Let's be more precise:
    expect(result.content).toBe("HTTP is a protocol used for web communication.");
  });

  it("throws when fetch itself rejects (network error)", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(
      chatCompletion(fakeLLMConfig, [{ role: "user", content: "test" }]),
    ).rejects.toThrow("Failed to fetch");
  });

  it("handles error with missing type field", async () => {
    mockFetchResponse({
      error: {
        message: "Something went wrong",
      },
    });

    await expect(
      chatCompletion(fakeLLMConfig, [{ role: "user", content: "test" }]),
    ).rejects.toThrow("Gateway LLM error: unknown — Something went wrong");
  });

  it("handles error with missing message field", async () => {
    mockFetchResponse({
      error: {
        type: "server_error",
      },
    });

    await expect(
      chatCompletion(fakeLLMConfig, [{ role: "user", content: "test" }]),
    ).rejects.toThrow("Gateway LLM error: server_error — unknown error");
  });
});
