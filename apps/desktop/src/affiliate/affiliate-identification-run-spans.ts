/**
 * The frozen inbound span each in-flight identification (识别) run is working on.
 *
 * A sibling of `affiliate-run-checkpoints.ts`, not a mode of it. That registry
 * is keyed by `creatorRelationshipId` and carries a Creator run's checkpoint,
 * agenda snapshot and prediction lineage; an identification run has none of
 * those — no 达人, no agenda, no shop — and is keyed by the unknown-inbound row
 * instead. Making the Creator registry's key nullable would push that
 * uncertainty onto every consumer that today relies on it being present.
 *
 * Two jobs, and they are the same job seen from either end:
 *
 * 1. **The span.** A run is dispatched with everything the sender has said
 *    that no completed run has been shown, and it commits exactly that span
 *    when it finishes. The two cursors are frozen here at dispatch and reach
 *    the backend through the run's session context, so what a run is held to
 *    have covered is decided before it starts and never by the run itself.
 *
 * 2. **One run per stranger.** While a run holds this lease, no second run is
 *    dispatched for the same row. Without it a message arriving mid-run would
 *    open a second run whose wider span would then be committed by whichever
 *    finished first — marking messages read that nobody read, which is the
 *    exact failure the cursor exists to remove.
 *
 * The lease expires. A run that dies without reaching a terminal tool call
 * would otherwise hold its row forever, and a stranger nobody may look at is
 * worse than a stranger looked at twice. Expiry costs at most one repeated
 * run over a span that was never committed.
 */

/** A terminal identification tool call, named by what it decided. */
export type AffiliateIdentificationTerminalOutcome = "REPLIED" | "LINKED" | "IGNORED";

export interface ActiveAffiliateIdentificationRun {
  unknownInboundContactId: string;
  sessionKey: string;
  /** The handled cursor the run started from. The backend's compare-and-swap base. */
  baseInboundSequence: number;
  /** The end of the frozen span. The handled cursor advances here on a terminal outcome. */
  targetInboundSequence: number;
  startedAtMs: number;
  terminalOutcome?: AffiliateIdentificationTerminalOutcome;
}

/**
 * How long one identification run may hold its row before the lease is assumed
 * dead.
 *
 * Generous on purpose: the cost of waiting too long is a stranger kept waiting,
 * and the cost of expiring too early is a duplicate run. Neither is free, but
 * an identification run is a handful of tool calls and ten minutes is far
 * beyond any honest completion time.
 */
export const AFFILIATE_IDENTIFICATION_RUN_LEASE_MS = 10 * 60 * 1000;

const activeRuns = new Map<string, ActiveAffiliateIdentificationRun>();

export function registerActiveAffiliateIdentificationRun(
  input: Omit<ActiveAffiliateIdentificationRun, "startedAtMs" | "terminalOutcome"> & {
    now?: number;
  },
): void {
  activeRuns.set(input.unknownInboundContactId, {
    unknownInboundContactId: input.unknownInboundContactId,
    sessionKey: input.sessionKey,
    baseInboundSequence: input.baseInboundSequence,
    targetInboundSequence: input.targetInboundSequence,
    startedAtMs: input.now ?? Date.now(),
  });
}

/**
 * The run currently holding this row, or null once it has finished or expired.
 *
 * Expiry is evaluated on read and drops the entry, so a dead run releases its
 * row the next time anybody asks rather than at a timer's convenience.
 */
export function getActiveAffiliateIdentificationRun(
  unknownInboundContactId: string,
  now: number = Date.now(),
): ActiveAffiliateIdentificationRun | null {
  const run = activeRuns.get(unknownInboundContactId);
  if (!run) return null;
  if (isExpired(run, now)) {
    activeRuns.delete(unknownInboundContactId);
    return null;
  }
  return run.terminalOutcome ? null : run;
}

/**
 * Drops runs that are over, so the table tracks strangers we are working on
 * rather than every stranger this process has ever seen.
 *
 * A finished run is kept for the rest of its lease — that is what refuses a
 * second terminal call from a run still executing — and dropped afterwards.
 * Rows that leave the queue entirely, because they were linked or ignored,
 * would otherwise never be read again and would never be reaped.
 */
export function sweepFinishedAffiliateIdentificationRuns(now: number = Date.now()): void {
  for (const [id, run] of activeRuns) {
    if (isExpired(run, now)) activeRuns.delete(id);
  }
}

function isExpired(run: ActiveAffiliateIdentificationRun, now: number): boolean {
  return now - run.startedAtMs >= AFFILIATE_IDENTIFICATION_RUN_LEASE_MS;
}

/**
 * Records that this run reached a terminal tool call, releasing its row.
 *
 * Refuses a second terminal outcome in one run rather than letting a run reply
 * and then also link: the contract is exactly one, and the span it commits is
 * the span it was given once.
 */
export function recordAffiliateIdentificationTerminalOutcome(input: {
  unknownInboundContactId: string;
  outcome: AffiliateIdentificationTerminalOutcome;
}): void {
  const run = activeRuns.get(input.unknownInboundContactId);
  if (!run) return;
  if (run.terminalOutcome && run.terminalOutcome !== input.outcome) {
    throw new Error(
      `Affiliate identification run already completed with terminal outcome ${run.terminalOutcome}`,
    );
  }
  run.terminalOutcome = input.outcome;
}

/**
 * Refuses a second terminal tool call from one run, before it executes.
 *
 * The contract is exactly one: a run asks, or decides who this is, or stops
 * matching. Checked ahead of the call rather than after it, so a refused second
 * call has not already happened — the Creator path refuses its second terminal
 * call the same way and for the same reason.
 *
 * Silent when no run is registered: an operator calling one of these by hand
 * is not a run and holds no span.
 */
export function assertAffiliateIdentificationTerminalOutcomeAvailable(
  unknownInboundContactId: string,
): void {
  const run = activeRuns.get(unknownInboundContactId);
  if (!run?.terminalOutcome) return;
  throw new Error(
    `Affiliate identification run already completed with terminal outcome ${run.terminalOutcome}`,
  );
}

/** Drops a run that never started, so its row is offered again immediately. */
export function releaseAffiliateIdentificationRun(unknownInboundContactId: string): void {
  activeRuns.delete(unknownInboundContactId);
}

/** Test seam: clears the per-process lease table between cases. */
export function __clearActiveAffiliateIdentificationRunsForTests(): void {
  activeRuns.clear();
}
