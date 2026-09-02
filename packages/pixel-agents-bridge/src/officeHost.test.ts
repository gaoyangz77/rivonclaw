import { SCENE_CONTRACT_VERSION, type SceneSnapshot } from "@rivonclaw/scene-contract";
import { beforeEach, describe, expect, it } from "vitest";
import type { SceneAssetBundle } from "./assetBootstrap.js";
import { OfficeHost, type OfficeFrame } from "./officeHost.js";
import type { PacerTimerHandle } from "./scenePacer.js";

const ASSETS: SceneAssetBundle = {
  characters: [],
  pets: [],
  petNames: [],
  floors: [],
  walls: [],
  carpets: [],
  furnitureCatalog: [],
  furnitureSprites: {},
  layout: { version: 1 },
};

function scene(revision: number, occupied: boolean): SceneSnapshot {
  return {
    contractVersion: SCENE_CONTRACT_VERSION,
    revision,
    rooms: [{ id: "cs", labelKey: "office.room.cs", capacity: 1 }],
    desks: [{ id: "cs-0", roomId: "cs", index: 0 }],
    characters: occupied
      ? [
          {
            id: "lease-1",
            roomId: "cs",
            deskId: "cs-0",
            status: "working",
            startedAt: 1,
            updatedAt: 1,
          },
        ]
      : [],
  };
}

class FakeFrame implements OfficeFrame {
  sent: Array<{ type?: string }> = [];
  private handler: ((message: unknown) => void) | null = null;
  subscribed = false;

  post(message: unknown): void {
    this.sent.push(message as { type?: string });
  }
  subscribe(handler: (message: unknown) => void): () => void {
    this.handler = handler;
    this.subscribed = true;
    return () => {
      this.handler = null;
      this.subscribed = false;
    };
  }
  /** Simulate the renderer announcing itself. */
  reportReady(): void {
    this.handler?.({ type: "webviewReady" });
  }
  emit(message: unknown): void {
    this.handler?.(message);
  }
  types(): (string | undefined)[] {
    return this.sent.map((m) => m.type);
  }
  clear(): void {
    this.sent = [];
  }
}

describe("OfficeHost", () => {
  let frame: FakeFrame;
  let host: OfficeHost;

  beforeEach(() => {
    frame = new FakeFrame();
    host = new OfficeHost(frame, { assets: ASSETS, bootstrap: { hostVersion: "1.0.0" } });
    host.start();
  });

  it("sends nothing before the renderer reports ready", () => {
    host.applyScene(scene(1, true));
    expect(frame.sent).toEqual([]);
  });

  it("delivers a scene that arrived before the handshake", () => {
    host.applyScene(scene(1, true));
    frame.reportReady();
    expect(frame.types()).toContain("existingAgents");
  });

  it("sends bootstrap before any agent message", () => {
    host.applyScene(scene(1, true));
    frame.reportReady();
    const types = frame.types();
    expect(types.indexOf("settingsLoaded")).toBeLessThan(types.indexOf("existingAgents"));
    expect(types[0]).toBe("characterSpritesLoaded");
  });

  // A reloaded iframe has lost everything but the host has not; treating the
  // second handshake as a fresh start is what makes recovery automatic.
  it("re-bootstraps and re-sends the roster when the renderer reloads", () => {
    host.applyScene(scene(1, true));
    frame.reportReady();
    frame.clear();

    frame.reportReady();
    const types = frame.types();
    expect(types[0]).toBe("characterSpritesLoaded");
    expect(types).toContain("existingAgents");
  });

  // The first scene after a handshake is a full roster, not an incremental
  // create: the renderer has just been reset and holds no agents to add to.
  it("delivers the first scene after the handshake as a full roster", () => {
    frame.reportReady();
    frame.clear();
    host.applyScene(scene(1, true));
    const roster = frame.sent.find((m) => m.type === "existingAgents") as
      | { agents: number[] }
      | undefined;
    expect(roster?.agents).toHaveLength(1);
  });

  it("sends incremental creates once a roster is established", () => {
    frame.reportReady();
    host.applyScene(scene(1, false));
    frame.clear();
    host.applyScene(scene(2, true));
    expect(frame.types()).toContain("agentCreated");
  });

  it("ignores messages that are not the ready handshake", () => {
    frame.emit({ type: "saveLayout", layout: {} });
    frame.emit("not-an-object");
    frame.emit(null);
    expect(frame.sent).toEqual([]);
  });

  it("exposes queue depth for host chrome", () => {
    frame.reportReady();
    host.applyScene({
      ...scene(1, false),
      characters: [
        { id: "q1", roomId: "cs", deskId: null, status: "queued", startedAt: 1, updatedAt: 1 },
      ],
    });
    expect(host.queuedByRoom().get("cs")).toBe(1);
  });

  // The producer coalesces, so a run's setup sequence reaches the host as one
  // snapshot plus the cues that led to it. If the host drops the cues the
  // office can only ever show the last of those states.
  it("hands the pacer the transitions behind a coalesced snapshot", () => {
    frame.reportReady();
    host.applyScene(
      {
        ...scene(1, true),
        characters: [
          {
            id: "lease-1",
            roomId: "cs",
            deskId: "cs-0",
            status: "thinking",
            startedAt: 1,
            updatedAt: 1,
          },
        ],
      },
      [
        { kind: "statusChanged", characterId: "lease-1", status: "arriving" },
        { kind: "statusChanged", characterId: "lease-1", status: "thinking" },
      ],
    );
    const started = frame.sent.filter((m) => m.type === "agentToolStart") as Array<{
      toolName?: string;
    }>;
    // Only the first beat has been presented; the rest are still queued.
    expect(started.map((m) => m.toolName)).toEqual(["phase:arriving"]);
  });

  it("stops listening after dispose", () => {
    host.dispose();
    expect(frame.subscribed).toBe(false);
    frame.reportReady();
    expect(frame.sent).toEqual([]);
  });

  it("is safe to start twice", () => {
    host.start();
    frame.reportReady();
    expect(frame.types().filter((t) => t === "characterSpritesLoaded")).toHaveLength(1);
  });
});

// A reload is the renderer's problem, not the office's. The office was in the
// middle of telling a story, and the beats still queued behind the frame on
// screen are exactly the ones a viewer has not seen yet - so the handshake
// replays what was showing, never the runtime's present.
describe("OfficeHost - handshake during a paced run", () => {
  /** Beats are armed but never fired: whatever is queued stays queued. */
  const frozenPacer = {
    dwellMs: () => 1_000,
    now: () => 0,
    setTimeout: (): PacerTimerHandle => 1,
    clearTimeout: () => {},
  };

  function characterScene(revision: number, status: "arriving" | "replying"): SceneSnapshot {
    return {
      ...scene(revision, true),
      characters: [
        { id: "lease-1", roomId: "cs", deskId: "cs-0", status, startedAt: 1, updatedAt: 1 },
      ],
    };
  }

  it("re-sends the beat on screen, not the one the runtime has reached", () => {
    const frame = new FakeFrame();
    const host = new OfficeHost(frame, {
      assets: ASSETS,
      bootstrap: { hostVersion: "1.0.0" },
      pacer: frozenPacer,
    });
    host.start();
    frame.reportReady();
    host.applyScene(characterScene(1, "arriving"));
    // Queued behind the dwell: the office is still showing `arriving`.
    host.applyScene(characterScene(2, "replying"));
    frame.clear();

    frame.reportReady();
    const started = frame.sent.filter((m) => m.type === "agentToolStart") as Array<{
      toolName?: string;
    }>;
    expect(started.map((m) => m.toolName)).toEqual(["phase:arriving"]);
  });
});
