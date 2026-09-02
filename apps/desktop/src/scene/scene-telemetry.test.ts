import { describe, expect, it } from "vitest";
import type { SceneAgentEvent } from "./scene-projector.js";
import type { SceneRoomConfig } from "./scene-rooms.js";
import { buildSceneConfigRow, buildSceneEventRow } from "./scene-telemetry.js";

const CS_ROOM: SceneRoomConfig = {
  id: "cs",
  labelKey: "office.room.cs",
  agentId: "customer-service",
  capacity: 4,
};
const ROOMS: SceneRoomConfig[] = [
  CS_ROOM,
  { id: "bd", labelKey: "office.room.bd", agentId: "affiliate", capacity: 5 },
];

/** A real key, with the identifiers a real one carries. */
const CS_KEY = "agent:customer-service:cs:tiktok:shop-88:conv-12345";

function evt(over: Partial<SceneAgentEvent> = {}): SceneAgentEvent {
  return {
    runId: "run-1",
    seq: 3,
    stream: "lifecycle",
    sessionKey: CS_KEY,
    data: { phase: "start" },
    ...over,
  };
}

describe("buildSceneEventRow", () => {
  it("records the department instead of the session key", () => {
    const row = buildSceneEventRow(evt(), CS_ROOM, 1_000);
    expect(row).toMatchObject({
      runId: "run-1",
      seq: 3,
      department: "cs",
      agentId: "customer-service",
      stream: "lifecycle",
      phase: "start",
      occurredAt: 1_000,
    });
  });

  // The single property this module exists to guarantee: a recording rendered
  // into a public video cannot leak a shop, a buyer or a creator.
  it("never carries a session key or anything from inside one", () => {
    const row = buildSceneEventRow(evt(), CS_ROOM, 1_000);
    const serialised = JSON.stringify(row);
    expect(serialised).not.toContain("shop-88");
    expect(serialised).not.toContain("conv-12345");
    expect(serialised).not.toContain("agent:customer-service");
    expect(row).not.toHaveProperty("sessionKey");
  });

  it("drops runs that belong to no department", () => {
    expect(buildSceneEventRow(evt(), null, 1_000)).toBeNull();
  });

  // Recording the runtime's own identifier, never a label, is what lets a
  // capture be replayed into a language it was not captured in.
  it("keeps the raw tool identifier untranslated", () => {
    const row = buildSceneEventRow(
      evt({ stream: "tool", data: { name: "reply_buyer" } }),
      CS_ROOM,
      1_000,
    );
    expect(row).toMatchObject({ stream: "tool", toolName: "reply_buyer" });
  });

  it("preserves how a run ended", () => {
    expect(buildSceneEventRow(evt({ data: { phase: "end" } }), CS_ROOM, 1)).toMatchObject({
      phase: "end",
    });
    expect(
      buildSceneEventRow(evt({ data: { phase: "end", aborted: true } }), CS_ROOM, 1),
    ).toMatchObject({ phase: "end", aborted: true });
    expect(buildSceneEventRow(evt({ data: { phase: "error" } }), CS_ROOM, 1)).toMatchObject({
      phase: "error",
    });
  });

  it("omits fields a stream does not carry rather than writing empties", () => {
    const row = buildSceneEventRow(evt({ stream: "thinking", data: {} }), CS_ROOM, 1);
    expect(row).not.toHaveProperty("toolName");
    expect(row).not.toHaveProperty("phase");
    expect(row).not.toHaveProperty("aborted");
  });

  it("ignores non-string values where a name or phase is expected", () => {
    const row = buildSceneEventRow(
      evt({ stream: "tool", data: { name: 42, phase: { nested: true } } }),
      CS_ROOM,
      1,
    );
    expect(row).not.toHaveProperty("toolName");
    expect(row).not.toHaveProperty("phase");
  });
});

describe("buildSceneConfigRow", () => {
  // A replay has to rebuild the office that existed then, not today's.
  it("captures the room set and desk counts in force", () => {
    expect(buildSceneConfigRow(ROOMS, 1, 5_000)).toEqual({
      contractVersion: 1,
      recordedAt: 5_000,
      rooms: [
        { id: "cs", agentId: "customer-service", capacity: 4 },
        { id: "bd", agentId: "affiliate", capacity: 5 },
      ],
    });
  });

  it("carries no display copy", () => {
    const serialised = JSON.stringify(buildSceneConfigRow(ROOMS, 1, 5_000));
    expect(serialised).not.toContain("labelKey");
    expect(serialised).not.toContain("office.room");
  });
});
