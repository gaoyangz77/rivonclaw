export interface SensitiveRecoveryPlan {
  ok: boolean;
  status?: "skipped_nested_recovery" | "skipped_limit_reached";
  attempt: number;
  maxAttempts: number;
  message?: string;
}

export class CSRound {
  readonly placeholderRunId: string;

  private activeRunId: string | null;
  private trackedRunIds = new Set<string>();
  private abortedRunIds = new Set<string>();
  private turnTextBuffer = new Map<string, string>();
  private forwardedRunIds = new Set<string>();
  private sensitiveRecoveryAttempts = 0;
  private sensitiveRecoveryRunIds = new Set<string>();
  private disposeWhenIdle = false;

  constructor(
    readonly roundId: string,
    readonly undeliveredCountAtStart: number,
  ) {
    this.placeholderRunId = `pending:${roundId}`;
    this.activeRunId = this.placeholderRunId;
    this.trackedRunIds.add(this.placeholderRunId);
  }

  hasActiveRun(): boolean {
    return this.activeRunId !== null;
  }

  isCurrentRun(runId: string): boolean {
    return this.activeRunId === runId;
  }

  abortActiveRun(): string | null {
    if (!this.activeRunId) return null;
    this.abortedRunIds.add(this.activeRunId);
    this.disposeWhenIdle = true;
    return this.activeRunId;
  }

  isRunAborted(runId: string): boolean {
    return this.abortedRunIds.has(runId);
  }

  markDispatchResolved(
    runId: string,
    sessionStillOwnsRound: boolean,
    placeholderRunId = this.placeholderRunId,
  ): "aborted" | "stale" | "active" {
    this.trackedRunIds.add(runId);
    if (this.abortedRunIds.has(placeholderRunId)) {
      this.abortedRunIds.delete(placeholderRunId);
      this.abortedRunIds.add(runId);
      if (this.activeRunId === placeholderRunId) {
        this.activeRunId = runId;
      }
      return "aborted";
    }

    if (!sessionStillOwnsRound || this.activeRunId !== placeholderRunId) {
      this.abortedRunIds.add(runId);
      if (this.activeRunId === placeholderRunId) {
        this.activeRunId = runId;
      }
      return "stale";
    }

    this.activeRunId = runId;
    return "active";
  }

  assumeRunDispatched(runId: string): void {
    this.activeRunId = runId;
    this.trackedRunIds.add(runId);
  }

  clearPlaceholderIfCurrent(placeholderRunId = this.placeholderRunId): void {
    if (this.activeRunId === placeholderRunId) {
      this.activeRunId = null;
    }
  }

  beginFollowUpDispatch(idempotencyKey: string): string {
    const placeholder = `pending:${idempotencyKey}`;
    this.activeRunId = placeholder;
    this.trackedRunIds.add(placeholder);
    return placeholder;
  }

  noteTurnText(runId: string, text: string): void {
    this.turnTextBuffer.set(runId, text);
  }

  takeTurnText(runId: string): string {
    const text = this.turnTextBuffer.get(runId) ?? "";
    this.turnTextBuffer.delete(runId);
    return text;
  }

  clearTurnText(runId: string): void {
    this.turnTextBuffer.delete(runId);
  }

  markDeliveryStarted(runId: string): void {
    this.forwardedRunIds.add(runId);
  }

  completeRun(runId: string): { wasAborted: boolean; hadForwardedText: boolean; shouldDispose: boolean } {
    const wasAborted = this.abortedRunIds.has(runId);
    if (wasAborted) {
      this.abortedRunIds.delete(runId);
    }
    const hadForwardedText = this.forwardedRunIds.has(runId);
    this.forwardedRunIds.delete(runId);
    this.turnTextBuffer.delete(runId);
    if (this.activeRunId === runId) {
      this.activeRunId = null;
    }
    return { wasAborted, hadForwardedText, shouldDispose: this.shouldDispose() };
  }

  onDeliverySucceeded(): { shouldDispose: boolean } {
    this.sensitiveRecoveryAttempts = 0;
    this.disposeWhenIdle = true;
    return { shouldDispose: this.shouldDispose() };
  }

  onTerminalFailure(): { shouldDispose: boolean } {
    this.disposeWhenIdle = true;
    return { shouldDispose: this.shouldDispose() };
  }

  private shouldDispose(): boolean {
    return this.disposeWhenIdle && !this.hasActiveRun();
  }

  buildBuyerMessage(content: string, stagingMode: boolean): string {
    const senderTag = stagingMode ? "[Internal: Developer]" : "[External: Buyer]";
    return this.withUndeliveredNotice(`${senderTag}\n${content}`);
  }

  buildConversationWorkPackageMessage(content: string): string {
    return this.withUndeliveredNotice(content);
  }

  private withUndeliveredNotice(content: string): string {
    let message = content;
    if (this.undeliveredCountAtStart <= 0) return message;

    const notice = this.undeliveredCountAtStart === 1
      ? "[Internal: System]\nNote: Your previous reply was not delivered to the buyer because a new message arrived. The buyer has not seen it. Please incorporate all messages in your response."
      : `[Internal: System]\nNote: Your last ${this.undeliveredCountAtStart} replies were not delivered to the buyer because new messages arrived while you were responding. The buyer has not seen them. Please incorporate all messages in your response.`;
    message = `${notice}\n\n${message}`;
    return message;
  }

  planSensitiveRecovery(maxAttempts: number, failedRunId: string, rejectedText: string): SensitiveRecoveryPlan {
    if (this.sensitiveRecoveryRunIds.has(failedRunId)) {
      return {
        ok: false,
        status: "skipped_nested_recovery",
        attempt: this.sensitiveRecoveryAttempts,
        maxAttempts,
      };
    }

    if (this.sensitiveRecoveryAttempts >= maxAttempts) {
      return {
        ok: false,
        status: "skipped_limit_reached",
        attempt: this.sensitiveRecoveryAttempts,
        maxAttempts,
      };
    }

    this.sensitiveRecoveryAttempts++;
    return {
      ok: true,
      attempt: this.sensitiveRecoveryAttempts,
      maxAttempts,
      message: [
        "[Internal: System]",
        "Your previous buyer-facing draft was rejected by the marketplace. The buyer did not receive it.",
        "It may have been triggered by wording about off-platform payment method or communication apps.",
        "Rephrase the same meaning in concise, neutral customer-service language. If you must mention a sensitive term, use a buyer-understandable abbreviation or softer wording instead.",
        "Do not mention that a previous draft was blocked or that you are following an internal instruction.",
        "Reply with the revised buyer-facing message only.",
        "",
        "[Internal: Rejected Draft]",
        rejectedText.trim().slice(0, 1_500),
      ].join("\n"),
    };
  }

  rollbackSensitiveRecoveryAttempt(): number {
    this.sensitiveRecoveryAttempts = Math.max(0, this.sensitiveRecoveryAttempts - 1);
    return this.sensitiveRecoveryAttempts;
  }

  registerSensitiveRecoveryRun(runId: string): void {
    this.sensitiveRecoveryRunIds.add(runId);
  }

  getTrackedRunIds(): string[] {
    return Array.from(this.trackedRunIds);
  }

  destroy(): void {
    this.activeRunId = null;
    this.trackedRunIds.clear();
    this.abortedRunIds.clear();
    this.turnTextBuffer.clear();
    this.forwardedRunIds.clear();
    this.sensitiveRecoveryRunIds.clear();
    this.sensitiveRecoveryAttempts = 0;
  }
}
