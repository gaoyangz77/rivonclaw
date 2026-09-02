import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emitCsTelemetry } from "../telemetry/cs-telemetry-ref.js";
import { CONFIG_RECORD_INTERVAL_MS, startSceneService } from "./scene-service.js";

vi.mock("../telemetry/cs-telemetry-ref.js", () => ({ emitCsTelemetry: vi.fn() }));
// The real resolver reads the admission controllers' concurrency; the room set
// is irrelevant here beyond being recorded, so keep the import chain out.
vi.mock("./scene-rooms.js", () => ({
  resolveSceneRooms: () => [
    { id: "cs", labelKey: "office.room.cs", agentId: "customer-service", capacity: 4 },
  ],
  resolveRoomForSession: () => null,
}));

const SWEEP_INTERVAL_MS = 30_000;

function configRows(): Array<Record<string, unknown>> {
  return vi
    .mocked(emitCsTelemetry)
    .mock.calls.filter(([type]) => type === "office.scene_config")
    .map(([, row]) => row);
}

describe("startSceneService room-set recording", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(emitCsTelemetry).mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // The config table expires on the same 14-day clock as the events. A row
  // written only at start would vanish under a long-running Desktop while its
  // events kept arriving, so the room set is re-recorded daily.
  it("records the room set at start and again once a day while up", () => {
    let clock = 1_000;
    const service = startSceneService({ broadcastEvent: vi.fn(), now: () => clock });

    expect(configRows()).toEqual([
      {
        contractVersion: expect.any(Number),
        recordedAt: 1_000,
        rooms: [{ id: "cs", agentId: "customer-service", capacity: 4 }],
      },
    ]);

    // Just short of a day: sweeps keep running, nothing is re-recorded.
    clock += CONFIG_RECORD_INTERVAL_MS - SWEEP_INTERVAL_MS;
    vi.advanceTimersByTime(CONFIG_RECORD_INTERVAL_MS - SWEEP_INTERVAL_MS);
    expect(configRows()).toHaveLength(1);

    clock += SWEEP_INTERVAL_MS;
    vi.advanceTimersByTime(SWEEP_INTERVAL_MS);
    expect(configRows()).toHaveLength(2);
    expect(configRows()[1]).toMatchObject({ recordedAt: clock });

    // And the interval restarts from the last recording, not from start.
    clock += SWEEP_INTERVAL_MS;
    vi.advanceTimersByTime(SWEEP_INTERVAL_MS);
    expect(configRows()).toHaveLength(2);

    service.stop();
  });

  it("stops re-recording once stopped", () => {
    let clock = 0;
    const service = startSceneService({ broadcastEvent: vi.fn(), now: () => clock });
    service.stop();

    clock += CONFIG_RECORD_INTERVAL_MS * 2;
    vi.advanceTimersByTime(CONFIG_RECORD_INTERVAL_MS * 2);
    expect(configRows()).toHaveLength(1);
  });
});
