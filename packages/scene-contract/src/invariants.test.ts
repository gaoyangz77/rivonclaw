import { describe, expect, it } from "vitest";
import { assertSceneInvariants, findSceneViolations } from "./invariants.js";
import { SCENE_CONTRACT_VERSION, type SceneCharacter, type SceneSnapshot } from "./scene.js";

function character(overrides: Partial<SceneCharacter> = {}): SceneCharacter {
  return {
    id: "lease-1",
    roomId: "cs",
    deskId: "cs-0",
    status: "working",
    startedAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

function snapshot(overrides: Partial<SceneSnapshot> = {}): SceneSnapshot {
  return {
    contractVersion: SCENE_CONTRACT_VERSION,
    revision: 1,
    rooms: [
      { id: "cs", labelKey: "office.room.customerService", capacity: 2 },
      { id: "bd", labelKey: "office.room.affiliate", capacity: 1 },
    ],
    desks: [
      { id: "cs-0", roomId: "cs", index: 0 },
      { id: "cs-1", roomId: "cs", index: 1 },
      { id: "bd-0", roomId: "bd", index: 0 },
    ],
    characters: [character()],
    ...overrides,
  };
}

describe("findSceneViolations", () => {
  it("accepts a well-formed scene", () => {
    expect(findSceneViolations(snapshot())).toEqual([]);
  });

  it("accepts a queued character with no desk", () => {
    const scene = snapshot({
      characters: [character(), character({ id: "lease-2", deskId: null, status: "queued" })],
    });
    expect(findSceneViolations(scene)).toEqual([]);
  });

  it("rejects a mismatched contract version", () => {
    const scene = { ...snapshot(), contractVersion: SCENE_CONTRACT_VERSION + 1 };
    expect(findSceneViolations(scene)).toContainEqual(expect.stringContaining("contractVersion"));
  });

  it("rejects a negative revision", () => {
    expect(findSceneViolations(snapshot({ revision: -1 }))).toContainEqual(
      expect.stringContaining("revision"),
    );
  });

  // The failure this whole contract exists to make impossible: one execution
  // slot rendered as two working characters.
  it("rejects a double-booked desk", () => {
    const scene = snapshot({
      characters: [character({ id: "lease-1" }), character({ id: "lease-2" })],
    });
    expect(findSceneViolations(scene)).toContainEqual(
      expect.stringContaining("double-booked by lease-1 and lease-2"),
    );
  });

  it("rejects more desks than the room's capacity", () => {
    const scene = snapshot({
      desks: [
        { id: "bd-0", roomId: "bd", index: 0 },
        { id: "bd-1", roomId: "bd", index: 1 },
      ],
      characters: [character({ roomId: "bd", deskId: "bd-0" })],
    });
    expect(findSceneViolations(scene)).toContainEqual(
      expect.stringContaining("room bd has 2 desks but capacity 1"),
    );
  });

  it("rejects a queued character that still holds a desk", () => {
    const scene = snapshot({ characters: [character({ status: "queued" })] });
    expect(findSceneViolations(scene)).toContainEqual(
      expect.stringContaining("is queued but holds desk"),
    );
  });

  it("rejects a working character with no desk", () => {
    const scene = snapshot({ characters: [character({ deskId: null })] });
    expect(findSceneViolations(scene)).toContainEqual(
      expect.stringContaining("has status working but no desk"),
    );
  });

  it("rejects a character seated in another room's desk", () => {
    const scene = snapshot({ characters: [character({ roomId: "bd", deskId: "cs-0" })] });
    expect(findSceneViolations(scene)).toContainEqual(
      expect.stringContaining("sits at desk cs-0 in a different room"),
    );
  });

  it("rejects unknown room and desk references", () => {
    const scene = snapshot({ characters: [character({ roomId: "ghost", deskId: "nowhere" })] });
    const violations = findSceneViolations(scene);
    expect(violations).toContainEqual(expect.stringContaining("unknown room ghost"));
    expect(violations).toContainEqual(expect.stringContaining("unknown desk nowhere"));
  });

  it("rejects duplicate ids", () => {
    const scene = snapshot({
      rooms: [
        { id: "cs", labelKey: "a", capacity: 2 },
        { id: "cs", labelKey: "b", capacity: 2 },
      ],
    });
    expect(findSceneViolations(scene)).toContainEqual(expect.stringContaining("duplicate room id"));
  });

  it("rejects updatedAt earlier than startedAt", () => {
    const scene = snapshot({ characters: [character({ startedAt: 2_000, updatedAt: 1_000 })] });
    expect(findSceneViolations(scene)).toContainEqual(
      expect.stringContaining("updatedAt before startedAt"),
    );
  });

  it("reports every violation at once rather than the first", () => {
    const scene = snapshot({
      revision: -1,
      characters: [character({ status: "queued" }), character({ id: "lease-2" })],
    });
    expect(findSceneViolations(scene).length).toBeGreaterThan(1);
  });
});

describe("assertSceneInvariants", () => {
  it("does not throw on a valid scene", () => {
    expect(() => assertSceneInvariants(snapshot())).not.toThrow();
  });

  it("throws listing the violations", () => {
    const scene = snapshot({ characters: [character({ deskId: null })] });
    expect(() => assertSceneInvariants(scene)).toThrow(/Invalid scene snapshot/);
  });
});
