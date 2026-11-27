/**
 * Parity-golden generator for the Desktop customer-service (CS) agent inputs.
 *
 * Captures, from the real CustomerServiceSession code, exactly what Desktop sends to the
 * OpenClaw `agent` RPC: the raw-mode system prompt (`extraSystemPrompt`) and the user-turn
 * dispatch message. The backend agent runner must later reproduce these byte for byte.
 *
 * Contract: docs/SERVICES/agent-runner.md ("Parity goldens").
 *
 *   AGENT_GOLDENS_OUT=<dir> pnpm vitest run src/cs-bridge/__goldens__   -> writes <dir>/cs/<case>.json
 *   (no env)                                                            -> asserts regeneration is stable
 *
 * All fixture data is synthetic. Do not paste real shop prompts or buyer data here.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ─── Mocks (same boundary as customer-service-session.forwardText.test.ts) ──

vi.mock("@rivonclaw/logger", () => {
  const stubLogger = () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });
  return {
    createLogger: stubLogger,
    createQuietLogger: stubLogger,
    DEBUG_FLAGS: { PROXY: "DEBUG_PROXY", SECRETS: "DEBUG_SECRETS" },
    isDebugFlagEnabled: () => false,
  };
});

const mockRpcRequest = vi.fn();
vi.mock("../../openclaw/index.js", () => ({
  openClawConnector: {
    request: (...args: unknown[]) => mockRpcRequest(...args),
    ensureRpcReady: () => ({ request: mockRpcRequest, isConnected: () => true }),
  },
}));

const mockGraphqlFetch = vi.fn();
const { mockGetAuthSession } = vi.hoisted(() => ({ mockGetAuthSession: vi.fn() }));
vi.mock("../../auth/session-ref.js", () => ({ getAuthSession: mockGetAuthSession }));

vi.mock("../../app/storage-ref.js", () => ({ getStorageRef: () => null }));

const stagingFlag = vi.hoisted(() => ({ value: false }));
vi.mock("@rivonclaw/core/endpoints", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@rivonclaw/core/endpoints");
  return { ...actual, isStagingDevMode: () => stagingFlag.value };
});

vi.mock("../../telemetry/cs-telemetry-ref.js", () => ({
  emitCsTelemetry: vi.fn(),
  emitCsError: vi.fn(),
  emitCsDeliveryRecovery: vi.fn(),
  emitCsDispatchEvent: vi.fn(),
  emitCsEscalationEvent: vi.fn(),
  emitCsSessionEvent: vi.fn(),
  CS_ERROR_STAGE: {
    DELIVER: "deliver",
    SANITIZE: "sanitize",
    RUN_ERROR: "run_error",
    DISPATCH: "dispatch",
    BACKEND_SESSION: "backend_session",
    SETUP: "setup",
    CONTEXT_RESOLUTION: "context_resolution",
    IMAGE_INGEST: "image_ingest",
    ESCALATE: "escalate",
    RELAY_CONNECT: "relay_connect",
    SHOP_BIND_REJECTED: "shop_bind_rejected",
  },
}));

const cursorState = vi.hoisted(() => ({
  value: null as null | { messageId: string; messageIndex: string; createTime: number },
}));
vi.mock("../cs-session-cursor-store.js", () => ({
  readOpenClawSessionCursor: vi.fn(async () => cursorState.value),
  advanceOpenClawSessionCursor: vi.fn(async () => undefined),
  compareMessageCursor: vi.fn(() => 0),
}));

vi.mock("../../utils/openclaw-session-anchor.js", () => ({
  readLatestUserSessionAnchor: vi.fn(async () => null),
}));

vi.mock("../../infra/proxy/proxy-aware-network.js", () => ({
  proxyNetwork: {
    fetch: vi.fn(
      async () =>
        new Response(new Uint8Array([1, 2, 3, 4]), {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
    ),
  },
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import {
  CustomerServiceSession,
  type CSContext,
  type CSShopContext,
} from "../customer-service-session.js";
import type { CsAgentDispatchReason } from "../cs-agent-dispatch-resolver.js";
import { rootStore } from "../../app/store/desktop-store.js";

// ─── Golden plumbing ────────────────────────────────────────────────────────

const AREA = "cs";
const BUILDER_FILE = "apps/desktop/src/cs-bridge/customer-service-session.ts";
const FROZEN_NOW = new Date("2026-03-01T08:00:00.000Z");
const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");

interface GoldenCase {
  case: string;
  file: string;
  input: unknown;
  output: unknown;
}

function rootCommit(): string {
  return execFileSync("git", ["-C", ROOT_DIR, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

function serialize(c: GoldenCase, commit: string): string {
  return (
    JSON.stringify(
      {
        schemaVersion: 1,
        source: { repo: "root", commit, file: c.file },
        case: c.case,
        input: c.input,
        output: c.output,
      },
      null,
      2,
    ) + "\n"
  );
}

// ─── Synthetic fixtures ─────────────────────────────────────────────────────

const SHOP_PROMPT = [
  "You are Mira, the customer-service assistant for Lumen Candle Co., a synthetic demo shop.",
  "Be warm and concise. Shipping takes 3-5 business days. Returns are accepted within 14 days.",
  "Never offer discounts above 10% without manager approval.",
].join("\n");

function shop(overrides: Partial<CSShopContext> = {}): CSShopContext {
  return {
    objectId: "shop-demo-001",
    platformShopId: "7000000000001",
    shopName: "Lumen Candle Co.",
    systemPrompt: SHOP_PROMPT,
    platform: "tiktok",
    ...overrides,
  };
}

function csContext(overrides: Partial<CSContext> = {}): CSContext {
  return {
    shopId: "shop-demo-001",
    conversationId: "conv-demo-001",
    buyerUserId: "buyer-demo-001",
    ...overrides,
  };
}

function makeSession(
  s: CSShopContext,
  ctx: CSContext,
  locale: string | undefined,
): CustomerServiceSession {
  return new CustomerServiceSession(s, ctx, {
    defaultRunProfileId: "CUSTOMER_SERVICE",
    locale: () => locale,
  });
}

// 2026-01-01T00:00:00Z, 2026-01-01T23:59:59Z, 2026-02-14T12:00:00Z
const SEVERAL_ORDERS = [
  { orderId: "order-demo-1001", createTime: 1767225600 },
  { orderId: "order-demo-1002", createTime: 1767311999 },
  { orderId: "order-demo-1003", createTime: 1771070400 },
];

// ─── extraSystemPrompt matrix ───────────────────────────────────────────────

function buildSystemPromptCases(): GoldenCase[] {
  interface Spec {
    id: string;
    staging?: boolean;
    locale?: string | undefined;
    shop?: Partial<CSShopContext>;
    ctx?: Partial<CSContext>;
  }
  const specs: Spec[] = [
    { id: "prod.en.baseline", locale: "en" },
    { id: "prod.zh", locale: "zh" },
    { id: "prod.de", locale: "de" },
    { id: "prod.es", locale: "es" },
    { id: "prod.fr", locale: "fr" },
    { id: "prod.id", locale: "id" },
    { id: "prod.it", locale: "it" },
    { id: "prod.th", locale: "th" },
    { id: "prod.locale-undefined-falls-back-to-english", locale: undefined },
    { id: "prod.locale-unsupported-pt-BR-falls-back-to-english", locale: "pt-BR" },
    { id: "prod.locale-zh-CN-normalizes-to-chinese", locale: "zh-CN" },
    { id: "prod.en.buyer-alias", locale: "en", ctx: { buyerNickname: "Alex Rivera" } },
    { id: "prod.en.buyer-alias-empty-string-omitted", locale: "en", ctx: { buyerNickname: "" } },
    { id: "prod.en.recent-orders-empty", locale: "en", ctx: { recentOrders: [] } },
    {
      id: "prod.en.recent-orders-single",
      locale: "en",
      ctx: { recentOrders: [SEVERAL_ORDERS[0]!] },
    },
    { id: "prod.en.recent-orders-several", locale: "en", ctx: { recentOrders: SEVERAL_ORDERS } },
    {
      id: "prod.zh.alias-and-several-orders",
      locale: "zh",
      ctx: { buyerNickname: "小林", recentOrders: SEVERAL_ORDERS },
    },
    {
      id: "prod.en.ignores-imUserId-and-orderId",
      locale: "en",
      ctx: { imUserId: "im-demo-001", orderId: "order-demo-focus" },
    },
    { id: "prod.en.shop-prompt-empty", locale: "en", shop: { systemPrompt: "" } },
    {
      id: "prod.en.shop-prompt-trailing-newline",
      locale: "en",
      shop: { systemPrompt: "Single line prompt.\n" },
    },
    { id: "staging.en.baseline", staging: true, locale: "en" },
    {
      id: "staging.zh.alias-and-several-orders",
      staging: true,
      locale: "zh",
      ctx: { buyerNickname: "小林", recentOrders: SEVERAL_ORDERS },
    },
    {
      id: "staging.en.recent-orders-empty",
      staging: true,
      locale: "en",
      ctx: { recentOrders: [] },
    },
  ];

  return specs.map((spec) => {
    const s = shop(spec.shop);
    const ctx = csContext(spec.ctx);
    stagingFlag.value = spec.staging ?? false;
    const prompt = makeSession(s, ctx, spec.locale).extraSystemPrompt;
    stagingFlag.value = false;
    return {
      case: `extra-system-prompt.${spec.id}`,
      file: BUILDER_FILE,
      input: {
        staging: spec.staging ?? false,
        desktopLocale: spec.locale ?? null,
        shop: s,
        csContext: ctx,
      },
      output: prompt,
    };
  });
}

// ─── Dispatch message matrix ────────────────────────────────────────────────

interface DeltaItem {
  messageId: string;
  index: string;
  type: string;
  text: string;
  createTime: number;
  sender: { role?: string; nickname?: string };
}

interface DeltaFixture {
  items: DeltaItem[];
  meta: {
    completeness: string;
    anchorMatchType: string;
    currentMessageFound: boolean;
    anchorMatched: boolean;
    pageLimitReached: boolean;
    fetchedMessageCount: number;
  };
}

const COMPLETE_META = {
  completeness: "COMPLETE",
  anchorMatchType: "PLATFORM_MESSAGE_ID",
  currentMessageFound: true,
  anchorMatched: true,
  pageLimitReached: false,
};

const buyerText = (messageId: string, index: string, text: string, createTime: number) => ({
  messageId,
  index,
  type: "TEXT",
  text,
  createTime,
  sender: { role: "BUYER", nickname: "Alex Rivera" },
});

const DELTA_SINGLE: DeltaFixture = {
  items: [buyerText("msg-current", "1772000000000001", "Where is my order?", 1772000001)],
  meta: { ...COMPLETE_META, fetchedMessageCount: 1 },
};

const DELTA_MULTI: DeltaFixture = {
  items: [
    buyerText("msg-a", "1772000000000001", "Hi, I ordered a candle set.", 1772000001),
    {
      messageId: "msg-b",
      index: "1772000000000002",
      type: "TEXT",
      text: "Hello Alex, how can I help?",
      createTime: 1772000060,
      sender: { role: "SELLER" },
    },
    {
      messageId: "msg-c",
      index: "1772000000000003",
      type: "ORDER_CARD",
      text: '{"orderId":"order-demo-1001"}',
      createTime: 1772000100,
      sender: { role: "BUYER", nickname: "Alex Rivera" },
    },
    buyerText("msg-current", "1772000000000004", "Can I change the address?\nIt is urgent.", 1772000200),
    {
      messageId: "msg-sys",
      index: "1772000000000005",
      type: "SYSTEM",
      text: "Conversation is about to expire.",
      createTime: 1772000300,
      sender: {},
    },
  ],
  meta: { ...COMPLETE_META, fetchedMessageCount: 5 },
};

const DELTA_EMPTY: DeltaFixture = {
  items: [],
  meta: {
    completeness: "CURRENT_MESSAGE_NOT_FOUND",
    anchorMatchType: "NONE",
    currentMessageFound: false,
    anchorMatched: false,
    pageLimitReached: false,
    fetchedMessageCount: 0,
  },
};

const DELTA_INCOMPLETE: DeltaFixture = {
  items: [buyerText("msg-current", "1772000000000020", "Any update on my refund?", 1772000900)],
  meta: {
    completeness: "PAGE_LIMIT_REACHED",
    anchorMatchType: "NONE",
    currentMessageFound: true,
    anchorMatched: false,
    pageLimitReached: true,
    fetchedMessageCount: 1,
  },
};

const DELTA_IMAGE: DeltaFixture = {
  items: [
    {
      messageId: "msg-current",
      index: "1772000000000030",
      type: "IMAGE",
      text: JSON.stringify({ url: "https://img.example.test/demo/damaged-candle.png" }),
      createTime: 1772001000,
      sender: { role: "BUYER", nickname: "Alex Rivera" },
    },
  ],
  meta: { ...COMPLETE_META, fetchedMessageCount: 1 },
};

const ALL_REASONS: CsAgentDispatchReason[] = [
  "PENDING_BUYER_MESSAGE",
  "MANUAL_START",
  "SESSION_EXPIRING_ESCALATION_FOLLOW_UP",
  "SESSION_EXPIRING_CUSTOMER_FOLLOW_UP",
  "BAD_REVIEW_REACHOUT",
];

const OPERATOR_INSTRUCTION =
  "This buyer asked for a refund after 30 days. Review the order and do not promise compensation unless the evidence supports it.";

type CatchUpOptions = NonNullable<Parameters<CustomerServiceSession["dispatchCatchUp"]>[0]>;

interface DispatchSpec {
  id: string;
  /** Options passed to dispatchCatchUp. Undefined = call with no argument. */
  options?: CatchUpOptions;
  /** Platform delta returned by the (mocked) backend; null = no local anchor, so no delta. */
  delta?: DeltaFixture | null;
  undelivered?: number;
  ctx?: Partial<CSContext>;
  locale?: string;
}

interface AgentRequest {
  sessionKey: unknown;
  message: unknown;
  extraSystemPrompt: unknown;
  promptMode: unknown;
  allowEmptyAssistantReplyAsSilent: unknown;
  idempotencyKey: unknown;
  attachments: unknown;
}

function lastAgentRequest(): AgentRequest {
  const call = mockRpcRequest.mock.calls.findLast((c: unknown[]) => c[0] === "agent");
  if (!call) throw new Error("No agent RPC was issued");
  const p = call[1] as Record<string, unknown>;
  return {
    sessionKey: p.sessionKey,
    message: p.message,
    extraSystemPrompt: p.extraSystemPrompt,
    promptMode: p.promptMode,
    allowEmptyAssistantReplyAsSilent: p.allowEmptyAssistantReplyAsSilent,
    idempotencyKey: p.idempotencyKey,
    attachments: p.attachments ?? null,
  };
}

function resetRpc(delta: DeltaFixture | null | undefined): void {
  mockRpcRequest.mockReset();
  mockRpcRequest.mockImplementation(async (method: string) =>
    method === "agent" ? { runId: "run-demo-1" } : { ok: true },
  );
  mockGraphqlFetch.mockReset();
  mockGraphqlFetch.mockImplementation(async (query: string) => {
    if (query.includes("csGetOrCreateSession")) {
      return { csGetOrCreateSession: { sessionId: "sess-demo-1", isNew: true } };
    }
    if (query.includes("ecommerceGetConversationMessageDelta")) {
      if (!delta) throw new Error("delta must not be requested when there is no anchor");
      return { ecommerceGetConversationMessageDelta: structuredClone(delta) };
    }
    throw new Error(`Unexpected GraphQL operation: ${query.slice(0, 60)}`);
  });
  cursorState.value = delta
    ? { messageId: "msg-seen", messageIndex: "1772000000000000", createTime: 1771999999 }
    : null;
}

async function runDispatchSpec(spec: DispatchSpec): Promise<GoldenCase> {
  stagingFlag.value = false;
  resetRpc(spec.delta);
  const s = shop();
  const ctx = csContext(spec.ctx);
  const session = makeSession(s, ctx, spec.locale ?? "en");
  if (spec.undelivered) {
    (session as unknown as { undeliveredCount: number }).undeliveredCount = spec.undelivered;
  }
  await session.dispatchCatchUp(spec.options);
  const req = lastAgentRequest();
  if (req.promptMode !== "raw") throw new Error(`CS dispatch must use raw promptMode, got ${String(req.promptMode)}`);
  if (req.extraSystemPrompt !== session.extraSystemPrompt) {
    throw new Error(`dispatch extraSystemPrompt diverged from the getter for ${spec.id}`);
  }
  return {
    case: `dispatch.${spec.id}`,
    file: BUILDER_FILE,
    input: {
      desktopLocale: spec.locale ?? "en",
      shop: s,
      csContext: ctx,
      dispatchCatchUpOptions: spec.options ?? null,
      platformDelta: spec.delta === undefined ? null : spec.delta,
      localSessionAnchorPresent: Boolean(spec.delta),
      undeliveredRunsAtStart: spec.undelivered ?? 0,
    },
    output: {
      message: req.message,
      idempotencyKey: req.idempotencyKey,
      attachments: req.attachments,
    },
  };
}

function dispatchSpecs(): DispatchSpec[] {
  const specs: DispatchSpec[] = [];
  const slug = (r: CsAgentDispatchReason) => r.toLowerCase().replace(/_/g, "-");

  // Full mode (no current message id): dispatch message built from the dispatch reason alone.
  specs.push({ id: "full.default-reason-no-options" });
  for (const reason of ALL_REASONS) {
    // PENDING_BUYER_MESSAGE without a message id skips the buyer round and goes straight to dispatch().
    specs.push({
      id: `full.${slug(reason)}`,
      options: { dispatchReason: reason, useMessageDelta: false },
    });
    specs.push({
      id: `full.${slug(reason)}.operator-instruction`,
      options: {
        dispatchReason: reason,
        useMessageDelta: false,
        operatorInstruction: `  ${OPERATOR_INSTRUCTION}\n`,
      },
    });
  }
  specs.push({
    id: "full.manual-start.whitespace-instruction-omitted",
    options: { dispatchReason: "MANUAL_START", useMessageDelta: false, operatorInstruction: "   " },
  });
  specs.push({
    id: "full.bad-review-reachout.round-authorization",
    options: {
      dispatchReason: "BAD_REVIEW_REACHOUT",
      useMessageDelta: false,
      badReviewReachoutRoundId: "review-round-demo-1",
    },
  });
  specs.push({
    id: "full.bad-review-reachout.round-authorization-and-instruction",
    options: {
      dispatchReason: "BAD_REVIEW_REACHOUT",
      useMessageDelta: false,
      badReviewReachoutRoundId: "review-round-demo-1",
      operatorInstruction: "Apologize for the damaged item and offer a replacement check-in.",
    },
  });
  specs.push({
    id: "full.manual-start.round-id-ignored-for-other-reasons",
    options: {
      dispatchReason: "MANUAL_START",
      useMessageDelta: false,
      badReviewReachoutRoundId: "review-round-demo-1",
    },
  });
  specs.push({
    id: "full.manual-start.with-message-id-no-delta.keeps-reason-text",
    options: {
      dispatchReason: "MANUAL_START",
      useMessageDelta: false,
      currentMessageId: "msg-current",
      operatorInstruction: OPERATOR_INSTRUCTION,
    },
  });

  // Buyer-round path (PENDING_BUYER_MESSAGE + currentMessageId): delta work package, wrapped by CSRound.
  const pending = (extra: Partial<CatchUpOptions> = {}): CatchUpOptions => ({
    dispatchReason: "PENDING_BUYER_MESSAGE",
    currentMessageId: "msg-current",
    useMessageDelta: true,
    ...extra,
  });
  specs.push({ id: "delta.pending-buyer-message.single", options: pending(), delta: DELTA_SINGLE });
  specs.push({ id: "delta.pending-buyer-message.multi-with-seller-order-card-system", options: pending(), delta: DELTA_MULTI });
  specs.push({ id: "delta.pending-buyer-message.empty-timeline", options: pending(), delta: DELTA_EMPTY });
  specs.push({ id: "delta.pending-buyer-message.incomplete-page-limit", options: pending(), delta: DELTA_INCOMPLETE });
  specs.push({ id: "delta.pending-buyer-message.image-attached", options: pending(), delta: DELTA_IMAGE });
  specs.push({
    id: "delta.pending-buyer-message.operator-instruction-is-dropped",
    options: pending({ operatorInstruction: OPERATOR_INSTRUCTION }),
    delta: DELTA_SINGLE,
  });
  specs.push({
    id: "delta.pending-buyer-message.undelivered-1",
    options: pending(),
    delta: DELTA_SINGLE,
    undelivered: 1,
  });
  specs.push({
    id: "delta.pending-buyer-message.undelivered-3",
    options: pending(),
    delta: DELTA_SINGLE,
    undelivered: 3,
  });
  specs.push({
    id: "delta.pending-buyer-message.zh-merchant-locale-does-not-change-message",
    options: pending(),
    delta: DELTA_SINGLE,
    locale: "zh",
  });
  // No local anchor -> delta unavailable -> falls back to the reason-based message, still wrapped.
  specs.push({ id: "delta.pending-buyer-message.no-anchor-fallback", options: pending(), delta: null });
  specs.push({
    id: "delta.pending-buyer-message.no-anchor-fallback.undelivered-2",
    options: pending(),
    delta: null,
    undelivered: 2,
  });
  specs.push({
    id: "full.pending-buyer-message.delta-disabled-with-message-id",
    options: pending({ useMessageDelta: false }),
    delta: DELTA_SINGLE,
  });

  // Direct path with delta (non-pending reasons with a message id): work package only, no reason text.
  for (const reason of ALL_REASONS.filter((r) => r !== "PENDING_BUYER_MESSAGE")) {
    specs.push({
      id: `delta.${slug(reason)}.single`,
      options: {
        dispatchReason: reason,
        currentMessageId: "msg-current",
        useMessageDelta: true,
        operatorInstruction: OPERATOR_INSTRUCTION,
        ...(reason === "BAD_REVIEW_REACHOUT" ? { badReviewReachoutRoundId: "review-round-demo-1" } : {}),
      },
      delta: DELTA_SINGLE,
    });
  }
  specs.push({
    id: "delta.manual-start.no-anchor-fallback",
    options: {
      dispatchReason: "MANUAL_START",
      currentMessageId: "msg-current",
      useMessageDelta: true,
      operatorInstruction: OPERATOR_INSTRUCTION,
    },
    delta: null,
  });
  return specs;
}

// Escalation / recovery dispatches: internal messages that do not go through dispatchCatchUp.
async function runEscalationAndRecoveryCases(): Promise<GoldenCase[]> {
  const cases: GoldenCase[] = [];
  const base = () => {
    stagingFlag.value = false;
    resetRpc(null);
    const s = shop();
    const ctx = csContext();
    return { s, ctx, session: makeSession(s, ctx, "en") };
  };
  const record = (
    id: string,
    s: CSShopContext,
    ctx: CSContext,
    input: Record<string, unknown>,
  ): GoldenCase => {
    const req = lastAgentRequest();
    if (req.promptMode !== "raw") throw new Error(`promptMode must be raw for ${id}`);
    return {
      case: `dispatch.${id}`,
      file: BUILDER_FILE,
      input: { desktopLocale: "en", shop: s, csContext: ctx, ...input },
      output: {
        message: req.message,
        idempotencyKey: req.idempotencyKey,
        attachments: req.attachments,
      },
    };
  };

  for (const resolved of [true, false]) {
    const { s, ctx, session } = base();
    await session.dispatchCloudEscalationUpdate({
      escalationId: "esc-demo-1",
      resolved,
      version: 3,
    });
    cases.push(
      record(`cloud-escalation-update.${resolved ? "resolved" : "interim"}`, s, ctx, {
        cloudEscalationUpdate: { escalationId: "esc-demo-1", resolved, version: 3 },
      }),
    );
  }
  for (const resolved of [true, false]) {
    const { s, ctx, session } = base();
    session.escalations.set("esc-demo-2", {
      id: "esc-demo-2",
      reason: "Refund request above authority",
      createdAt: FROZEN_NOW.getTime(),
      result: resolved
        ? { decision: "approve", instructions: "ok", resolved: true, resolvedAt: FROZEN_NOW.getTime() }
        : undefined,
    });
    await session.dispatchEscalationResolved("esc-demo-2");
    cases.push(
      record(`local-escalation-update.${resolved ? "resolved" : "interim"}`, s, ctx, {
        localEscalation: { escalationId: "esc-demo-2", resolved },
      }),
    );
  }
  {
    const { s, ctx, session } = base();
    await session.dispatchSensitiveContentRecovery({
      failedRunId: "run-failed-1",
      rejectedText: "A blocked draft reply.",
    });
    cases.push(
      record("sensitive-content-recovery", s, ctx, {
        sensitiveContentRecovery: { failedRunId: "run-failed-1", rejectedText: "A blocked draft reply." },
      }),
    );
  }
  return cases;
}

async function generateAll(): Promise<GoldenCase[]> {
  const cases: GoldenCase[] = [...buildSystemPromptCases()];
  for (const spec of dispatchSpecs()) cases.push(await runDispatchSpec(spec));
  cases.push(...(await runEscalationAndRecoveryCases()));
  return cases;
}

// ─── Test ───────────────────────────────────────────────────────────────────

const savedQuietWindow = process.env.RIVONCLAW_CS_BUYER_QUIET_WINDOW_MS;
const savedCompression = process.env.RIVONCLAW_CS_IMAGE_COMPRESSION;

beforeAll(() => {
  // No coalescing timer: buyer dispatches flush immediately.
  process.env.RIVONCLAW_CS_BUYER_QUIET_WINDOW_MS = "0";
  delete process.env.RIVONCLAW_CS_IMAGE_COMPRESSION;
  vi.useFakeTimers({ toFake: ["Date"], now: FROZEN_NOW });
});

afterAll(() => {
  vi.useRealTimers();
  if (savedQuietWindow === undefined) delete process.env.RIVONCLAW_CS_BUYER_QUIET_WINDOW_MS;
  else process.env.RIVONCLAW_CS_BUYER_QUIET_WINDOW_MS = savedQuietWindow;
  if (savedCompression !== undefined) process.env.RIVONCLAW_CS_IMAGE_COMPRESSION = savedCompression;
});

beforeEach(() => {
  mockGetAuthSession.mockReturnValue({
    getAccessToken: () => "test-token",
    graphqlFetch: mockGraphqlFetch,
  });
  const activeProviderKey = {
    id: "key-default",
    provider: "rivonclaw-pro",
    label: "TK Copilot AI",
    model: "gpt-5.5",
    isDefault: true,
    authType: "custom",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  rootStore.llmManager.setEnv({
    storage: {
      providerKeys: {
        getAll: () => [activeProviderKey],
        getActive: () => activeProviderKey,
        getById: (id: string) => (id === activeProviderKey.id ? activeProviderKey : null),
      },
    } as any,
    secretStore: { get: async () => null, set: async () => {}, delete: async () => {} } as any,
    getRpcClient: () => ({ request: mockRpcRequest, isConnected: () => true }) as any,
    toMstSnapshot: async () => ({}) as any,
    allKeysToMstSnapshots: async () => [],
    syncActiveKey: async () => {},
    syncAllAuthProfiles: async () => {},
    removeAuthProfilesForRuntimeProvider: () => {},
    activateAuthProfile: () => "openai:active",
    writeProxyRouterConfig: async () => {},
    writeFullGatewayConfig: async () => {},
    writeDefaultModelToConfig: () => {},
    restartGateway: async () => {},
    proxyFetch: globalThis.fetch,
    stateDir: "/tmp/test-state",
    getLastSystemProxy: () => null,
  });
});

describe("CS agent input goldens", () => {
  it("regenerates deterministically and (when AGENT_GOLDENS_OUT is set) writes the goldens", async () => {
    const first = await generateAll();
    const second = await generateAll();

    const commit = rootCommit();
    const firstSerialized = first.map((c) => serialize(c, commit));
    const secondSerialized = second.map((c) => serialize(c, commit));
    expect(secondSerialized).toEqual(firstSerialized);

    const ids = first.map((c) => c.case);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9._-]+$/);
    // Sanity: the matrix really exercises both staging branches and every dispatch reason.
    expect(first.some((c) => String(c.output).includes("STAGING ENVIRONMENT"))).toBe(true);
    for (const reason of ALL_REASONS) {
      expect(
        first.some((c) => c.case.startsWith("dispatch.") && JSON.stringify(c.input).includes(reason)),
      ).toBe(true);
    }

    const outRoot = process.env.AGENT_GOLDENS_OUT;
    if (!outRoot) return;
    const outDir = join(outRoot, AREA);
    mkdirSync(outDir, { recursive: true });
    // Drop stale files from earlier generations so removed cases do not linger.
    for (const name of readdirSync(outDir)) {
      if (name.endsWith(".json")) rmSync(join(outDir, name));
    }
    first.forEach((c, i) => writeFileSync(join(outDir, `${c.case}.json`), firstSerialized[i]!));
  });
  it("matches the committed goldens exactly (case, input, output; source.commit ignored)", async (ctx) => {
    if (process.env.AGENT_GOLDENS_OUT) {
      ctx.skip("AGENT_GOLDENS_OUT is set: this run regenerates goldens instead of comparing");
    }
    const goldenDir = join(
      process.env.AGENT_GOLDENS_DIR ?? join(ROOT_DIR, "server/backend/test-fixtures/agent-goldens"),
      AREA,
    );
    if (!existsSync(goldenDir)) {
      ctx.skip(`committed goldens not found at ${goldenDir} (no server checkout/symlink in this workspace)`);
    }
    const generated = await generateAll();
    const committedFiles = readdirSync(goldenDir).filter((n) => n.endsWith(".json")).sort();
    const generatedNames = generated.map((c) => `${c.case}.json`).sort();
    // Stale committed files (no generated case) and missing files (new case, not yet generated).
    expect(committedFiles).toEqual(generatedNames);
    for (const c of generated) {
      const committed = JSON.parse(readFileSync(join(goldenDir, `${c.case}.json`), "utf8"));
      const actual = JSON.parse(serialize(c, "ignored"));
      expect(
        { case: committed.case, input: committed.input, output: committed.output },
        `golden ${c.case} is out of date; regenerate with AGENT_GOLDENS_OUT`,
      ).toEqual({ case: actual.case, input: actual.input, output: actual.output });
    }
  });
});
