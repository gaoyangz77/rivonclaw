import { afterEach, describe, expect, it, vi } from "vitest";
import { emitCsDispatchEvent, setCsTelemetryClient } from "./cs-telemetry-ref.js";

describe("emitCsDispatchEvent batchId", () => {
  afterEach(() => setCsTelemetryClient(null));

  function emit(batchId?: string): Record<string, unknown> {
    const track = vi.fn();
    setCsTelemetryClient({ track, getQueueSize: () => 0 } as never);
    emitCsDispatchEvent({ outcome: "requested", dispatchReason: "MANUAL_START", batchId });
    expect(track).toHaveBeenCalledWith("cs.dispatch_event", expect.any(Object));
    return track.mock.calls[0][1] as Record<string, unknown>;
  }

  it("records the batch id when present", () => {
    expect(emit("batch-1").batchId).toBe("batch-1");
  });

  it("omits the field for non-batch dispatches", () => {
    expect(emit()).not.toHaveProperty("batchId");
  });
});
