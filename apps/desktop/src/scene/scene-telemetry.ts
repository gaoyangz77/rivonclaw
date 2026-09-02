import type { SceneAgentEvent } from "./scene-projector.js";
import type { SceneRoomConfig } from "./scene-rooms.js";

/**
 * One recorded office event, as it lands in ClickHouse.
 *
 * ## What is deliberately absent
 *
 * The session key. It carries the identifiers that make a run a real piece of
 * business - `agent:customer-service:cs:tiktok:<shopId>:<conversationId>`,
 * `agent:affiliate:affiliate:<userId>:<creatorRelationshipId>` - and none of
 * them are needed to redraw an office. The department is derived here and the
 * key is dropped before the row leaves the process, so a replay rendered into a
 * public video cannot leak a shop, a buyer or a creator even by accident.
 *
 * `runId` stays because characters have to be told apart, and it is an opaque
 * per-run identifier that means nothing outside the run.
 *
 * ## Why events and not scenes
 *
 * These are the projector's INPUTS. Replaying them through the same projector
 * reproduces a scene exactly, at a fraction of the storage of writing every
 * frame, and without pinning stored history to the scene contract's shape.
 *
 * ## Why this is language-free
 *
 * Nothing here has been translated: `toolName` is the runtime's own identifier
 * (`reply_buyer`), and department is an id. Translation happens only in the
 * Panel, at render time. A recording can therefore be replayed into any
 * language later, including one not supported when it was captured.
 */
export type SceneEventRow = {
  runId: string;
  seq: number;
  /** Room id: `cs`, `bd`, `ops`. */
  department: string;
  agentId: string;
  stream: string;
  /** Raw tool identifier, never a label. Absent outside the tool stream. */
  toolName?: string;
  /** Lifecycle phase (`start`, `end`, `error`) or approval phase. */
  phase?: string;
  aborted?: boolean;
  occurredAt: number;
};

/**
 * Room set and capacities in force, recorded so a replay can rebuild them.
 *
 * Recorded at Desktop start and again once a day while the Desktop stays up:
 * the config table keeps rows for the same 14 days as the events, so a row
 * written only at start would expire under a long-running Desktop while its
 * events kept arriving, leaving a replay with characters and no rooms.
 * `recordedAt` is when this row was written, which is what the TTL and the
 * "config in force at time T" lookup are keyed on.
 */
export type SceneConfigRow = {
  contractVersion: number;
  rooms: Array<{ id: string; agentId: string; capacity: number }>;
  recordedAt: number;
};

/**
 * Reduce one agent event to its recordable form.
 *
 * Returns null for anything outside a department: the office does not draw it,
 * so recording it would only add rows a replay must then learn to skip.
 */
export function buildSceneEventRow(
  event: SceneAgentEvent,
  room: SceneRoomConfig | null,
  occurredAt: number,
): SceneEventRow | null {
  if (!room) return null;
  const data = event.data ?? {};
  const toolName = typeof data.name === "string" ? data.name : undefined;
  const phase = typeof data.phase === "string" ? data.phase : undefined;
  return {
    runId: event.runId,
    seq: event.seq,
    department: room.id,
    agentId: room.agentId,
    stream: event.stream,
    ...(toolName !== undefined ? { toolName } : {}),
    ...(phase !== undefined ? { phase } : {}),
    ...(data.aborted === true ? { aborted: true } : {}),
    occurredAt,
  };
}

export function buildSceneConfigRow(
  rooms: readonly SceneRoomConfig[],
  contractVersion: number,
  recordedAt: number,
): SceneConfigRow {
  return {
    contractVersion,
    rooms: rooms.map((room) => ({ id: room.id, agentId: room.agentId, capacity: room.capacity })),
    recordedAt,
  };
}
