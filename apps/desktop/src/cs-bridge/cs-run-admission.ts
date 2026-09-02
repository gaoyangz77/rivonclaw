import {
  CS_MAX_CONCURRENT_ENV,
  DEFAULT_CS_MAX_CONCURRENT,
  resolveConcurrency,
} from "@rivonclaw/core/node";
import { createLogger } from "@rivonclaw/logger";

const log = createLogger("cs-run-admission");

/**
 * Re-exported from the shared definition so the office layout draws exactly as
 * many customer-service desks as this controller admits runs. Changing the
 * number here alone is impossible; it lives in
 * `packages/core/src/node-utils/agent-concurrency.ts`.
 */
export const DEFAULT_CS_AUTOMATIC_MAX_CONCURRENT = DEFAULT_CS_MAX_CONCURRENT;

/**
 * Hard ceiling on how long one admission lease may stay unreleased. A normal
 * CS run finishes in well under a minute and the Gateway enforces its own run
 * timeouts far below this, so a lease this old means the terminal event (or
 * the bookkeeping that releases on it) was lost. Two production incidents
 * wedged all four slots exactly this way — the queue then grows unboundedly
 * and automatic CS replies stop entirely — so the admission controller itself
 * guarantees a lost lease is reclaimed instead of trusting every upstream
 * bookkeeping path to be leak-free.
 */
export const DEFAULT_CS_LEASE_MAX_AGE_MS = 15 * 60_000;

const LEASE_WATCHDOG_INTERVAL_MS = 60_000;

export type CsRunAdmissionMode = "automatic" | "bypass";

export interface CsRunAdmissionRequest {
  conversationId: string;
  dispatchReason?: string;
  source?: string;
}

export interface CsRunAdmissionLease {
  release(reason?: string): void;
}

interface PendingAdmission {
  request: CsRunAdmissionRequest;
  queuedAt: number;
  generation: number;
  resolve: (lease: CsRunAdmissionLease) => void;
  reject: (error: Error) => void;
}

export class CsRunAdmissionCancelledError extends Error {
  constructor(message = "CS automatic run admission was cancelled") {
    super(message);
    this.name = "CsRunAdmissionCancelledError";
  }
}

export function resolveCsAutomaticMaxConcurrent(env: NodeJS.ProcessEnv = process.env): number {
  return resolveConcurrency(CS_MAX_CONCURRENT_ENV, DEFAULT_CS_MAX_CONCURRENT, env);
}

/**
 * FIFO admission controller for automatic customer-service agent runs.
 *
 * A lease remains active until the corresponding Gateway run reaches a
 * terminal state. Pausing only stops new admissions; existing leases remain
 * owned so a reconnect can reconcile them without exceeding the limit.
 */
export class CsAutomaticRunAdmission {
  private readonly maxConcurrent: number;
  private readonly leaseMaxAgeMs: number;
  private active = 0;
  private paused = false;
  private generation = 0;
  private queue: PendingAdmission[] = [];

  /** Live leases by watchdog handle; entries removed on any release path. */
  private readonly activeLeases = new Map<
    symbol,
    { conversationId: string; acquiredAt: number; release: (reason?: string) => void }
  >();

  private leaseWatchdogTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    maxConcurrent = resolveCsAutomaticMaxConcurrent(),
    leaseMaxAgeMs = DEFAULT_CS_LEASE_MAX_AGE_MS,
  ) {
    this.maxConcurrent = maxConcurrent;
    this.leaseMaxAgeMs = leaseMaxAgeMs;
  }

  acquire(request: CsRunAdmissionRequest): Promise<CsRunAdmissionLease> {
    return new Promise<CsRunAdmissionLease>((resolve, reject) => {
      const pending: PendingAdmission = {
        request,
        queuedAt: Date.now(),
        generation: this.generation,
        resolve,
        reject,
      };
      this.queue.push(pending);
      if (this.paused || this.active >= this.maxConcurrent) {
        log.info(
          `CS automatic run queued: conv=${request.conversationId} ` +
            `reason=${request.dispatchReason ?? ""} source=${request.source ?? ""} ` +
            `active=${this.active}/${this.maxConcurrent} queued=${this.queue.length}`,
        );
      }
      this.drain();
    });
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    log.info(
      `CS automatic run admission paused: active=${this.active}/${this.maxConcurrent} ` +
        `queued=${this.queue.length}`,
    );
  }

  resume(): void {
    if (!this.paused) {
      this.drain();
      return;
    }
    this.paused = false;
    log.info(
      `CS automatic run admission resumed: active=${this.active}/${this.maxConcurrent} ` +
        `queued=${this.queue.length}`,
    );
    this.drain();
  }

  reset(reason = "bridge_stopped"): void {
    const queued = this.queue.splice(0);
    const released = this.active;
    this.generation += 1;
    this.active = 0;
    this.paused = true;
    this.activeLeases.clear();
    this.stopLeaseWatchdogIfIdle();
    const error = new CsRunAdmissionCancelledError(reason);
    for (const pending of queued) pending.reject(error);
    log.info(
      `CS automatic run admission reset: reason=${reason} released=${released} ` +
        `cancelled=${queued.length}`,
    );
  }

  /**
   * Reclaims leases whose owner lost track of them. Release is idempotent and
   * generation-guarded, so a late terminal event arriving after reclamation is
   * a harmless no-op. This is the last line of defense: bridge-side
   * reconciliation should normally recover the run outcome first.
   */
  private sweepExpiredLeases(): void {
    const now = Date.now();
    for (const [handle, lease] of this.activeLeases) {
      const ageMs = now - lease.acquiredAt;
      if (ageMs < this.leaseMaxAgeMs) continue;
      log.warn(
        `CS automatic run lease exceeded ${this.leaseMaxAgeMs}ms without release; ` +
          `force-releasing to prevent slot loss: conv=${lease.conversationId} ageMs=${ageMs}`,
      );
      this.activeLeases.delete(handle);
      lease.release("lease_watchdog_timeout");
    }
    this.stopLeaseWatchdogIfIdle();
  }

  private ensureLeaseWatchdog(): void {
    if (this.leaseWatchdogTimer || this.activeLeases.size === 0) return;
    this.leaseWatchdogTimer = setInterval(() => {
      this.sweepExpiredLeases();
    }, LEASE_WATCHDOG_INTERVAL_MS);
    this.leaseWatchdogTimer.unref?.();
  }

  private stopLeaseWatchdogIfIdle(): void {
    if (this.activeLeases.size > 0 || !this.leaseWatchdogTimer) return;
    clearInterval(this.leaseWatchdogTimer);
    this.leaseWatchdogTimer = null;
  }

  getDebugState(): { active: number; queued: number; maxConcurrent: number; paused: boolean } {
    return {
      active: this.active,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      paused: this.paused,
    };
  }

  private drain(): void {
    while (!this.paused && this.active < this.maxConcurrent && this.queue.length > 0) {
      const pending = this.queue.shift();
      if (!pending) return;
      if (pending.generation !== this.generation) {
        pending.reject(new CsRunAdmissionCancelledError());
        continue;
      }

      this.active += 1;
      const waitMs = Date.now() - pending.queuedAt;
      let released = false;
      const leaseHandle = Symbol("cs-run-admission-lease");
      const release = (reason = "terminal") => {
        if (released) return;
        released = true;
        this.activeLeases.delete(leaseHandle);
        this.stopLeaseWatchdogIfIdle();
        if (pending.generation !== this.generation) return;
        this.active = Math.max(0, this.active - 1);
        log.info(
          `CS automatic run released: conv=${pending.request.conversationId} ` +
            `reason=${reason} active=${this.active}/${this.maxConcurrent} ` +
            `queued=${this.queue.length}`,
        );
        this.drain();
      };
      this.activeLeases.set(leaseHandle, {
        conversationId: pending.request.conversationId,
        acquiredAt: Date.now(),
        release,
      });
      this.ensureLeaseWatchdog();
      pending.resolve({ release });
      log.info(
        `CS automatic run admitted: conv=${pending.request.conversationId} ` +
          `reason=${pending.request.dispatchReason ?? ""} source=${pending.request.source ?? ""} ` +
          `waitMs=${waitMs} active=${this.active}/${this.maxConcurrent} queued=${this.queue.length}`,
      );
    }
  }
}
