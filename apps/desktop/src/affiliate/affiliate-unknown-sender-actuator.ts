import { createLogger } from "@rivonclaw/logger";
import type { AuthSessionManager } from "../auth/session.js";
import { rootStore } from "../app/store/desktop-store.js";
import {
  AFFILIATE_UNKNOWN_SENDER_IDENTIFICATION_WORK_QUERY,
  type AffiliateUnknownSenderIdentificationWorkPayload,
  type AffiliateUnknownSenderIdentificationWorkQueryResult,
} from "../cloud/affiliate-queries.js";
import { requestAgent } from "../gateway/agent-tooling-readiness.js";
import { localeToStaffLanguage } from "../i18n/locale.js";
import { openClawConnector } from "../openclaw/index.js";
import { buildAffiliateIdentificationRunRequest } from "./affiliate-identification-run-factory.js";
import { DEBUG_AFFILIATE_PROMPT, DEFAULT_AFFILIATE_RUN_PROFILE_ID } from "./affiliate-session.js";

const log = createLogger("affiliate-unknown-sender");

/** How many strangers one poll asks for. The backend caps this at 100. */
const IDENTIFICATION_WORK_PAGE_SIZE = 50;

/**
 * How often we ask the backend who is waiting to be identified.
 *
 * There is no subscription for unknown senders: a stranger's first message
 * creates the row through the Provider drop site, which publishes nothing. The
 * interval only has to be short relative to how long a person will wait for a
 * reply, and the query is one indexed read per seller.
 */
const IDENTIFICATION_POLL_INTERVAL_MS = 5 * 60 * 1000;

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
 * The value is the row version an agent run was started for. A re-poll of
 * unchanged work must not open a second run for one stranger; a spent attempt
 * or a new message is genuinely new work and re-enters.
 */
const dispatchedRowVersions = new Map<string, string>();

/** Rows with a dispatch in flight, so two overlapping polls cannot both start one. */
const inFlightRowIds = new Set<string>();

function rowVersion(work: AffiliateUnknownSenderIdentificationWorkPayload): string {
  return `${work.identificationAttempts}:${work.messageCount}`;
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

  for (const work of rows) {
    await handleAffiliateUnknownSenderIdentificationWork(work, deviceId, getUiLocale);
  }
}

/**
 * Starts polling for unknown senders and returns the stop function.
 *
 * Each pass is skipped while the session holds no access token, so the poll
 * goes quiet after logout without a teardown of its own.
 */
export function startAffiliateUnknownSenderIdentificationPolling(
  authSession: AuthSessionManager,
  deviceId: string,
  getUiLocale?: () => string,
): () => void {
  const poll = (): void => {
    if (!authSession.getAccessToken()) return;
    void catchUpAffiliateUnknownSenderIdentification(authSession, deviceId, getUiLocale).catch(
      (error) => {
        log.warn("Failed to read pending Affiliate unknown senders", error);
      },
    );
  };
  poll();
  const timer = setInterval(poll, IDENTIFICATION_POLL_INTERVAL_MS);
  return () => clearInterval(timer);
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

  const request = buildAffiliateIdentificationRunRequest({
    work,
    staffLanguage: getUiLocale ? localeToStaffLanguage(getUiLocale()) : undefined,
  });
  if (!request) return;

  inFlightRowIds.add(work.id);
  try {
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
        `scope=${sessionKey} unknownInboundContact=${work.id}`,
    );
  } catch (error) {
    // Leave the row undispatched so the next poll retries it. The backend has
    // spent no attempt: the cap is claimed inside the reply tool, not here.
    log.warn(
      `Failed to dispatch Affiliate identification run for unknownInboundContact=${work.id}`,
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
      `candidates=${work.candidates.length}`,
      `messageChars=${message.length}`,
      `systemPromptChars=${systemPrompt.length}`,
      "promptContextVersion=affiliate-unknown-sender-identification-v1",
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
}
