import { describe, expect, it, vi } from "vitest";

import { createRunSessionTracker } from "./index.js";

describe("createRunSessionTracker", () => {
  it("cleans up only the ended run instead of every run sharing a session", () => {
    vi.useFakeTimers();
    try {
      const tracker = createRunSessionTracker(1000);

      tracker.set("old-run", "agent:main:telegram:account:direct:user");
      tracker.set("new-run", "agent:main:telegram:account:direct:user");
      tracker.scheduleCleanup("old-run");

      vi.advanceTimersByTime(1000);

      expect(tracker.get("old-run")).toBeUndefined();
      expect(tracker.get("new-run")).toBe("agent:main:telegram:account:direct:user");
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels stale cleanup when the same run is remapped", () => {
    vi.useFakeTimers();
    try {
      const tracker = createRunSessionTracker(1000);

      tracker.set("run", "session-a");
      tracker.scheduleCleanup("run");
      vi.advanceTimersByTime(500);
      tracker.set("run", "session-b");
      vi.advanceTimersByTime(500);

      expect(tracker.get("run")).toBe("session-b");
    } finally {
      vi.useRealTimers();
    }
  });
});
