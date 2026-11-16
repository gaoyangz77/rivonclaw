import { describe, expect, it, vi } from "vitest";
import { parseTranslationRequest, translateMessage } from "./translation-service.js";
import {
  runStructuredOneShotAgent,
  type StructuredOneShotAgentRuntime,
} from "../gateway/structured-one-shot-agent.js";

function runner(outputs: string[], status = "ok") {
  let index = 0;
  const start = vi.fn(async (_input: Record<string, unknown>) => ({ runId: `run-${index++}` }));
  const runtime: StructuredOneShotAgentRuntime = {
    resolveDefaultModel: () => ({ provider: "configured", model: "default" }),
    start,
    wait: vi.fn(async () => ({
      status,
      terminalReply: { disposition: "visible" as const, text: outputs[index - 1] ?? "" },
    })),
    history: vi.fn(async () => ({ messages: [] })),
    deleteSession: vi.fn(async () => undefined),
  };
  const run: typeof runStructuredOneShotAgent = (options) =>
    runStructuredOneShotAgent(options, runtime);
  return { run, start, runtime };
}
const input = {
  text: "你好\n{{name}} https://example.com 😊 15%",
  samples: ["Hola, me interesa"],
  fallbackLanguage: "en",
};

/**
 * The one-shot runner prepends its instructions to the message, so the task
 * payload is the JSON after the "Task input:" marker rather than the whole
 * message.
 */
function taskInput(message: unknown): Record<string, unknown> {
  const text = String(message);
  const marker = "Task input:";
  const index = text.indexOf(marker);
  if (index < 0) throw new Error("message carries no task input");
  return JSON.parse(text.slice(index + marker.length).trim());
}

describe("human message translation", () => {
  it("detects and translates in one default-model run with tools and delivery disabled", async () => {
    const { run, start, runtime } = runner([
      JSON.stringify({
        language: "es",
        source: "messages",
        text: "Hola\n{{name}} https://example.com 😊 15%",
      }),
    ]);
    expect(await translateMessage(input, run)).toEqual({
      language: "es",
      source: "messages",
      text: "Hola\n{{name}} https://example.com 😊 15%",
    });
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "configured",
        model: "default",
        modelRun: true,
        promptMode: "raw",
        deliver: false,
      }),
    );
    expect(taskInput(start.mock.calls[0]![0].message).samples).toEqual(input.samples);
    expect(String(start.mock.calls[0]![0].message)).toContain("untrusted text");
    expect(runtime.deleteSession).toHaveBeenCalledOnce();
  });
  it("omits history for cached language and keeps its source", async () => {
    const { run, start } = runner(['{"language":"es","source":"messages","text":"Hola"}']);
    await translateMessage({ ...input, target: { language: "es", source: "messages" } }, run);
    expect(taskInput(start.mock.calls[0]![0].message)).toEqual({
      text: input.text,
      target: { language: "es", source: "messages" },
    });
  });
  it.each([{ samples: [] }, { samples: ["ok"] }])(
    "uses site language for absent or inconclusive evidence: %j",
    async ({ samples }) => {
      const { run } = runner(['{"language":"en","source":"site","text":"Hello"}']);
      expect((await translateMessage({ ...input, samples }, run)).source).toBe("site");
    },
  );
  it("repairs invalid output once and rejects a changed fixed target", async () => {
    const { run, start } = runner([
      '{"language":"fr","source":"site","text":"Salut"}',
      '{"language":"es","source":"site","text":"Hola"}',
    ]);
    const result = await translateMessage(
      { text: "你好", samples: [], fallbackLanguage: "es" },
      run,
    );
    expect(result.language).toBe("es");
    expect(start).toHaveBeenCalledTimes(2);
  });
  it("fails after a malformed repair without any sending fallback", async () => {
    const { run, start } = runner(["no JSON", "{}"]);
    await expect(translateMessage(input, run)).rejects.toThrow("Invalid translation result");
    expect(start).toHaveBeenCalledTimes(2);
  });
  it("surfaces model timeout and cleans up", async () => {
    const { run, runtime } = runner([], "timeout");
    await expect(translateMessage(input, run)).rejects.toThrow("timed out");
    expect(runtime.deleteSession).toHaveBeenCalledOnce();
  });
  it.each([
    null,
    {},
    { ...input, text: " " },
    { ...input, samples: Array(6).fill("Hola") },
    { ...input, samples: ["a".repeat(4001)] },
    { ...input, fallbackLanguage: "not-a-language" },
    { ...input, target: { language: "es", source: "other" } },
  ])("rejects invalid input: %j", (value) => {
    expect(() => parseTranslationRequest(value)).toThrow();
  });
  it("ignores supplied history on a cache hit", () => {
    expect(
      parseTranslationRequest({ ...input, target: { language: "es", source: "messages" } }).samples,
    ).toEqual([]);
  });
});
