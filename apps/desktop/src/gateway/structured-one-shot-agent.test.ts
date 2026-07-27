import { describe, expect, it, vi } from "vitest";
import {
  runStructuredOneShotAgent,
  type StructuredOneShotAgentRuntime,
} from "./structured-one-shot-agent.js";

function runtimeFor(outputs: string[]): {
  runtime: StructuredOneShotAgentRuntime;
  start: ReturnType<typeof vi.fn>;
  deleteSession: ReturnType<typeof vi.fn>;
} {
  let turn = 0;
  const start = vi.fn(async () => ({ runId: `run-${turn += 1}` }));
  const deleteSession = vi.fn(async () => undefined);
  const runtime: StructuredOneShotAgentRuntime = {
    resolveDefaultModel: vi.fn(() => ({
      provider: "user-default-provider",
      model: "user-default-model",
    })),
    start,
    wait: vi.fn(async () => ({ status: "ok" })),
    history: vi.fn(async () => ({
      messages: [
        {
          role: "assistant",
          content: [{ type: "text", text: outputs[Math.max(0, turn - 1)] }],
        },
      ],
    })),
    deleteSession,
  };
  return { runtime, start, deleteSession };
}

function validateName(value: unknown): { name: string } {
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as { name?: unknown }).name !== "string"
  ) {
    throw new Error("name is required");
  }
  return { name: (value as { name: string }).name };
}

describe("runStructuredOneShotAgent", () => {
  it("uses the user's resolved default model and cleans up the temporary session", async () => {
    const { runtime, start, deleteSession } = runtimeFor(['{"name":"ready"}']);

    const result = await runStructuredOneShotAgent(
      {
        namespace: "campaign-keywords",
        systemPrompt: "Generate a test object.",
        userPrompt: "Generate it now.",
        jsonSchema: {
          type: "object",
          required: ["name"],
          properties: { name: { type: "string" } },
          additionalProperties: false,
        },
        validate: validateName,
      },
      runtime,
    );

    expect(result.value).toEqual({ name: "ready" });
    expect(result.provider).toBe("user-default-provider");
    expect(result.model).toBe("user-default-model");
    expect(result.repaired).toBe(false);
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "user-default-provider",
        model: "user-default-model",
        modelRun: true,
        promptMode: "raw",
        deliver: false,
      }),
    );
    expect(deleteSession).toHaveBeenCalledTimes(1);
  });

  it("runs one schema repair turn when the first response is invalid", async () => {
    const { runtime, start, deleteSession } = runtimeFor([
      "not-json",
      '```json\n{"name":"repaired"}\n```',
    ]);

    const result = await runStructuredOneShotAgent(
      {
        namespace: "campaign-keywords",
        systemPrompt: "Generate a test object.",
        userPrompt: "Generate it now.",
        jsonSchema: {
          type: "object",
          required: ["name"],
          properties: { name: { type: "string" } },
          additionalProperties: false,
        },
        validate: validateName,
      },
      runtime,
    );

    expect(result.value).toEqual({ name: "repaired" });
    expect(result.repaired).toBe(true);
    expect(start).toHaveBeenCalledTimes(2);
    expect(start.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        message: expect.stringContaining("did not satisfy the required JSON contract"),
      }),
    );
    expect(deleteSession).toHaveBeenCalledTimes(1);
  });

  it("fails closed after one unsuccessful repair and still deletes the session", async () => {
    const { runtime, start, deleteSession } = runtimeFor(["{}", "{}"]);

    await expect(
      runStructuredOneShotAgent(
        {
          namespace: "campaign-keywords",
          systemPrompt: "Generate a test object.",
          userPrompt: "Generate it now.",
          jsonSchema: {
            type: "object",
            required: ["name"],
            properties: { name: { type: "string" } },
            additionalProperties: false,
          },
          validate: validateName,
        },
        runtime,
      ),
    ).rejects.toThrow("name is required");

    expect(start).toHaveBeenCalledTimes(2);
    expect(deleteSession).toHaveBeenCalledTimes(1);
  });
});
