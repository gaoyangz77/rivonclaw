import { randomUUID } from "node:crypto";
import { createLogger } from "@rivonclaw/logger";
import { openClawConnector } from "../openclaw/index.js";
import { rootStore } from "../app/store/desktop-store.js";
import { requestAgent } from "./agent-tooling-readiness.js";

const log = createLogger("structured-one-shot-agent");
const DEFAULT_TIMEOUT_MS = 120_000;

type ChatHistoryMessage = Record<string, unknown>;

export interface StructuredOneShotAgentRuntime {
  resolveDefaultModel(sessionKey: string): { provider: string; model: string };
  start(input: Record<string, unknown>): Promise<{ runId?: string }>;
  wait(runId: string, timeoutMs: number): Promise<{ status?: string; error?: unknown }>;
  history(sessionKey: string): Promise<{ messages?: ChatHistoryMessage[] }>;
  deleteSession(sessionKey: string): Promise<unknown>;
}

export interface StructuredOneShotAgentOptions<T> {
  namespace: string;
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: Record<string, unknown>;
  validate(value: unknown): T;
  timeoutMs?: number;
  allowFormatRepair?: boolean;
}

export interface StructuredOneShotAgentResult<T> {
  value: T;
  provider: string;
  model: string;
  runIds: string[];
  repaired: boolean;
  durationMs: number;
}

const defaultRuntime: StructuredOneShotAgentRuntime = {
  resolveDefaultModel(sessionKey) {
    return rootStore.llmManager.resolveModelForDispatch(sessionKey);
  },
  start(input) {
    return requestAgent<{ runId?: string }>(input);
  },
  wait(runId, timeoutMs) {
    return openClawConnector.request("agent.wait", { runId, timeoutMs });
  },
  history(sessionKey) {
    return openClawConnector.request("chat.history", {
      sessionKey,
      limit: 20,
      maxChars: 80_000,
    });
  },
  deleteSession(sessionKey) {
    return openClawConnector.request("sessions.delete", {
      key: sessionKey,
      deleteTranscript: true,
      emitLifecycleHooks: false,
    });
  },
};

export async function runStructuredOneShotAgent<T>(
  options: StructuredOneShotAgentOptions<T>,
  runtime: StructuredOneShotAgentRuntime = defaultRuntime,
): Promise<StructuredOneShotAgentResult<T>> {
  const startedAt = Date.now();
  const sessionKey = `agent:utility:${sanitizeNamespace(options.namespace)}:${randomUUID()}`;
  const resolvedModel = runtime.resolveDefaultModel(sessionKey);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runIds: string[] = [];

  try {
    const firstText = await runOneShotTurn({
      runtime,
      sessionKey,
      resolvedModel,
      timeoutMs,
      systemPrompt: structuredSystemPrompt(options.systemPrompt, options.jsonSchema),
      message: options.userPrompt,
      idempotencyKey: `${sessionKey}:initial`,
      runIds,
    });
    try {
      return result(options.validate(parseJson(firstText)), false);
    } catch (firstError) {
      if (options.allowFormatRepair === false) throw firstError;
      const repairedText = await runOneShotTurn({
        runtime,
        sessionKey,
        resolvedModel,
        timeoutMs,
        systemPrompt: structuredSystemPrompt(options.systemPrompt, options.jsonSchema),
        message: [
          "Your previous response did not satisfy the required JSON contract.",
          "Return a corrected JSON object only. Do not explain the correction.",
          `Validation error: ${errorMessage(firstError)}`,
        ].join("\n"),
        idempotencyKey: `${sessionKey}:repair`,
        runIds,
      });
      return result(options.validate(parseJson(repairedText)), true);
    }
  } finally {
    await runtime.deleteSession(sessionKey).catch((error) => {
      log.warn(
        `Failed to delete one-shot session namespace=${options.namespace}: ${errorMessage(error)}`,
      );
    });
  }

  function result(value: T, wasRepaired: boolean): StructuredOneShotAgentResult<T> {
    const durationMs = Date.now() - startedAt;
    log.info(
      `Structured one-shot completed namespace=${options.namespace} model=${resolvedModel.provider}/${resolvedModel.model} turns=${runIds.length} repaired=${wasRepaired} durationMs=${durationMs}`,
    );
    return {
      value,
      provider: resolvedModel.provider,
      model: resolvedModel.model,
      runIds,
      repaired: wasRepaired,
      durationMs,
    };
  }
}

async function runOneShotTurn(input: {
  runtime: StructuredOneShotAgentRuntime;
  sessionKey: string;
  resolvedModel: { provider: string; model: string };
  timeoutMs: number;
  systemPrompt: string;
  message: string;
  idempotencyKey: string;
  runIds: string[];
}): Promise<string> {
  const response = await input.runtime.start({
    sessionKey: input.sessionKey,
    provider: input.resolvedModel.provider,
    model: input.resolvedModel.model,
    message: input.message,
    extraSystemPrompt: input.systemPrompt,
    modelRun: true,
    fastMode: true,
    promptMode: "raw",
    deliver: false,
    idempotencyKey: input.idempotencyKey,
  });
  if (!response.runId) throw new Error("Structured one-shot Agent run was not accepted");
  input.runIds.push(response.runId);
  const wait = await input.runtime.wait(response.runId, input.timeoutMs);
  if (wait.status !== "ok") {
    throw new Error(
      wait.status === "timeout"
        ? "Structured one-shot Agent timed out"
        : `Structured one-shot Agent ended with status ${wait.status ?? "unknown"}`,
    );
  }
  const history = await input.runtime.history(input.sessionKey);
  const text = latestAssistantText(history.messages ?? []);
  if (!text) throw new Error("Structured one-shot Agent produced no visible output");
  return text;
}

function structuredSystemPrompt(
  useCasePrompt: string,
  jsonSchema: Record<string, unknown>,
): string {
  return [
    "You are a one-shot structured-output generator running on the user's current Desktop default model.",
    "Do not call tools. Do not emit Markdown or commentary.",
    "Return exactly one JSON object that conforms to the supplied JSON Schema.",
    useCasePrompt,
    `JSON Schema: ${JSON.stringify(jsonSchema)}`,
  ].join("\n");
}

function parseJson(text: string): unknown {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();
  if (!unfenced.startsWith("{") || !unfenced.endsWith("}")) {
    throw new Error("Model output must contain exactly one JSON object");
  }
  return JSON.parse(unfenced);
}

function latestAssistantText(messages: ChatHistoryMessage[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "assistant") continue;
    if (typeof message.text === "string" && message.text.trim()) {
      return message.text.trim();
    }
    if (!Array.isArray(message.content)) continue;
    const chunks = message.content
      .map((block) =>
        block && typeof block === "object" && typeof (block as { text?: unknown }).text === "string"
          ? String((block as { text: string }).text)
          : "",
      )
      .filter(Boolean);
    if (chunks.length) return chunks.join("\n").trim();
  }
  return undefined;
}

function sanitizeNamespace(value: string): string {
  const normalized = value.toLocaleLowerCase().replace(/[^a-z0-9_-]+/gu, "-");
  return normalized.replace(/^-+|-+$/gu, "").slice(0, 48) || "structured";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
