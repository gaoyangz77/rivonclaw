import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RunTracker, FINAL_FALLBACK_MS, RECENTLY_COMPLETED_TTL_MS } from "./run-tracker.js";
import type { RunAction } from "./run-tracker.js";

function createTracker() {
  const onChange = vi.fn();
  const tracker = new RunTracker(onChange);
  return { tracker, onChange };
}

describe("RunTracker", () => {
  // ---------------------------------------------------------------------------
  // LOCAL_SEND
  // ---------------------------------------------------------------------------
  describe("LOCAL_SEND", () => {
    it("creates a run in processing phase", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      const run = tracker.getRun("r1");
      expect(run).toBeDefined();
      expect(run!.phase).toBe("processing");
      expect(run!.source).toBe("local");
      expect(tracker.getLocalRunId()).toBe("r1");
    });
  });

  // ---------------------------------------------------------------------------
  // EXTERNAL_INBOUND
  // ---------------------------------------------------------------------------
  describe("EXTERNAL_INBOUND", () => {
    it("creates a run in queued phase", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "EXTERNAL_INBOUND", runId: "r1", sessionKey: "s1", channel: "wechat" });
      const run = tracker.getRun("r1");
      expect(run).toBeDefined();
      expect(run!.phase).toBe("queued");
      expect(run!.source).toBe("wechat");
    });

    it("maps telegram channel", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "EXTERNAL_INBOUND", runId: "r1", sessionKey: "s1", channel: "telegram" });
      expect(tracker.getRun("r1")!.source).toBe("telegram");
    });

    it("maps unknown channel", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "EXTERNAL_INBOUND", runId: "r1", sessionKey: "s1", channel: "discord" });
      expect(tracker.getRun("r1")!.source).toBe("unknown");
    });
  });

  // ---------------------------------------------------------------------------
  // State transitions
  // ---------------------------------------------------------------------------
  describe("state transitions", () => {
    it("queued → awaiting_llm on LIFECYCLE_START", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "EXTERNAL_INBOUND", runId: "r1", sessionKey: "s1", channel: "wechat" });
      tracker.dispatch({ type: "LIFECYCLE_START", runId: "r1" });
      expect(tracker.getRun("r1")!.phase).toBe("awaiting_llm");
    });

    it("processing → tooling on TOOL_START", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "TOOL_START", runId: "r1", toolName: "browser" });
      const run = tracker.getRun("r1")!;
      expect(run.phase).toBe("tooling");
      expect(run.toolName).toBe("browser");
    });

    it("tooling → awaiting_llm on TOOL_RESULT", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "TOOL_START", runId: "r1", toolName: "browser" });
      tracker.dispatch({ type: "TOOL_RESULT", runId: "r1" });
      const run = tracker.getRun("r1")!;
      expect(run.phase).toBe("awaiting_llm");
      expect(run.toolName).toBeUndefined();
    });

    it("processing → generating on ASSISTANT_STREAM", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "ASSISTANT_STREAM", runId: "r1" });
      expect(tracker.getRun("r1")!.phase).toBe("generating");
    });

    it("tooling does NOT transition to generating on ASSISTANT_STREAM", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "TOOL_START", runId: "r1", toolName: "browser" });
      tracker.dispatch({ type: "ASSISTANT_STREAM", runId: "r1" });
      expect(tracker.getRun("r1")!.phase).toBe("tooling");
    });

    it("generating → tooling on TOOL_START", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "ASSISTANT_STREAM", runId: "r1" });
      tracker.dispatch({ type: "TOOL_START", runId: "r1", toolName: "exec" });
      expect(tracker.getRun("r1")!.phase).toBe("tooling");
    });

    it("processing → awaiting_llm on LIFECYCLE_START", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "LIFECYCLE_START", runId: "r1" });
      expect(tracker.getRun("r1")!.phase).toBe("awaiting_llm");
    });

    it("awaiting_llm → generating on ASSISTANT_STREAM", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "LIFECYCLE_START", runId: "r1" });
      tracker.dispatch({ type: "ASSISTANT_STREAM", runId: "r1" });
      expect(tracker.getRun("r1")!.phase).toBe("generating");
    });

    it("awaiting_llm → generating on CHAT_DELTA", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "LIFECYCLE_START", runId: "r1" });
      tracker.dispatch({ type: "CHAT_DELTA", runId: "r1", text: "hi" });
      expect(tracker.getRun("r1")!.phase).toBe("generating");
    });

    it("queued → generating on CHAT_DELTA (race condition)", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "EXTERNAL_INBOUND", runId: "r1", sessionKey: "s1", channel: "wechat" });
      tracker.dispatch({ type: "CHAT_DELTA", runId: "r1", text: "hello" });
      const run = tracker.getRun("r1")!;
      expect(run.phase).toBe("generating");
      expect(run.streaming).toBe("hello");
    });
  });

  // ---------------------------------------------------------------------------
  // Terminal states
  // ---------------------------------------------------------------------------
  describe("terminal states", () => {
    it("CHAT_FINAL → done", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "CHAT_FINAL", runId: "r1" });
      expect(tracker.getRun("r1")!.phase).toBe("done");
      expect(tracker.getLocalRunId()).toBeNull();
    });

    it("CHAT_ERROR → error", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "CHAT_ERROR", runId: "r1" });
      expect(tracker.getRun("r1")!.phase).toBe("error");
      expect(tracker.getLocalRunId()).toBeNull();
    });

    it("CHAT_ABORTED → aborted", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "CHAT_ABORTED", runId: "r1" });
      expect(tracker.getRun("r1")!.phase).toBe("aborted");
      expect(tracker.getLocalRunId()).toBeNull();
    });

    it("CHAT_FINAL clears toolName", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "TOOL_START", runId: "r1", toolName: "browser" });
      tracker.dispatch({ type: "CHAT_FINAL", runId: "r1" });
      expect(tracker.getRun("r1")!.toolName).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // CHAT_DELTA
  // ---------------------------------------------------------------------------
  describe("CHAT_DELTA", () => {
    it("updates streaming text without changing phase", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "ASSISTANT_STREAM", runId: "r1" });
      tracker.dispatch({ type: "CHAT_DELTA", runId: "r1", text: "Hello" });
      const run = tracker.getRun("r1")!;
      expect(run.phase).toBe("generating");
      expect(run.streaming).toBe("Hello");
    });

    it("does not update terminal-state runs", () => {
      const { tracker, onChange } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "CHAT_FINAL", runId: "r1" });
      onChange.mockClear();
      tracker.dispatch({ type: "CHAT_DELTA", runId: "r1", text: "late" });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // RUN_CLEANUP
  // ---------------------------------------------------------------------------
  describe("RUN_CLEANUP", () => {
    it("removes a run", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "RUN_CLEANUP", runId: "r1" });
      expect(tracker.isTracked("r1")).toBe(false);
    });

    it("does not fire onChange for unknown runId", () => {
      const { tracker, onChange } = createTracker();
      onChange.mockClear();
      tracker.dispatch({ type: "RUN_CLEANUP", runId: "unknown" });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // isTracked
  // ---------------------------------------------------------------------------
  describe("isTracked", () => {
    it("returns true for active run", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      expect(tracker.isTracked("r1")).toBe(true);
    });

    it("returns true for terminal-state run (not yet cleaned up)", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "CHAT_FINAL", runId: "r1" });
      expect(tracker.isTracked("r1")).toBe(true);
    });

    it("returns false for unknown runId", () => {
      const { tracker } = createTracker();
      expect(tracker.isTracked("unknown")).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // getView
  // ---------------------------------------------------------------------------
  describe("getView", () => {
    it("returns idle view when no runs", () => {
      const { tracker } = createTracker();
      const view = tracker.getView();
      expect(view.isActive).toBe(false);
      expect(view.displayPhase).toBeNull();
      expect(view.displayToolName).toBeNull();
      expect(view.displayStreaming).toBeNull();
      expect(view.canAbort).toBe(false);
      expect(view.abortTargetRunId).toBeNull();
    });

    it("shows local run phase", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      const view = tracker.getView();
      expect(view.isActive).toBe(true);
      expect(view.displayPhase).toBe("processing");
      expect(view.canAbort).toBe(true);
      expect(view.abortTargetRunId).toBe("r1");
    });

    it("shows tool name when tooling", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "TOOL_START", runId: "r1", toolName: "browser" });
      const view = tracker.getView();
      expect(view.displayPhase).toBe("tooling");
      expect(view.displayToolName).toBe("browser");
    });

    it("does not show toolName when not tooling", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      const view = tracker.getView();
      expect(view.displayToolName).toBeNull();
    });

    it("prioritises local run over external run", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "EXTERNAL_INBOUND", runId: "ext1", sessionKey: "s1", channel: "wechat" });
      tracker.dispatch({ type: "LOCAL_SEND", runId: "local1", sessionKey: "s1" });
      const view = tracker.getView();
      expect(view.displayPhase).toBe("processing"); // local
      expect(view.abortTargetRunId).toBe("local1");
    });

    it("falls back to external run when no local run", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "EXTERNAL_INBOUND", runId: "ext1", sessionKey: "s1", channel: "wechat" });
      const view = tracker.getView();
      expect(view.displayPhase).toBe("queued");
      expect(view.canAbort).toBe(true);
      expect(view.abortTargetRunId).toBe("ext1");
    });

    it("excludes terminal-state runs from activeRuns", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "CHAT_FINAL", runId: "r1" });
      const view = tracker.getView();
      expect(view.activeRuns.size).toBe(0);
      expect(view.isActive).toBe(false);
    });

    it("shows streaming text from display run", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "CHAT_DELTA", runId: "r1", text: "Hello world" });
      const view = tracker.getView();
      expect(view.displayStreaming).toBe("Hello world");
    });
  });

  // ---------------------------------------------------------------------------
  // Concurrent runs
  // ---------------------------------------------------------------------------
  describe("concurrent runs", () => {
    it("tracks multiple runs simultaneously", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "EXTERNAL_INBOUND", runId: "ext1", sessionKey: "s1", channel: "wechat" });
      tracker.dispatch({ type: "EXTERNAL_INBOUND", runId: "ext2", sessionKey: "s1", channel: "telegram" });
      tracker.dispatch({ type: "LOCAL_SEND", runId: "local1", sessionKey: "s1" });
      const view = tracker.getView();
      expect(view.activeRuns.size).toBe(3);
    });

    it("finishing one run does not affect others", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "EXTERNAL_INBOUND", runId: "ext1", sessionKey: "s1", channel: "wechat" });
      tracker.dispatch({ type: "LOCAL_SEND", runId: "local1", sessionKey: "s1" });
      tracker.dispatch({ type: "CHAT_FINAL", runId: "ext1" });
      const view = tracker.getView();
      expect(view.activeRuns.size).toBe(1);
      expect(view.displayPhase).toBe("processing");
      expect(view.abortTargetRunId).toBe("local1");
    });

    it("picks most recent external run when no local run", () => {
      const now = Date.now();
      vi.spyOn(Date, "now")
        .mockReturnValueOnce(now)       // ext1 startedAt
        .mockReturnValueOnce(now + 100); // ext2 startedAt
      const { tracker } = createTracker();
      tracker.dispatch({ type: "EXTERNAL_INBOUND", runId: "ext1", sessionKey: "s1", channel: "wechat" });
      tracker.dispatch({ type: "EXTERNAL_INBOUND", runId: "ext2", sessionKey: "s1", channel: "telegram" });
      vi.restoreAllMocks();
      const view = tracker.getView();
      expect(view.abortTargetRunId).toBe("ext2");
    });
  });

  // ---------------------------------------------------------------------------
  // cleanup and reset
  // ---------------------------------------------------------------------------
  describe("cleanup", () => {
    it("removes only terminal-state runs", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "EXTERNAL_INBOUND", runId: "r2", sessionKey: "s1", channel: "wechat" });
      tracker.dispatch({ type: "CHAT_FINAL", runId: "r1" });
      tracker.cleanup();
      expect(tracker.isTracked("r1")).toBe(false);
      expect(tracker.isTracked("r2")).toBe(true);
    });
  });

  describe("reset", () => {
    it("clears everything", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "EXTERNAL_INBOUND", runId: "r2", sessionKey: "s1", channel: "wechat" });
      tracker.reset();
      expect(tracker.isTracked("r1")).toBe(false);
      expect(tracker.isTracked("r2")).toBe(false);
      expect(tracker.getLocalRunId()).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // onChange callback
  // ---------------------------------------------------------------------------
  describe("onChange", () => {
    it("fires on state change", () => {
      const { tracker, onChange } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("does not fire when action has no effect", () => {
      const { tracker, onChange } = createTracker();
      // ABORT_REQUESTED doesn't change state
      tracker.dispatch({ type: "ABORT_REQUESTED" });
      expect(onChange).not.toHaveBeenCalled();
    });

    it("does not fire for TOOL_START on unknown runId", () => {
      const { tracker, onChange } = createTracker();
      tracker.dispatch({ type: "TOOL_START", runId: "unknown", toolName: "x" });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // serialize / restore
  // ---------------------------------------------------------------------------
  describe("serialize / restore", () => {
    it("round-trips active runs and localRunId", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "CHAT_DELTA", runId: "r1", text: "hello" });
      tracker.dispatch({ type: "EXTERNAL_INBOUND", runId: "ext1", sessionKey: "s1", channel: "wechat" });

      const snapshot = tracker.serialize();
      expect(snapshot.localRunId).toBe("r1");
      expect(snapshot.runs).toHaveLength(2);

      // Restore into a fresh tracker
      const { tracker: t2, onChange: onChange2 } = createTracker();
      t2.restore(snapshot);
      expect(onChange2).toHaveBeenCalledTimes(1);

      expect(t2.getLocalRunId()).toBe("r1");
      expect(t2.isTracked("r1")).toBe(true);
      expect(t2.isTracked("ext1")).toBe(true);
      expect(t2.getRun("r1")!.streaming).toBe("hello");
      // CHAT_DELTA promotes queued/awaiting_llm to generating, but processing stays
      expect(t2.getRun("r1")!.phase).toBe("processing");
    });

    it("restore replaces existing state", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "old", sessionKey: "s1" });

      const snapshot = { runs: [], localRunId: null };
      tracker.restore(snapshot);

      expect(tracker.isTracked("old")).toBe(false);
      expect(tracker.getLocalRunId()).toBeNull();
    });

    it("events continue to work after restore", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      const snapshot = tracker.serialize();

      const { tracker: t2 } = createTracker();
      t2.restore(snapshot);
      t2.dispatch({ type: "CHAT_DELTA", runId: "r1", text: "world" });
      expect(t2.getRun("r1")!.streaming).toBe("world");

      t2.dispatch({ type: "CHAT_FINAL", runId: "r1" });
      expect(t2.getRun("r1")!.phase).toBe("done");
      expect(t2.getLocalRunId()).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // TOOL_START clears streaming
  // ---------------------------------------------------------------------------
  describe("TOOL_START clears streaming", () => {
    it("clears streaming text when entering tooling phase", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "CHAT_DELTA", runId: "r1", text: "partial text" });
      expect(tracker.getRun("r1")!.streaming).toBe("partial text");

      tracker.dispatch({ type: "TOOL_START", runId: "r1", toolName: "browser" });
      expect(tracker.getRun("r1")!.streaming).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // getView — localRunId and localStreaming
  // ---------------------------------------------------------------------------
  describe("getView localRunId / localStreaming", () => {
    it("returns localRunId and localStreaming for active local run", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "CHAT_DELTA", runId: "r1", text: "hi" });
      const view = tracker.getView();
      expect(view.localRunId).toBe("r1");
      expect(view.localStreaming).toBe("hi");
    });

    it("returns null localRunId when local run is terminal", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "CHAT_FINAL", runId: "r1" });
      const view = tracker.getView();
      expect(view.localRunId).toBeNull();
      expect(view.localStreaming).toBeNull();
    });

    it("returns null when no local run exists", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "EXTERNAL_INBOUND", runId: "ext1", sessionKey: "s1", channel: "wechat" });
      const view = tracker.getView();
      expect(view.localRunId).toBeNull();
      expect(view.localStreaming).toBeNull();
    });

    it("returns null localStreaming when local run has no streaming text", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      const view = tracker.getView();
      expect(view.localRunId).toBe("r1");
      expect(view.localStreaming).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // No-op actions for unknown or terminal runs
  // ---------------------------------------------------------------------------
  describe("no-op for invalid transitions", () => {
    it("LIFECYCLE_START on unknown run does nothing", () => {
      const { tracker, onChange } = createTracker();
      tracker.dispatch({ type: "LIFECYCLE_START", runId: "unknown" });
      expect(onChange).not.toHaveBeenCalled();
    });

    it("TOOL_RESULT on non-tooling run does nothing", () => {
      const { tracker, onChange } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      onChange.mockClear();
      tracker.dispatch({ type: "TOOL_RESULT", runId: "r1" }); // phase is processing, not tooling
      expect(onChange).not.toHaveBeenCalled();
    });

    it("ASSISTANT_STREAM on done run does nothing", () => {
      const { tracker, onChange } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "CHAT_FINAL", runId: "r1" });
      onChange.mockClear();
      tracker.dispatch({ type: "ASSISTANT_STREAM", runId: "r1" });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // LIFECYCLE_END fallback timer
  // ---------------------------------------------------------------------------
  describe("LIFECYCLE_END fallback timer", () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it("force-transitions to done after timeout when CHAT_FINAL never arrives", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "LIFECYCLE_START", runId: "r1" });
      expect(tracker.getRun("r1")!.phase).toBe("awaiting_llm");

      tracker.dispatch({ type: "LIFECYCLE_END", runId: "r1" });
      // Still active immediately after LIFECYCLE_END
      expect(tracker.getRun("r1")!.phase).toBe("awaiting_llm");

      // Advance past the fallback timeout
      vi.advanceTimersByTime(FINAL_FALLBACK_MS);

      expect(tracker.getRun("r1")!.phase).toBe("done");
      expect(tracker.getLocalRunId()).toBeNull();
    });

    it("cancels fallback timer when CHAT_FINAL arrives in time", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "LIFECYCLE_END", runId: "r1" });

      // CHAT_FINAL arrives before the timeout
      tracker.dispatch({ type: "CHAT_FINAL", runId: "r1" });
      expect(tracker.getRun("r1")!.phase).toBe("done");

      // Advance past the timeout — should NOT cause any error or double-transition
      vi.advanceTimersByTime(FINAL_FALLBACK_MS + 1000);
      expect(tracker.getRun("r1")!.phase).toBe("done");
    });

    it("cancels fallback timer when CHAT_ERROR arrives in time", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "LIFECYCLE_ERROR", runId: "r1" });

      tracker.dispatch({ type: "CHAT_ERROR", runId: "r1" });
      expect(tracker.getRun("r1")!.phase).toBe("error");

      vi.advanceTimersByTime(FINAL_FALLBACK_MS + 1000);
      expect(tracker.getRun("r1")!.phase).toBe("error");
    });

    it("cancels fallback timer when CHAT_ABORTED arrives in time", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "LIFECYCLE_END", runId: "r1" });

      tracker.dispatch({ type: "CHAT_ABORTED", runId: "r1" });
      expect(tracker.getRun("r1")!.phase).toBe("aborted");

      vi.advanceTimersByTime(FINAL_FALLBACK_MS + 1000);
      expect(tracker.getRun("r1")!.phase).toBe("aborted");
    });

    it("does not set timer for already-terminal runs", () => {
      const { tracker, onChange } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "CHAT_FINAL", runId: "r1" });
      onChange.mockClear();

      tracker.dispatch({ type: "LIFECYCLE_END", runId: "r1" });
      vi.advanceTimersByTime(FINAL_FALLBACK_MS + 1000);

      // No state change should have occurred
      expect(onChange).not.toHaveBeenCalled();
      expect(tracker.getRun("r1")!.phase).toBe("done");
    });

    it("does not set timer for unknown runs", () => {
      const { tracker, onChange } = createTracker();
      onChange.mockClear();

      tracker.dispatch({ type: "LIFECYCLE_END", runId: "unknown" });
      vi.advanceTimersByTime(FINAL_FALLBACK_MS + 1000);

      expect(onChange).not.toHaveBeenCalled();
    });

    it("reset clears all fallback timers", () => {
      const { tracker, onChange } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "LIFECYCLE_END", runId: "r1" });

      tracker.reset();
      onChange.mockClear();

      // Timer should have been cleared by reset — FORCE_DONE should NOT fire
      vi.advanceTimersByTime(FINAL_FALLBACK_MS + 1000);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("works with LIFECYCLE_ERROR too", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "EXTERNAL_INBOUND", runId: "ext1", sessionKey: "s1", channel: "wechat" });
      tracker.dispatch({ type: "LIFECYCLE_START", runId: "ext1" });

      tracker.dispatch({ type: "LIFECYCLE_ERROR", runId: "ext1" });
      expect(tracker.getRun("ext1")!.phase).toBe("awaiting_llm");

      vi.advanceTimersByTime(FINAL_FALLBACK_MS);
      expect(tracker.getRun("ext1")!.phase).toBe("done");
    });
  });

  // ---------------------------------------------------------------------------
  // recentlyCompleted (phantom run suppression)
  // ---------------------------------------------------------------------------
  describe("recentlyCompleted", () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it("marks run as recently completed after CHAT_FINAL + cleanup", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "CHAT_FINAL", runId: "r1" });
      tracker.cleanup();

      // Run is no longer tracked but is recently completed
      expect(tracker.isTracked("r1")).toBe(false);
      expect(tracker.isRecentlyCompleted("r1")).toBe(true);
    });

    it("expires recently completed status after TTL", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "CHAT_FINAL", runId: "r1" });
      tracker.cleanup();

      expect(tracker.isRecentlyCompleted("r1")).toBe(true);

      vi.advanceTimersByTime(RECENTLY_COMPLETED_TTL_MS);

      expect(tracker.isRecentlyCompleted("r1")).toBe(false);
    });

    it("marks run as recently completed on CHAT_FINAL even before cleanup", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "CHAT_FINAL", runId: "r1" });

      // Still tracked (not yet cleaned up) but also recently completed
      expect(tracker.isTracked("r1")).toBe(true);
      expect(tracker.isRecentlyCompleted("r1")).toBe(true);
    });

    it("marks run as recently completed on CHAT_ERROR", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "CHAT_ERROR", runId: "r1" });
      tracker.cleanup();

      expect(tracker.isTracked("r1")).toBe(false);
      expect(tracker.isRecentlyCompleted("r1")).toBe(true);
    });

    it("marks run as recently completed on CHAT_ABORTED", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "CHAT_ABORTED", runId: "r1" });
      tracker.cleanup();

      expect(tracker.isTracked("r1")).toBe(false);
      expect(tracker.isRecentlyCompleted("r1")).toBe(true);
    });

    it("marks run as recently completed on FORCE_DONE", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "FORCE_DONE", runId: "r1" });
      tracker.cleanup();

      expect(tracker.isTracked("r1")).toBe(false);
      expect(tracker.isRecentlyCompleted("r1")).toBe(true);
    });

    it("reset clears recently completed state", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "CHAT_FINAL", runId: "r1" });
      tracker.cleanup();

      expect(tracker.isRecentlyCompleted("r1")).toBe(true);

      tracker.reset();
      expect(tracker.isRecentlyCompleted("r1")).toBe(false);
    });

    it("reset clears recently completed timers (no late expiry side effects)", () => {
      const { tracker, onChange } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "CHAT_FINAL", runId: "r1" });
      tracker.cleanup();

      tracker.reset();
      onChange.mockClear();

      // Timer from the old recently-completed should have been cleared
      vi.advanceTimersByTime(RECENTLY_COMPLETED_TTL_MS + 1000);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("returns false for unknown runId", () => {
      const { tracker } = createTracker();
      expect(tracker.isRecentlyCompleted("unknown")).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // FORCE_DONE
  // ---------------------------------------------------------------------------
  describe("FORCE_DONE", () => {
    it("transitions active run to done", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "ASSISTANT_STREAM", runId: "r1" });
      expect(tracker.getRun("r1")!.phase).toBe("generating");

      tracker.dispatch({ type: "FORCE_DONE", runId: "r1" });
      expect(tracker.getRun("r1")!.phase).toBe("done");
      expect(tracker.getLocalRunId()).toBeNull();
    });

    it("clears toolName when force-done from tooling", () => {
      const { tracker } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "TOOL_START", runId: "r1", toolName: "browser" });
      expect(tracker.getRun("r1")!.toolName).toBe("browser");

      tracker.dispatch({ type: "FORCE_DONE", runId: "r1" });
      expect(tracker.getRun("r1")!.toolName).toBeUndefined();
      expect(tracker.getRun("r1")!.phase).toBe("done");
    });

    it("does nothing for already-terminal runs", () => {
      const { tracker, onChange } = createTracker();
      tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
      tracker.dispatch({ type: "CHAT_FINAL", runId: "r1" });
      onChange.mockClear();

      tracker.dispatch({ type: "FORCE_DONE", runId: "r1" });
      expect(onChange).not.toHaveBeenCalled();
    });

    it("does nothing for unknown runId", () => {
      const { tracker, onChange } = createTracker();
      tracker.dispatch({ type: "FORCE_DONE", runId: "unknown" });
      expect(onChange).not.toHaveBeenCalled();
    });

    it("transitions all active phases to done", () => {
      const phases = ["queued", "processing", "awaiting_llm", "tooling", "generating"] as const;
      for (const phase of phases) {
        const { tracker } = createTracker();
        // Set up a run and manipulate it to the desired phase
        if (phase === "queued") {
          tracker.dispatch({ type: "EXTERNAL_INBOUND", runId: "r1", sessionKey: "s1", channel: "wechat" });
        } else {
          tracker.dispatch({ type: "LOCAL_SEND", runId: "r1", sessionKey: "s1" });
          if (phase === "awaiting_llm") {
            tracker.dispatch({ type: "LIFECYCLE_START", runId: "r1" });
          } else if (phase === "tooling") {
            tracker.dispatch({ type: "TOOL_START", runId: "r1", toolName: "t" });
          } else if (phase === "generating") {
            tracker.dispatch({ type: "ASSISTANT_STREAM", runId: "r1" });
          }
          // "processing" is the initial state for LOCAL_SEND, no extra dispatch needed
        }

        expect(tracker.getRun("r1")!.phase).toBe(phase);
        tracker.dispatch({ type: "FORCE_DONE", runId: "r1" });
        expect(tracker.getRun("r1")!.phase).toBe("done");
      }
    });
  });
});
