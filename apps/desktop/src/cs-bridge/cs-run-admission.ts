import { createLogger } from "@rivonclaw/logger";

const log = createLogger("cs-run-admission");

export const DEFAULT_CS_AUTOMATIC_MAX_CONCURRENT = 4;

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

export function resolveCsAutomaticMaxConcurrent(): number {
  const raw = process.env.RIVONCLAW_CS_AUTO_MAX_CONCURRENT;
  if (raw === undefined) return DEFAULT_CS_AUTOMATIC_MAX_CONCURRENT;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_CS_AUTOMATIC_MAX_CONCURRENT;
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
  private active = 0;
  private paused = false;
  private generation = 0;
  private queue: PendingAdmission[] = [];

  constructor(maxConcurrent = resolveCsAutomaticMaxConcurrent()) {
    this.maxConcurrent = maxConcurrent;
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
    const error = new CsRunAdmissionCancelledError(reason);
    for (const pending of queued) pending.reject(error);
    log.info(
      `CS automatic run admission reset: reason=${reason} released=${released} ` +
        `cancelled=${queued.length}`,
    );
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
      pending.resolve({
        release: (reason = "terminal") => {
          if (released) return;
          released = true;
          if (pending.generation !== this.generation) return;
          this.active = Math.max(0, this.active - 1);
          log.info(
            `CS automatic run released: conv=${pending.request.conversationId} ` +
              `reason=${reason} active=${this.active}/${this.maxConcurrent} ` +
              `queued=${this.queue.length}`,
          );
          this.drain();
        },
      });
      log.info(
        `CS automatic run admitted: conv=${pending.request.conversationId} ` +
          `reason=${pending.request.dispatchReason ?? ""} source=${pending.request.source ?? ""} ` +
          `waitMs=${waitMs} active=${this.active}/${this.maxConcurrent} queued=${this.queue.length}`,
      );
    }
  }
}
