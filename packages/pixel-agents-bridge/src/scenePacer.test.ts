import {
  SCENE_CONTRACT_VERSION,
  type CharacterStatus,
  type SceneCharacter,
  type SceneCue,
  type SceneSnapshot,
} from "@rivonclaw/scene-contract";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_QUEUED_BEATS, ScenePacer, type PacerTimerHandle } from "./scenePacer.js";

const ROOMS = [{ id: "cs", labelKey: "office.room.cs", capacity: 2 }];
const DESKS = [
  { id: "cs-0", roomId: "cs", index: 0 },
  { id: "cs-1", roomId: "cs", index: 1 },
];

const DWELL = 1_000;

function character(overrides: Partial<SceneCharacter> & { id: string }): SceneCharacter {
  return {
    roomId: "cs",
    deskId: "cs-0",
    status: "working",
    startedAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

function scene(revision: number, characters: SceneCharacter[]): SceneSnapshot {
  return {
    contractVersion: SCENE_CONTRACT_VERSION,
    revision,
    rooms: ROOMS,
    desks: DESKS,
    characters,
  };
}

/**
 * Deterministic clock.
 *
 * Every dwell in these tests is the same length on purpose - the randomness
 * exists so a row of characters does not change caption in lockstep, which is a
 * property of how it looks, not of what it presents.
 */
class FakeClock {
  time = 0;
  private nextHandle = 1;
  private readonly pending = new Map<number, { at: number; run: () => void }>();

  readonly setTimeout = (run: () => void, ms: number): PacerTimerHandle => {
    const handle = this.nextHandle++;
    this.pending.set(handle, { at: this.time + ms, run });
    return handle;
  };

  readonly clearTimeout = (handle: PacerTimerHandle): void => {
    this.pending.delete(handle as number);
  };

  readonly now = (): number => this.time;

  /** Run every timer due within `ms`, in due order, as a real clock would. */
  advance(ms: number): void {
    const until = this.time + ms;
    for (;;) {
      const due = [...this.pending.entries()]
        .filter(([, timer]) => timer.at <= until)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      const [handle, timer] = due;
      this.pending.delete(handle);
      this.time = timer.at;
      timer.run();
    }
    this.time = until;
  }

  get armed(): number {
    return this.pending.size;
  }
}

describe("ScenePacer", () => {
  let clock: FakeClock;
  let presented: SceneSnapshot[];
  let pacer: ScenePacer;

  beforeEach(() => {
    clock = new FakeClock();
    presented = [];
    pacer = new ScenePacer({
      onPresent: (snapshot) => presented.push(snapshot),
      dwellMs: () => DWELL,
      now: clock.now,
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
    });
  });

  const latest = () => presented[presented.length - 1]!;
  const statusOf = (id: string) => latest().characters.find((c) => c.id === id)?.status;
  const activityOf = (id: string) => latest().characters.find((c) => c.id === id)?.activity;

  // A character held back does not exist on screen at all, which reads as a
  // dropped run rather than a slow one.
  it("shows a new character's first beat without waiting", () => {
    pacer.push(scene(1, [character({ id: "lease-1", status: "arriving" })]));
    expect(statusOf("lease-1")).toBe("arriving");
  });

  it("holds the first beat for the dwell before showing the second", () => {
    pacer.push(scene(1, [character({ id: "lease-1", status: "arriving" })]));
    pacer.push(scene(2, [character({ id: "lease-1", status: "tooling", activity: "read" })]));
    expect(statusOf("lease-1")).toBe("arriving");

    clock.advance(DWELL - 1);
    expect(statusOf("lease-1")).toBe("arriving");

    clock.advance(1);
    expect(statusOf("lease-1")).toBe("tooling");
    expect(activityOf("lease-1")).toBe("read");
  });

  // The five-tools-in-forty-milliseconds case: every tool is shown, one at a
  // time, instead of all of them flickering past inside one frame.
  it("plays a burst of states out one beat at a time", () => {
    pacer.push(scene(1, [character({ id: "lease-1", status: "tooling", activity: "a" })]));
    pacer.push(scene(2, [character({ id: "lease-1", status: "tooling", activity: "b" })]));
    pacer.push(scene(3, [character({ id: "lease-1", status: "tooling", activity: "c" })]));

    expect(activityOf("lease-1")).toBe("a");
    clock.advance(DWELL);
    expect(activityOf("lease-1")).toBe("b");
    clock.advance(DWELL);
    expect(activityOf("lease-1")).toBe("c");
  });

  it("presents the next beat immediately once the dwell has already lapsed", () => {
    pacer.push(scene(1, [character({ id: "lease-1", status: "tooling", activity: "a" })]));
    clock.advance(DWELL * 3);
    pacer.push(scene(2, [character({ id: "lease-1", status: "tooling", activity: "b" })]));
    expect(activityOf("lease-1")).toBe("b");
  });

  it("ignores a stale or duplicated authoritative revision", () => {
    pacer.push(scene(5, [character({ id: "lease-1", status: "working" })]));
    const before = presented.length;
    pacer.push(scene(4, [character({ id: "lease-1", status: "thinking" })]));
    pacer.push(scene(5, [character({ id: "lease-1", status: "thinking" })]));
    expect(presented).toHaveLength(before);
  });

  it("numbers its own presentations, not the authoritative ones", () => {
    pacer.push(scene(40, [character({ id: "lease-1", status: "arriving" })]));
    pacer.push(scene(90, [character({ id: "lease-1", status: "replying" })]));
    clock.advance(DWELL);
    expect(presented.map((s) => s.revision)).toEqual([1, 2, 3]);
  });

  it("carries the rooms and desks of the newest authoritative scene", () => {
    pacer.push(scene(1, [character({ id: "lease-1" })]));
    expect(latest().rooms).toEqual(ROOMS);
    expect(latest().desks).toEqual(DESKS);
    expect(latest().contractVersion).toBe(SCENE_CONTRACT_VERSION);
  });
});

// The phases with nothing behind them. A run that reports `arriving` and then
// says nothing for eight seconds must not stand there captioned "arriving".
describe("ScenePacer - synthetic thinking", () => {
  let clock: FakeClock;
  let presented: SceneSnapshot[];
  let pacer: ScenePacer;

  beforeEach(() => {
    clock = new FakeClock();
    presented = [];
    pacer = new ScenePacer({
      onPresent: (snapshot) => presented.push(snapshot),
      dwellMs: () => DWELL,
      now: clock.now,
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
    });
  });

  const statusOf = (id: string) => presented[presented.length - 1]!.characters.find((c) => c.id === id)?.status;

  it("moves on from arriving when the run goes quiet", () => {
    pacer.push(scene(1, [character({ id: "lease-1", status: "arriving" })]));
    clock.advance(DWELL);
    expect(statusOf("lease-1")).toBe("thinking");
  });

  it("moves on from preparing the same way", () => {
    pacer.push(scene(1, [character({ id: "lease-1", status: "preparing" })]));
    clock.advance(DWELL);
    expect(statusOf("lease-1")).toBe("thinking");
  });

  it("settles there rather than looping", () => {
    pacer.push(scene(1, [character({ id: "lease-1", status: "arriving" })]));
    clock.advance(DWELL * 10);
    expect(statusOf("lease-1")).toBe("thinking");
    expect(clock.armed).toBe(0);
  });

  // Any snapshot, for any character, re-states every other character. If the
  // synthetic beat took part in the change comparison, those would each read as
  // a change back and the character would flip between the two.
  it("does not flip back when a later snapshot still carries the old phase", () => {
    pacer.push(
      scene(1, [
        character({ id: "lease-1", status: "preparing" }),
        character({ id: "lease-2", deskId: "cs-1", status: "working" }),
      ]),
    );
    clock.advance(DWELL);
    expect(statusOf("lease-1")).toBe("thinking");

    pacer.push(
      scene(2, [
        character({ id: "lease-1", status: "preparing" }),
        character({ id: "lease-2", deskId: "cs-1", status: "thinking" }),
      ]),
    );
    clock.advance(DWELL * 3);
    expect(statusOf("lease-1")).toBe("thinking");
  });

  it("invents nothing after a state that speaks for itself", () => {
    pacer.push(scene(1, [character({ id: "lease-1", status: "working" })]));
    clock.advance(DWELL * 5);
    expect(statusOf("lease-1")).toBe("working");
  });

  it("invents nothing for a character that has already gone", () => {
    pacer.push(scene(1, [character({ id: "lease-1", status: "arriving" })]));
    pacer.push(scene(2, []));
    // Its farewell, not a thought it never had.
    clock.advance(DWELL);
    expect(statusOf("lease-1")).toBe("leaving");
    clock.advance(DWELL);
    expect(presented[presented.length - 1]!.characters).toEqual([]);
  });
});

// The defect cues exist for: the producer coalesces every 200 ms, so a setup
// burst reaches the pacer as ONE snapshot showing only its last state. Diffing
// snapshots can never recover the states in between - they were true, and they
// never appeared in any snapshot at all.
describe("ScenePacer - coalesced transitions", () => {
  let clock: FakeClock;
  let presented: SceneSnapshot[];
  let pacer: ScenePacer;

  beforeEach(() => {
    clock = new FakeClock();
    presented = [];
    pacer = new ScenePacer({
      onPresent: (snapshot) => presented.push(snapshot),
      dwellMs: () => DWELL,
      now: clock.now,
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
    });
  });

  const statusOf = (id: string) =>
    presented[presented.length - 1].characters.find((c) => c.id === id)?.status;

  function statusCue(status: CharacterStatus, activity?: string): SceneCue {
    return activity === undefined
      ? { kind: "statusChanged", characterId: "lease-1", status }
      : { kind: "statusChanged", characterId: "lease-1", status, activity };
  }

  it("plays a whole setup burst that arrived as one snapshot", () => {
    pacer.push(scene(1, [character({ id: "lease-1", status: "thinking" })]), [
      statusCue("arriving"),
      statusCue("preparing"),
      statusCue("thinking"),
    ]);

    expect(statusOf("lease-1")).toBe("arriving");
    clock.advance(DWELL);
    expect(statusOf("lease-1")).toBe("preparing");
    clock.advance(DWELL);
    expect(statusOf("lease-1")).toBe("thinking");
  });

  // The snapshot's own state is the last cue, so re-stating it would show
  // `thinking` twice and then invent a third from `preparing`.
  it("settles on the snapshot's state without re-stating it", () => {
    pacer.push(scene(1, [character({ id: "lease-1", status: "thinking" })]), [
      statusCue("arriving"),
      statusCue("preparing"),
      statusCue("thinking"),
    ]);
    clock.advance(DWELL * 10);
    expect(statusOf("lease-1")).toBe("thinking");
    expect(clock.armed).toBe(0);
  });

  it("carries the activity a cue names", () => {
    pacer.push(scene(1, [character({ id: "lease-1", status: "tooling", activity: "b" })]), [
      statusCue("tooling", "a"),
      statusCue("tooling", "b"),
    ]);
    expect(presented[presented.length - 1].characters[0]?.activity).toBe("a");
    clock.advance(DWELL);
    expect(presented[presented.length - 1].characters[0]?.activity).toBe("b");
  });

  // Cues are droppable by contract, so the snapshot diff has to remain the
  // whole of the behaviour for a producer that sends none.
  it("still paces a producer that sends no cues at all", () => {
    pacer.push(scene(1, [character({ id: "lease-1", status: "arriving" })]));
    pacer.push(scene(2, [character({ id: "lease-1", status: "replying" })]));
    expect(statusOf("lease-1")).toBe("arriving");
    clock.advance(DWELL);
    expect(statusOf("lease-1")).toBe("replying");
  });

  it("keeps diffing characters no cue mentioned in the same push", () => {
    pacer.push(
      scene(1, [
        character({ id: "lease-1", status: "arriving" }),
        character({ id: "lease-2", deskId: "cs-1", status: "working" }),
      ]),
    );
    pacer.push(
      scene(2, [
        character({ id: "lease-1", status: "thinking" }),
        character({ id: "lease-2", deskId: "cs-1", status: "replying" }),
      ]),
      [statusCue("preparing"), statusCue("thinking")],
    );

    clock.advance(DWELL);
    expect(statusOf("lease-1")).toBe("preparing");
    expect(statusOf("lease-2")).toBe("replying");
    clock.advance(DWELL);
    expect(statusOf("lease-1")).toBe("thinking");
  });

  it("discards a cue for a character nothing knows about", () => {
    pacer.push(scene(1, []), [
      { kind: "statusChanged", characterId: "ghost", status: "working" },
    ]);
    expect(presented[presented.length - 1].characters).toEqual([]);
  });

  it("ignores cue kinds it has no use for", () => {
    pacer.push(scene(1, [character({ id: "lease-1", status: "waiting" })]), [
      { kind: "approvalRequested", characterId: "lease-1" },
      { kind: "subagentSpawned", parentCharacterId: "lease-1", childCharacterId: "lease-2" },
    ]);
    expect(presented[presented.length - 1].characters.map((c) => c.id)).toEqual(["lease-1"]);
    expect(statusOf("lease-1")).toBe("waiting");
  });

  // A run whose whole life fell inside one flush: its transitions still play,
  // and the departure queues behind them rather than cutting them off.
  it("plays out a character that arrived and left within one push", () => {
    pacer.push(scene(1, [character({ id: "lease-1", status: "arriving" })]));
    pacer.push(scene(2, []), [statusCue("thinking"), statusCue("replying")]);

    expect(statusOf("lease-1")).toBe("arriving");
    clock.advance(DWELL);
    expect(statusOf("lease-1")).toBe("thinking");
    clock.advance(DWELL);
    expect(statusOf("lease-1")).toBe("replying");
    clock.advance(DWELL);
    expect(statusOf("lease-1")).toBe("leaving");
    clock.advance(DWELL);
    expect(presented[presented.length - 1].characters).toEqual([]);
  });
});

// The renderer entity is the DESK: its agent id, its sprite and its caption all
// belong to the seat, not to whoever is sitting in it. The projector hands a
// freed desk straight to the next run, so pacing per character let one run's
// last beat and the next run's first land on the same agent inside one frame -
// seen on the harness as `affiliate_send_sample` becoming `phase:arriving` in
// 100 ms after a clean 10.9 seconds.
describe("ScenePacer - back-to-back runs on one desk", () => {
  let clock: FakeClock;
  let presented: SceneSnapshot[];
  let pacer: ScenePacer;

  beforeEach(() => {
    clock = new FakeClock();
    presented = [];
    pacer = new ScenePacer({
      onPresent: (snapshot) => presented.push(snapshot),
      dwellMs: () => DWELL,
      now: clock.now,
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
    });
  });

  /** Who is at desk cs-0 right now, and what they are doing. */
  const seat = () => {
    const shown = presented[presented.length - 1].characters.find((c) => c.deskId === "cs-0");
    return shown ? `${shown.id}:${shown.status}${shown.activity ? `/${shown.activity}` : ""}` : null;
  };

  it("makes the handover wait its turn instead of flipping inside one frame", () => {
    pacer.push(scene(1, [character({ id: "run-a", status: "tooling", activity: "send_sample" })]));
    // The projector takes the lowest free desk, so the next run lands on cs-0
    // the moment the previous one releases it - in the very same snapshot.
    pacer.push(scene(2, [character({ id: "run-b", status: "arriving" })]));

    expect(seat()).toBe("run-a:tooling/send_sample");
    clock.advance(DWELL - 1);
    expect(seat()).toBe("run-a:tooling/send_sample");

    // The outgoing run gets its last line, and only then gives up the seat, so
    // the handover is visible rather than a caption changing under one sprite.
    clock.advance(1);
    expect(seat()).toBe("run-a:leaving/phase:leaving-success");
    clock.advance(DWELL);
    expect(seat()).toBeNull();
    clock.advance(DWELL);
    expect(seat()).toBe("run-b:arriving");
    clock.advance(DWELL);
    expect(seat()).toBe("run-b:thinking");
  });

  it("never shows two occupants on one desk", () => {
    pacer.push(scene(1, [character({ id: "run-a", status: "replying" })]));
    pacer.push(scene(2, [character({ id: "run-b", status: "arriving" })]));
    clock.advance(DWELL * 6);
    for (const snapshot of presented) {
      const atDesk = snapshot.characters.filter((c) => c.deskId === "cs-0");
      expect(atDesk.length).toBeLessThanOrEqual(1);
    }
  });

  // The dwell exists to make a story readable. A desk standing idle has no
  // story in progress, so there is nothing for the arrival to interrupt.
  it("seats a new occupant at once on a desk that is standing idle", () => {
    pacer.push(scene(1, [character({ id: "run-a", status: "working" })]));
    pacer.push(scene(2, []));
    clock.advance(DWELL * 4);
    expect(seat()).toBeNull();

    pacer.push(scene(3, [character({ id: "run-b", status: "arriving" })]));
    expect(seat()).toBe("run-b:arriving");
  });

  it("keeps the desks independent, so a busy seat never delays its neighbour", () => {
    pacer.push(scene(1, [character({ id: "run-a", status: "arriving" })]));
    pacer.push(
      scene(2, [
        character({ id: "run-a", status: "replying" }),
        character({ id: "run-b", deskId: "cs-1", status: "arriving" }),
      ]),
    );
    // cs-0 is mid-dwell and holds `replying` back; cs-1 is fresh and shows at once.
    expect(seat()).toBe("run-a:arriving");
    const neighbour = presented[presented.length - 1].characters.find((c) => c.deskId === "cs-1");
    expect(neighbour?.status).toBe("arriving");
  });

  // The office should fall behind on a run that has ended before it falls
  // behind on the one happening now.
  it("drops a departed occupant's backlog before the new occupant's beats", () => {
    pacer.push(scene(1, [character({ id: "run-a", status: "working" })]));
    for (let i = 0; i < 6; i++) {
      pacer.push(scene(i + 2, [character({ id: "run-a", status: "tooling", activity: `a${i}` })]));
    }
    pacer.push(scene(8, [character({ id: "run-b", status: "arriving" })]));
    pacer.push(scene(9, [character({ id: "run-b", status: "tooling", activity: "b0" })]));

    const played: (string | null)[] = [];
    for (let i = 0; i < 6; i++) {
      clock.advance(DWELL);
      played.push(seat());
    }
    // Four of run-a's six queued tools were dropped to make room; its last line
    // and its departure survived, and so did both of run-b's beats.
    expect(played).toEqual([
      "run-a:tooling/a4",
      "run-a:tooling/a5",
      "run-a:leaving/phase:leaving-success",
      null,
      "run-b:arriving",
      "run-b:tooling/b0",
    ]);
  });
});

describe("ScenePacer - departures", () => {
  let clock: FakeClock;
  let presented: SceneSnapshot[];
  let pacer: ScenePacer;

  beforeEach(() => {
    clock = new FakeClock();
    presented = [];
    pacer = new ScenePacer({
      onPresent: (snapshot) => presented.push(snapshot),
      dwellMs: () => DWELL,
      now: clock.now,
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
    });
  });

  const ids = () => presented[presented.length - 1]!.characters.map((c) => c.id);
  const statusOf = (id: string) => presented[presented.length - 1]!.characters.find((c) => c.id === id)?.status;

  it("keeps the character on screen until its queued beats have played", () => {
    pacer.push(scene(1, [character({ id: "lease-1", status: "arriving" })]));
    pacer.push(scene(2, [character({ id: "lease-1", status: "tooling", activity: "read" })]));
    pacer.push(scene(3, [character({ id: "lease-1", status: "replying" })]));
    pacer.push(scene(4, []));

    expect(statusOf("lease-1")).toBe("arriving");
    clock.advance(DWELL);
    expect(statusOf("lease-1")).toBe("tooling");
    clock.advance(DWELL);
    expect(statusOf("lease-1")).toBe("replying");
    clock.advance(DWELL);
    expect(statusOf("lease-1")).toBe("leaving");
    clock.advance(DWELL);
    expect(ids()).toEqual([]);
  });

  it("lets a character say goodbye at once when nothing is holding it", () => {
    pacer.push(scene(1, [character({ id: "lease-1" })]));
    clock.advance(DWELL * 2);
    pacer.push(scene(2, []));
    expect(statusOf("lease-1")).toBe("leaving");
    clock.advance(DWELL);
    expect(ids()).toEqual([]);
  });

  // Absence from the snapshot stays sufficient; a cue is an additional signal
  // for a producer that knows sooner than its next snapshot says so.
  it("takes an exit cue as a departure while the snapshot still lists the character", () => {
    pacer.push(scene(1, [character({ id: "lease-1" })]));
    pacer.push(scene(2, [character({ id: "lease-1" })]), [
      { kind: "characterExit", characterId: "lease-1", tone: "success" },
    ]);
    clock.advance(DWELL);
    expect(statusOf("lease-1")).toBe("leaving");
    clock.advance(DWELL);
    expect(ids()).toEqual([]);
  });

  it("does not despawn a character the runtime brought back", () => {
    pacer.push(scene(1, [character({ id: "lease-1", status: "arriving" })]));
    pacer.push(scene(2, [character({ id: "lease-1", status: "tooling", activity: "read" })]));
    pacer.push(scene(3, []));
    pacer.push(scene(4, [character({ id: "lease-1", status: "tooling", activity: "read" })]));
    clock.advance(DWELL * 5);
    expect(ids()).toEqual(["lease-1"]);
  });

  it("keeps the character's desk and room while it plays out its backlog", () => {
    pacer.push(scene(1, [character({ id: "lease-1", deskId: "cs-1", status: "arriving" })]));
    pacer.push(scene(2, [character({ id: "lease-1", deskId: "cs-1", status: "replying" })]));
    pacer.push(scene(3, []));
    clock.advance(DWELL);
    const shown = presented[presented.length - 1]!.characters[0];
    expect(shown?.deskId).toBe("cs-1");
    expect(shown?.roomId).toBe("cs");
  });
});

// The renderer marks a finished agent with a two-second checkmark bubble and
// no caption, so a run that ended went from "Typing a reply" straight to an
// idle label - the worker looked like it fell asleep mid-sentence.
describe("ScenePacer - the last line of a run", () => {
  let clock: FakeClock;
  let presented: SceneSnapshot[];
  let pacer: ScenePacer;

  beforeEach(() => {
    clock = new FakeClock();
    presented = [];
    pacer = new ScenePacer({
      onPresent: (snapshot) => presented.push(snapshot),
      dwellMs: () => DWELL,
      now: clock.now,
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
    });
  });

  const shown = () => presented[presented.length - 1].characters[0];

  it("says goodbye for a full dwell before the desk is given up", () => {
    pacer.push(scene(1, [character({ id: "lease-1", status: "replying" })]));
    pacer.push(scene(2, []), [
      { kind: "characterExit", characterId: "lease-1", tone: "success" },
    ]);

    // Still mid-sentence: the farewell waits its turn like any other beat.
    expect(shown()?.status).toBe("replying");
    clock.advance(DWELL);
    expect(shown()?.status).toBe("leaving");
    expect(shown()?.activity).toBe("phase:leaving-success");
    expect(shown()?.deskId).toBe("cs-0");

    clock.advance(DWELL - 1);
    expect(shown()?.status).toBe("leaving");
    clock.advance(1);
    expect(presented[presented.length - 1].characters).toEqual([]);
  });

  const TONES = ["success", "failure", "aborted", "reclaimed"] as const;
  for (const tone of TONES) {
    it(`carries the ${tone} outcome the cue named`, () => {
      pacer.push(scene(1, [character({ id: "lease-1", status: "working" })]));
      pacer.push(scene(2, []), [{ kind: "characterExit", characterId: "lease-1", tone }]);
      clock.advance(DWELL);
      expect(shown()?.activity).toBe(`phase:leaving-${tone}`);
    });
  }

  // Most departures carry no cue at all - the character simply stops appearing
  // - and a run that ran to the end is the overwhelmingly common case.
  it("assumes the work went fine when nothing says otherwise", () => {
    pacer.push(scene(1, [character({ id: "lease-1", status: "working" })]));
    pacer.push(scene(2, []));
    clock.advance(DWELL);
    expect(shown()?.status).toBe("leaving");
    expect(shown()?.activity).toBe("phase:leaving-success");
  });

  it("does not invent a thought after the farewell", () => {
    pacer.push(scene(1, [character({ id: "lease-1", status: "preparing" })]));
    pacer.push(scene(2, []));
    clock.advance(DWELL * 10);
    expect(presented[presented.length - 1].characters).toEqual([]);
    expect(clock.armed).toBe(0);
  });

  // The story's last line: a viewer who looks up at the wrong moment should
  // still learn how the run ended, so it outranks any backlog of tool calls.
  it("keeps the farewell however deep the backlog", () => {
    pacer.push(scene(1, [character({ id: "lease-1", status: "working" })]));
    for (let i = 0; i < 20; i++) {
      pacer.push(
        scene(i + 2, [character({ id: "lease-1", status: "tooling", activity: `t${i}` })]),
      );
    }
    pacer.push(scene(100, []), [
      { kind: "characterExit", characterId: "lease-1", tone: "failure" },
    ]);

    const played: string[] = [];
    for (let i = 0; i < 8; i++) {
      clock.advance(DWELL);
      const current = presented[presented.length - 1].characters[0];
      if (current) played.push(`${current.status}${current.activity ? `/${current.activity}` : ""}`);
    }
    expect(played[played.length - 1]).toBe("leaving/phase:leaving-failure");
    expect(presented[presented.length - 1].characters).toEqual([]);
  });
});

describe("ScenePacer - collapse", () => {
  let clock: FakeClock;
  let presented: SceneSnapshot[];
  let pacer: ScenePacer;

  beforeEach(() => {
    clock = new FakeClock();
    presented = [];
    pacer = new ScenePacer({
      onPresent: (snapshot) => presented.push(snapshot),
      dwellMs: () => DWELL,
      now: clock.now,
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
    });
  });

  const activityOf = () => presented[presented.length - 1]!.characters[0]?.activity;

  /** Push `count` distinct tool episodes on top of an already-shown first beat. */
  function burst(count: number): void {
    pacer.push(scene(1, [character({ id: "lease-1", status: "working" })]));
    for (let i = 0; i < count; i++) {
      pacer.push(
        scene(i + 2, [character({ id: "lease-1", status: "tooling", activity: `tool-${i}` })]),
      );
    }
  }

  it("drops the oldest queued beats so the office never narrates old work", () => {
    burst(20);
    // The first beat is on screen; everything after it queued and was trimmed.
    const played: (string | undefined)[] = [];
    for (let i = 0; i < MAX_QUEUED_BEATS; i++) {
      clock.advance(DWELL);
      played.push(activityOf());
    }
    expect(played).toEqual(["tool-14", "tool-15", "tool-16", "tool-17", "tool-18", "tool-19"]);
  });

  it("stops once the backlog has drained", () => {
    burst(20);
    clock.advance(DWELL * 40);
    expect(activityOf()).toBe("tool-19");
    expect(clock.armed).toBe(0);
  });

  // A dropped departure leaves a character standing at a desk it no longer
  // holds, forever - the one failure a viewer could read as a hung run.
  it("never drops the departure, however deep the backlog", () => {
    burst(20);
    pacer.push(scene(100, []));
    clock.advance(DWELL * 40);
    expect(presented[presented.length - 1]!.characters).toEqual([]);
  });
});

describe("ScenePacer - lifecycle", () => {
  let clock: FakeClock;
  let presented: SceneSnapshot[];
  let pacer: ScenePacer;

  beforeEach(() => {
    clock = new FakeClock();
    presented = [];
    pacer = new ScenePacer({
      onPresent: (snapshot) => presented.push(snapshot),
      dwellMs: () => DWELL,
      now: clock.now,
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
    });
  });

  it("hands out the scene currently on screen, not the newest one", () => {
    pacer.push(scene(1, [character({ id: "lease-1", status: "arriving" })]));
    pacer.push(scene(2, [character({ id: "lease-1", status: "replying" })]));
    expect(pacer.presentedScene()?.characters[0]?.status).toBe("arriving");
  });

  it("has nothing on screen before the first push", () => {
    expect(pacer.presentedScene()).toBeNull();
  });

  it("forgets everything on reset", () => {
    pacer.push(scene(1, [character({ id: "lease-1", status: "arriving" })]));
    pacer.push(scene(2, [character({ id: "lease-1", status: "replying" })]));
    pacer.reset();
    expect(pacer.presentedScene()).toBeNull();
    expect(clock.armed).toBe(0);

    // A lower revision is accepted afterwards, because nothing is held to gate
    // it against any more.
    presented = [];
    pacer.push(scene(1, [character({ id: "lease-2", status: "working" })]));
    expect(presented[0]?.characters.map((c) => c.id)).toEqual(["lease-2"]);
  });

  it("keeps its revisions climbing across a reset", () => {
    pacer.push(scene(1, [character({ id: "lease-1" })]));
    const before = presented[presented.length - 1]!.revision;
    pacer.reset();
    pacer.push(scene(1, [character({ id: "lease-1" })]));
    expect(presented[presented.length - 1]!.revision).toBeGreaterThan(before);
  });

  it("stops presenting after dispose", () => {
    pacer.push(scene(1, [character({ id: "lease-1", status: "arriving" })]));
    pacer.push(scene(2, [character({ id: "lease-1", status: "replying" })]));
    pacer.dispose();
    const after = presented.length;
    clock.advance(DWELL * 10);
    expect(presented).toHaveLength(after);
    expect(clock.armed).toBe(0);
  });
});
