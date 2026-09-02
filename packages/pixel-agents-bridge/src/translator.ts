import {
  PHASE_ACTIVITY_PREFIX,
  type CharacterStatus,
  type SceneCharacter,
  type SceneSnapshot,
} from "@rivonclaw/scene-contract";
import type { OutboundMessage } from "./capabilities.js";
import type { AgentActivityStatus, AgentSeatMeta } from "./protocol.js";

/**
 * How stable the workforce should look.
 *
 * `faithful` - a character exists only while an admission lease holds its desk.
 * Empty desks are empty. This is the honest projection of the runtime.
 *
 * `staff` - every desk always has a character; it simply sits idle when no
 * lease holds the desk. Intended for demos and livestreams, where an empty
 * department reads as a broken product rather than as spare capacity. The
 * underlying binding is identical in both modes: work still attaches to and
 * detaches from desks. Nothing here invents an agent that OpenClaw does not
 * have - an idle character is a free execution slot, not a resident worker.
 */
export type TranslatorMode = "faithful" | "staff";

export type TranslatorOptions = {
  mode?: TranslatorMode;
  /**
   * Turns a raw tool identifier into the caption drawn over the character.
   *
   * Also receives run phases, which travel as pseudo-tools - see
   * `PHASE_ACTIVITY_PREFIX`. A resolver that does not recognise the prefix
   * simply captions them from its tool vocabulary, which is wrong on screen but
   * never fatal.
   *
   * This package stays language-free: it never contains a word a viewer reads,
   * because the same events are also recorded for later replay and a caption
   * baked in here would freeze that history into one language. The host owns
   * translation and supplies it; without a resolver the identifier itself is
   * sent, which is honest for a headless consumer and wrong on screen.
   */
  resolveActivity?: (rawToolName: string) => string;
  /**
   * Whether a tool should play the reading animation rather than typing.
   *
   * Same reason it is a callback rather than a list: the callable tool set is
   * delivered to the client at runtime, so a shipped build meets tool names it
   * has never seen and no enumeration compiled into it can be complete. A
   * predicate classifies those the moment they appear; see `announcedReading`.
   */
  isReadingTool?: (rawToolName: string) => boolean;
};

type LiveAgent = {
  deskId: string;
  roomId: string;
  /** Current activity episode, if a tool message is outstanding. */
  toolId: string | null;
  /**
   * RAW tool name of the open episode, never the caption.
   *
   * Episodes are keyed on the identifier because captions collapse: several
   * tools legitimately read as the same sentence over a character's head, and
   * keying on the caption would silently merge a switch between two of them
   * into one episode - leaving the renderer's `currentTool`, and therefore the
   * reading-vs-typing animation, pinned to the tool that is no longer running.
   */
  toolRaw: string | null;
  awaitingInput: boolean;
  status: AgentActivityStatus;
};

type Desired = {
  agentId: number;
  deskId: string;
  roomId: string;
  occupant: SceneCharacter | null;
};

/**
 * Translates our renderer-agnostic scene into Pixel Agents wire messages.
 *
 * ## Agent ids: one per occupancy, never reused
 *
 * A desk holds one id for as long as it is continuously occupied, and a fresh
 * id the next time it fills. Ids are never recycled.
 *
 * That rule is forced by the renderer. Closing an agent does not delete it:
 * `OfficeState.removeAgent` starts a despawn animation and leaves the character
 * in place, while `addAgent` opens with `if (this.characters.has(id)) return`.
 * Upstream never hits that window because its ids come from sessions and are
 * unique forever, so a close is always final. Reusing an id - which keying
 * purely on the desk would do - makes the re-create a silent no-op and the
 * character simply never comes back. Caught in the browser spike: four agents
 * closed and re-created on their old desks vanished from the office while the
 * message counts still claimed they were live.
 *
 * In `staff` mode desks are never closed, so each desk keeps one id for the
 * whole session and seats stay put. In `faithful` mode a returning desk gets a
 * new id and therefore possibly a different chair within its room; the room
 * itself is still correct, because routing is by `folderName`, not by seat.
 *
 * ## Why an empty desk reports `waiting`
 *
 * In `staff` mode a desk with no lease still has a character, and that character
 * should get up and walk around rather than sit frozen at a desk it is not
 * working at. We do not drive that walk: the renderer owns it. Its character FSM
 * wanders to random walkable tiles, and returns to its seat to rest after a few
 * moves, for exactly as long as `ch.isActive` is false
 * (`webview-ui/src/office/engine/characters.ts`). The one and only input to
 * `ch.isActive` is this message - `setAgentActive(id, status === 'active')` in
 * `useExtensionMessages.ts` - so reporting an empty desk as `active` is what
 * pins those characters to their chairs.
 *
 * `waiting` with `awaitingInput: false` is not a mislabelled status here; it is
 * upstream's own encoding for a finished turn. Their `core/asyncapi.yaml` says
 * of `awaitingInput` that true "drives the 'Waiting for input' label" while
 * "absent/false means the agent finished its turn ('Done')". An unoccupied desk
 * is precisely that - no turn is running on it. The occupied-and-blocked case
 * keeps `awaitingInput: true` plus `agentToolPermission`, so the two remain
 * distinguishable on the wire and on screen.
 *
 * The renderer couples two visible side effects to any `waiting`: a two-second
 * "Done" bubble and `playDoneSound()`. Both are accepted rather than patched
 * away - the sound is inert because our bootstrap ships `soundEnabled: false`,
 * and a brief bubble as a desk empties reads correctly. `faithful` mode never
 * reaches this branch: it emits no character for an empty desk at all.
 *
 * ## Why queued characters are not emitted
 *
 * A queued character holds no desk. Upstream has no notion of an unseated
 * agent: its allocator would find the queued character a free seat, which would
 * show more concurrent workers than the admission controller actually permits -
 * exactly the lie this whole design exists to avoid. Queue depth is reported by
 * `queuedByRoom()` for the host UI to render as chrome outside the office.
 */
export class PixelAgentsTranslator {
  private readonly mode: TranslatorMode;
  private readonly resolveActivity: (rawToolName: string) => string;
  private readonly isReadingTool: (rawToolName: string) => boolean;
  /** Desk -> the id of its CURRENT occupancy. Cleared when the desk closes. */
  private readonly agentIdByDesk = new Map<string, number>();
  private readonly live = new Map<number, LiveAgent>();
  /**
   * Reading tools the renderer has been told about, in first-seen order.
   *
   * Grows as unfamiliar tools arrive and is re-announced whenever it does, so a
   * tool nobody enumerated still animates correctly from its very first frame:
   * the taxonomy update is emitted in the same batch, immediately ahead of the
   * `agentToolStart` that needs it. Kept across `reset` - the renderer forgets
   * on reload, we do not, so recovery re-announces everything learned so far.
   */
  private readonly announcedReading = new Set<string>();
  private queued = new Map<string, number>();
  private nextAgentId = 1;
  private toolEpisode = 0;
  private lastRevision = -1;
  private needsFullSync = true;
  private needsCapabilitiesSync = true;

  constructor(options: TranslatorOptions = {}) {
    this.mode = options.mode ?? "faithful";
    this.resolveActivity = options.resolveActivity ?? ((rawToolName) => rawToolName);
    this.isReadingTool = options.isReadingTool ?? (() => false);
  }

  /**
   * Forget every emitted agent so the next `apply` re-sends the full roster.
   *
   * Call this whenever the renderer restarts - iframe reload, transport
   * reconnect, host navigation. Desk-to-id assignments are deliberately kept so
   * seats survive a reload.
   */
  reset(): void {
    this.live.clear();
    this.lastRevision = -1;
    this.needsFullSync = true;
    this.needsCapabilitiesSync = true;
    // Desk-to-id assignments and the learned tool taxonomy deliberately survive:
    // a reloaded renderer is told the same roster it had, so nothing needs to be
    // renumbered, and it is told every reading tool learned so far rather than
    // having to rediscover them one call at a time.
  }

  /** Queue depth per room id, from the most recently applied snapshot. */
  queuedByRoom(): ReadonlyMap<string, number> {
    return this.queued;
  }

  /**
   * Diff a snapshot against what the renderer has already been told.
   *
   * Returns an empty array for a stale or duplicate snapshot. That revision gate
   * is the bridge's entire defence against reordered and repeated delivery -
   * every message below is derived from state, never replayed from an event, so
   * a dropped snapshot self-heals on the next one.
   */
  apply(snapshot: SceneSnapshot): OutboundMessage[] {
    if (!this.needsFullSync && snapshot.revision <= this.lastRevision) return [];
    this.lastRevision = snapshot.revision;

    const desired = this.buildDesired(snapshot);
    this.queued = countQueuedByRoom(snapshot);

    const messages: OutboundMessage[] = [];
    const fullSync = this.needsFullSync;

    if (this.needsCapabilitiesSync) {
      // Ahead of the roster, so no character can exist before the taxonomy that
      // decides how it is drawn.
      messages.push(this.buildCapabilities());
      this.needsCapabilitiesSync = false;
    }

    if (fullSync) {
      messages.push(this.buildRoster(desired));
      this.needsFullSync = false;
    }

    // Collected before deleting, so the loop never mutates what it walks.
    const desiredIds = new Set(desired.map((d) => d.agentId));
    const closing: number[] = [];
    for (const agentId of this.live.keys()) {
      if (!desiredIds.has(agentId)) closing.push(agentId);
    }
    for (const agentId of closing) {
      messages.push({ type: "agentClosed", id: agentId });
      const deskId = this.live.get(agentId)?.deskId;
      if (deskId !== undefined) this.agentIdByDesk.delete(deskId);
      this.live.delete(agentId);
    }

    for (const entry of desired) {
      if (!this.live.has(entry.agentId)) {
        if (!fullSync) {
          messages.push({
            type: "agentCreated",
            id: entry.agentId,
            folderName: entry.roomId,
          });
        }
        this.live.set(entry.agentId, {
          deskId: entry.deskId,
          roomId: entry.roomId,
          toolId: null,
          toolRaw: null,
          awaitingInput: false,
          status: "active",
        });
        // `freshlyCreated` forces the first status message: the renderer has
        // been told the agent exists but nothing about what it is doing.
        messages.push(...this.syncAgent(entry, true));
        continue;
      }
      messages.push(...this.syncAgent(entry, false));
    }

    return messages;
  }

  private buildDesired(snapshot: SceneSnapshot): Desired[] {
    const occupantByDesk = new Map<string, SceneCharacter>();
    for (const character of snapshot.characters) {
      if (character.deskId !== null) occupantByDesk.set(character.deskId, character);
    }

    // Stable ordering keeps id assignment deterministic across runs, which is
    // what lets persisted seats mean the same thing after a restart.
    const desks = [...snapshot.desks].sort(
      (a, b) => a.roomId.localeCompare(b.roomId) || a.index - b.index,
    );

    const desired: Desired[] = [];
    for (const desk of desks) {
      const occupant = occupantByDesk.get(desk.id) ?? null;
      if (this.mode === "faithful" && occupant === null) continue;
      desired.push({
        agentId: this.agentIdFor(desk.id),
        deskId: desk.id,
        roomId: desk.roomId,
        occupant,
      });
    }
    return desired;
  }

  private buildCapabilities(): OutboundMessage {
    return {
      type: "providerCapabilities",
      readingTools: [...this.announcedReading],
      // Never populated. See the field's own documentation in `capabilities.ts`.
      subagentToolNames: [],
    };
  }

  private buildRoster(desired: Desired[]): OutboundMessage {
    const agentMeta: Record<string, AgentSeatMeta> = {};
    const folderNames: Record<string, string> = {};
    const externalAgents: Record<string, boolean> = {};
    for (const entry of desired) {
      const key = String(entry.agentId);
      agentMeta[key] = {};
      folderNames[key] = entry.roomId;
      externalAgents[key] = false;
    }
    return {
      type: "existingAgents",
      agents: desired.map((d) => d.agentId),
      agentMeta,
      folderNames,
      externalAgents,
    };
  }

  /** Emit only the messages needed to move one agent to its desired state. */
  private syncAgent(entry: Desired, freshlyCreated: boolean): OutboundMessage[] {
    const live = this.live.get(entry.agentId);
    if (!live) return [];

    const messages: OutboundMessage[] = [];
    const occupant = entry.occupant;
    const toolRaw = occupant === null ? null : activityOf(occupant);
    const wantsPermission = occupant?.status === "waiting";
    // An unoccupied desk reports a finished turn, which is what releases the
    // character to wander; only an occupant blocked on approval raises the
    // permission flag. See "Why an empty desk reports `waiting`" above.
    const vacant = occupant === null;
    const wantsStatus: AgentActivityStatus = vacant || wantsPermission ? "waiting" : "active";

    // Close the previous activity episode when the tool ends or changes.
    //
    // Both messages are required. `agentToolDone` only marks the tool finished
    // in the renderer's list; the label stays over the character until
    // `agentToolsClear` empties it (`useExtensionMessages.ts` routes that one to
    // `setAgentTool(id, null)`). Upstream's own host sends the clear at every
    // turn end for this reason, "even when activeToolIds is empty by now".
    if (live.toolId !== null && live.toolRaw !== toolRaw) {
      messages.push({ type: "agentToolDone", id: entry.agentId, toolId: live.toolId });
      if (toolRaw === null) {
        // Only when nothing replaces the activity. A tool that changes needs no
        // clear: the following `agentToolStart` overwrites the label itself,
        // which is also how upstream's host sequences it.
        messages.push({ type: "agentToolsClear", id: entry.agentId });
        // That clear also drops the permission bubble, so our mirror of the
        // renderer's state has to forget it or a still-waiting character would
        // never have its bubble raised again.
        live.awaitingInput = false;
      }
      live.toolId = null;
      live.toolRaw = null;
    }

    if (freshlyCreated || live.status !== wantsStatus || live.awaitingInput !== wantsPermission) {
      messages.push({
        type: "agentStatus",
        id: entry.agentId,
        status: wantsStatus,
        awaitingInput: wantsPermission,
      });
      live.status = wantsStatus;
    }

    if (wantsPermission && !live.awaitingInput) {
      messages.push({ type: "agentToolPermission", id: entry.agentId });
    } else if (!wantsPermission && live.awaitingInput) {
      messages.push({ type: "agentToolPermissionClear", id: entry.agentId });
    }
    live.awaitingInput = wantsPermission;

    if (toolRaw !== null && live.toolId === null) {
      // Before the episode, never after: the renderer classifies the tool the
      // moment `agentToolStart` lands, so a taxonomy update arriving later
      // would leave the first seconds of the episode animated as typing.
      if (!this.announcedReading.has(toolRaw) && this.isReadingTool(toolRaw)) {
        this.announcedReading.add(toolRaw);
        messages.push(this.buildCapabilities());
      }
      const toolId = `${entry.agentId}:${++this.toolEpisode}`;
      messages.push({
        type: "agentToolStart",
        id: entry.agentId,
        toolId,
        // The caption a viewer reads, and the identifier the renderer matches
        // its animation on. Keeping the raw name in `toolName` is also what
        // keeps a recorded session debuggable in any language.
        status: this.resolveActivity(toolRaw),
        toolName: toolRaw,
      });
      live.toolId = toolId;
      live.toolRaw = toolRaw;
    }

    return messages;
  }

  private agentIdFor(deskId: string): number {
    const existing = this.agentIdByDesk.get(deskId);
    if (existing !== undefined) return existing;
    const id = this.nextAgentId++;
    this.agentIdByDesk.set(deskId, id);
    return id;
  }
}

/**
 * Statuses that caption themselves.
 *
 * A phase caption has to travel as a tool because a tool label is the ONLY
 * caption the renderer draws: `agentToolStart.toolName` is what appears over a
 * character's head, and `agentToolsClear` is what removes it. A status change
 * alone shows nothing at all. So `thinking` is sent as a pseudo-tool named
 * `phase:thinking`, opened and closed exactly like `web_search`. The prefix
 * itself is the contract's (`PHASE_ACTIVITY_PREFIX`), because the host that
 * captions it must not depend on this package to know it.
 *
 * ## Why every working status must be in here
 *
 * On this renderer "no caption" is not a neutral state - it is the IDLE state.
 * `ToolOverlay.getActivityText` ends in `return officeLabel('idle', ...)`, and
 * everything that could return earlier needs a tool row to do it: its one
 * mid-turn rescue, "all tools done but the agent is still active, keep the last
 * tool's status", is inside `if (tools && tools.length > 0)`. Our
 * `agentToolsClear` is what empties that list (`delete next[id]` in
 * `useExtensionMessages.ts`), so after a clear there is no row left for
 * `isActive` to rescue and a busy, visibly typing character is captioned as
 * asleep. A status this set omits therefore READS AS IDLE ON SCREEN, and the
 * only safe rule is that every status a seated running character can hold
 * captions itself.
 *
 * `working` was the omission that proved it. It means "running, nothing more
 * specific is known", which sounded like nothing worth captioning - and every
 * run that passed through it (OpenClaw's `lifecycle/finishing` used to, so
 * every run did) showed one beat of "Zzz" in the middle of working.
 *
 * The three left out are the ones the renderer already draws its own chrome
 * for, so they never reach the fall-through: `waiting` (permission bubble),
 * `queued` (never emitted - a queued character holds no desk) and `idle`, which
 * genuinely is idle.
 */
const CAPTIONED_PHASES: ReadonlySet<CharacterStatus> = new Set<CharacterStatus>([
  "arriving",
  "preparing",
  "thinking",
  "working",
  "replying",
  "leaving",
]);

/** The activity episode an occupant should have open, or null for none. */
function activityOf(occupant: SceneCharacter): string | null {
  // `tool` is the projector's own sentinel for a tool event that arrived
  // without a name; it is never a real identifier.
  if (occupant.status === "tooling") return occupant.activity ?? "tool";
  if (!CAPTIONED_PHASES.has(occupant.status)) return null;
  // A phase that names itself is taken as written. `leaving` does: it carries
  // its outcome (`phase:leaving-success`, `phase:leaving-failure`) because the
  // only caption channel this office has holds exactly one string, so a
  // departure that went wrong has nowhere else to say so.
  if (occupant.activity?.startsWith(PHASE_ACTIVITY_PREFIX)) return occupant.activity;
  return `${PHASE_ACTIVITY_PREFIX}${occupant.status}`;
}

function countQueuedByRoom(snapshot: SceneSnapshot): Map<string, number> {
  const counts = new Map<string, number>();
  for (const room of snapshot.rooms) counts.set(room.id, 0);
  for (const character of snapshot.characters) {
    if (character.status !== "queued") continue;
    counts.set(character.roomId, (counts.get(character.roomId) ?? 0) + 1);
  }
  return counts;
}
