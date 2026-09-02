import {
  PHASE_ACTIVITY_PREFIX,
  type CharacterStatus,
  type SceneCharacter,
  type SceneCue,
  type SceneExitTone,
  type SceneSnapshot,
} from "@rivonclaw/scene-contract";

/**
 * Slows the scene down to the speed a person can read it.
 *
 * ## The problem this exists for
 *
 * A run is not paced like a story. A customer-service run finishes in thirteen
 * seconds and fires five tools inside forty milliseconds of each other; the
 * office draws every one of those as a caption over a character's head, so the
 * viewer sees a flicker and then a character standing still. The information
 * was all delivered, and none of it was legible. Worse, the phases that take
 * the actual time - waiting for the model, thinking - produce no event at all,
 * so the seconds that ARE slow look empty and the milliseconds that are fast
 * look like a glitch.
 *
 * The pacer sits between the authoritative scene and the translator and turns
 * the scene's history into BEATS: one per distinct state, each held for a
 * minimum dwell before the next is shown. Nothing is invented - every beat the
 * viewer sees really happened - it is only shown for long enough to be read.
 *
 * ## Why a beat queue belongs to a DESK, not to a character
 *
 * The thing on screen is a desk. The renderer's agent id is per desk, its
 * character sprite sits at that desk, and its caption is drawn over that desk -
 * so a desk is the unit that can only say one thing at a time. A character is
 * not: the projector hands a freed desk straight to the next run (it takes the
 * lowest free index), so in a four-desk room handling conversations back to
 * back, one run's last beat and the next run's first beat land on the SAME
 * renderer agent inside one frame. Pacing per character honours each queue
 * separately and still lets those two collide - which is exactly what was seen
 * on the harness: a caption going from `affiliate_send_sample` to
 * `phase:arriving` in 100ms after a clean 10.9 seconds.
 *
 * So beats queue on the desk. A character contributes its states, then a
 * `leaving` beat and an exit beat when it goes; the next occupant's first beat
 * falls in behind those and waits its turn like any other. The dwell is
 * therefore honoured ACROSS the handover, which is the only place it was ever
 * violated. A desk with nothing showing and nothing queued still presents its
 * first beat immediately - an empty desk has no story in progress to interrupt.
 *
 * ## Why a run gets a last line
 *
 * The renderer marks a finished agent with a two-second checkmark bubble and no
 * caption. A run that ended therefore went from "Typing a reply" straight to an
 * idle label - the worker appeared to fall asleep mid-sentence. The `leaving`
 * beat is that missing sentence: the character stays at its desk for one dwell,
 * captioned with how the work actually went, and only then stands up. The
 * outcome comes from the `characterExit` cue when one accompanies the
 * departure, and is `success` when a character simply stopped appearing.
 *
 * Queued characters hold no desk at all. There is nothing to pace and nothing
 * to read: they are a number in the host's own chrome (`queuedByRoom`), so they
 * pass through untouched.
 *
 * ## Why the queue is bounded
 *
 * A long-enough burst would make the office lag minutes behind the runtime and
 * narrate work that finished long ago. Past the cap a beat is dropped, oldest
 * first, and a beat belonging to a character that no longer holds the desk goes
 * before one belonging to the current occupant: the office should fall behind on
 * a finished run before it falls behind on the run happening now.
 *
 * ## Why a synthetic `thinking` beat
 *
 * `arriving` and `preparing` are both followed by a silence - the model has
 * been started and nothing has come back. Leaving the character captioned
 * "arriving" through that silence says something that stopped being true
 * seconds ago; showing `thinking` says the thing that IS true, and is what makes
 * a customer-service run (which emits nothing between its start and its tools)
 * tell the same story as an ops run that reports its phases. It is the only
 * state this class produces on its own, and it is produced only while the
 * character it belongs to still holds the desk.
 *
 * ## Revisions
 *
 * The presented stream carries the pacer's OWN revision, not the authoritative
 * one: presentation and authority advance at different rates, and the consumer's
 * revision gate must be monotonic in what it actually received. Incoming
 * snapshots are gated on the authoritative revision exactly as the translator
 * gates its own input, so a reordered or duplicated push changes nothing.
 */

/** Timer handle, opaque so a host may inject any scheduler. */
export type PacerTimerHandle = unknown;

/**
 * Clock and scheduler seams.
 *
 * Injectable purely so tests can run a whole run in zero real time; production
 * uses the platform's own timers and `Date.now`.
 */
export type ScenePacerTiming = {
  /**
   * How long one beat holds, in milliseconds, drawn fresh per beat.
   *
   * Random by default, and deliberately so: a fixed dwell makes a row of
   * characters change caption in lockstep, which reads as one animation rather
   * than as several people working. The range is the shortest span a caption can
   * be read in without the office feeling slow.
   */
  dwellMs?: () => number;
  now?: () => number;
  setTimeout?: (callback: () => void, ms: number) => PacerTimerHandle;
  clearTimeout?: (handle: PacerTimerHandle) => void;
};

export type ScenePacerOptions = ScenePacerTiming & {
  /** Called with each newly presented scene. */
  onPresent: (snapshot: SceneSnapshot) => void;
};

export const MIN_DWELL_MS = 1_000;
export const MAX_DWELL_MS = 1_500;

/**
 * Beats one desk may hold in reserve.
 *
 * Six is roughly nine seconds of backlog at the default dwell - long enough to
 * absorb a burst of tool calls without losing any of them, short enough that
 * the office never narrates a run that has already ended.
 */
export const MAX_QUEUED_BEATS = 6;

/**
 * States whose natural continuation is "the model is thinking".
 *
 * Both are followed by a silence in which the run is genuinely reasoning; see
 * the class comment.
 */
const SYNTHETIC_THINKING_AFTER: ReadonlySet<CharacterStatus> = new Set<CharacterStatus>([
  "arriving",
  "preparing",
]);

type StateBeat = {
  kind: "state";
  characterId: string;
  status: CharacterStatus;
  activity: string | undefined;
};
/** The desk emptying. Presented as a beat of its own, so a handover is visible. */
type ExitBeat = { kind: "exit"; characterId: string };
type Beat = StateBeat | ExitBeat;

/** One desk's presentation state. Created on first use, then kept for good. */
type Track = {
  key: string;
  roomId: string;
  deskId: string;
  /**
   * The desk's authoritative occupant, or null while the runtime holds it free.
   *
   * Distinct from what is on screen: a desk whose new occupant is still queued
   * behind the old one's beats has an `occupantId` the viewer cannot see yet.
   */
  occupantId: string | null;
  /** The beat on screen, or null while the desk is presented as empty. */
  current: StateBeat | null;
  /** When `current` was presented; becomes the presented `updatedAt`. */
  presentedAt: number;
  queue: Beat[];
  /** Non-null exactly while the current beat is still serving its dwell. */
  timer: PacerTimerHandle | null;
};

export class ScenePacer {
  private readonly onPresent: (snapshot: SceneSnapshot) => void;
  private readonly dwellMs: () => number;
  private readonly now: () => number;
  private readonly schedule: (callback: () => void, ms: number) => PacerTimerHandle;
  private readonly cancel: (handle: PacerTimerHandle) => void;
  private readonly tracks = new Map<string, Track>();
  /**
   * Which desk a character's beats belong to.
   *
   * A seated character never moves: the projector assigns a desk once, on
   * admission or on leaving the queue, and frees it only by removing the run.
   */
  private readonly deskOf = new Map<string, Track>();
  /**
   * Last authoritative record per character with beats in flight.
   *
   * Kept after the character leaves the snapshot, because its exit beat may be
   * queued behind several others and it has to keep being drawn until then.
   */
  private readonly records = new Map<string, SceneCharacter>();
  /** Last authoritative state per character, for the repeat check. */
  private readonly authored = new Map<string, StateBeat>();
  private authoritative: SceneSnapshot | null = null;
  private presented: SceneSnapshot | null = null;
  private lastRevision = -1;
  private revision = 0;

  constructor(options: ScenePacerOptions) {
    this.onPresent = options.onPresent;
    this.dwellMs = options.dwellMs ?? defaultDwellMs;
    this.now = options.now ?? (() => Date.now());
    this.schedule = options.setTimeout ?? defaultSetTimeout;
    this.cancel = options.clearTimeout ?? defaultClearTimeout;
  }

  /**
   * Hand the pacer a new authoritative scene, and the cues that led to it.
   *
   * Always presents afterwards. Rooms, desks and queued characters are not
   * paced - there is nothing to read in a desk or in a queue depth - and a desk
   * standing idle seats its next occupant at once, because there is no story in
   * progress for that arrival to interrupt.
   *
   * ## Why cues are read at all, when the snapshot is authoritative
   *
   * The producer coalesces: a run that moves through `arriving`, `preparing`
   * and `starting_model` inside half a second arrives here as ONE snapshot, and
   * that snapshot says only `thinking`. Diffing snapshots can therefore never
   * recover the setup sequence - the intermediate states were true, were never
   * false, and simply never appeared in any snapshot the pacer was given.
   * `statusChanged` cues are one entry per transition and accumulate between
   * flushes, so they carry exactly what the coalescing dropped.
   *
   * Cues stay droppable, as the contract requires. A producer that sends none
   * is paced from snapshot diffs alone, which is the behaviour this class had
   * before they existed; a cue for a character that neither the snapshot nor an
   * open track knows about has nothing to attach to and is discarded.
   */
  push(snapshot: SceneSnapshot, cues: readonly SceneCue[] = []): void {
    if (snapshot.revision <= this.lastRevision) return;
    this.lastRevision = snapshot.revision;
    this.authoritative = snapshot;

    const seated = new Map<string, SceneCharacter>();
    for (const character of snapshot.characters) {
      if (character.deskId !== null) seated.set(character.id, character);
    }

    // Read before anything else: a handover in the loop below is a departure
    // too, and it needs the outgoing character's outcome to caption its
    // farewell with.
    const exitTone = new Map<string, SceneExitTone>();
    for (const cue of cues) {
      if (cue.kind === "characterExit") exitTone.set(cue.characterId, cue.tone);
    }

    // Transitions first, in the order they happened. A character whose whole
    // life - arrive, work, finish - fell inside one flush is opened here and
    // still plays its beats out; the departure below queues behind them.
    const cued = new Set<string>();
    for (const cue of cues) {
      if (cue.kind !== "statusChanged") continue;
      const track = this.trackFor(cue.characterId, seated);
      if (!track) continue;
      this.observe(track, {
        kind: "state",
        characterId: cue.characterId,
        status: cue.status,
        activity: cue.activity,
      });
      cued.add(cue.characterId);
    }

    for (const character of seated.values()) {
      const track = this.trackFor(character.id, seated);
      if (!track) continue;
      this.records.set(character.id, character);

      if (track.occupantId !== null && track.occupantId !== character.id) {
        // Handover. The outgoing character's departure is queued BEFORE the new
        // occupant's first beat, which is what makes the dwell survive it.
        this.depart(track, track.occupantId, exitTone.get(track.occupantId) ?? "success");
      }
      track.occupantId = character.id;
      // A character that came back is not leaving. Lease ids are never reused,
      // so this only fires if a snapshot dropped a character and restored it;
      // despawning a character the runtime says is working would be the one
      // failure a viewer could actually mistake for a lost run.
      if (this.cancelDeparture(track, character.id)) {
        // Its farewell is off. Forget the last state it was seen in so the beat
        // below re-states it, or the desk would sit on `leaving` while the
        // runtime insists the character is working.
        this.authored.delete(character.id);
      }

      // Cues already said everything this character did in this flush, down to
      // the state the snapshot ends on. Diffing it again would re-state the
      // last cue as a beat of its own.
      if (cued.has(character.id)) continue;
      this.observe(track, beatOf(character));
    }

    // Absence from the snapshot is the departure signal and always has been; an
    // explicit cue is accepted as well, for a producer that knows a character
    // is gone before its next snapshot says so.
    for (const track of this.tracks.values()) {
      const occupantId = track.occupantId;
      if (occupantId === null) continue;
      if (seated.has(occupantId) && !exitTone.has(occupantId)) continue;
      track.occupantId = null;
      this.depart(track, occupantId, exitTone.get(occupantId) ?? "success");
    }

    this.emit();
  }

  /**
   * The scene currently on screen, or null before the first presentation.
   *
   * This - not the authoritative snapshot - is what a reconnecting renderer has
   * to be given, or the handshake would jump the office forward to the runtime's
   * present and silently discard every beat still queued behind it.
   */
  presentedScene(): SceneSnapshot | null {
    return this.presented;
  }

  /** Forget every desk and cancel every dwell. */
  reset(): void {
    for (const track of this.tracks.values()) this.clearTimer(track);
    this.tracks.clear();
    this.deskOf.clear();
    this.records.clear();
    this.authored.clear();
    this.authoritative = null;
    this.presented = null;
    this.lastRevision = -1;
    // `revision` deliberately survives: a consumer that kept its gate across the
    // reset must still see the next presentation as newer than the last one.
  }

  dispose(): void {
    for (const track of this.tracks.values()) this.clearTimer(track);
  }

  /**
   * The desk a character's beats belong on, or null if it has no desk.
   *
   * A character that has left the snapshot keeps the desk it was last seen at,
   * so cues that arrive in the same flush as its departure still land there.
   */
  private trackFor(characterId: string, seated: Map<string, SceneCharacter>): Track | null {
    const existing = this.deskOf.get(characterId);
    if (existing) return existing;
    const character = seated.get(characterId);
    if (!character || character.deskId === null) return null;
    const track = this.trackAt(character.roomId, character.deskId);
    this.deskOf.set(characterId, track);
    this.records.set(characterId, character);
    return track;
  }

  private trackAt(roomId: string, deskId: string): Track {
    const key = `${roomId} ${deskId}`;
    const existing = this.tracks.get(key);
    if (existing) return existing;
    const track: Track = {
      key,
      roomId,
      deskId,
      occupantId: null,
      current: null,
      presentedAt: this.now(),
      queue: [],
      timer: null,
    };
    this.tracks.set(key, track);
    return track;
  }

  /**
   * Queue a character's farewell, then the beat that empties its desk.
   *
   * Two beats, not one. The renderer marks a finished agent with a two-second
   * checkmark bubble and no caption, so a run that ended went straight from
   * "Typing a reply" to an idle label - the worker appeared to fall asleep
   * mid-sentence. `leaving` is the sentence that was missing: the character is
   * still at its desk, for one dwell, saying how the work went.
   *
   * The outcome rides in `activity` rather than in a field of its own, because
   * the caption path this office has - a tool label - carries exactly one
   * string, and every other phase already travels that way.
   */
  private depart(track: Track, characterId: string, tone: SceneExitTone): void {
    this.enqueue(track, {
      kind: "state",
      characterId,
      status: "leaving",
      activity: `${PHASE_ACTIVITY_PREFIX}leaving-${tone}`,
    });
    this.enqueue(track, { kind: "exit", characterId });
  }

  /**
   * Undo a departure that has not finished playing. True if there was one.
   *
   * A character shown as `leaving` counts: its farewell is on screen but its
   * seat has not been given up, so the desk can still be handed back.
   */
  private cancelDeparture(track: Track, characterId: string): boolean {
    let cancelled = false;
    for (let index = track.queue.length - 1; index >= 0; index--) {
      const beat = track.queue[index];
      if (beat.characterId !== characterId) continue;
      if (beat.kind !== "exit" && beat.status !== "leaving") continue;
      track.queue.splice(index, 1);
      cancelled = true;
    }
    const current = track.current;
    if (current && current.characterId === characterId && current.status === "leaving") {
      cancelled = true;
    }
    return cancelled;
  }

  /** Record an authoritative state, queueing a beat unless it is a repeat. */
  private observe(track: Track, beat: StateBeat): void {
    const previous = this.authored.get(beat.characterId);
    if (previous && sameState(previous, beat)) return;
    this.authored.set(beat.characterId, beat);
    this.enqueue(track, beat);
  }

  private enqueue(track: Track, beat: Beat): void {
    track.queue.push(beat);
    while (track.queue.length > MAX_QUEUED_BEATS) {
      const index = droppableIndex(track);
      if (index < 0) break;
      track.queue.splice(index, 1);
    }
    if (track.timer === null) this.advance(track);
  }

  /** Move the desk to whatever should be on it now that the dwell is over. */
  private advance(track: Track): void {
    const next = track.queue.shift();
    if (next) {
      this.show(track, next);
      return;
    }
    const current = track.current;
    if (
      current &&
      current.characterId === track.occupantId &&
      SYNTHETIC_THINKING_AFTER.has(current.status)
    ) {
      this.show(track, {
        kind: "state",
        characterId: current.characterId,
        status: "thinking",
        activity: undefined,
      });
      return;
    }
    // Nothing to move to. No timer is armed, so the next beat to arrive is
    // presented the moment it does rather than waiting out a dwell it has
    // already outlived.
  }

  private show(track: Track, beat: Beat): void {
    track.presentedAt = this.now();
    if (beat.kind === "exit") {
      // The desk empties, and that emptiness is itself a beat: it serves a dwell
      // like any other, so the seat is visibly given up before the next run sits
      // down in it.
      track.current = null;
      this.forget(beat.characterId, track);
    } else {
      track.current = beat;
    }
    track.timer = this.schedule(() => {
      track.timer = null;
      this.advance(track);
      this.emit();
    }, this.dwellMs());
  }

  /** Drop everything held for a character whose departure has been shown. */
  private forget(characterId: string, track: Track): void {
    if (this.deskOf.get(characterId) !== track) return;
    this.deskOf.delete(characterId);
    this.records.delete(characterId);
    this.authored.delete(characterId);
  }

  private clearTimer(track: Track): void {
    if (track.timer === null) return;
    this.cancel(track.timer);
    track.timer = null;
  }

  private emit(): void {
    const authoritative = this.authoritative;
    if (!authoritative) return;

    const characters: SceneCharacter[] = [];
    for (const track of this.tracks.values()) {
      const current = track.current;
      if (!current) continue;
      const record = this.records.get(current.characterId);
      if (!record) continue;
      const character: SceneCharacter = {
        id: current.characterId,
        // From the desk, not the record: the track IS the seat, and it is the
        // seat that has to hold exactly one occupant at a time.
        roomId: track.roomId,
        deskId: track.deskId,
        status: current.status,
        startedAt: record.startedAt,
        // The presented scene has to be internally consistent: this character's
        // status changed when it was SHOWN to change, not when the runtime
        // recorded it, and stale-detection downstream reads this field.
        updatedAt: track.presentedAt,
      };
      // Built field by field rather than spread from the record, so a beat with
      // no activity genuinely has none - an inherited tool name would caption a
      // character with the tool it finished several beats ago.
      if (current.activity !== undefined) character.activity = current.activity;
      if (record.taskRef !== undefined) character.taskRef = record.taskRef;
      characters.push(character);
    }
    // Deskless characters are queue depth, not a performance; the host counts
    // them for its own chrome and the renderer never seats them.
    for (const character of authoritative.characters) {
      if (character.deskId === null) characters.push(character);
    }

    this.presented = {
      contractVersion: authoritative.contractVersion,
      revision: ++this.revision,
      rooms: authoritative.rooms,
      desks: authoritative.desks,
      characters,
    };
    this.onPresent(this.presented);
  }
}

/**
 * Index of the beat to drop when a desk's queue is over the cap.
 *
 * A superseded character's beat goes first - the office should fall behind on a
 * run that has ended before it falls behind on the one happening now - and
 * otherwise the oldest. Never a departure, neither the `leaving` beat nor the
 * exit: one is the story's last line and the other is the character standing
 * up, and dropping either leaves someone sitting at a desk they no longer hold,
 * which is the one failure a viewer could read as a hung run.
 */
function droppableIndex(track: Track): number {
  let oldest = -1;
  for (let index = 0; index < track.queue.length; index++) {
    const beat = track.queue[index];
    if (beat.kind === "exit" || beat.status === "leaving") continue;
    if (beat.characterId !== track.occupantId) return index;
    if (oldest < 0) oldest = index;
  }
  return oldest;
}

function beatOf(character: SceneCharacter): StateBeat {
  return {
    kind: "state",
    characterId: character.id,
    status: character.status,
    activity: character.activity,
  };
}

function sameState(a: StateBeat, b: StateBeat): boolean {
  return a.status === b.status && a.activity === b.activity;
}

function defaultDwellMs(): number {
  return MIN_DWELL_MS + Math.random() * (MAX_DWELL_MS - MIN_DWELL_MS);
}

function defaultSetTimeout(callback: () => void, ms: number): PacerTimerHandle {
  return globalThis.setTimeout(callback, ms);
}

function defaultClearTimeout(handle: PacerTimerHandle): void {
  globalThis.clearTimeout(handle as Parameters<typeof globalThis.clearTimeout>[0]);
}
