/**
 * Business-agnostic description of an "agent office" scene.
 *
 * This is the swap seam. A renderer consumes ONLY these types; nothing in here
 * names a business domain, a channel, a shop, or a buyer. Replacing the pixel
 * renderer must never require touching the projector that produces this state.
 *
 * ## Snapshot is authoritative, cues are sugar
 *
 * `SceneSnapshot` alone must be enough to draw a correct frame. `SceneCue` is a
 * transient hint for transition animations and is explicitly droppable: a
 * renderer that ignores every cue still shows the right thing. That rule is what
 * keeps reconnect, Desktop restart, and renderer swaps from each needing their
 * own state machine.
 */

/**
 * Bumped on any breaking change to the types below.
 *
 * 2: `preparing` and `replying` joined `CharacterStatus`, and `arriving` is now
 *    produced for a run's first event. A version-1 consumer treats the two new
 *    values as `working`.
 */
export const SCENE_CONTRACT_VERSION = 2;

/**
 * What a character is doing right now.
 *
 * Deliberately mirrors the run phases the Panel chat page already tracks
 * (`apps/panel/src/pages/chat/run-tracker.ts`) so there is one vocabulary for
 * "what is this run doing", not two that drift. The phases are fine-grained on
 * purpose: a run spends most of its life between its visible events - waiting
 * for a model to start, thinking, composing a reply - and a viewer watching the
 * office needs each of those to look like something.
 */
export type CharacterStatus =
  /** Admitted to the queue, has not been given a desk yet. */
  | "queued"
  /** Just took the work (run started); on the way to its desk. */
  | "arriving"
  /** Setting up before the model starts (OpenClaw `run_status` preparing phases). */
  | "preparing"
  /** Running: model turn in progress, nothing more specific known. */
  | "working"
  /** Reasoning (OpenClaw `thinking` stream, or the model has been started and nothing has come back yet). */
  | "thinking"
  /** Executing a tool (OpenClaw `tool` stream); see `activity`. */
  | "tooling"
  /** Composing its reply (OpenClaw `assistant` stream has begun). */
  | "replying"
  /** Blocked on a human - approval or input (OpenClaw `approval` stream). */
  | "waiting"
  /** Reached a terminal state; playing its exit animation before removal. */
  | "leaving"
  /** Occupies a seat with no work. Only produced when the product models
   *  stable "virtual employees"; a purely faithful projection never emits it. */
  | "idle";

/** A department floor. Capacity is the real admission limit, not a drawing hint. */
export type SceneRoom = {
  id: string;
  /**
   * i18n key, NOT display text. Business wording is resolved by the UI that
   * owns translations; the scene layer stays free of copy in any language.
   */
  labelKey: string;
  /** Concurrent execution slots. Mirrors the admission controller's limit. */
  capacity: number;
};

/** One execution slot, rendered as a desk/pod. */
export type SceneDesk = {
  id: string;
  roomId: string;
  /** Stable 0-based position within the room. Keeps seats from shuffling. */
  index: number;
};

/**
 * One character.
 *
 * `id` is the ADMISSION LEASE id - not a run id, not a session key, not an
 * OpenClaw agentId.
 *
 * That choice is load-bearing. Terminal run events are known to go missing in
 * this system: `apps/desktop/src/cs-bridge/cs-run-admission.ts` documents two
 * production incidents where lost terminal events wedged every slot, which is
 * why that controller carries a lease watchdog. A character keyed on the run
 * would inherit the same failure and stand at its desk forever; a character
 * keyed on the lease leaves when the watchdog reclaims it.
 */
export type SceneCharacter = {
  id: string;
  roomId: string;
  /** Desk currently held, or `null` while waiting in the queue area. */
  deskId: string | null;
  status: CharacterStatus;
  /**
   * Short display hint for the current activity, e.g. a tool name. Free text,
   * never parsed. Absent when nothing more specific than `status` is known.
   */
  activity?: string;
  /**
   * Opaque handle for the task on the desk.
   *
   * MUST NOT carry personal data. This office is intended for product demos and
   * livestreams, so anything derived from a real conversation - buyer ids,
   * creator handles, message text - has to be hashed or replaced upstream
   * before it reaches this field.
   */
  taskRef?: string;
  /** Epoch ms the lease was acquired. */
  startedAt: number;
  /**
   * Epoch ms of the last event seen for this character. Drives watchdog and
   * stale detection.
   *
   * Liveness, not visible change: an event that leaves the pose exactly as it
   * was still refreshes this, because a run streaming tool results has not gone
   * quiet and must not have its desk reclaimed while it works.
   */
  updatedAt: number;
};

/** Full authoritative scene state. */
export type SceneSnapshot = {
  contractVersion: number;
  /**
   * Monotonic per producer. A consumer that receives a revision lower than or
   * equal to the one it holds must discard the message: that is the whole
   * defence against reordered and duplicated delivery.
   */
  revision: number;
  rooms: SceneRoom[];
  desks: SceneDesk[];
  characters: SceneCharacter[];
};

/** Why a character left. Renderers may use it to pick an exit animation. */
export type SceneExitTone = "success" | "failure" | "aborted" | "reclaimed";

/**
 * Transient animation hints. Always safe to drop.
 *
 * `reclaimed` is the watchdog path: the lease was force-released because its
 * terminal event never arrived. Worth showing differently from a clean finish,
 * because it means something upstream is broken.
 *
 * `statusChanged` is one entry per status transition, in order. Snapshots are
 * coalesced by the producer, so a run that moves through three statuses in a
 * few milliseconds shows only the last of them in the next snapshot; a
 * presenter that wants to play the whole sequence (a paced office does) reads
 * it from these cues. A consumer that drops them still draws the right frame.
 */
export type SceneCue =
  | { kind: "characterExit"; characterId: string; tone: SceneExitTone }
  | { kind: "subagentSpawned"; parentCharacterId: string; childCharacterId: string }
  | { kind: "approvalRequested"; characterId: string }
  | { kind: "statusChanged"; characterId: string; status: CharacterStatus; activity?: string };
