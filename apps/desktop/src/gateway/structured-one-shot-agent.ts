import { randomUUID } from "node:crypto";
import { DEFAULT_AGENT_ID } from "@rivonclaw/core/node";
import { createLogger } from "@rivonclaw/logger";
import { openClawConnector } from "../openclaw/index.js";
import { rootStore } from "../app/store/desktop-store.js";

const log = createLogger("structured-one-shot-agent");
const DEFAULT_TIMEOUT_MS = 120_000;
const AGENT_WAIT_TRANSPORT_GRACE_MS = 5_000;
const MAX_REPAIR_OUTPUT_CHARS = 60_000;
const MAX_REPAIR_CONTEXT_CHARS = 40_000;

type ChatHistoryMessage = Record<string, unknown>;
type TerminalReply =
  | { disposition: "visible"; text: string }
  | { disposition: "silent" | "empty" };

export interface StructuredOneShotAgentRuntime {
  resolveDefaultModel(sessionKey: string): { provider: string; model: string };
  start(input: Record<string, unknown>): Promise<{ runId?: string }>;
  wait(
    runId: string,
    timeoutMs: number,
  ): Promise<{ status?: string; error?: unknown; terminalReply?: TerminalReply }>;
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
    // Structured one-shot work is a raw model run. Going through requestAgent()
    // would unnecessarily wait for the interactive Agent tool catalog even
    // though modelRun disables tool construction in the gateway.
    return openClawConnector.request<{ runId?: string }>("agent", input);
  },
  wait(runId, timeoutMs) {
    // agent.wait is a long-polling RPC. Its transport deadline must outlive the
    // server-side wait; otherwise the RPC client's 30s default rejects first,
    // session cleanup aborts the still-running model request, and a healthy
    // one-shot run is reported as a generation failure.
    return openClawConnector.request(
      "agent.wait",
      { runId, timeoutMs },
      timeoutMs + AGENT_WAIT_TRANSPORT_GRACE_MS,
    );
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
  // The second session-key segment is an OpenClaw agent id, not a workload
  // label. One-shot workloads still run through the configured default agent;
  // modelRun + promptMode=raw are what remove tools and the normal system
  // prompt. Using a synthetic id such as "utility" makes the gateway reject
  // the request when no agent with that id is configured.
  const sessionKey =
    `agent:${DEFAULT_AGENT_ID}:model-run:${sanitizeNamespace(options.namespace)}:${randomUUID()}`;
  const repairSessionKey = `${sessionKey}:format-repair`;
  const resolvedModel = runtime.resolveDefaultModel(sessionKey);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runIds: string[] = [];
  const createdSessionKeys = new Set([sessionKey]);

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
      return result(options.validate(parseJson(firstText, options.jsonSchema)), false);
    } catch (firstError) {
      if (options.allowFormatRepair === false) throw firstError;
      log.warn(
        `Structured one-shot initial output failed validation namespace=${options.namespace} initialError=${errorMessage(firstError)}`,
      );
      createdSessionKeys.add(repairSessionKey);
      const repairedText = await runOneShotTurn({
        runtime,
        sessionKey: repairSessionKey,
        resolvedModel,
        timeoutMs,
        systemPrompt: structuredSystemPrompt(options.systemPrompt, options.jsonSchema),
        message: structuredRepairPrompt({
          originalUserPrompt: options.userPrompt,
          invalidOutput: firstText,
          validationError: errorMessage(firstError),
          jsonSchema: options.jsonSchema,
        }),
        idempotencyKey: `${sessionKey}:repair`,
        runIds,
      });
      try {
        return result(options.validate(parseJson(repairedText, options.jsonSchema)), true);
      } catch (repairError) {
        log.warn(
          `Structured one-shot repair failed namespace=${options.namespace} initialError=${errorMessage(firstError)} repairError=${errorMessage(repairError)}`,
        );
        throw repairError;
      }
    }
  } finally {
    await Promise.all(
      [...createdSessionKeys].map((createdSessionKey) =>
        runtime.deleteSession(createdSessionKey).catch((error) => {
          log.warn(
            `Failed to delete one-shot session namespace=${options.namespace}: ${errorMessage(error)}`,
          );
        }),
      ),
    );
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
  // Raw model runs intentionally use internal session effects, so their reply
  // is not required to appear in chat.history. agent.wait.terminalReply is the
  // producer-owned terminal result and is therefore the authoritative output
  // path. Keep history only as a compatibility fallback for older gateways.
  if (wait.terminalReply?.disposition === "visible" && wait.terminalReply.text.trim()) {
    return wait.terminalReply.text;
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
  const rootType = schemaRootType(jsonSchema);
  return [
    "You are a one-shot structured-output generator running on the user's current Desktop default model.",
    "Do not call tools. Do not emit Markdown or commentary.",
    `Return exactly one JSON ${rootType} that conforms to the supplied JSON Schema.`,
    `The top-level value MUST be a JSON ${rootType}.`,
    "Include every property listed in every required array, including nested required properties.",
    `Your entire response must be the JSON ${rootType}; do not acknowledge these instructions.`,
    useCasePrompt,
    `JSON Schema: ${JSON.stringify(jsonSchema)}`,
  ].join("\n");
}

function structuredRepairPrompt(input: {
  originalUserPrompt: string;
  invalidOutput: string;
  validationError: string;
  jsonSchema: Record<string, unknown>;
}): string {
  const rootType = schemaRootType(input.jsonSchema);
  const invalidOutput =
    input.invalidOutput.length <= MAX_REPAIR_OUTPUT_CHARS
      ? input.invalidOutput
      : input.invalidOutput.slice(0, MAX_REPAIR_OUTPUT_CHARS);
  const originalUserPrompt =
    input.originalUserPrompt.length <= MAX_REPAIR_CONTEXT_CHARS
      ? input.originalUserPrompt
      : input.originalUserPrompt.slice(0, MAX_REPAIR_CONTEXT_CHARS);
  return [
    "Repair the previous model output into the required structured payload.",
    "Do not acknowledge the error and do not describe the correction.",
    `Return the COMPLETE corrected JSON ${rootType} only.`,
    `The top-level value MUST be a JSON ${rootType}.`,
    "Preserve useful content from the previous output, but add or correct every required property.",
    "Use the original task input below as the factual source. Do not replace it with generic placeholder content.",
    `Validation error: ${input.validationError}`,
    `Required JSON Schema: ${JSON.stringify(input.jsonSchema)}`,
    "Original task input:",
    originalUserPrompt,
    "Previous invalid output:",
    invalidOutput,
  ].join("\n");
}

function parseJson(text: string, jsonSchema: Record<string, unknown>): unknown {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();
  const rootType = schemaRootType(jsonSchema);
  const hasExpectedDelimiters =
    rootType === "array"
      ? unfenced.startsWith("[") && unfenced.endsWith("]")
      : unfenced.startsWith("{") && unfenced.endsWith("}");
  if (!hasExpectedDelimiters) {
    throw new Error(`Model output must contain exactly one JSON ${rootType}`);
  }
  const parsed = JSON.parse(unfenced);
  if (
    (rootType === "array" && !Array.isArray(parsed)) ||
    (rootType === "object" && (!parsed || typeof parsed !== "object" || Array.isArray(parsed)))
  ) {
    throw new Error(`Model output root must be a JSON ${rootType}`);
  }
  return parsed;
}

function schemaRootType(jsonSchema: Record<string, unknown>): "object" | "array" {
  return jsonSchema.type === "array" ? "array" : "object";
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
