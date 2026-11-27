/**
 * Parity goldens for the Affiliate area (docs/SERVICES/agent-runner.md, "Parity goldens").
 *
 * Captures what Desktop builds today for an Affiliate Agent run so the Backend
 * agent runner can later be required to reproduce it byte for byte:
 *   - the system prompt (`extraSystemPrompt`) and the user turn (`message`) of
 *     every work-item kind, plus the exact gateway RPC sequence of a dispatch;
 *   - the unknown-sender identification prompt, user turn and dispatch;
 *   - the workflow skill descriptor injected into the prompt and the manifest of
 *     the skill bundle the Agent reads with the built-in `read` tool;
 *   - the tool allowlist (run profile + built-ins) and the managed agent config.
 *
 * `AGENT_GOLDENS_OUT=<dir>` writes `<dir>/affiliate/<case>.json`. Without it the
 * test only asserts that regeneration is stable (two generations are equal).
 *
 * All data is synthetic: the root repo is public.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const FIXED_UUID = "00000000-0000-4000-8000-000000000001";
const SYNTHETIC_STATE_DIR = "/synthetic/openclaw-state";
const FROZEN_NOW = new Date("2026-06-01T00:00:00.000Z");

const h = vi.hoisted(() => ({
  rpcCalls: [] as Array<{ method: string; params: unknown }>,
  authSession: null as unknown,
}));

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  const randomUUID = () => "00000000-0000-4000-8000-000000000001";
  return { ...actual, randomUUID, default: { ...actual, randomUUID } };
});

vi.mock("@rivonclaw/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@rivonclaw/logger")>();
  const logger = { info() {}, warn() {}, error() {}, debug() {} };
  return { ...actual, createLogger: () => logger };
});

vi.mock("../../openclaw/index.js", () => ({
  openClawConnector: {
    request: async (method: string, params: unknown) => {
      h.rpcCalls.push({ method, params: JSON.parse(JSON.stringify(params ?? null)) });
      return { runId: "run-golden-001" };
    },
  },
}));

vi.mock("../../auth/session-ref.js", () => ({ getAuthSession: () => h.authSession }));
vi.mock("../../gateway/provider-keys-ref.js", () => ({
  getProviderKeysStore: () => ({ getAll: () => [] }),
}));
vi.mock("../../gateway/vendor-dir-ref.js", () => ({ getVendorDir: () => "/fake/vendor" }));
vi.mock("@rivonclaw/gateway", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@rivonclaw/gateway")>();
  return { ...actual, readFullModelCatalog: vi.fn().mockResolvedValue({}) };
});
// The real `requestAgent` is `openClawConnector.request("agent", params)` when no
// readiness deps are configured; `ensureAgentToolingReady` is a gate with no
// effect on what is sent.
vi.mock("../../gateway/agent-tooling-readiness.js", () => ({
  requestAgent: async (params: unknown) => {
    h.rpcCalls.push({ method: "agent", params: JSON.parse(JSON.stringify(params)) });
    return { runId: "run-golden-001" };
  },
  ensureAgentToolingReady: async () => {},
}));

import { GQL, ScopeType } from "@rivonclaw/core";
import { initLLMProviderManagerEnv, rootStore } from "../../app/store/desktop-store.js";
import { buildManagedGatewayAgents } from "../../gateway/config-builder.js";
import { buildAffiliateAgentRunRequest } from "../affiliate-agent-run-factory.js";
import {
  buildAffiliateIdentificationRunRequest,
  buildIdentificationSystemPrompt,
} from "../affiliate-identification-run-factory.js";
import { AffiliateInbound } from "../affiliate-inbound.js";
import { __clearActiveAffiliateRunCheckpointsForTests } from "../affiliate-run-checkpoints.js";
import { AffiliateSession, type AffiliateContext } from "../affiliate-session.js";
import {
  catchUpAffiliateUnknownSenderIdentification,
  resetAffiliateUnknownSenderDispatchStateForTests,
} from "../affiliate-unknown-sender-actuator.js";
import { __clearActiveAffiliateIdentificationRunsForTests } from "../affiliate-identification-run-spans.js";
import {
  loadAffiliateWorkflowSkillDescriptor,
  renderAffiliateWorkflowSkillCatalog,
} from "../affiliate-workflow-skill.js";

// ── Golden plumbing ─────────────────────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../../../..");
const REAL_SKILL_DIR = join(REPO_ROOT, "server/preset-skills/affiliate/affiliate-workflow");

const SRC = {
  runFactory: "apps/desktop/src/affiliate/affiliate-agent-run-factory.ts",
  inbound: "apps/desktop/src/affiliate/affiliate-inbound.ts",
  session: "apps/desktop/src/affiliate/affiliate-session.ts",
  identificationFactory: "apps/desktop/src/affiliate/affiliate-identification-run-factory.ts",
  identificationActuator: "apps/desktop/src/affiliate/affiliate-unknown-sender-actuator.ts",
  skill: "apps/desktop/src/affiliate/affiliate-workflow-skill.ts",
  rootStore: "packages/core/src/models/RootStore.ts",
  configBuilder: "apps/desktop/src/gateway/config-builder.ts",
} as const;

interface Golden {
  schemaVersion: 1;
  source: { repo: "root"; commit: string; file: string };
  case: string;
  input: unknown;
  output: unknown;
}

type Cases = Map<string, Omit<Golden, "source"> & { file: string }>;

function add(cases: Cases, id: string, file: string, input: unknown, output: unknown): void {
  if (cases.has(id)) throw new Error(`Duplicate golden case id: ${id}`);
  cases.set(id, { schemaVersion: 1, case: id, file, input, output });
}

/** Replaces the machine-specific state directory with the synthetic one. */
function normalize<T>(value: T, stateDir: string): T {
  return JSON.parse(JSON.stringify(value).split(stateDir).join(SYNTHETIC_STATE_DIR)) as T;
}

const sha256 = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");

// ── Synthetic fixtures ──────────────────────────────────────────────────────

const USER_ID = "user-demo-001";
const REL_ID = "rel-demo-001";
const CREATOR_ID = "creator-demo-001";
const SHOP_US = { shopId: "shop-lumen-us-001", shopName: "Lumen Home Goods US" };
const SHOP_UK = { shopId: "shop-lumen-uk-002", shopName: "Lumen Home Goods UK" };
const AT = "2026-06-01T00:00:00.000Z";

type Json = Record<string, unknown>;

function agendaItem(overrides: Json = {}): Json {
  return {
    key: `relationship:${REL_ID}:HANDLE_CREATOR_MESSAGE`,
    owner: "AGENT",
    sourceType: "RELATIONSHIP",
    workKind: "INBOUND_MESSAGE_TRIAGE",
    requiredAction: "HANDLE_CREATOR_MESSAGE",
    shopId: SHOP_US.shopId,
    shopRegion: "US",
    productId: null,
    affiliateCollaborationId: null,
    sampleApplicationRecordId: null,
    proposalId: null,
    reasons: ["CREATOR_MESSAGE_NEEDS_HANDLING"],
    nextActionAt: null,
    boundaryEventCursor: 12,
    updatedAt: AT,
    ...overrides,
  };
}

function workItem(items: Json[], overrides: Json = {}): Json {
  const first = items[0]!;
  return {
    id: "work-demo-001",
    triggerShopId: SHOP_US.shopId,
    triggerPlatformShopId: "platform-shop-demo-001",
    routingShopIds: [SHOP_US.shopId],
    subjectType: "CREATOR_RELATIONSHIP",
    creatorRelationshipId: REL_ID,
    affiliateCollaborationId: null,
    workKind: first.workKind,
    workBundleKind: "GENERAL_REVIEW",
    agentWorkingAgendaItems: items,
    agentDispatchRecommended: true,
    requiredAction: first.requiredAction,
    processReasons: first.reasons,
    versionAt: AT,
    agendaItemsSnapshotId: "snapshot-demo-001",
    creatorRelationship: {
      id: REL_ID,
      userId: USER_ID,
      creatorId: CREATOR_ID,
      systemTags: [],
      committedCheckpointId: null,
      committedEventCursor: 0,
      lastInboundLifecycleEventId: "lifecycle-demo-001",
      stateUpdatedAt: AT,
    },
    sampleApplicationRecord: null,
    context: {
      creatorProfile: { id: CREATOR_ID, creatorOpenId: "creator-open-demo-001" },
      primarySampleApplication: null,
    },
    ...overrides,
  };
}

const text = (sequence: number, value: string): Json => ({
  kind: "TEXT",
  sequence,
  text: value,
  contentTruncated: false,
  originalCharacterCount: value.length,
});

const turn = (
  relationshipSequence: number,
  direction: string,
  channel: string,
  parts: Json[],
  extra: Json = {},
): Json => ({
  relationshipSequence,
  occurredAt: `2026-05-31T${String(relationshipSequence).padStart(2, "0")}:00:00.000Z`,
  direction,
  channel,
  trust: direction === "CREATOR" ? "UNTRUSTED_CREATOR_CONTENT" : "TRUSTED_SELLER_CONTENT",
  parts,
  ...extra,
});

function conversationWindow(overrides: Json = {}): Json {
  return {
    coverage: "COMPLETE",
    resolvedThroughRelationshipSequence: 8,
    lastPendingRelationshipSequence: 10,
    includedCreatorTurnCount: 2,
    totalCreatorTurnCount: 2,
    containsUnsupportedContent: false,
    sellerAnchor: turn(8, "SELLER", "WHATSAPP", [
      text(1, "Hi Dana, thanks for your interest in our linen bedding set."),
    ]),
    creatorTurns: [
      turn(9, "CREATOR", "WHATSAPP", [text(1, "Hi! What is the commission rate for the bedding set?")]),
      turn(10, "CREATOR", "WHATSAPP", [text(1, "Also, can you ship to Canada?")]),
    ],
    ...overrides,
  };
}

type EvidenceMode =
  | "EXPECTED_SALES_TRUSTED"
  | "MERCHANT_APPROVAL_TENDENCY"
  | "NO_MODEL_SIGNAL"
  | "MODEL_SIGNAL_ERROR";

function canonicalEvidence(mode: EvidenceMode): Json {
  const family = (name: string, status: string, value: unknown, error: unknown = null, selection: unknown = null): Json => ({
    family: name,
    status,
    selection,
    error,
    value,
  });
  // Every mode carries the withheld family's real numbers too, so the output
  // proves Desktop withholds them rather than that they were never present.
  const esSelection = {
    requestedScope: "SHOP",
    effectiveScope: "USER",
    modelVersion: "affiliate-unified-v4:USER:7",
    evaluatedScopes: [{ scope: "SHOP", tenantId: "tenant-scope-demo-001" }],
  };
  const hdSelection = {
    requestedScope: "SHOP",
    effectiveScope: "SHOP",
    modelVersion: { modelVersionKey: "affiliate-human-v2:SHOP:3" },
    evaluatedScopes: [{ scope: "SHOP", tenantId: "tenant-scope-demo-001" }],
  };
  switch (mode) {
    case "EXPECTED_SALES_TRUSTED":
      return {
        evidenceMode: mode,
        expectedSales: family(
          "EXPECTED_SALES",
          "READY",
          { units: 2.4, percentile: 61, quality: { level: "HIGH" }, reliability: "TRUSTED", reliabilityReasons: [] },
          null,
          esSelection,
        ),
        humanDecision: family(
          "HUMAN_DECISION",
          "READY",
          { wouldApprove: true, approvalProbability: 0.74, cutoff: 0.5 },
          null,
          hdSelection,
        ),
      };
    case "MERCHANT_APPROVAL_TENDENCY":
      return {
        evidenceMode: mode,
        expectedSales: family(
          "EXPECTED_SALES",
          "READY",
          { units: 9.9, reliability: "DEGRADED", reliabilityReasons: ["LOW_SAMPLE_COUNT"] },
          null,
          esSelection,
        ),
        humanDecision: family(
          "HUMAN_DECISION",
          "READY",
          {
            wouldApprove: false,
            approvalProbability: 0.31,
            approvalPercentile: 22,
            cutoff: 0.52,
            historicalApprovalRate: 0.44,
          },
          null,
          hdSelection,
        ),
      };
    case "NO_MODEL_SIGNAL":
      return {
        evidenceMode: mode,
        expectedSales: family("EXPECTED_SALES", "NOT_AVAILABLE", null),
        humanDecision: family("HUMAN_DECISION", "NOT_AVAILABLE", null),
      };
    case "MODEL_SIGNAL_ERROR":
      return {
        evidenceMode: mode,
        expectedSales: family("EXPECTED_SALES", "ERROR", null, {
          code: "ES_ARTIFACT_INVALID",
          message: "expected sales artifact failed validation",
        }),
        humanDecision: family("HUMAN_DECISION", "ERROR", null, {
          code: "HD_FEATURE_CONTRACT_VIOLATION",
          message: "feature creator_selection_region is null",
        }),
      };
  }
}

function predictionEvidence(canonical: Json | null, overrides: Json = {}): Json {
  return {
    sourceCacheId: "cache-demo-001",
    predictionType: "SALES_UNITS_FORECAST",
    captureMode: "PROMOTED_FROM_CACHE",
    scenario: "SAMPLE_REVIEW",
    subject: {
      sampleApplicationRecordId: "sample-record-demo-001",
      creatorId: CREATOR_ID,
      productId: "product-demo-001",
    },
    status: "OK",
    output: {},
    model: {},
    diagnostics: {},
    predictedAt: AT,
    ...(canonical ? { predictionEvidence: canonical } : {}),
    ...overrides,
  };
}

function sampleReviewItem(overrides: Json = {}): Json {
  return agendaItem({
    key: "affiliateCollaboration:collab-demo-001:COMPLETE_COLLABORATION_TASK",
    sourceType: "PLATFORM_COLLABORATION",
    workKind: "SAMPLE_APPLICATION_DECISION",
    requiredAction: "REVIEW_SAMPLE_APPLICATION",
    productId: "product-demo-001",
    affiliateCollaborationId: "collab-demo-001",
    sampleApplicationRecordId: "sample-record-demo-001",
    reasons: ["SAMPLE_PENDING_REVIEW"],
    predictionEvidence: predictionEvidence(canonicalEvidence("EXPECTED_SALES_TRUSTED")),
    minExpectedSalesReference: { availability: "CONFIGURED", units: 3 },
    ...overrides,
  });
}

function sampleReviewWorkItem(items: Json[], overrides: Json = {}): Json {
  return workItem(items, {
    workBundleKind: "SAMPLE_REVIEW_ONLY",
    affiliateCollaborationId: "collab-demo-001",
    sampleApplicationRecord: { id: "sample-record-demo-001" },
    context: {
      creatorProfile: { id: CREATOR_ID, creatorOpenId: "creator-open-demo-001" },
      primarySampleApplication: { id: "sample-record-demo-001" },
    },
    ...overrides,
  });
}

function terminalItem(cause: string, platformStatus: string | null): Json {
  return agendaItem({
    key: "sampleApplication:sample-record-demo-001:HANDLE_SAMPLE_TERMINAL_STATE",
    sourceType: "SAMPLE_APPLICATION",
    workKind: "SAMPLE_PLATFORM_TERMINAL_FOLLOW_UP",
    requiredAction: "HANDLE_SAMPLE_TERMINAL_STATE",
    productId: "product-demo-001",
    sampleApplicationRecordId: "sample-record-demo-001",
    reasons: ["SAMPLE_PLATFORM_TERMINAL_STATE"],
    sampleTerminalState: { cause, sampleWorkStatus: "CANCELLED", platformStatus },
  });
}

const TWO_SHOPS = [
  { shopId: SHOP_US.shopId, shopName: SHOP_US.shopName, businessPrompt: "Prefer fit over audience size." },
  { shopId: SHOP_UK.shopId, shopName: SHOP_UK.shopName, businessPrompt: null },
];

// ── User-turn cases (pure renderer) ─────────────────────────────────────────

function messageCase(
  cases: Cases,
  id: string,
  item: Json,
  shops: readonly Json[] | null = [TWO_SHOPS[0]!],
  platform = "tiktok",
): void {
  let output: unknown;
  try {
    const request = buildAffiliateAgentRunRequest({
      workItem: item as unknown as GQL.AffiliateWorkItem,
      platform,
      involvedShopInstructions: shops as unknown as GQL.AffiliateInvolvedShopInstruction[] | null,
    });
    output = request;
  } catch (error) {
    // Fail-loud contract violations are part of the behavior to reproduce.
    output = { error: error instanceof Error ? error.message : String(error) };
  }
  add(cases, `user-message.${id}`, SRC.runFactory, { workItem: item, involvedShopInstructions: shops, platform }, output);
}

function addUserMessageCases(cases: Cases): void {
  // Inbound Creator message.
  messageCase(
    cases,
    "inbound.window-complete",
    workItem([agendaItem({ conversationWindow: conversationWindow() })], {
      workBundleKind: "CREATOR_REPLY_ONLY",
    }),
  );
  messageCase(
    cases,
    "inbound.window-truncated-unsupported",
    workItem(
      [
        agendaItem({
          conversationWindow: conversationWindow({
            coverage: "TRUNCATED",
            includedCreatorTurnCount: 2,
            totalCreatorTurnCount: 5,
            containsUnsupportedContent: true,
            sellerAnchor: null,
            creatorTurns: [
              turn(9, "CREATOR", "EMAIL", [
                { kind: "ATTACHMENT", sequence: 1, fileName: "rate-card.pdf", mimeType: "application/pdf", sizeBytes: 20480, contentAvailability: "AVAILABLE", agentReadable: true, contentTruncated: false, originalCharacterCount: 0 },
                text(2, "Please see my rate card attached."),
              ], { subject: "Rates for Q3" }),
              turn(10, "CREATOR", "PLATFORM_CHAT", [
                { kind: "PRODUCT_CARD", sequence: 1, productId: "product-demo-001", shopId: SHOP_US.shopId, contentTruncated: false, originalCharacterCount: 0 },
                { kind: "UNKNOWN", sequence: 2, providerType: "STICKER", contentTruncated: false, originalCharacterCount: 0 },
              ]),
            ],
          }),
        }),
      ],
      { workBundleKind: "CREATOR_REPLY_ONLY" },
    ),
  );
  messageCase(cases, "inbound.no-window", workItem([agendaItem()]));
  messageCase(
    cases,
    "inbound.system-tags",
    workItem([agendaItem({ conversationWindow: conversationWindow() })], {
      creatorRelationship: {
        id: REL_ID,
        userId: USER_ID,
        creatorId: CREATOR_ID,
        systemTags: ["NO_CAMPAIGN_DISTURB", "PROTECTED"],
        committedCheckpointId: null,
        committedEventCursor: 0,
        lastInboundLifecycleEventId: null,
        stateUpdatedAt: AT,
      },
    }),
  );
  messageCase(
    cases,
    "inbound.with-sample-review-bundle",
    workItem(
      [
        agendaItem({ conversationWindow: conversationWindow(), reasons: ["CREATOR_MESSAGE_NEEDS_HANDLING", "SAMPLE_PENDING_REVIEW"] }),
        sampleReviewItem(),
      ],
      { workBundleKind: "CREATOR_REPLY_WITH_SAMPLE_REVIEW" },
    ),
  );
  messageCase(
    cases,
    "inbound.cross-shop-bundle",
    workItem(
      [
        agendaItem({ conversationWindow: conversationWindow() }),
        agendaItem({ key: `relationship:${REL_ID}:UK`, shopId: SHOP_UK.shopId, shopRegion: "GB", conversationWindow: conversationWindow() }),
      ],
      { routingShopIds: [SHOP_US.shopId, SHOP_UK.shopId] },
    ),
    TWO_SHOPS,
  );
  messageCase(
    cases,
    "inbound.unknown-shop-name",
    workItem([agendaItem({ shopId: "shop-unlisted-009" })]),
    TWO_SHOPS,
  );
  messageCase(cases, "inbound.no-shop-id", workItem([agendaItem({ shopId: null, shopRegion: null })]), []);
  messageCase(
    cases,
    "inbound.non-tiktok-platform",
    workItem([agendaItem({ conversationWindow: conversationWindow() })]),
    [TWO_SHOPS[0]!],
    "shopee",
  );

  // Follow-ups.
  messageCase(
    cases,
    "creator-follow-up.due",
    workItem(
      [
        agendaItem({
          key: `relationship:${REL_ID}:FOLLOW_UP_CREATOR`,
          workKind: "CREATOR_FOLLOW_UP",
          requiredAction: "FOLLOW_UP_CREATOR",
          reasons: ["CREATOR_ACTION_FOLLOW_UP_DUE"],
          nextActionAt: "2026-06-03T00:00:00.000Z",
        }),
      ],
      { workBundleKind: "CREATOR_FOLLOW_UP" },
    ),
  );
  for (const stage of ["SAMPLE_CONTENT_FOLLOW_UP_DAY_3", "SAMPLE_CONTENT_FOLLOW_UP_DAY_7", "SAMPLE_CONTENT_FOLLOW_UP_DAY_12"]) {
    messageCase(
      cases,
      `content-follow-up.${stage.replace("SAMPLE_CONTENT_FOLLOW_UP_DAY_", "day-")}`,
      workItem(
        [
          agendaItem({
            key: `sampleApplication:sample-record-demo-001:${stage}`,
            workKind: "CONTENT_FOLLOW_UP",
            requiredAction: "FOLLOW_UP_CREATOR",
            sampleApplicationRecordId: "sample-record-demo-001",
            productId: "product-demo-001",
            reasons: ["SAMPLE_CONTENT_FOLLOW_UP_DUE"],
            nextActionAt: "2026-06-02T00:00:00.000Z",
            sampleContentFollowUpStage: stage,
          }),
        ],
        { workBundleKind: "CONTENT_FOLLOW_UP" },
      ),
    );
  }
  messageCase(
    cases,
    "sample-performance-follow-up.low-orders",
    workItem([
      agendaItem({
        key: "sampleApplication:sample-record-demo-001:PERFORMANCE_STAGE_1",
        workKind: "SAMPLE_PERFORMANCE_FOLLOW_UP",
        requiredAction: "FOLLOW_UP_CREATOR",
        sampleApplicationRecordId: "sample-record-demo-001",
        productId: "product-demo-001",
        reasons: ["SAMPLE_PERFORMANCE_FOLLOW_UP_DUE"],
        samplePerformanceFollowUpStage: "SAMPLE_PERFORMANCE_FOLLOW_UP_STAGE_1",
        samplePerformanceFollowUpStageId: "stage-7d",
        samplePerformanceConfigRevision: 4,
        samplePerformanceFollowUpDelayDays: 7,
        samplePerformanceFollowUpAnchorAt: "2026-05-25T00:00:00.000Z",
        samplePerformanceFollowUpExpiresAt: "2026-06-03T00:00:00.000Z",
        samplePerformanceLowOrderThreshold: 3,
        samplePerformanceAttributedOrderCount: 1,
        samplePerformanceSnapshotHash: "a".repeat(64),
      }),
    ]),
  );
  messageCase(
    cases,
    "sample-performance-follow-up.fields-unavailable",
    workItem([
      agendaItem({
        workKind: "SAMPLE_PERFORMANCE_FOLLOW_UP",
        requiredAction: "FOLLOW_UP_CREATOR",
        reasons: ["SAMPLE_PERFORMANCE_FOLLOW_UP_DUE"],
        samplePerformanceFollowUpStage: "SAMPLE_PERFORMANCE_FOLLOW_UP_STAGE_1",
      }),
    ]),
  );

  // Sample application review: evidence mode x shop reference matrix.
  const reviewCases: Array<[string, Json]> = [
    ["es-trusted.reference-configured", sampleReviewItem()],
    [
      "tendency.reference-not-configured",
      sampleReviewItem({
        predictionEvidence: predictionEvidence(canonicalEvidence("MERCHANT_APPROVAL_TENDENCY")),
        minExpectedSalesReference: { availability: "NOT_CONFIGURED", units: null },
      }),
    ],
    [
      "no-model-signal.reference-shop-unresolved",
      sampleReviewItem({
        predictionEvidence: predictionEvidence(canonicalEvidence("NO_MODEL_SIGNAL")),
        minExpectedSalesReference: { availability: "SHOP_UNRESOLVED", units: null },
      }),
    ],
    [
      "model-signal-error.reference-absent",
      sampleReviewItem({
        predictionEvidence: predictionEvidence(canonicalEvidence("MODEL_SIGNAL_ERROR")),
        minExpectedSalesReference: null,
      }),
    ],
    [
      "data-path-passthrough",
      sampleReviewItem({
        predictionEvidence: predictionEvidence(null, {
          status: "DATA_NOT_READY",
          message: "Creator performance snapshot is not ready",
        }),
      }),
    ],
    [
      "soft-rejected-without-evidence",
      sampleReviewItem({ reviewDisposition: "SOFT_REJECTED", predictionEvidence: null }),
    ],
    [
      "proposal-and-failed-execution",
      sampleReviewItem({
        proposalId: "proposal-demo-001",
        lastFailedExecution: {
          proposalId: "proposal-demo-001",
          proposalType: "REVIEW_SAMPLE_APPLICATION",
          operatorSummary: "Approve the sample for product-demo-001",
          failedAt: "2026-05-31T12:00:00.000Z",
          errorMessage: "Provider timed out",
          errorRetryability: "RETRYABLE",
          consecutiveFailureCount: 2,
          consecutiveFailureCountTruncated: false,
        },
      }),
    ],
    [
      "failed-execution-count-truncated",
      sampleReviewItem({
        lastFailedExecution: {
          proposalId: "proposal-demo-002",
          proposalType: "REVIEW_SAMPLE_APPLICATION",
          operatorSummary: "Reject the sample",
          failedAt: "2026-05-31T12:00:00.000Z",
          errorMessage: "Platform rejected the review",
          errorRetryability: "NON_RETRYABLE",
          consecutiveFailureCount: 5,
          consecutiveFailureCountTruncated: true,
        },
      }),
    ],
    [
      "failed-execution-minimal",
      sampleReviewItem({
        lastFailedExecution: {
          proposalId: "proposal-demo-003",
          proposalType: "SEND_MESSAGE",
          operatorSummary: "Send the reply",
          failedAt: "2026-05-31T12:00:00.000Z",
          errorMessage: "  ",
          errorRetryability: null,
          consecutiveFailureCount: null,
          consecutiveFailureCountTruncated: null,
        },
      }),
    ],
    [
      "revision-requested",
      sampleReviewItem({
        revisionRequestedProposal: {
          id: "proposal-demo-004",
          status: "REVISION_REQUESTED",
          type: "SEND_MESSAGE",
          operatorSummary: "Reply with the commission details",
          decision: { note: "Mention the 15% commission and drop the discount offer." },
          messageIntent: { channelType: "WHATSAPP", parts: [{ type: "TEXT", text: "Hi Dana, the commission is 20%." }] },
          sampleReviewIntent: null,
          creatorTagIntent: null,
          steps: [],
        },
      }),
    ],
  ];
  for (const [name, item] of reviewCases) {
    messageCase(cases, `sample-review.${name}`, sampleReviewWorkItem([item]));
  }
  messageCase(
    cases,
    "sample-review.two-shops-two-references",
    sampleReviewWorkItem(
      [
        sampleReviewItem(),
        sampleReviewItem({
          key: "affiliateCollaboration:collab-demo-002:COMPLETE_COLLABORATION_TASK",
          shopId: SHOP_UK.shopId,
          shopRegion: "GB",
          productId: "product-demo-002",
          sampleApplicationRecordId: "sample-record-demo-002",
          affiliateCollaborationId: "collab-demo-002",
          predictionEvidence: predictionEvidence(canonicalEvidence("MERCHANT_APPROVAL_TENDENCY"), {
            sourceCacheId: "cache-demo-002",
            subject: { sampleApplicationRecordId: "sample-record-demo-002", creatorId: CREATOR_ID, productId: "product-demo-002" },
          }),
          minExpectedSalesReference: { availability: "NOT_CONFIGURED" },
        }),
      ],
      { routingShopIds: [SHOP_US.shopId, SHOP_UK.shopId] },
    ),
    TWO_SHOPS,
  );

  // Sample terminal follow-up: one case per Backend cause.
  for (const cause of Object.values(GQL.AffiliateSampleTerminalCause)) {
    messageCase(
      cases,
      `sample-terminal.${cause.toLowerCase()}`,
      workItem([terminalItem(cause, cause === "UNDETERMINED" ? null : "CANCELLED")], {
        affiliateCollaborationId: null,
        sampleApplicationRecord: { id: "sample-record-demo-001" },
      }),
    );
  }

  // Escalation resolution.
  const escalation = (overrides: Json): Json =>
    agendaItem({
      key: `escalation:escalation-demo-001:HANDLE_ESCALATION_RESOLUTION`,
      sourceType: "AFFILIATE_ESCALATION",
      workKind: "ESCALATION_RESOLUTION",
      requiredAction: "HANDLE_ESCALATION_RESOLUTION",
      reasons: ["ESCALATION_RESOLVED"],
      escalationResolvedAt: "2026-05-31T18:00:00.000Z",
      escalationQuestion: "Can we reship the necklace to a new address?",
      ...overrides,
    });
  messageCase(
    cases,
    "escalation-resolution.full",
    workItem([
      escalation({
        escalationContext: "Creator says the first parcel was lost in transit.",
        escalationDecision: "Approved. Reship once and share the new tracking number.",
        escalationInstructions: "Use the WhatsApp thread.",
      }),
    ]),
  );
  messageCase(
    cases,
    "escalation-resolution.decision-only",
    workItem([escalation({ escalationDecision: "Declined: the parcel was delivered." })]),
  );
  messageCase(
    cases,
    "escalation-resolution.missing-decision",
    workItem([escalation({ escalationDecision: "  " })]),
  );

  // Target Collaboration and the remaining work kinds share the generic path.
  messageCase(
    cases,
    "target-collaboration.campaign-and-collaboration",
    workItem([
      agendaItem({
        key: "affiliateCollaboration:collab-demo-003:COMPLETE_COLLABORATION_TASK",
        sourceType: "PLATFORM_COLLABORATION",
        workKind: "MANUAL_REVIEW",
        requiredAction: "COMPLETE_COLLABORATION_TASK",
        campaignId: "campaign-demo-001",
        affiliateCollaborationId: "collab-demo-003",
        productId: "product-demo-003",
        reasons: ["TARGET_COLLABORATION_ACCEPTED"],
      }),
    ]),
  );
  for (const [kind, requiredAction, reason] of [
    ["MANUAL_REVIEW", "REVIEW_AMBIGUOUS_CONTEXT", "COLLABORATION_CONTEXT_AMBIGUOUS"],
    ["SAMPLE_SHIPMENT", "SHIP_SAMPLE", "SAMPLE_AWAITING_SHIPMENT"],
    ["SAMPLE_PLATFORM_FULFILLMENT_WAIT", "WAIT_PLATFORM_UPDATE", "SAMPLE_AWAITING_PLATFORM_SHIPMENT"],
    ["IDENTITY_RESOLUTION", "RESOLVE_CREATOR_IDENTITY", "IDENTITY_RESOLUTION"],
    ["OBSERVATION_REVIEW", "REVIEW_AGENT_FAILURE", "AGENT_RUN_FAILED"],
  ] as const) {
    messageCase(
      cases,
      `generic.${kind.toLowerCase()}`,
      workItem([agendaItem({ workKind: kind, requiredAction, reasons: [reason] })]),
    );
  }

  // Idempotency-key anchors and refusals.
  messageCase(
    cases,
    "idempotency.inbound-without-lifecycle-event",
    workItem([agendaItem()], {
      creatorRelationship: {
        id: REL_ID, userId: USER_ID, creatorId: CREATOR_ID, systemTags: [],
        committedCheckpointId: null, committedEventCursor: 0, lastInboundLifecycleEventId: null, stateUpdatedAt: AT,
      },
    }),
  );
  messageCase(cases, "refusal.dispatch-not-recommended", workItem([agendaItem()], { agentDispatchRecommended: false }));
  messageCase(cases, "refusal.no-working-agenda", workItem([agendaItem()], { agentWorkingAgendaItems: [] }));
  messageCase(
    cases,
    "refusal.sample-review-missing-evidence",
    sampleReviewWorkItem([sampleReviewItem({ predictionEvidence: null })]),
  );
  messageCase(
    cases,
    "refusal.ok-snapshot-without-canonical-evidence",
    sampleReviewWorkItem([sampleReviewItem({ predictionEvidence: predictionEvidence(null) })]),
  );
  messageCase(
    cases,
    "refusal.unknown-evidence-mode",
    sampleReviewWorkItem([
      sampleReviewItem({ predictionEvidence: predictionEvidence({ evidenceMode: "SOMETHING_ELSE" }) }),
    ]),
  );
  messageCase(
    cases,
    "refusal.model-signal-error-without-error",
    sampleReviewWorkItem([
      sampleReviewItem({
        predictionEvidence: predictionEvidence({
          evidenceMode: "MODEL_SIGNAL_ERROR",
          expectedSales: { family: "EXPECTED_SALES", status: "ERROR", error: null, value: null },
          humanDecision: { family: "HUMAN_DECISION", status: "ERROR", error: null, value: null },
        }),
      }),
    ]),
  );
  messageCase(
    cases,
    "refusal.configured-reference-without-units",
    sampleReviewWorkItem([sampleReviewItem({ minExpectedSalesReference: { availability: "CONFIGURED", units: null } })]),
  );
}

// ── Dispatch cases (system prompt + user turn + gateway RPC sequence) ───────

interface DispatchScenario {
  id: string;
  item: Json;
  shop?: Json;
  contextBuilder?: Json;
}

const BD_FULL = {
  creatorDisplayName: "Riley Park",
  businessPrompt: "Keep outreach concise and warm. Move qualified Creators to WhatsApp.",
  whatsApp: { displayName: "Riley WhatsApp" },
  email: { displayName: "Riley" },
};

const DISPATCH_SCENARIOS: DispatchScenario[] = [
  {
    id: "inbound.bd-full.one-shop.new-session",
    item: workItem([agendaItem({ conversationWindow: conversationWindow() })], { workBundleKind: "CREATOR_REPLY_ONLY" }),
    contextBuilder: { businessDeveloperDispatchContext: BD_FULL },
  },
  {
    id: "inbound.no-bd.one-shop-no-prompt",
    item: workItem([agendaItem({ conversationWindow: conversationWindow() })]),
    contextBuilder: {
      businessDeveloperDispatchContext: null,
      involvedShopInstructions: [{ shopId: SHOP_US.shopId, shopName: SHOP_US.shopName, businessPrompt: null }],
    },
  },
  {
    id: "inbound.bd-name-only.two-shops.zh-staff",
    item: workItem(
      [
        agendaItem({ conversationWindow: conversationWindow() }),
        agendaItem({ key: `relationship:${REL_ID}:UK`, shopId: SHOP_UK.shopId, shopRegion: "GB" }),
      ],
      { routingShopIds: [SHOP_US.shopId, SHOP_UK.shopId] },
    ),
    shop: { staffLanguage: "Chinese" },
    contextBuilder: {
      businessDeveloperDispatchContext: { creatorDisplayName: "Riley Park" },
      involvedShopInstructions: TWO_SHOPS,
    },
  },
  {
    id: "inbound.bd-no-creator-facing-name.non-tiktok-platform",
    item: workItem([agendaItem()]),
    shop: { platform: "shopee" },
    contextBuilder: { businessDeveloperDispatchContext: { email: { displayName: "Riley" } } },
  },
  {
    id: "inbound.restore-committed-checkpoint",
    item: workItem([agendaItem({ conversationWindow: conversationWindow(), boundaryEventCursor: 12 })], {
      creatorRelationship: {
        id: REL_ID, userId: USER_ID, creatorId: CREATOR_ID, systemTags: [],
        committedCheckpointId: "checkpoint-demo-001", committedEventCursor: 10,
        lastInboundLifecycleEventId: "lifecycle-demo-001", stateUpdatedAt: AT,
      },
    }),
    contextBuilder: { businessDeveloperDispatchContext: BD_FULL },
  },
  {
    id: "sample-review.es-trusted.prediction-cache-ids",
    item: sampleReviewWorkItem([sampleReviewItem()], { workBundleKind: "SAMPLE_REVIEW_ONLY" }),
    contextBuilder: { businessDeveloperDispatchContext: BD_FULL },
  },
];

interface Dispatched {
  agentRequest: Json;
  rpcSequence: Array<{ method: string; params: unknown }>;
  sessionContext: unknown;
  toolAllowlist: unknown;
  sessionKey: string;
}

/** Synthetic ToolSpecs only prove how Desktop derives built-ins; ids are not production ids. */
const PROBE_SPEC_IDS = ["PROBE_AFFILIATE_READ_TOOL", "PROBE_AFFILIATE_WRITE_TOOL"];

function installProbeToolSpecs(): void {
  const spec = (id: string, runProfiles: string[]): Json => ({
    __typename: "ToolSpec",
    id,
    name: id.toLowerCase(),
    displayName: id,
    description: "probe",
    category: "probe",
    runProfiles,
    surfaces: [],
  });
  rootStore.ingestGraphQLResponse({
    runProfiles: [],
    surfaces: [],
    toolSpecs: [
      spec(PROBE_SPEC_IDS[0]!, ["AFFILIATE_OPERATOR"]),
      spec(PROBE_SPEC_IDS[1]!, ["AFFILIATE_OPERATOR"]),
      spec("PROBE_CS_TOOL", ["CUSTOMER_SERVICE"]),
    ],
    shops: [],
  });
}

function toolAllowlist(sessionKey: string): unknown {
  const effective = rootStore.toolCapability.getEffectiveToolsForScope(ScopeType.AFFILIATE_SESSION, sessionKey);
  const probesSelected = effective.filter((id) => PROBE_SPEC_IDS.includes(id)).sort();
  // The probe ToolSpecs prove the selection rule; they are not production ids.
  if (probesSelected.join() !== [...PROBE_SPEC_IDS].sort().join() || effective.includes("PROBE_CS_TOOL")) {
    throw new Error(`Unexpected ToolSpec selection for ${sessionKey}: ${effective.join(",")}`);
  }
  return {
    runProfileId: rootStore.toolCapability.getSessionRunProfileId(sessionKey),
    scopeType: ScopeType.AFFILIATE_SESSION,
    // ToolSpecs are backend-owned (ids come from the backend ToolSpec registry):
    // every ToolSpec whose runProfiles include the run profile is selected and no
    // ToolSpec of another profile is. Only the built-ins Desktop adds are recorded here.
    toolSpecSelection: "every backend ToolSpec whose runProfiles include the run profile; none of another profile",
    builtInToolIds: effective.filter((id) => !PROBE_SPEC_IDS.includes(id)).sort(),
  };
}

async function dispatchScenario(scenario: DispatchScenario): Promise<Dispatched> {
  const item = scenario.item;
  const items = item.agentWorkingAgendaItems as Json[];
  h.rpcCalls.length = 0;
  __clearActiveAffiliateRunCheckpointsForTests();
  h.authSession = {
    graphqlFetch: async (query: string) => {
      if (!query.includes("affiliateContextBuilder")) throw new Error(`Unexpected GraphQL call: ${query.slice(0, 80)}`);
      return {
        affiliateContextBuilder: {
          baseMatchesCommitted: true,
          truncated: false,
          targetEventCursor: Math.max(...items.map((i) => i.boundaryEventCursor as number)),
          relationshipOperationalConfigRevision: 2,
          businessDeveloperDispatchContext: null,
          involvedShopInstructions: [
            { shopId: SHOP_US.shopId, shopName: SHOP_US.shopName, businessPrompt: "Prefer fit over audience size." },
          ],
          ...scenario.contextBuilder,
        },
      };
    },
  };
  const shop = {
    objectId: SHOP_US.shopId,
    userId: USER_ID,
    platformShopId: "platform-shop-demo-001",
    shopName: SHOP_US.shopName,
    platform: "tiktok",
    runProfileId: "AFFILIATE_OPERATOR",
    ...scenario.shop,
  };
  // The session context is derived exactly as `AffiliateInbound` derives it.
  const context = (new AffiliateInbound() as unknown as {
    buildContextFromWorkItem(shop: unknown, workItem: unknown): AffiliateContext | null;
  }).buildContextFromWorkItem(shop, item);
  if (!context) throw new Error(`Golden scenario ${scenario.id} has no stable trigger context`);
  const session = new AffiliateSession(shop, context);
  const result = await session.handleWorkItem(item as unknown as GQL.AffiliateWorkItem);
  if (!result.runId) throw new Error(`Golden scenario ${scenario.id} did not dispatch a run`);

  const agentCall = h.rpcCalls.find((call) => call.method === "agent");
  if (!agentCall) throw new Error(`Golden scenario ${scenario.id} sent no agent request`);
  const { provider: _provider, model: _model, ...agentRequest } = agentCall.params as Json;
  return {
    agentRequest,
    rpcSequence: h.rpcCalls
      .filter((call) => call.method !== "agent")
      .map((call) => ({ method: call.method, params: call.params })),
    sessionContext: context,
    toolAllowlist: toolAllowlist(session.scopeKey),
    sessionKey: session.scopeKey,
  };
}

async function addDispatchCases(cases: Cases, stateDir: string): Promise<void> {
  for (const scenario of DISPATCH_SCENARIOS) {
    const dispatched = await dispatchScenario(scenario);
    const input = {
      workItem: scenario.item,
      shop: scenario.shop ?? null,
      dispatchContext: scenario.contextBuilder ?? null,
      note: "provider/model are omitted from the agent request: they come from the user's local model configuration",
    };
    add(
      cases,
      `dispatch.${scenario.id}.agent-request`,
      SRC.session,
      input,
      normalize({ sessionKey: dispatched.sessionKey, ...dispatched.agentRequest }, stateDir),
    );
    add(
      cases,
      `dispatch.${scenario.id}.session-context`,
      SRC.inbound,
      { workItem: scenario.item, shop: scenario.shop ?? null },
      dispatched.sessionContext,
    );
  }
  // The RPC sequence differs only by checkpoint restore vs reset and by cache ids.
  for (const id of [
    "inbound.bd-full.one-shop.new-session",
    "inbound.restore-committed-checkpoint",
    "sample-review.es-trusted.prediction-cache-ids",
  ]) {
    const scenario = DISPATCH_SCENARIOS.find((s) => s.id === id)!;
    const dispatched = await dispatchScenario(scenario);
    add(cases, `dispatch.${id}.gateway-rpc-sequence`, SRC.session, { workItem: scenario.item }, normalize(dispatched.rpcSequence, stateDir));
  }
  const operator = await dispatchScenario(DISPATCH_SCENARIOS[0]!);
  add(
    cases,
    "tool-allowlist.operator-work-item-run",
    SRC.rootStore,
    { runKind: "affiliate-work-item-run", runProfileId: "AFFILIATE_OPERATOR", note: "SYSTEM_RUN_PROFILE_TOOL_AUGMENTATIONS adds built-in `read`" },
    operator.toolAllowlist,
  );
}

// ── Identification cases ────────────────────────────────────────────────────

const IDENT_SESSION_KEY = "agent:affiliate:identify:user-demo-001:whatsapp:14255550100:34600000000";

function identificationWork(overrides: Json = {}): Json {
  return {
    id: "unknown-demo-1",
    sessionKey: IDENT_SESSION_KEY,
    channel: "WHATSAPP",
    providerAddress: "34600000000",
    providerAddressAlt: "100000000000001@lid",
    providerAlias: "Dana",
    accountBindingId: "binding-demo-1",
    accountLabel: "Lumen Home Goods US",
    businessDeveloperId: "bd-demo-1",
    businessDeveloperName: "Riley (BD)",
    businessDeveloperDeviceId: "device-demo",
    lastMessagePreview: "Hola, soy la creadora del video de ayer",
    unreadMessages: [{ inboundSequence: 1, text: "Hola, soy la creadora del video de ayer", receivedAt: "2026-06-01T00:00:00.000Z" }],
    unreadCoverage: "COMPLETE",
    unreadMessageCount: 1,
    handledThroughInboundSequence: 0,
    latestInboundSequence: 1,
    lastProviderMessageId: "MSG-1",
    messageCount: 1,
    firstSeenAt: "2026-06-01T00:00:00.000Z",
    lastSeenAt: "2026-06-01T00:00:00.000Z",
    identificationAttempts: 0,
    remainingIdentificationAttempts: 3,
    lastIdentificationAttemptAt: null,
    nextAttemptEligibleAt: null,
    dispatchable: true,
    notDispatchableReason: null,
    candidates: [],
    ...overrides,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const candidate = (n: number, overrides: Json = {}): Json => ({
  creatorRelationshipId: `rel-candidate-${n}`,
  creatorId: `creator-candidate-${n}`,
  creatorNickname: `Candidate ${n}`,
  creatorUsername: `candidate_${n}`,
  firstSharedAt: "2026-05-30T00:00:00.000Z",
  lastSharedAt: "2026-05-30T00:00:00.000Z",
  evidenceAnchorAt: "2026-05-30T00:00:00.000Z",
  stale: false,
  sharedAfterFirstMessage: false,
  evidenceAgeAtFirstMessageMs: 2 * DAY_MS,
  ...overrides,
});

const IDENTIFICATION_CONTEXT_CASES: Array<[string, Json]> = [
  ["no-candidates", identificationWork()],
  ["one-fresh-candidate", identificationWork({ candidates: [candidate(1)] })],
  [
    "stale-and-shared-after-first-message",
    identificationWork({
      candidates: [
        candidate(1, { stale: true, evidenceAgeAtFirstMessageMs: 40 * DAY_MS }),
        candidate(2, { sharedAfterFirstMessage: true, creatorNickname: null, creatorUsername: null, creatorId: "" }),
      ],
    }),
  ],
  [
    "multi-message-span-with-earlier-read",
    identificationWork({
      messageCount: 4,
      handledThroughInboundSequence: 2,
      latestInboundSequence: 4,
      unreadMessageCount: 2,
      unreadMessages: [
        { inboundSequence: 3, text: "Y la cadena cubana", receivedAt: "2026-06-01T00:05:00.000Z" },
        { inboundSequence: 4, text: null, receivedAt: "2026-06-01T00:06:00.000Z" },
      ],
      identificationAttempts: 1,
      remainingIdentificationAttempts: 2,
      lastIdentificationAttemptAt: "2026-05-31T12:00:00.000Z",
    }),
  ],
  [
    "truncated-unread-span",
    identificationWork({ unreadCoverage: "TRUNCATED", unreadMessageCount: 9, messageCount: 9, latestInboundSequence: 9 }),
  ],
  ["nothing-retained", identificationWork({ unreadMessages: [], unreadMessageCount: 3 })],
  [
    "no-alias-no-alt-unassigned-bd-unlabelled-account",
    identificationWork({ providerAddressAlt: null, providerAlias: null, accountLabel: null, businessDeveloperName: null }),
  ],
];

function addIdentificationCases(cases: Cases): void {
  for (const language of [undefined, "Chinese"] as const) {
    add(
      cases,
      `identification.system-prompt.${language ? language.toLowerCase() : "default-english"}`,
      SRC.identificationFactory,
      { staffLanguage: language ?? null },
      buildIdentificationSystemPrompt(language),
    );
  }
  for (const [name, work] of IDENTIFICATION_CONTEXT_CASES) {
    add(
      cases,
      `identification.run-request.${name}`,
      SRC.identificationFactory,
      { work, staffLanguage: null },
      buildAffiliateIdentificationRunRequest({ work: work as never }),
    );
  }
  add(
    cases,
    "identification.run-request.chinese-staff-language",
    SRC.identificationFactory,
    { work: identificationWork(), staffLanguage: "Chinese" },
    buildAffiliateIdentificationRunRequest({ work: identificationWork() as never, staffLanguage: "Chinese" }),
  );
  add(
    cases,
    "identification.run-request.refused-not-dispatchable",
    SRC.identificationFactory,
    { work: identificationWork({ dispatchable: false, notDispatchableReason: "AWAITING_SENDER_REPLY" }) },
    buildAffiliateIdentificationRunRequest({
      work: identificationWork({ dispatchable: false, notDispatchableReason: "AWAITING_SENDER_REPLY" }) as never,
    }),
  );
  add(
    cases,
    "identification.run-request.refused-no-session-key",
    SRC.identificationFactory,
    { work: identificationWork({ sessionKey: null }) },
    buildAffiliateIdentificationRunRequest({ work: identificationWork({ sessionKey: null }) as never }),
  );
}

async function addIdentificationDispatchCases(cases: Cases, stateDir: string): Promise<void> {
  for (const [id, language] of [
    ["default-english", undefined],
    ["chinese", "zh"],
  ] as const) {
    h.rpcCalls.length = 0;
    resetAffiliateUnknownSenderDispatchStateForTests();
    __clearActiveAffiliateIdentificationRunsForTests();
    const work = identificationWork({ candidates: [candidate(1)] });
    await catchUpAffiliateUnknownSenderIdentification(
      {
        graphqlFetch: async () => ({ affiliateUnknownSenderIdentificationWork: [work] }),
        getAccessToken: () => "token",
      } as never,
      "device-demo",
      language ? () => language : undefined,
    );
    const agentCall = h.rpcCalls.find((call) => call.method === "agent");
    if (!agentCall) throw new Error("Identification golden did not dispatch");
    const { provider: _p, model: _m, ...agentRequest } = agentCall.params as Json;
    add(
      cases,
      `identification.dispatch.${id}`,
      SRC.identificationActuator,
      { work, deviceId: "device-demo", uiLocale: language ?? null },
      normalize(
        {
          agentRequest,
          gatewayRpcSequence: h.rpcCalls.filter((call) => call.method !== "agent"),
          toolAllowlist: toolAllowlist(IDENT_SESSION_KEY),
        },
        stateDir,
      ),
    );
  }
}

// ── Skill and agent config ──────────────────────────────────────────────────

function walkFiles(dir: string): string[] {
  return readdirSync(dir)
    .flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? walkFiles(full) : [full];
    })
    .sort();
}

async function addSkillCases(cases: Cases, stateDir: string, skillSource: "real" | "synthetic"): Promise<void> {
  const descriptor = await loadAffiliateWorkflowSkillDescriptor({ OPENCLAW_STATE_DIR: stateDir });
  add(
    cases,
    "skill.descriptor-and-catalog",
    SRC.skill,
    {
      skillSource: skillSource === "real" ? "server/preset-skills/affiliate/affiliate-workflow/SKILL.md" : "synthetic",
      openclawStateDir: SYNTHETIC_STATE_DIR,
    },
    normalize({ descriptor, catalog: renderAffiliateWorkflowSkillCatalog(descriptor) }, stateDir),
  );
  add(
    cases,
    "skill.catalog-xml-escaping",
    SRC.skill,
    {
      descriptor: {
        name: "affiliate-workflow",
        description: "Use A & B <together> with \"quotes\" and 'apostrophes'",
        version: "1.0.0",
        location: "/synthetic/openclaw-state/workspace-affiliate/skills/affiliate-workflow/SKILL.md",
      },
    },
    renderAffiliateWorkflowSkillCatalog({
      name: "affiliate-workflow",
      description: "Use A & B <together> with \"quotes\" and 'apostrophes'",
      version: "1.0.0",
      location: "/synthetic/openclaw-state/workspace-affiliate/skills/affiliate-workflow/SKILL.md",
    }),
  );
  if (skillSource === "real") {
    add(
      cases,
      "skill.bundle-manifest",
      SRC.skill,
      {
        note: "The Agent reads these files with the built-in `read` tool from the workspace-local skill directory; the bodies are not part of the prompt.",
        bundleDir: "server/preset-skills/affiliate/affiliate-workflow",
      },
      walkFiles(REAL_SKILL_DIR).map((file) => ({
        path: relative(REAL_SKILL_DIR, file),
        bytes: statSync(file).size,
        sha256: sha256(readFileSync(file)),
      })),
    );
  }
}

function addAgentConfigCase(cases: Cases): void {
  const affiliate = buildManagedGatewayAgents(SYNTHETIC_STATE_DIR).find((agent) => agent.id === "affiliate");
  if (!affiliate) throw new Error("Managed gateway agents define no affiliate agent");
  add(cases, "agent-config.managed-affiliate-agent", SRC.configBuilder, { stateDir: SYNTHETIC_STATE_DIR }, affiliate);
}

// ── Orchestration ───────────────────────────────────────────────────────────

async function generateAll(stateDir: string, skillSource: "real" | "synthetic"): Promise<Cases> {
  const cases: Cases = new Map();
  addUserMessageCases(cases);
  await addDispatchCases(cases, stateDir);
  addIdentificationCases(cases);
  await addIdentificationDispatchCases(cases, stateDir);
  await addSkillCases(cases, stateDir, skillSource);
  addAgentConfigCase(cases);
  return cases;
}

function rootCommit(): string {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" }).trim();
}

function serialize(golden: Golden): string {
  return `${JSON.stringify(golden, null, 2)}\n`;
}

describe("affiliate parity goldens", () => {
  let stateDir: string;
  const outRoot = process.env.AGENT_GOLDENS_OUT;
  const realSkill = existsSync(join(REAL_SKILL_DIR, "SKILL.md"));

  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FROZEN_NOW);
    stateDir = mkdtempSync(join(tmpdir(), "affiliate-goldens-"));
    process.env.OPENCLAW_STATE_DIR = stateDir;
    const skillDir = join(stateDir, "workspace-affiliate", "skills", "affiliate-workflow");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, "SKILL.md"),
      realSkill
        ? readFileSync(join(REAL_SKILL_DIR, "SKILL.md"))
        : "---\nname: affiliate-workflow\ndescription: Synthetic stand-in used when the server checkout is absent.\nversion: 0.0.0\n---\n",
    );
    initLLMProviderManagerEnv({
      storage: {
        providerKeys: { getActive: () => ({ provider: "openai", model: "gpt-5-test", authType: "custom" }) },
      } as never,
      secretStore: {} as never,
      getRpcClient: () => ({ request: async () => ({}) }) as never,
      toMstSnapshot: vi.fn(),
      allKeysToMstSnapshots: vi.fn(),
      syncActiveKey: vi.fn(),
      syncAllAuthProfiles: vi.fn(),
      activateAuthProfile: vi.fn(),
      writeProxyRouterConfig: vi.fn(),
      writeDefaultModelToConfig: vi.fn(),
      writeFullGatewayConfig: vi.fn(),
      restartGateway: vi.fn(),
      proxyFetch: vi.fn(),
      stateDir: "/tmp/rivonclaw-goldens",
      getLastSystemProxy: () => null,
    } as never);
    installProbeToolSpecs();
  });

  afterAll(() => {
    vi.useRealTimers();
    delete process.env.OPENCLAW_STATE_DIR;
    rmSync(stateDir, { recursive: true, force: true });
  });

  it(outRoot ? "writes the goldens and they are stable" : "regenerates the goldens stably", async () => {
    if (outRoot && !realSkill) {
      throw new Error("Writing goldens requires server/preset-skills/affiliate/affiliate-workflow to exist");
    }
    const skillSource = realSkill ? "real" : "synthetic";
    const first = await generateAll(stateDir, skillSource);
    const second = await generateAll(stateDir, skillSource);

    expect([...first.keys()]).toEqual([...second.keys()]);
    for (const [id, golden] of first) {
      expect(JSON.stringify(second.get(id)), `golden ${id} is not stable`).toBe(JSON.stringify(golden));
      expect(golden.output, `golden ${id} has no output`).not.toBeUndefined();
    }
    expect(first.size).toBeGreaterThan(60);

    if (!outRoot) return;
    const commit = rootCommit();
    const dir = join(outRoot, "affiliate");
    mkdirSync(dir, { recursive: true });
    const expectedFiles = new Set<string>();
    for (const [id, { file, ...golden }] of first) {
      const name = `${id}.json`;
      expectedFiles.add(name);
      writeFileSync(
        join(dir, name),
        serialize({ ...golden, source: { repo: "root", commit, file } }),
      );
    }
    // Remove goldens of cases that no longer exist so the directory is exactly this generation.
    for (const existing of readdirSync(dir)) {
      if (existing.endsWith(".json") && !expectedFiles.has(existing)) rmSync(join(dir, existing));
    }
  });

  it("matches the committed goldens exactly (case, input, output; source.commit ignored)", async (ctx) => {
    if (outRoot) {
      ctx.skip("AGENT_GOLDENS_OUT is set: this run regenerates goldens instead of comparing");
    }
    const goldenDir = join(
      process.env.AGENT_GOLDENS_DIR ?? join(REPO_ROOT, "server/backend/test-fixtures/agent-goldens"),
      "affiliate",
    );
    if (!existsSync(goldenDir)) {
      ctx.skip(`committed goldens not found at ${goldenDir} (no server checkout in this workspace)`);
    }
    if (!realSkill) {
      ctx.skip("server/preset-skills/affiliate/affiliate-workflow is absent, so skill goldens cannot be reproduced");
    }
    const generated = await generateAll(stateDir, "real");
    const committedFiles = readdirSync(goldenDir).filter((n) => n.endsWith(".json")).sort();
    const generatedNames = [...generated.keys()].map((id) => `${id}.json`).sort();
    // Stale committed files (no generated case) and missing files (case without a golden).
    expect(committedFiles).toEqual(generatedNames);
    for (const [id, { file: _file, ...golden }] of generated) {
      const committed = JSON.parse(readFileSync(join(goldenDir, `${id}.json`), "utf8"));
      const actual = JSON.parse(JSON.stringify(golden));
      expect(
        { case: committed.case, input: committed.input, output: committed.output },
        `golden ${id} is out of date; regenerate with AGENT_GOLDENS_OUT`,
      ).toEqual({ case: actual.case, input: actual.input, output: actual.output });
    }
  });
});
