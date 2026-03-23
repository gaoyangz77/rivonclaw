/**
 * RunTracker — pure TypeScript state machine for tracking concurrent Agent runs.
 *
 * Each run progresses through phases:
 *   queued → processing → awaiting_llm ⇄ tooling → generating → done/error/aborted
 *
 * No React or DOM dependency — testable in isolation.
 * See ADR-022 for design rationale.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RunPhase =
  | "queued"
  | "processing"
  | "awaiting_llm"
  | "tooling"
  | "generating"
  | "done"
  | "error"
  | "aborted";

const ACTIVE_PHASES = new Set<RunPhase>(["queued", "processing", "awaiting_llm", "tooling", "generating"]);

export type RunSource = "local" | "wechat" | "telegram" | "unknown";

export interface RunState {
  runId: string;
  source: RunSource;
  sessionKey: string;
  phase: RunPhase;
  toolName?: string;
  streaming?: string;
  startedAt: number;
}

export interface RunTrackerView {
  /** All active (non-terminal) runs */
  activeRuns: ReadonlyMap<string, RunState>;
  /** Whether any run is active */
  isActive: boolean;
  /** Phase to display (local run prioritised, then most-recent external) */
  displayPhase: RunPhase | null;
  /** Tool name when displayPhase === "tooling" */
  displayToolName: string | null;
  /** Streaming text buffer of the display run */
  displayStreaming: string | null;
  /** Whether the stop button should be enabled */
  canAbort: boolean;
  /** runId to pass to chat.abort */
  abortTargetRunId: string | null;
  /** Local run ID (null if no local run is active) */
  localRunId: string | null;
  /** Streaming text of the local run (null if no local run or no text yet) */
  localStreaming: string | null;
}

/** Serialisable snapshot of RunTracker state for per-session caching. */
export interface RunTrackerSnapshot {
  runs: Array<[string, RunState]>;
  localRunId: string | null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type RunAction =
  // User operations
  | { type: "LOCAL_SEND"; runId: string; sessionKey: string }
  | { type: "ABORT_REQUESTED" }
  // SSE bridge (panel-server → chat page)
  | { type: "EXTERNAL_INBOUND"; runId: string; sessionKey: string; channel: string }
  | { type: "TOOL_START"; runId: string; toolName: string }
  | { type: "TOOL_RESULT"; runId: string }
  // Gateway WebSocket
  | { type: "LIFECYCLE_START"; runId: string }
  | { type: "LIFECYCLE_END"; runId: string }
  | { type: "LIFECYCLE_ERROR"; runId: string }
  | { type: "ASSISTANT_STREAM"; runId: string }
  | { type: "CHAT_DELTA"; runId: string; text: string }
  | { type: "CHAT_FINAL"; runId: string }
  | { type: "CHAT_ERROR"; runId: string }
  | { type: "CHAT_ABORTED"; runId: string }
  // Fallback terminal transition
  | { type: "FORCE_DONE"; runId: string }
  // Cleanup
  | { type: "RUN_CLEANUP"; runId: string };

// ---------------------------------------------------------------------------
// RunTracker
// ---------------------------------------------------------------------------

/** How long to wait after LIFECYCLE_END before force-transitioning to done. */
export const FINAL_FALLBACK_MS = 5_000;

/** How long a completed runId stays in the "recently completed" set to suppress phantom runs. */
export const RECENTLY_COMPLETED_TTL_MS = 10_000;

function channelToSource(channel: string): RunSource {
  if (channel === "wechat") return "wechat";
  if (channel === "telegram") return "telegram";
  return "unknown";
}

export class RunTracker {
  private runs = new Map<string, RunState>();
  private localRunId: string | null = null;
  private onChange: () => void;
  /** Pending timers that force-transition runs to done if CHAT_FINAL never arrives. */
  private finalFallbackTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** RunIds that recently completed — used to suppress phantom runs from late-arriving deltas. */
  private recentlyCompleted = new Set<string>();
  private recentlyCompletedTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(onChange: () => void) {
    this.onChange = onChange;
  }

  /** Process an action and update state. Calls onChange if state changed. */
  dispatch(action: RunAction): void {
    let changed = false;

    switch (action.type) {
      // ---- user operations ----

      case "LOCAL_SEND": {
        this.localRunId = action.runId;
        this.runs.set(action.runId, {
          runId: action.runId,
          source: "local",
          sessionKey: action.sessionKey,
          phase: "processing",
          startedAt: Date.now(),
        });
        changed = true;
        break;
      }

      case "ABORT_REQUESTED": {
        // Abort is handled externally via RPC; we just note intent if needed.
        // Actual state change happens when CHAT_ABORTED arrives.
        break;
      }

      // ---- SSE bridge ----

      case "EXTERNAL_INBOUND": {
        this.runs.set(action.runId, {
          runId: action.runId,
          source: channelToSource(action.channel),
          sessionKey: action.sessionKey,
          phase: "queued",
          startedAt: Date.now(),
        });
        changed = true;
        break;
      }

      case "TOOL_START": {
        const run = this.runs.get(action.runId);
        if (run && ACTIVE_PHASES.has(run.phase)) {
          run.phase = "tooling";
          run.toolName = action.toolName;
          run.streaming = undefined;
          changed = true;
        }
        break;
      }

      case "TOOL_RESULT": {
        const run = this.runs.get(action.runId);
        if (run && run.phase === "tooling") {
          run.phase = "awaiting_llm";
          run.toolName = undefined;
          changed = true;
        }
        break;
      }

      // ---- gateway lifecycle ----

      case "LIFECYCLE_START": {
        const run = this.runs.get(action.runId);
        if (run && (run.phase === "queued" || run.phase === "processing")) {
          run.phase = "awaiting_llm";
          changed = true;
        }
        break;
      }

      case "LIFECYCLE_END":
      case "LIFECYCLE_ERROR": {
        // Lifecycle end/error is informational; actual terminal state
        // normally comes from CHAT_FINAL / CHAT_ERROR. However, if the
        // gateway sends lifecycle.end but never sends chat.final, the run
        // stays stuck forever. Set a delayed fallback timer: if CHAT_FINAL
        // does not arrive within FINAL_FALLBACK_MS, force-transition to done.
        const endRun = this.runs.get(action.runId);
        if (endRun && ACTIVE_PHASES.has(endRun.phase)) {
          this.clearFallbackTimer(action.runId);
          const timer = setTimeout(() => {
            this.finalFallbackTimers.delete(action.runId);
            this.dispatch({ type: "FORCE_DONE", runId: action.runId });
          }, FINAL_FALLBACK_MS);
          this.finalFallbackTimers.set(action.runId, timer);
        }
        break;
      }

      // ---- gateway assistant ----

      case "ASSISTANT_STREAM": {
        const run = this.runs.get(action.runId);
        if (run && ACTIVE_PHASES.has(run.phase) && run.phase !== "tooling") {
          run.phase = "generating";
          changed = true;
        }
        break;
      }

      // ---- chat events ----

      case "CHAT_DELTA": {
        const run = this.runs.get(action.runId);
        if (run && ACTIVE_PHASES.has(run.phase)) {
          run.streaming = action.text;
          // Promote to generating if still waiting (race: delta before assistant stream)
          if (run.phase === "queued" || run.phase === "awaiting_llm") {
            run.phase = "generating";
          }
          changed = true;
        }
        break;
      }

      case "CHAT_FINAL": {
        this.clearFallbackTimer(action.runId);
        this.markRecentlyCompleted(action.runId);
        const run = this.runs.get(action.runId);
        if (run) {
          run.phase = "done";
          run.toolName = undefined;
          if (this.localRunId === action.runId) this.localRunId = null;
          changed = true;
        }
        break;
      }

      case "CHAT_ERROR": {
        this.clearFallbackTimer(action.runId);
        this.markRecentlyCompleted(action.runId);
        const run = this.runs.get(action.runId);
        if (run) {
          run.phase = "error";
          run.toolName = undefined;
          if (this.localRunId === action.runId) this.localRunId = null;
          changed = true;
        }
        break;
      }

      case "CHAT_ABORTED": {
        this.clearFallbackTimer(action.runId);
        this.markRecentlyCompleted(action.runId);
        const run = this.runs.get(action.runId);
        if (run) {
          run.phase = "aborted";
          run.toolName = undefined;
          if (this.localRunId === action.runId) this.localRunId = null;
          changed = true;
        }
        break;
      }

      // ---- fallback terminal transition ----

      case "FORCE_DONE": {
        this.markRecentlyCompleted(action.runId);
        const run = this.runs.get(action.runId);
        if (run && ACTIVE_PHASES.has(run.phase)) {
          run.phase = "done";
          run.toolName = undefined;
          if (this.localRunId === action.runId) this.localRunId = null;
          changed = true;
        }
        break;
      }

      // ---- cleanup ----

      case "RUN_CLEANUP": {
        if (this.runs.delete(action.runId)) {
          if (this.localRunId === action.runId) this.localRunId = null;
          changed = true;
        }
        break;
      }
    }

    if (changed) {
      this.onChange();
    }
  }

  /** Compute the view state for rendering. */
  getView(): RunTrackerView {
    const activeRuns = new Map<string, RunState>();
    for (const [id, run] of this.runs) {
      if (ACTIVE_PHASES.has(run.phase)) {
        activeRuns.set(id, run);
      }
    }

    const isActive = activeRuns.size > 0;

    // Pick the "display" run: local first, then most-recently-started external
    let displayRun: RunState | null = null;
    if (this.localRunId) {
      const local = activeRuns.get(this.localRunId);
      if (local) displayRun = local;
    }
    if (!displayRun) {
      let latest: RunState | null = null;
      for (const run of activeRuns.values()) {
        if (!latest || run.startedAt > latest.startedAt) {
          latest = run;
        }
      }
      displayRun = latest;
    }

    // Abort target: local run first, otherwise latest active run
    let abortTarget: RunState | null = null;
    if (this.localRunId) {
      const local = activeRuns.get(this.localRunId);
      if (local) abortTarget = local;
    }
    if (!abortTarget && displayRun) {
      abortTarget = displayRun;
    }

    // Local run is only "active" when it has an active phase
    const localActive = this.localRunId ? activeRuns.has(this.localRunId) : false;

    return {
      activeRuns,
      isActive,
      displayPhase: displayRun?.phase ?? null,
      displayToolName: displayRun?.phase === "tooling" ? (displayRun.toolName ?? null) : null,
      displayStreaming: displayRun?.streaming ?? null,
      canAbort: abortTarget !== null,
      abortTargetRunId: abortTarget?.runId ?? null,
      localRunId: localActive ? this.localRunId : null,
      localStreaming: localActive ? (this.runs.get(this.localRunId!)?.streaming ?? null) : null,
    };
  }

  /** Check whether a runId is being tracked (active or terminal). */
  isTracked(runId: string): boolean {
    return this.runs.has(runId);
  }

  /** Get the local run ID, if any. */
  getLocalRunId(): string | null {
    return this.localRunId;
  }

  /** Get a specific run's state. */
  getRun(runId: string): RunState | undefined {
    return this.runs.get(runId);
  }

  /** Clear a pending fallback timer for a specific run. */
  private clearFallbackTimer(runId: string): void {
    const timer = this.finalFallbackTimers.get(runId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.finalFallbackTimers.delete(runId);
    }
  }

  /** Clear all pending fallback timers. */
  private clearAllFallbackTimers(): void {
    for (const timer of this.finalFallbackTimers.values()) {
      clearTimeout(timer);
    }
    this.finalFallbackTimers.clear();
  }

  /** Mark a runId as recently completed so late-arriving events don't create phantom runs. */
  private markRecentlyCompleted(runId: string): void {
    this.recentlyCompleted.add(runId);
    // Clear any existing timer for this runId to reset the TTL
    const existing = this.recentlyCompletedTimers.get(runId);
    if (existing !== undefined) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.recentlyCompleted.delete(runId);
      this.recentlyCompletedTimers.delete(runId);
    }, RECENTLY_COMPLETED_TTL_MS);
    this.recentlyCompletedTimers.set(runId, timer);
  }

  /** Check whether a runId was recently completed (within the TTL window). */
  isRecentlyCompleted(runId: string): boolean {
    return this.recentlyCompleted.has(runId);
  }

  /** Remove all terminal-state runs. */
  cleanup(): void {
    let changed = false;
    for (const [id, run] of this.runs) {
      if (!ACTIVE_PHASES.has(run.phase)) {
        this.markRecentlyCompleted(id);
        this.runs.delete(id);
        this.clearFallbackTimer(id);
        changed = true;
      }
    }
    if (changed) {
      this.onChange();
    }
  }

  /** Reset all state. */
  reset(): void {
    this.clearAllFallbackTimers();
    for (const timer of this.recentlyCompletedTimers.values()) {
      clearTimeout(timer);
    }
    this.recentlyCompletedTimers.clear();
    this.recentlyCompleted.clear();
    this.runs.clear();
    this.localRunId = null;
    this.onChange();
  }

  /** Snapshot current state for per-session caching. */
  serialize(): RunTrackerSnapshot {
    return {
      runs: Array.from(this.runs.entries()),
      localRunId: this.localRunId,
    };
  }

  /** Restore state from a snapshot (e.g. after tab switch). Calls onChange once. */
  restore(snapshot: RunTrackerSnapshot): void {
    this.runs = new Map(snapshot.runs);
    this.localRunId = snapshot.localRunId;
    this.onChange();
  }
}
