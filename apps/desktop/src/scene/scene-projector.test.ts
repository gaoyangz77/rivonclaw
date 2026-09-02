import { assertSceneInvariants } from "@rivonclaw/scene-contract";
import { describe, expect, it } from "vitest";
import { SceneProjector, type SceneAgentEvent } from "./scene-projector.js";
import type { SceneRoomConfig } from "./scene-rooms.js";

const ROOMS: SceneRoomConfig[] = [
  { id: "cs", labelKey: "office.room.cs", agentId: "customer-service", capacity: 2 },
  { id: "bd", labelKey: "office.room.bd", agentId: "affiliate", capacity: 1 },
  { id: "ops", labelKey: "office.room.ops", agentId: "main", capacity: 2 },
];

const CS_KEY = "agent:customer-service:cs:tiktok:shop-1:conv-1";
const BD_KEY = "agent:affiliate:affiliate:user-1:rel-1";
/** Shop operations runs on the default agent, across whatever channel it uses. */
const OPS_KEY = "agent:main:main";
const OPS_TELEGRAM_KEY = "agent:main:telegram:acct:direct:user";

function projector(now = () => 1_000) {
  return new SceneProjector({ rooms: ROOMS, now });
}

function evt(over: Partial<SceneAgentEvent> & { runId: string; seq: number }): SceneAgentEvent {
  return { stream: "lifecycle", sessionKey: CS_KEY, data: { phase: "start" }, ...over };
}

const chars = (p: SceneProjector) => p.snapshot().characters;
const byId = (p: SceneProjector, id: string) => chars(p).find((c) => c.id === id);

/**
 * Replay a recorded run and report the pose after each of its events.
 *
 * `tooling` is reported with its activity because the tool name is half of
 * what that pose means; `removed` is what a retired run looks like.
 */
function replay(
  p: SceneProjector,
  runId: string,
  sessionKey: string,
  events: Array<{ stream: string; data?: Record<string, unknown> }>,
): string[] {
  return events.map((event, index) => {
    p.handleEvent({
      runId,
      seq: index + 1,
      sessionKey,
      stream: event.stream,
      ...(event.data ? { data: event.data } : {}),
    });
    const character = byId(p, runId);
    if (!character) return "removed";
    return character.activity ? `${character.status}(${character.activity})` : character.status;
  });
}

describe("SceneProjector - seating", () => {
  it("seats a customer-service run in the cs room", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 1 }));
    expect(byId(p, "r1")).toMatchObject({ roomId: "cs", deskId: "cs-0", status: "preparing" });
  });

  it("routes by session key, not by guesswork", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 1, sessionKey: BD_KEY }));
    expect(byId(p, "r1")).toMatchObject({ roomId: "bd", deskId: "bd-0" });
  });

  // Shop operations is the default agent, so it is identified by agent id and
  // NOT by the channel segment - the same department talks on many channels.
  it("seats a shop-operations run whatever channel it arrived on", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 1, sessionKey: OPS_KEY }));
    p.handleEvent(evt({ runId: "r2", seq: 1, sessionKey: OPS_TELEGRAM_KEY }));
    expect(byId(p, "r1")?.roomId).toBe("ops");
    expect(byId(p, "r2")?.roomId).toBe("ops");
  });

  it("ignores runs that belong to no department", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 1, sessionKey: "agent:some-other-agent:x:y" }));
    p.handleEvent(evt({ runId: "r2", seq: 1, sessionKey: "not-a-session-key" }));
    p.handleEvent(evt({ runId: "r3", seq: 1, sessionKey: undefined }));
    expect(chars(p)).toHaveLength(0);
  });

  it("gives each run its own desk", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 1 }));
    p.handleEvent(evt({ runId: "r2", seq: 1 }));
    expect(byId(p, "r1")?.deskId).toBe("cs-0");
    expect(byId(p, "r2")?.deskId).toBe("cs-1");
  });

  // A full room is the product being at capacity, not the drawing running out
  // of chairs - so the overflow has to read as a queue, never as a third desk.
  it("queues a run when its room is at capacity", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 1 }));
    p.handleEvent(evt({ runId: "r2", seq: 1 }));
    p.handleEvent(evt({ runId: "r3", seq: 1 }));
    expect(byId(p, "r3")).toMatchObject({ status: "queued", deskId: null });
  });

  it("seats a queued run once a desk frees up", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 1 }));
    p.handleEvent(evt({ runId: "r2", seq: 1 }));
    p.handleEvent(evt({ runId: "r3", seq: 1 }));
    p.handleEvent(evt({ runId: "r1", seq: 2, data: { phase: "end" } }));
    p.handleEvent(evt({ runId: "r3", seq: 2, stream: "thinking" }));
    expect(byId(p, "r3")).toMatchObject({ status: "thinking", deskId: "cs-0" });
  });
});

describe("SceneProjector - activity", () => {
  it("reports the tool a run is executing", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 1 }));
    p.handleEvent(evt({ runId: "r1", seq: 2, stream: "tool", data: { name: "reply_buyer" } }));
    expect(byId(p, "r1")).toMatchObject({ status: "tooling", activity: "reply_buyer" });
  });

  it("drops the tool label when the run moves on", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 1 }));
    p.handleEvent(evt({ runId: "r1", seq: 2, stream: "tool", data: { name: "reply_buyer" } }));
    p.handleEvent(evt({ runId: "r1", seq: 3, stream: "thinking" }));
    expect(byId(p, "r1")?.activity).toBeUndefined();
  });

  it("shows a run blocked on approval as waiting, and cues it", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 1 }));
    p.handleEvent(evt({ runId: "r1", seq: 2, stream: "approval", data: { phase: "requested" } }));
    expect(byId(p, "r1")?.status).toBe("waiting");
    expect(p.takeCues()).toContainEqual({ kind: "approvalRequested", characterId: "r1" });
  });

  it("returns to working once the approval resolves", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 1 }));
    p.handleEvent(evt({ runId: "r1", seq: 2, stream: "approval", data: { phase: "requested" } }));
    p.handleEvent(evt({ runId: "r1", seq: 3, stream: "approval", data: { phase: "resolved" } }));
    expect(byId(p, "r1")?.status).toBe("working");
  });

  // Usage, items and patches say nothing about what the character is doing.
  it("leaves the pose alone for streams that carry no activity", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 1, stream: "thinking" }));
    p.handleEvent(evt({ runId: "r1", seq: 2, stream: "usage", data: { tokens: 10 } }));
    expect(byId(p, "r1")?.status).toBe("thinking");
  });

  // OpenClaw reports run failure on the lifecycle stream; the error stream also
  // carries recoverable faults, so it must not retire a run.
  it("does not retire a run on the error stream", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 1 }));
    p.handleEvent(evt({ runId: "r1", seq: 2, stream: "error", data: { message: "retrying" } }));
    expect(byId(p, "r1")).toBeDefined();
  });
});

// Both sequences below are real runs taken from the recorded event stream, not
// invented ones. They are the check that the office shows a WHOLE turn: before
// these poses existed, the ops run read as one long `working` broken by two
// tool calls, and the cs run - which emits no thinking and no run_status at all
// - was `working` for its first eight seconds and again for its last four.
describe("SceneProjector - the arc of a run", () => {
  it("follows a shop-operations run from setup to reply", () => {
    const p = projector();
    expect(
      replay(p, "r1", OPS_KEY, [
        { stream: "run_status", data: { phase: "preparing_workspace" } },
        { stream: "run_status", data: { phase: "preparing_context" } },
        { stream: "lifecycle", data: { phase: "start" } },
        { stream: "run_status", data: { phase: "starting_model" } },
        { stream: "tool", data: { phase: "start", name: "read" } },
        { stream: "tool", data: { phase: "result", name: "read" } },
        { stream: "tool", data: { phase: "start", name: "web_fetch" } },
        { stream: "tool", data: { phase: "result", name: "web_fetch" } },
        // The recording has several silent seconds here - the model writing its
        // reply. This is the marker the gateway plugin now sends for that burst.
        { stream: "assistant" },
        { stream: "lifecycle", data: { phase: "finishing" } },
        { stream: "lifecycle", data: { phase: "end" } },
      ]),
    ).toEqual([
      "preparing",
      "preparing",
      "preparing",
      "thinking",
      "tooling(read)",
      "tooling(read)",
      "tooling(web_fetch)",
      "tooling(web_fetch)",
      "replying",
      "working",
      "removed",
    ]);
  });

  // Five tools fired within 40 ms of each other, so the character changes tool
  // label four times in one frame. That is correct and the renderer coalesces
  // it; what matters here is that the labels arrive in the recorded order.
  it("follows a customer-service run that never reports a phase of its own", () => {
    const p = projector();
    const tools = ["get_conversation", "get_order", "get_product", "get_logistics", "reply_buyer"];
    expect(
      replay(p, "r1", CS_KEY, [
        { stream: "lifecycle", data: { phase: "start" } },
        ...tools.map((name) => ({ stream: "tool", data: { phase: "start", name } })),
        ...tools.map((name) => ({ stream: "tool", data: { phase: "result", name } })),
        { stream: "lifecycle", data: { phase: "finishing" } },
        { stream: "lifecycle", data: { phase: "end" } },
      ]),
    ).toEqual([
      "preparing",
      ...tools.map((name) => `tooling(${name})`),
      // Results change nothing visible: the pose stays on the last tool that
      // started, however the five returns are ordered.
      ...tools.map(() => "tooling(reply_buyer)"),
      "working",
      "removed",
    ]);
  });

  // Returns arrive in whatever order the tools finish. Re-posing on each one
  // would replay a five-tool burst a second time, shuffled, on top of the
  // first - and every one of those poses would be a status cue for a paced
  // presenter to play.
  it("does not treat a tool result as a new activity", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 1, stream: "tool", data: { phase: "start", name: "a" } }));
    p.handleEvent(evt({ runId: "r1", seq: 2, stream: "tool", data: { phase: "start", name: "b" } }));
    p.takeCues();
    p.handleEvent(evt({ runId: "r1", seq: 3, stream: "tool", data: { phase: "result", name: "a" } }));
    expect(byId(p, "r1")).toMatchObject({ status: "tooling", activity: "b" });
    expect(p.takeCues()).toEqual([]);
  });

  // A phase this build has never seen still means the run is alive, and that is
  // all it is allowed to claim - guessing a pose from an unknown name would put
  // a wrong animation on screen the next time OpenClaw adds a phase.
  it("shows an unrecognised run_status phase as plain working", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 1 }));
    p.handleEvent(evt({ runId: "r1", seq: 2, stream: "run_status", data: { phase: "compacting" } }));
    expect(byId(p, "r1")?.status).toBe("working");
  });

  // The pose is what a character does, the label is which tool it is doing it
  // with; a label that outlived its tool would caption the wrong animation.
  it("drops the tool label when the run starts replying", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 1, stream: "tool", data: { name: "reply_buyer" } }));
    p.handleEvent(evt({ runId: "r1", seq: 2, stream: "assistant", data: {} }));
    expect(byId(p, "r1")).toMatchObject({ status: "replying" });
    expect(byId(p, "r1")?.activity).toBeUndefined();
  });
});

// The snapshot is authoritative but coalesced: the service above sends one
// frame per 200 ms, and a real setup burst lands well inside that window. So
// the whole opening of a run - the part these statuses were added for - is
// visible ONLY through cues. That makes them load-bearing here, not sugar.
describe("SceneProjector - status cues", () => {
  const statusCues = (p: SceneProjector) =>
    p.takeCues().filter((c) => c.kind === "statusChanged");

  it("reports every beat of a setup burst that a single snapshot hides", () => {
    const p = projector();
    replay(p, "r1", OPS_KEY, [
      { stream: "run_status", data: { phase: "preparing_workspace" } },
      { stream: "run_status", data: { phase: "preparing_context" } },
      { stream: "lifecycle", data: { phase: "start" } },
      { stream: "run_status", data: { phase: "starting_model" } },
    ]);

    // Three beats from four events: the two extra `preparing` phases and
    // `lifecycle/start` are the same pose restated, and a cue is a transition,
    // not a heartbeat. Repeating it would make a presenter play the arrival at
    // the desk three times over.
    expect(statusCues(p)).toEqual([
      { kind: "statusChanged", characterId: "r1", status: "arriving" },
      { kind: "statusChanged", characterId: "r1", status: "preparing" },
      { kind: "statusChanged", characterId: "r1", status: "thinking" },
    ]);
    expect(byId(p, "r1")?.status).toBe("thinking");
  });

  // Same three opening beats as the ops run above, off a completely different
  // first event. That is the point of cueing `arriving` from taking the work
  // rather than from a stream.
  it("opens a customer-service run with the same beats as a shop-operations one", () => {
    const p = projector();
    replay(p, "r1", CS_KEY, [
      { stream: "lifecycle", data: { phase: "start" } },
      { stream: "tool", data: { phase: "start", name: "get_order" } },
    ]);

    expect(statusCues(p)).toEqual([
      { kind: "statusChanged", characterId: "r1", status: "arriving" },
      { kind: "statusChanged", characterId: "r1", status: "preparing" },
      { kind: "statusChanged", characterId: "r1", status: "tooling", activity: "get_order" },
    ]);
  });

  it("carries the tool name so a cue can be captioned without the snapshot", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 1, stream: "tool", data: { name: "read" } }));

    expect(statusCues(p)).toContainEqual({
      kind: "statusChanged",
      characterId: "r1",
      status: "tooling",
      activity: "read",
    });
  });

  // A result event restates the tool already on screen. Nothing changed, so
  // there is nothing to animate.
  it("stays quiet when a tool result restates the running tool", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 1, stream: "tool", data: { name: "read" } }));
    p.takeCues();

    p.handleEvent(
      evt({ runId: "r1", seq: 2, stream: "tool", data: { phase: "result", name: "read" } }),
    );
    expect(statusCues(p)).toEqual([]);

    p.handleEvent(evt({ runId: "r1", seq: 3, stream: "tool", data: { name: "web_fetch" } }));
    expect(statusCues(p)).toEqual([
      { kind: "statusChanged", characterId: "r1", status: "tooling", activity: "web_fetch" },
    ]);
  });

  // A queued run has not arrived anywhere - it is waiting for a desk. Cueing
  // its arrival would put a character in the room before it has a seat.
  it("announces nothing until a queued run gets a desk", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 1 }));
    p.handleEvent(evt({ runId: "r2", seq: 1 }));
    p.takeCues();

    p.handleEvent(evt({ runId: "r3", seq: 1 }));
    expect(statusCues(p)).toEqual([]);

    p.handleEvent(evt({ runId: "r1", seq: 2, data: { phase: "end" } }));
    p.takeCues();
    p.handleEvent(evt({ runId: "r3", seq: 2, stream: "thinking" }));
    expect(statusCues(p)).toEqual([
      { kind: "statusChanged", characterId: "r3", status: "thinking" },
    ]);
  });
});

describe("SceneProjector - run endings", () => {
  it("removes a finished run and reports success", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 1 }));
    p.handleEvent(evt({ runId: "r1", seq: 2, data: { phase: "end", aborted: false } }));
    expect(chars(p)).toHaveLength(0);
    expect(p.takeCues()).toContainEqual({
      kind: "characterExit",
      characterId: "r1",
      tone: "success",
    });
  });

  it("distinguishes a failure", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 1 }));
    p.handleEvent(evt({ runId: "r1", seq: 2, data: { phase: "error", error: "boom" } }));
    expect(p.takeCues()).toContainEqual({
      kind: "characterExit",
      characterId: "r1",
      tone: "failure",
    });
  });

  // An abort arrives as phase "end" with `aborted: true`, not a phase of its own.
  it("distinguishes an abort from a clean finish", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 1 }));
    p.handleEvent(
      evt({ runId: "r1", seq: 2, data: { phase: "end", aborted: true, status: "cancelled" } }),
    );
    expect(p.takeCues()).toContainEqual({
      kind: "characterExit",
      characterId: "r1",
      tone: "aborted",
    });
  });

  it("never seats a run first seen at its terminal event", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 9, data: { phase: "end" } }));
    expect(chars(p)).toHaveLength(0);
    expect(p.takeCues()).toHaveLength(0);
  });
});

describe("SceneProjector - delivery hazards", () => {
  it("discards a replayed sequence", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 5, stream: "thinking" }));
    p.handleEvent(evt({ runId: "r1", seq: 5, stream: "tool", data: { name: "x" } }));
    expect(byId(p, "r1")?.status).toBe("thinking");
  });

  it("discards an out-of-order sequence", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 5, stream: "thinking" }));
    p.handleEvent(evt({ runId: "r1", seq: 4, data: { phase: "end" } }));
    expect(byId(p, "r1")).toBeDefined();
  });

  // The terminal event can be lost outright; a character that stopped emitting
  // must still leave, or it stands at a desk for the rest of the session.
  it("reclaims a run that went silent", () => {
    let clock = 1_000;
    const p = new SceneProjector({ rooms: ROOMS, now: () => clock, staleAfterMs: 60_000 });
    p.handleEvent(evt({ runId: "r1", seq: 1 }));
    p.takeCues();

    clock += 30_000;
    p.sweep();
    expect(chars(p)).toHaveLength(1);

    clock += 40_000;
    p.sweep();
    expect(chars(p)).toHaveLength(0);
    expect(p.takeCues()).toContainEqual({
      kind: "characterExit",
      characterId: "r1",
      tone: "reclaimed",
    });
  });

  it("keeps a run alive while it is still emitting", () => {
    let clock = 1_000;
    const p = new SceneProjector({ rooms: ROOMS, now: () => clock, staleAfterMs: 60_000 });
    p.handleEvent(evt({ runId: "r1", seq: 1 }));
    clock += 50_000;
    p.handleEvent(evt({ runId: "r1", seq: 2, stream: "thinking" }));
    clock += 50_000;
    p.sweep();
    expect(chars(p)).toHaveLength(1);
  });

  it("advances the revision so stale snapshots can be discarded downstream", () => {
    const p = projector();
    const before = p.snapshot().revision;
    p.handleEvent(evt({ runId: "r1", seq: 1 }));
    expect(p.snapshot().revision).toBeGreaterThan(before);
  });
});

describe("SceneProjector - contract", () => {
  // The contract's own checker is the cross-check: a projector bug that
  // double-books a desk or overfills a room fails here rather than on screen.
  it("emits snapshots that satisfy the scene invariants", () => {
    const p = projector();
    p.handleEvent(evt({ runId: "r1", seq: 1 }));
    p.handleEvent(evt({ runId: "r2", seq: 1, stream: "tool", data: { name: "t" } }));
    p.handleEvent(evt({ runId: "r3", seq: 1 }));
    p.handleEvent(evt({ runId: "r4", seq: 1, sessionKey: BD_KEY }));
    p.handleEvent(evt({ runId: "r1", seq: 2, stream: "approval", data: { phase: "requested" } }));
    expect(() => assertSceneInvariants(p.snapshot())).not.toThrow();
  });

  it("stays valid after runs come and go", () => {
    const p = projector();
    for (let i = 0; i < 6; i++) p.handleEvent(evt({ runId: `r${i}`, seq: 1 }));
    for (let i = 0; i < 3; i++) {
      p.handleEvent(evt({ runId: `r${i}`, seq: 2, data: { phase: "end" } }));
    }
    for (let i = 0; i < 6; i++) {
      p.handleEvent(evt({ runId: `r${i}`, seq: 3, stream: "thinking" }));
    }
    expect(() => assertSceneInvariants(p.snapshot())).not.toThrow();
  });
});
