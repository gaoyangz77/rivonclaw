import { createLogger } from "@rivonclaw/logger";
import type { AuthSessionManager } from "../auth/session.js";
import { rootStore } from "../app/store/desktop-store.js";
import {
  AFFILIATE_UNKNOWN_SENDER_IDENTIFICATION_WORK_QUERY,
  type AffiliateUnknownSenderIdentificationWorkPayload,
  type AffiliateUnknownSenderIdentificationWorkQueryResult,
} from "../cloud/affiliate-queries.js";
import { ensureAgentToolingReady, requestAgent } from "../gateway/agent-tooling-readiness.js";
import { localeToStaffLanguage } from "../i18n/locale.js";
import { openClawConnector } from "../openclaw/index.js";
import { buildAffiliateIdentificationRunRequest } from "./affiliate-identification-run-factory.js";
import {
  getActiveAffiliateIdentificationRun,
  registerActiveAffiliateIdentificationRun,
  releaseAffiliateIdentificationRun,
  sweepFinishedAffiliateIdentificationRuns,
  __clearActiveAffiliateIdentificationRunsForTests,
} from "./affiliate-identification-run-spans.js";
import { DEBUG_AFFILIATE_PROMPT, DEFAULT_AFFILIATE_RUN_PROFILE_ID } from "./affiliate-session.js";

const log = createLogger("affiliate-unknown-sender");

/** How many strangers one read asks for. The backend caps this at 100. */
const IDENTIFICATION_WORK_PAGE_SIZE = 50;

/**
 * The safety net, not the delivery path.
 *
 * Identification work reaches this device by subscription: the drop site
 * records a stranger's message and the backend publishes
 * `affiliateUnknownSenderIdentificationChanged`, exactly as Creator work
 * arrives through `affiliateWorkItemChanged`. This sweep exists only because
 * subscriptions drop, and a dropped event must not leave a person waiting
 * indefinitely for an answer nobody knows they are owed. It is deliberately
 * slow: making it fast would make it the mechanism again, and hide the day the
 * push stops working.
 */
const IDENTIFICATION_SWEEP_INTERVAL_MS = 15 * 60 * 1000;

/**
 * How long a wake-up waits for others before reading.
 *
 * A stranger sending five messages produces five events and one piece of work.
 * The backend already refuses to dispatch until their burst settles, so five
 * immediate reads would return "still settling" five times. Coalescing them
 * costs a second of latency and removes four round trips.
 */
const IDENTIFICATION_WAKE_COALESCE_MS = 1000;

/**
 * Slack added when re-reading a row the backend withheld until a stated time.
 *
 * Without this the settle window would be closed by the sweep — the stranger
 * stops typing, the backend says "ready in 15 seconds", and nothing asks again
 * for fifteen minutes. A wait with a stated end is a wait we schedule.
 */
const IDENTIFICATION_WAIT_RECHECK_SLACK_MS = 1000;

/**
 * The single device an unknown-sender row is targeted at, or the reason no
 * device can claim it.
 *
 * The same rule `computeAffiliateWorkItemDeviceTarget` applies to Affiliate
 * work items, minus the half that cannot exist here: an unknown-inbound row
 * has no shop anchor at all — no agenda item, no relationship shop state — so
 * there is nothing for a shop device to be selected from. Business Developer
 * or nobody.
 */
export type AffiliateIdentificationDeviceTarget =
  | { kind: "BUSINESS_DEVELOPER"; deviceId: string }
  /**
   * A 商务 owns the seller account but has no outreach device bound. Nobody
   * dispatches and the row waits visibly. There is deliberately NO shop
   * fallback: shop devices must not pick up Business Developer work.
   */
  | { kind: "BUSINESS_DEVELOPER_WITHOUT_DEVICE" }
  /**
   * No 商务 is on the row. Unlike a work item, there is no second rule to fall
   * back to, so nobody dispatches until the seller account gets a custodian.
   */
  | { kind: "NO_BUSINESS_DEVELOPER" };

/**
 * Deterministic single-target device selection for an unknown-sender row.
 *
 * Every Desktop of the seller computes the same target from the same payload,
 * and only the one whose local device id equals the target proceeds — so one
 * stranger is asked who they are once, not once per running Desktop. Both the
 * 商务 and their device are frozen by the backend the instant the row was read,
 * which is what makes the answer identical everywhere.
 */
export function computeAffiliateIdentificationDeviceTarget(
  work: AffiliateUnknownSenderIdentificationWorkPayload,
): AffiliateIdentificationDeviceTarget {
  const businessDeveloperId = trimmedOrNull(work.businessDeveloperId);
  if (!businessDeveloperId) return { kind: "NO_BUSINESS_DEVELOPER" };
  const deviceId = trimmedOrNull(work.businessDeveloperDeviceId);
  return deviceId
    ? { kind: "BUSINESS_DEVELOPER", deviceId }
    : { kind: "BUSINESS_DEVELOPER_WITHOUT_DEVICE" };
}

/**
 * Rows this Desktop has already handed to the agent, keyed by row id.
 *
 * The value is the row version an agent run was started for. A re-read of
 * unchanged work must not open a second run for one stranger; a spent attempt
 * or an unread message is genuinely new work and re-enters.
 */
const dispatchedRowVersions = new Map<string, string>();

/** Rows with a dispatch in flight, so two overlapping reads cannot both start one. */
const inFlightRowIds = new Set<string>();

/** Coalesces a burst of wake-ups into one read. */
let pendingWakeTimer: ReturnType<typeof setTimeout> | null = null;
/** The scheduled re-read for a row the backend withheld until a stated time. */
let pendingWaitTimer: ReturnType<typeof setTimeout> | null = null;
let pendingWaitAtMs: number | null = null;

/**
 * The version of the work, as the span defines it.
 *
 * Keyed by the two cursors rather than by `messageCount`, because the span is
 * what a run is actually given: a message that arrives and is committed in the
 * same breath is not new work, and a run whose span was never committed still
 * is. `messageCount` counts observations and answers neither question.
 */
function rowVersion(work: AffiliateUnknownSenderIdentificationWorkPayload): string {
  return [
    work.identificationAttempts,
    work.handledThroughInboundSequence,
    work.latestInboundSequence,
  ].join(":");
}

/**
 * Reads the pending unknown senders and dispatches the ones this device owns.
 *
 * Reading is itself meaningful: the backend retires rows that have spent every
 * attempt in the same read, so a stranger nobody could identify leaves the
 * queue here rather than being offered forever.
 */
export async function catchUpAffiliateUnknownSenderIdentification(
  authSession: AuthSessionManager,
  deviceId: string,
  getUiLocale?: () => string,
): Promise<void> {
  const data = await authSession.graphqlFetch<AffiliateUnknownSenderIdentificationWorkQueryResult>(
    AFFILIATE_UNKNOWN_SENDER_IDENTIFICATION_WORK_QUERY,
    { input: { limit: IDENTIFICATION_WORK_PAGE_SIZE } },
  );
  const rows = data.affiliateUnknownSenderIdentificationWork ?? [];
  const liveRowIds = new Set(rows.map((row) => row.id));
  for (const id of dispatchedRowVersions.keys()) {
    if (!liveRowIds.has(id)) dispatchedRowVersions.delete(id);
  }
  sweepFinishedAffiliateIdentificationRuns();

  for (const work of rows) {
    await handleAffiliateUnknownSenderIdentificationWork(work, deviceId, getUiLocale);
  }

  scheduleWithheldRowRecheck(rows, deviceId, () =>
    catchUpAffiliateUnknownSenderIdentification(authSession, deviceId, getUiLocale),
  );
}

/**
 * Re-reads once, at the moment the backend said a withheld row becomes ready.
 *
 * `AWAITING_MESSAGE_SETTLE` is a wait with a stated end, and a wait with a
 * stated end must be scheduled rather than swept up later. Without this a
 * stranger who stops typing waits out the settle window and then waits for the
 * sweep — the delay this whole change exists to remove, reappearing behind a
 * shorter name. Only the earliest such time is tracked: one timer clears every
 * row that becomes ready at or before it.
 */
function scheduleWithheldRowRecheck(
  rows: AffiliateUnknownSenderIdentificationWorkPayload[],
  deviceId: string,
  reread: () => Promise<void>,
): void {
  const now = Date.now();
  const earliest = rows
    .filter((row) => {
      const target = computeAffiliateIdentificationDeviceTarget(row);
      return target.kind === "BUSINESS_DEVELOPER" && target.deviceId === deviceId;
    })
    .map((row) => (row.nextAttemptEligibleAt ? Date.parse(row.nextAttemptEligibleAt) : NaN))
    .filter((at) => Number.isFinite(at) && at > now)
    .reduce<number | null>((min, at) => (min == null || at < min ? at : min), null);
  if (earliest == null) return;
  if (pendingWaitTimer && pendingWaitAtMs != null && pendingWaitAtMs <= earliest) return;
  if (pendingWaitTimer) clearTimeout(pendingWaitTimer);
  pendingWaitAtMs = earliest;
  pendingWaitTimer = setTimeout(() => {
    pendingWaitTimer = null;
    pendingWaitAtMs = null;
    void reread().catch((error) => {
      log.warn("Failed to re-read a settled Affiliate unknown sender", error);
    });
  }, earliest - now + IDENTIFICATION_WAIT_RECHECK_SLACK_MS);
}

/**
 * Wakes this device because a stranger said something nobody has read.
 *
 * The signal names a row, but the read is unfiltered: the same query decides
 * every row's span, candidates and dispatch verdict, and having a second path
 * that reads one row would be a second answer to the question of what a run is
 * dispatched with. A burst of signals collapses into one read.
 */
export function wakeAffiliateUnknownSenderIdentification(
  authSession: AuthSessionManager,
  deviceId: string,
  getUiLocale?: () => string,
): void {
  if (pendingWakeTimer) return;
  pendingWakeTimer = setTimeout(() => {
    pendingWakeTimer = null;
    if (!authSession.getAccessToken()) return;
    void catchUpAffiliateUnknownSenderIdentification(authSession, deviceId, getUiLocale).catch(
      (error) => {
        log.warn("Failed to read pending Affiliate unknown senders after a wake-up", error);
      },
    );
  }, IDENTIFICATION_WAKE_COALESCE_MS);
}

/**
 * Starts the low-frequency catch-up sweep and returns the stop function.
 *
 * The sweep is the floor, not the mechanism — see
 * `IDENTIFICATION_SWEEP_INTERVAL_MS`. Push delivery lives in
 * `wakeAffiliateUnknownSenderIdentification`. Each pass is skipped while the
 * session holds no access token, so it goes quiet after logout without a
 * teardown of its own.
 */
export function startAffiliateUnknownSenderIdentificationSweep(
  authSession: AuthSessionManager,
  deviceId: string,
  getUiLocale?: () => string,
): () => void {
  const sweep = (): void => {
    if (!authSession.getAccessToken()) return;
    void catchUpAffiliateUnknownSenderIdentification(authSession, deviceId, getUiLocale).catch(
      (error) => {
        log.warn("Failed to read pending Affiliate unknown senders", error);
      },
    );
  };
  sweep();
  const timer = setInterval(sweep, IDENTIFICATION_SWEEP_INTERVAL_MS);
  return () => {
    clearInterval(timer);
    if (pendingWakeTimer) clearTimeout(pendingWakeTimer);
    if (pendingWaitTimer) clearTimeout(pendingWaitTimer);
    pendingWakeTimer = null;
    pendingWaitTimer = null;
    pendingWaitAtMs = null;
  };
}

async function handleAffiliateUnknownSenderIdentificationWork(
  work: AffiliateUnknownSenderIdentificationWorkPayload,
  deviceId: string,
  getUiLocale?: () => string,
): Promise<void> {
  const target = computeAffiliateIdentificationDeviceTarget(work);
  if (target.kind === "BUSINESS_DEVELOPER_WITHOUT_DEVICE") {
    log.info(
      `Affiliate unknown sender is Business Developer-routed but the developer has no device; ` +
        `no desktop dispatches and the row waits visibly: unknownInboundContact=${work.id}`,
    );
    return;
  }
  if (target.kind === "NO_BUSINESS_DEVELOPER") {
    log.info(
      `Affiliate unknown sender has no Business Developer, and identification has no shop to fall ` +
        `back to; no desktop dispatches: unknownInboundContact=${work.id}`,
    );
    return;
  }
  if (target.deviceId !== deviceId) return;

  // The backend owns the attempt cap, the cooldown and the safety of the
  // session key. Read its answer; never second-guess it.
  if (!work.dispatchable) {
    log.info(
      `Affiliate unknown sender is not dispatchable yet: unknownInboundContact=${work.id} ` +
        `reason=${work.notDispatchableReason ?? "(unstated)"} ` +
        `nextAttemptEligibleAt=${work.nextAttemptEligibleAt ?? "(none)"}`,
    );
    return;
  }
  const sessionKey = work.sessionKey;
  if (!sessionKey) {
    // Only reachable if the backend ever reports a dispatchable row with no
    // key. Refuse loudly rather than inventing one: two strangers sharing a
    // transcript is the exact failure this feature exists to remove.
    log.error(
      `Affiliate unknown sender is dispatchable but carries no session key; refusing to run: ` +
        `unknownInboundContact=${work.id}`,
    );
    return;
  }

  const version = rowVersion(work);
  if (dispatchedRowVersions.get(work.id) === version) return;
  if (inFlightRowIds.has(work.id)) return;
  // One run per stranger. A message arriving mid-run would otherwise open a
  // second run over a wider span, and whichever finished first would commit
  // its own — marking as read messages the other run was still holding.
  const liveRun = getActiveAffiliateIdentificationRun(work.id);
  if (liveRun) {
    log.info(
      `Affiliate identification run is still in flight for this stranger; not opening a second: ` +
        `unknownInboundContact=${work.id} ` +
        `span=${liveRun.baseInboundSequence}-${liveRun.targetInboundSequence}`,
    );
    return;
  }

  const request = buildAffiliateIdentificationRunRequest({
    work,
    staffLanguage: getUiLocale ? localeToStaffLanguage(getUiLocale()) : undefined,
  });
  if (!request) return;

  inFlightRowIds.add(work.id);
  try {
    // The gateway may not be up yet — this is the first thing that runs after
    // a restart, and a wake-up can land before the RPC client connects.
    // Waiting for readiness turns "RPC client not connected" from a logged
    // failure into a scheduling detail. Nothing here spends an identification
    // attempt: the cap is claimed inside the reply tool, which only the agent
    // can reach, so a dispatch that never starts costs the sender nothing.
    await ensureAgentToolingReady();
    registerActiveAffiliateIdentificationRun({
      unknownInboundContactId: work.id,
      sessionKey,
      baseInboundSequence: work.handledThroughInboundSequence,
      targetInboundSequence: work.latestInboundSequence,
    });
    await registerIdentificationSession(sessionKey, work);
    logIdentificationPromptContext(sessionKey, work, request.message, request.extraSystemPrompt);
    const resolvedModel = rootStore.llmManager.resolveModelForDispatch(sessionKey);
    const response = await requestAgent<{ runId?: string }>({
      sessionKey,
      provider: resolvedModel.provider,
      model: resolvedModel.model,
      message: request.message,
      extraSystemPrompt: request.extraSystemPrompt,
      promptMode: "raw",
      idempotencyKey: request.idempotencyKey,
    });
    dispatchedRowVersions.set(work.id, version);
    log.info(
      `Affiliate identification run dispatched: runId=${response?.runId ?? "(none)"} ` +
        `scope=${sessionKey} unknownInboundContact=${work.id} ` +
        `span=${work.handledThroughInboundSequence}-${work.latestInboundSequence} ` +
        `unread=${work.unreadMessages.length}/${work.unreadMessageCount} ` +
        `coverage=${work.unreadCoverage}`,
    );
  } catch (error) {
    // The run never started, so it holds no span and committed nothing.
    // Release the lease and leave the row undispatched: the next wake-up or
    // sweep offers exactly the same span again.
    releaseAffiliateIdentificationRun(work.id);
    log.warn(
      `Failed to dispatch Affiliate identification run for unknownInboundContact=${work.id}; ` +
        `the span is uncommitted and will be offered again`,
      error,
    );
  } finally {
    inFlightRowIds.delete(work.id);
  }
}

/**
 * Registers the tool session the three identification tools resolve against.
 *
 * Mirrors `AffiliateSession.setup()`: the same run profile gates the same tool
 * catalog, and the same `tool_register_session` gateway method stores the
 * context the `before_tool_call` hook injects. The context is deliberately a
 * different kind — it carries the unknown-inbound row and never a
 * `creatorRelationshipId`, because this run has no 达人 to name.
 */
async function registerIdentificationSession(
  sessionKey: string,
  work: AffiliateUnknownSenderIdentificationWorkPayload,
): Promise<void> {
  rootStore.toolCapability.setSessionRunProfile(sessionKey, DEFAULT_AFFILIATE_RUN_PROFILE_ID);
  await openClawConnector.request("tool_register_session", {
    sessionKey,
    toolContext: {
      kind: "AFFILIATE_IDENTIFICATION",
      unknownInboundContactId: work.id,
      // The span this run is held to, frozen before it starts. Context-bound
      // on all three terminal tools, so it is stripped from the Agent-facing
      // schema and injected from here — the run cannot choose what it is
      // credited with having read, exactly as it cannot choose which stranger
      // it is answering for.
      baseInboundSequence: work.handledThroughInboundSequence,
      targetInboundSequence: work.latestInboundSequence,
    },
  });
}

function logIdentificationPromptContext(
  sessionKey: string,
  work: AffiliateUnknownSenderIdentificationWorkPayload,
  message: string,
  systemPrompt: string,
): void {
  log.info(
    [
      "Affiliate identification dispatch prompt context",
      `scope=${sessionKey}`,
      `unknownInboundContact=${work.id}`,
      `channel=${work.channel}`,
      `attempt=${work.identificationAttempts + 1}/${work.identificationAttempts + work.remainingIdentificationAttempts}`,
      `span=${work.handledThroughInboundSequence}-${work.latestInboundSequence}`,
      `unreadShown=${work.unreadMessages.length}`,
      `unreadOwed=${work.unreadMessageCount}`,
      `unreadCoverage=${work.unreadCoverage}`,
      `candidates=${work.candidates.length}`,
      `messageChars=${message.length}`,
      `systemPromptChars=${systemPrompt.length}`,
      "promptContextVersion=affiliate-unknown-sender-identification-v2",
      `debugFullPrompt=${DEBUG_AFFILIATE_PROMPT}`,
    ].join(" "),
  );

  if (!DEBUG_AFFILIATE_PROMPT) return;
  log.info(
    [
      "[Affiliate Identification Full Prompt]",
      `scope=${sessionKey}`,
      "",
      "## extraSystemPrompt",
      systemPrompt,
      "",
      "## userMessage",
      message,
      "[/Affiliate Identification Full Prompt]",
    ].join("\n"),
  );
}

function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Test seam: clears the per-process dispatch memory between cases. */
export function resetAffiliateUnknownSenderDispatchStateForTests(): void {
  dispatchedRowVersions.clear();
  inFlightRowIds.clear();
  __clearActiveAffiliateIdentificationRunsForTests();
  if (pendingWakeTimer) clearTimeout(pendingWakeTimer);
  if (pendingWaitTimer) clearTimeout(pendingWaitTimer);
  pendingWakeTimer = null;
  pendingWaitTimer = null;
  pendingWaitAtMs = null;
}
