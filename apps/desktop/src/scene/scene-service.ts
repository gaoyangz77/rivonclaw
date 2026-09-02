import type { SceneCue, SceneSnapshot } from "@rivonclaw/scene-contract";
import { createLogger } from "@rivonclaw/logger";
import { SCENE_CONTRACT_VERSION } from "@rivonclaw/scene-contract";
import { emitCsTelemetry } from "../telemetry/cs-telemetry-ref.js";
import { SceneProjector, type SceneAgentEvent } from "./scene-projector.js";
import { resolveRoomForSession, resolveSceneRooms } from "./scene-rooms.js";
import { buildSceneConfigRow, buildSceneEventRow } from "./scene-telemetry.js";

const log = createLogger("scene");

/**
 * How long changes are collected before one frame goes out.
 *
 * A busy run emits many events per second and the office cannot show more than
 * a few state changes a second anyway, so coalescing costs nothing visible and
 * keeps a burst of tool events from turning into a burst of SSE frames on every
 * connected Panel - including the ones not showing the office at all.
 */
const BROADCAST_INTERVAL_MS = 200;

/** How often silent runs are reclaimed. Cheap; the projector only walks a map. */
const SWEEP_INTERVAL_MS = 30_000;

/**
 * How often the room set is re-recorded while the Desktop stays up.
 *
 * The recording's config table expires rows on the same 14-day clock as the
 * events. A config written only at start therefore outlives its usefulness on
 * any Desktop that runs longer than that: events keep arriving, the one row
 * describing their rooms is gone, and a replay has characters but no office.
 * Re-recording daily keeps a fresh row inside the window at a cost of one
 * small row per tenant per day.
 */
export const CONFIG_RECORD_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface SceneService {
  /** Feed one department agent event. */
  handleEvent(event: SceneAgentEvent): void;
  /** Current scene, for a newly connected client. */
  snapshot(): SceneSnapshot;
  stop(): void;
}

export interface SceneServiceDeps {
  broadcastEvent: (event: string, data: unknown) => void;
  /** Overridable for tests. */
  now?: () => number;
}

/**
 * Owns the office projection and pushes it to Panel.
 *
 * Only full snapshots are sent - no JSON-Patch. A scene is a handful of rooms,
 * desks and characters, so a frame is a couple of kilobytes; patching it would
 * add a diff algorithm, an ordering requirement, and a class of drift bugs to
 * save bandwidth that is not scarce on a loopback socket. The `revision` on
 * each snapshot is what lets a client drop a stale frame.
 */
export function startSceneService(deps: SceneServiceDeps): SceneService {
  const rooms = resolveSceneRooms();
  const projector = new SceneProjector({ rooms, ...(deps.now ? { now: deps.now } : {}) });

  log.info(
    `Office scene started: ${rooms.map((r) => `${r.id}=${r.capacity}`).join(" ")}`,
  );

  const now = deps.now ?? Date.now;

  // Recorded at start, and re-recorded daily below, so a replay can rebuild
  // the room set and desk counts that were in force rather than assuming
  // today's configuration.
  let configRecordedAt = now();
  emitCsTelemetry(
    "office.scene_config",
    buildSceneConfigRow(rooms, SCENE_CONTRACT_VERSION, configRecordedAt),
  );

  let pending: ReturnType<typeof setTimeout> | null = null;
  let lastSentRevision = -1;

  function flush(): void {
    pending = null;
    const snapshot = projector.snapshot();
    const cues = projector.takeCues();
    // Nothing moved and nothing to animate: stay off the wire entirely.
    if (snapshot.revision === lastSentRevision && cues.length === 0) return;
    lastSentRevision = snapshot.revision;
    deps.broadcastEvent("scene-snapshot", { snapshot, cues });
  }

  function schedule(): void {
    if (pending) return;
    pending = setTimeout(flush, BROADCAST_INTERVAL_MS);
    pending.unref?.();
  }

  const sweepTimer = setInterval(() => {
    projector.sweep();
    schedule();
    const at = now();
    if (at - configRecordedAt >= CONFIG_RECORD_INTERVAL_MS) {
      configRecordedAt = at;
      emitCsTelemetry(
        "office.scene_config",
        buildSceneConfigRow(rooms, SCENE_CONTRACT_VERSION, at),
      );
    }
  }, SWEEP_INTERVAL_MS);
  sweepTimer.unref?.();

  return {
    handleEvent(event) {
      projector.handleEvent(event);
      // Recorded before projection, not after: these are the projector's
      // inputs, so a replay through a later projector build reproduces the
      // scene that build would draw rather than re-playing an old one.
      const row = buildSceneEventRow(event, resolveRoomForSession(rooms, event.sessionKey), now());
      if (row) emitCsTelemetry("office.scene_event", row);
      schedule();
    },
    snapshot() {
      return projector.snapshot();
    },
    stop() {
      clearInterval(sweepTimer);
      if (pending) clearTimeout(pending);
      pending = null;
    },
  };
}

export type { SceneCue };
