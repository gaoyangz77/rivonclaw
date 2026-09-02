import { SCENE_CONTRACT_VERSION, type SceneSnapshot } from "./scene.js";

/**
 * Structural checks a valid scene must satisfy.
 *
 * These are not defensive padding. Every rule here corresponds to a failure this
 * system has actually produced or is structurally able to produce: a desk held
 * by two characters is a double-booked execution slot, a room with more desks
 * than capacity means the projector and the admission controller have drifted
 * apart, and a character parked on a desk with `queued` status is a lease that
 * was never properly bound. Catching them at the contract boundary keeps a
 * projector bug from surfacing as a mysterious animation glitch.
 */
export function findSceneViolations(snapshot: SceneSnapshot): string[] {
  const violations: string[] = [];

  if (snapshot.contractVersion !== SCENE_CONTRACT_VERSION) {
    violations.push(
      `contractVersion ${snapshot.contractVersion} != expected ${SCENE_CONTRACT_VERSION}`,
    );
  }
  if (!Number.isInteger(snapshot.revision) || snapshot.revision < 0) {
    violations.push(`revision must be a non-negative integer, got ${snapshot.revision}`);
  }

  const roomIds = new Set<string>();
  const roomCapacity = new Map<string, number>();
  for (const room of snapshot.rooms) {
    if (roomIds.has(room.id)) violations.push(`duplicate room id ${room.id}`);
    roomIds.add(room.id);
    roomCapacity.set(room.id, room.capacity);
    if (!Number.isInteger(room.capacity) || room.capacity < 0) {
      violations.push(`room ${room.id} has invalid capacity ${room.capacity}`);
    }
  }

  const deskIds = new Set<string>();
  const deskRoom = new Map<string, string>();
  const desksPerRoom = new Map<string, number>();
  for (const desk of snapshot.desks) {
    if (deskIds.has(desk.id)) violations.push(`duplicate desk id ${desk.id}`);
    deskIds.add(desk.id);
    deskRoom.set(desk.id, desk.roomId);
    if (!roomIds.has(desk.roomId)) {
      violations.push(`desk ${desk.id} references unknown room ${desk.roomId}`);
    }
    desksPerRoom.set(desk.roomId, (desksPerRoom.get(desk.roomId) ?? 0) + 1);
  }
  for (const [roomId, count] of desksPerRoom) {
    const capacity = roomCapacity.get(roomId);
    if (capacity !== undefined && count > capacity) {
      violations.push(`room ${roomId} has ${count} desks but capacity ${capacity}`);
    }
  }

  const characterIds = new Set<string>();
  const deskOccupant = new Map<string, string>();
  for (const character of snapshot.characters) {
    if (characterIds.has(character.id)) {
      violations.push(`duplicate character id ${character.id}`);
    }
    characterIds.add(character.id);

    if (!roomIds.has(character.roomId)) {
      violations.push(`character ${character.id} references unknown room ${character.roomId}`);
    }

    // `queued` and "holds a desk" are exactly complementary: a queued character
    // is by definition one that admission has not yet given a slot to.
    const queued = character.status === "queued";
    if (queued && character.deskId !== null) {
      violations.push(`character ${character.id} is queued but holds desk ${character.deskId}`);
    }
    if (!queued && character.deskId === null) {
      violations.push(`character ${character.id} has status ${character.status} but no desk`);
    }

    if (character.deskId !== null) {
      if (!deskIds.has(character.deskId)) {
        violations.push(`character ${character.id} references unknown desk ${character.deskId}`);
      } else {
        if (deskRoom.get(character.deskId) !== character.roomId) {
          violations.push(
            `character ${character.id} sits at desk ${character.deskId} in a different room`,
          );
        }
        const existing = deskOccupant.get(character.deskId);
        if (existing !== undefined) {
          violations.push(
            `desk ${character.deskId} is double-booked by ${existing} and ${character.id}`,
          );
        } else {
          deskOccupant.set(character.deskId, character.id);
        }
      }
    }

    if (!Number.isFinite(character.startedAt) || !Number.isFinite(character.updatedAt)) {
      violations.push(`character ${character.id} has a non-finite timestamp`);
    } else if (character.updatedAt < character.startedAt) {
      violations.push(`character ${character.id} has updatedAt before startedAt`);
    }
  }

  return violations;
}

/** Throws with every violation at once. Callers should not catch this. */
export function assertSceneInvariants(snapshot: SceneSnapshot): void {
  const violations = findSceneViolations(snapshot);
  if (violations.length > 0) {
    throw new Error(`Invalid scene snapshot:\n  - ${violations.join("\n  - ")}`);
  }
}
