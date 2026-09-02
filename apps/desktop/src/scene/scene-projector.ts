import {
  SCENE_CONTRACT_VERSION,
  type CharacterStatus,
  type SceneCue,
  type SceneDesk,
  type SceneExitTone,
  type SceneRoom,
  type SceneSnapshot,
} from "@rivonclaw/scene-contract";
import { resolveRoomForSession, type SceneRoomConfig } from "./scene-rooms.js";

/** One agent event, already narrowed to what the office needs. */
export type SceneAgentEvent = {
  runId: string;
  /** Monotonic per run. The projector's only ordering signal. */
  seq: number;
  stream: string;
  sessionKey?: string;
  data?: Record<string, unknown>;
};

export type SceneProjectorOptions = {
  rooms: SceneRoomConfig[];
  now?: () => number;
  /**
   * A run with no event for this long is presumed gone.
   *
   * This is an independent safety net, not a mirror of the admission layer's
   * lease watchdog: the projector cannot see leases, only the event stream, and
   * a run whose terminal event is lost stops emitting entirely. Five minutes is
   * far longer than any healthy turn and far shorter than the 15-minute lease
   * watchdog, so a stuck character disappears well before the slot it stands
   * for is reclaimed.
   */
  staleAfterMs?: number;
};

const DEFAULT_STALE_AFTER_MS = 5 * 60_000;

type LiveRun = {
  runId: string;
  roomId: string;
  deskId: string | null;
  status: CharacterStatus;
  activity?: string;
  startedAt: number;
  updatedAt: number;
  lastSeq: number;
};

/**
 * Turns the OpenClaw agent event stream into office scene state.
 *
 * ## What a character is here
 *
 * One per ACTIVE RUN, seated in the room its session key names, holding the
 * first free desk in that room. Desks per room come from the admission layer's
 * real concurrency limit, so a full room means the product is actually at
 * capacity rather than that the drawing ran out of chairs.
 *
 * This is deliberately one step coarser than binding to admission leases. The
 * projector never touches the CS or affiliate dispatch paths, so it cannot
 * break them; the cost is that "which desk" is the projector's choice rather
 * than the lease's identity. Room membership and occupancy counts - the two
 * things a viewer actually reads - stay exact either way, because both sides
 * are driven by the same limit.
 */
export class SceneProjector {
  private readonly rooms: SceneRoomConfig[];
  private readonly now: () => number;
  private readonly staleAfterMs: number;
  private readonly runs = new Map<string, LiveRun>();
  private cues: SceneCue[] = [];
  private revision = 0;

  constructor(options: SceneProjectorOptions) {
    this.rooms = options.rooms;
    this.now = options.now ?? Date.now;
    this.staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  }

  /** Apply one event. Unknown streams and foreign sessions are ignored. */
  handleEvent(event: SceneAgentEvent): void {
    const existing = this.runs.get(event.runId);
    if (existing) {
      // Per-run sequence is the whole defence against reorder and replay.
      if (event.seq <= existing.lastSeq) return;
      existing.lastSeq = event.seq;
      this.applyStream(existing, event);
      return;
    }

    const room = this.resolveRoom(event.sessionKey);
    if (!room) return;
    // A run first seen at its terminal event never becomes a character: seating
    // someone only to remove them in the same tick is noise, not information.
    if (this.terminalTone(event) !== null) return;

    const now = this.now();
    const run: LiveRun = {
      runId: event.runId,
      roomId: room.id,
      deskId: this.takeFreeDesk(room),
      // `arriving` belongs to taking the work, not to any one stream. Which
      // event happens to be a run's first differs by department - shop
      // operations opens with `run_status`, customer service with
      // `lifecycle/start` - so deriving it from a stream would give the two
      // departments different-looking arcs for the same thing happening.
      status: "arriving",
      startedAt: now,
      updatedAt: now,
      lastSeq: event.seq,
    };
    this.runs.set(event.runId, run);
    // A queued run has not arrived anywhere yet: it is waiting for a desk, and
    // announcing an arrival it cannot show would put a character in the room
    // ahead of the seat it needs.
    if (run.deskId === null) run.status = "queued";
    else this.pushStatusCue(run);
    this.applyStream(run, event);
    this.revision++;
  }

  /** Drop runs that stopped emitting. Call on a timer. */
  sweep(): void {
    const cutoff = this.now() - this.staleAfterMs;
    // Collected before removing, so the loop never mutates what it walks.
    const stale: LiveRun[] = [];
    for (const run of this.runs.values()) {
      if (run.updatedAt <= cutoff) stale.push(run);
    }
    for (const run of stale) this.remove(run, "reclaimed");
  }

  /** Current authoritative scene. */
  snapshot(): SceneSnapshot {
    const rooms: SceneRoom[] = this.rooms.map((room) => ({
      id: room.id,
      labelKey: room.labelKey,
      capacity: room.capacity,
    }));
    const desks: SceneDesk[] = [];
    for (const room of this.rooms) {
      for (let index = 0; index < room.capacity; index++) {
        desks.push({ id: deskId(room.id, index), roomId: room.id, index });
      }
    }
    return {
      contractVersion: SCENE_CONTRACT_VERSION,
      revision: this.revision,
      rooms,
      desks,
      characters: [...this.runs.values()].map((run) => ({
        id: run.runId,
        roomId: run.roomId,
        deskId: run.deskId,
        status: run.status,
        ...(run.activity !== undefined ? { activity: run.activity } : {}),
        startedAt: run.startedAt,
        updatedAt: run.updatedAt,
      })),
    };
  }

  /** Drain animation hints accumulated since the last call. */
  takeCues(): SceneCue[] {
    const cues = this.cues;
    this.cues = [];
    return cues;
  }

  private applyStream(run: LiveRun, event: SceneAgentEvent): void {
    const tone = this.terminalTone(event);
    if (tone !== null) {
      this.remove(run, tone);
      return;
    }

    // Liveness and pose are separate questions, and every event answers the
    // first one. A run that spends a minute streaming tool results has not gone
    // quiet, so `sweep` must not reclaim its desk while it works. The revision
    // is deliberately NOT bumped for an event that changes nothing else:
    // downstream reads `updatedAt` only for staleness, and publishing a frame
    // per result would undo the whole point of ignoring them.
    run.updatedAt = this.now();

    const next = statusForStream(event);
    if (next === null) return;

    // A queued run holds no desk; it may only advance once one frees up, which
    // `sweep` and terminal removal are what make happen.
    if (run.deskId === null) {
      const room = this.rooms.find((r) => r.id === run.roomId);
      if (room) run.deskId = this.takeFreeDesk(room);
      if (run.deskId === null) {
        run.status = "queued";
        this.revision++;
        return;
      }
    }
    const activity = next.status === "tooling" ? next.activity : undefined;
    // Snapshots are coalesced every 200ms by the service above, so a burst of
    // statuses inside one window survives only as its last member. The cue is
    // what carries the beats a paced presenter has to play through - and only
    // real transitions are beats: a `tool/result` restating the tool already on
    // screen changes nothing, and cueing it would stutter the animation.
    const changed = run.status !== next.status || run.activity !== activity;
    run.status = next.status;
    if (activity !== undefined) run.activity = activity;
    else delete run.activity;
    if (changed) this.pushStatusCue(run);
    if (next.status === "waiting") {
      this.cues.push({ kind: "approvalRequested", characterId: run.runId });
    }
    this.revision++;
  }

  private pushStatusCue(run: LiveRun): void {
    this.cues.push({
      kind: "statusChanged",
      characterId: run.runId,
      status: run.status,
      ...(run.activity !== undefined ? { activity: run.activity } : {}),
    });
  }

  private remove(run: LiveRun, tone: SceneExitTone): void {
    this.runs.delete(run.runId);
    // No lingering `leaving` state: the renderer owns the exit animation, and
    // holding a desk through it would overstate occupancy.
    this.cues.push({ kind: "characterExit", characterId: run.runId, tone });
    this.revision++;
  }

  private terminalTone(event: SceneAgentEvent): SceneExitTone | null {
    if (event.stream !== "lifecycle") return null;
    const phase = event.data?.phase;
    if (phase === "error") return "failure";
    if (phase !== "end") return null;
    return event.data?.aborted === true ? "aborted" : "success";
  }

  private resolveRoom(sessionKey: string | undefined): SceneRoomConfig | null {
    return resolveRoomForSession(this.rooms, sessionKey);
  }

  private takeFreeDesk(room: SceneRoomConfig): string | null {
    const taken = new Set<string>();
    for (const run of this.runs.values()) {
      if (run.roomId === room.id && run.deskId !== null) taken.add(run.deskId);
    }
    for (let index = 0; index < room.capacity; index++) {
      const id = deskId(room.id, index);
      if (!taken.has(id)) return id;
    }
    return null;
  }
}

function deskId(roomId: string, index: number): string {
  return `${roomId}-${index}`;
}

type StatusUpdate = { status: CharacterStatus; activity?: string };

/**
 * Setup phases OpenClaw reports on `run_status`, and what they look like.
 *
 * Only the phases the office can draw something for are listed; every other
 * run_status phase falls through to `working`, because a status change with no
 * known meaning still says the run is alive and says nothing more than that.
 */
const RUN_STATUS_POSES: Record<string, CharacterStatus> = {
  // Everything OpenClaw does before the model is asked for anything: laying out
  // the workspace, cutting a worktree for it, running setup, provisioning the
  // environment, assembling the context. A viewer cannot tell these apart and
  // does not need to - they are one stretch of getting ready.
  preparing_workspace: "preparing",
  naming_worktree: "preparing",
  creating_worktree: "preparing",
  running_setup: "preparing",
  provisioning_environment: "preparing",
  preparing_context: "preparing",
  // The model has been asked for a turn and nothing has come back yet. From
  // the outside that is indistinguishable from reasoning, and drawing it as
  // such is what fills the several seconds of silence before the first token.
  starting_model: "thinking",
};

/**
 * Maps an OpenClaw event stream to what the character is doing.
 *
 * The mapping covers a whole turn, not only its tool calls: a run spends most
 * of its wall clock between the events that were historically drawn - setting
 * up, waiting on the model, composing a reply - and each of those stretches
 * has to look like something or the office reads as idle while it works.
 *
 * `arriving` is deliberately absent: it belongs to taking the work rather than
 * to any stream, so `handleEvent` owns it and every department's arc opens the
 * same way regardless of which event happens to arrive first.
 *
 * Returning null means "this event says nothing about activity" - usage, items,
 * patches and compaction all pass through without disturbing the pose, and so
 * do individual phases of a stream that usually poses. It is not a statement
 * about liveness: `applyStream` marks the run alive before asking.
 * `error` is deliberately among them: OpenClaw reports run failure on the
 * lifecycle stream with `phase: "error"`, and treating the separate error
 * stream as terminal would retire runs that merely logged a recoverable fault.
 */
function statusForStream(event: SceneAgentEvent): StatusUpdate | null {
  switch (event.stream) {
    case "thinking":
      return { status: "thinking" };
    case "tool": {
      // Only a `start` poses. The tool that is running was named by its start;
      // `update`, `result`, `review` and `input_delta` are all that same tool
      // continuing, and none of them says the character moved on. Five tools
      // that start together return in whatever order they finish, so posing on
      // returns would replay the whole burst a second time, shuffled, on top of
      // the first - and `input_delta` carries no name at all, so it would swap
      // the label for the unnamed-tool sentinel in the middle of an edit.
      //
      // An absent phase still poses: it is the shape a tool event has when the
      // producer sends only a name.
      const phase = event.data?.phase;
      if (phase !== undefined && phase !== "start") return null;
      const name = event.data?.name ?? event.data?.toolName;
      return { status: "tooling", activity: typeof name === "string" ? name : "tool" };
    }
    case "approval":
      return event.data?.phase === "requested"
        ? { status: "waiting" }
        : { status: "working" };
    // One marker per reply burst, not one per token - the gateway plugin
    // collapses the burst before it ever reaches here.
    case "assistant":
      return { status: "replying" };
    case "lifecycle":
      // `end` and `error` never arrive here: they retire the run upstream.
      switch (event.data?.phase) {
        // Still setup: the run has been accepted but no model has been asked
        // for anything yet, and `run_status/starting_model` ends that stretch.
        case "start":
          return { status: "preparing" };
        // The sub-second tail of the reply, with `end` right behind it. Posing
        // it would put a whole beat between the last word being written and the
        // character getting up - long enough on screen to read as a pause the
        // run never took.
        case "finishing":
          return null;
        // The turn has been handed to a fallback model and nothing has come
        // back from it. Indistinguishable from any other wait on a model, and
        // drawn the same way `starting_model` is.
        case "fallback_step":
          return { status: "thinking" };
        // A phase this build has never met still says the run is alive, and
        // that is all it is allowed to claim.
        default:
          return { status: "working" };
      }
    case "run_status": {
      const phase = event.data?.phase;
      const pose = typeof phase === "string" ? RUN_STATUS_POSES[phase] : undefined;
      return { status: pose ?? "working" };
    }
    default:
      return null;
  }
}
