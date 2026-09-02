import { SCENE_CONTRACT_VERSION, type SceneCharacter, type SceneSnapshot } from "@rivonclaw/scene-contract";
import { describe, expect, it } from "vitest";
import type { OutboundMessage } from "./capabilities.js";
import { PixelAgentsTranslator } from "./translator.js";

const ROOMS = [
  { id: "cs", labelKey: "office.room.cs", capacity: 2 },
  { id: "bd", labelKey: "office.room.bd", capacity: 1 },
];
const DESKS = [
  { id: "cs-0", roomId: "cs", index: 0 },
  { id: "cs-1", roomId: "cs", index: 1 },
  { id: "bd-0", roomId: "bd", index: 0 },
];

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

const typesOf = (messages: OutboundMessage[]) => messages.map((m) => m.type);
const pick = <T extends OutboundMessage["type"]>(messages: OutboundMessage[], type: T) =>
  messages.filter((m): m is Extract<OutboundMessage, { type: T }> => m.type === type);

describe("PixelAgentsTranslator - faithful mode", () => {
  it("opens with an empty roster when nothing is running", () => {
    const t = new PixelAgentsTranslator();
    const out = t.apply(scene(1, []));
    expect(typesOf(out)).toEqual(["providerCapabilities", "existingAgents"]);
    expect(pick(out, "existingAgents")[0].agents).toEqual([]);
  });

  it("creates a character when a lease takes a desk, and routes it by room", () => {
    const t = new PixelAgentsTranslator();
    t.apply(scene(1, []));
    const out = t.apply(scene(2, [character({ id: "lease-1" })]));
    const created = pick(out, "agentCreated");
    expect(created).toHaveLength(1);
    // `folderName` is the room routing key upstream feeds into areaMappings.
    expect(created[0].folderName).toBe("cs");
    expect(pick(out, "agentStatus")[0].status).toBe("active");
  });

  it("closes the character when the lease releases the desk", () => {
    const t = new PixelAgentsTranslator();
    t.apply(scene(1, [character({ id: "lease-1" })]));
    const out = t.apply(scene(2, []));
    expect(typesOf(out)).toEqual(["agentClosed"]);
  });

  it("leaves empty desks empty", () => {
    const t = new PixelAgentsTranslator();
    const out = t.apply(scene(1, [character({ id: "lease-1" })]));
    expect(pick(out, "existingAgents")[0].agents).toHaveLength(1);
  });
});

describe("PixelAgentsTranslator - staff mode", () => {
  it("seats one character per desk up front, including empty desks", () => {
    const t = new PixelAgentsTranslator({ mode: "staff" });
    const out = t.apply(scene(1, []));
    const roster = pick(out, "existingAgents")[0];
    expect(roster.agents).toHaveLength(DESKS.length);
    expect(Object.values(roster.folderNames).sort()).toEqual(["bd", "cs", "cs"]);
  });

  it("never closes a character when its desk frees up", () => {
    const t = new PixelAgentsTranslator({ mode: "staff" });
    t.apply(scene(1, [character({ id: "lease-1" })]));
    const out = t.apply(scene(2, []));
    expect(typesOf(out)).not.toContain("agentClosed");
  });
});

// `ch.isActive` is the renderer's only switch between "sit at the desk" and
// "get up and wander", and `agentStatus` is the only thing that sets it. An
// empty desk must therefore report a finished turn, or its character sits
// frozen forever. See the translator's own doc comment.
describe("PixelAgentsTranslator - idle staff wander", () => {
  it("reports an unoccupied staff desk as not active, which is what frees it to wander", () => {
    const t = new PixelAgentsTranslator({ mode: "staff" });
    const statuses = pick(t.apply(scene(1, [])), "agentStatus");
    expect(statuses).toHaveLength(DESKS.length);
    expect(statuses.every((m) => m.status === "waiting")).toBe(true);
    // A finished turn, not a request for input: no bubble label, no permission.
    expect(statuses.every((m) => m.awaitingInput === false)).toBe(true);
  });

  it("does not raise the permission flag for an empty desk", () => {
    const t = new PixelAgentsTranslator({ mode: "staff" });
    expect(typesOf(t.apply(scene(1, [])))).not.toContain("agentToolPermission");
  });

  it("keeps an occupied staff desk active, so its character stays seated", () => {
    const t = new PixelAgentsTranslator({ mode: "staff" });
    const seated = pick(t.apply(scene(1, [character({ id: "lease-1" })])), "agentStatus").filter(
      (m) => m.status === "active",
    );
    expect(seated).toHaveLength(1);
  });

  it("sits the character back down when work arrives, and releases it when work leaves", () => {
    const t = new PixelAgentsTranslator({ mode: "staff" });
    t.apply(scene(1, []));
    const filled = pick(t.apply(scene(2, [character({ id: "lease-1" })])), "agentStatus");
    expect(filled).toHaveLength(1);
    expect(filled[0].status).toBe("active");

    const emptied = pick(t.apply(scene(3, [])), "agentStatus");
    expect(emptied).toHaveLength(1);
    expect(emptied[0].status).toBe("waiting");
    expect(emptied[0].awaitingInput).toBe(false);
  });

  // The regression that matters: an occupant blocked on approval must stay
  // distinguishable from an empty desk, both of which travel as `waiting`.
  it("still reports an occupied desk blocked on approval as awaiting input", () => {
    const t = new PixelAgentsTranslator({ mode: "staff" });
    t.apply(scene(1, [character({ id: "lease-1" })]));
    const out = t.apply(scene(2, [character({ id: "lease-1", status: "waiting" })]));
    const status = pick(out, "agentStatus");
    expect(status).toHaveLength(1);
    expect(status[0].status).toBe("waiting");
    expect(status[0].awaitingInput).toBe(true);
    expect(typesOf(out)).toContain("agentToolPermission");
  });

  it("clears the permission flag when a blocked desk empties out", () => {
    const t = new PixelAgentsTranslator({ mode: "staff" });
    t.apply(scene(1, [character({ id: "lease-1", status: "waiting" })]));
    const out = t.apply(scene(2, []));
    expect(typesOf(out)).toContain("agentToolPermissionClear");
    expect(pick(out, "agentStatus")[0].awaitingInput).toBe(false);
  });

  it("leaves faithful mode alone - an empty desk has no character to report", () => {
    const t = new PixelAgentsTranslator();
    expect(pick(t.apply(scene(1, [])), "agentStatus")).toHaveLength(0);
  });
});

describe("PixelAgentsTranslator - activity", () => {
  it("starts a tool episode and labels it with the activity", () => {
    const t = new PixelAgentsTranslator();
    t.apply(scene(1, [character({ id: "lease-1" })]));
    const out = t.apply(
      scene(2, [character({ id: "lease-1", status: "tooling", activity: "web_search" })]),
    );
    const start = pick(out, "agentToolStart");
    expect(start).toHaveLength(1);
    expect(start[0].toolName).toBe("web_search");
  });

  it("closes the old episode before opening a new one when the tool changes", () => {
    const t = new PixelAgentsTranslator();
    t.apply(scene(1, [character({ id: "lease-1", status: "tooling", activity: "read" })]));
    const out = t.apply(
      scene(2, [character({ id: "lease-1", status: "tooling", activity: "write" })]),
    );
    expect(typesOf(out)).toEqual(["agentToolDone", "agentToolStart"]);
  });

  // `agentToolDone` alone leaves the label hanging over the character: the
  // renderer only drops it on `agentToolsClear`. Caught by the browser spike,
  // where finished tools kept their captions.
  it("clears the activity label, not just the tool, when the tool ends", () => {
    const t = new PixelAgentsTranslator();
    t.apply(scene(1, [character({ id: "lease-1", status: "tooling", activity: "read" })]));
    const out = t.apply(scene(2, [character({ id: "lease-1", status: "working" })]));
    expect(typesOf(out)).toContain("agentToolDone");
    expect(typesOf(out)).toContain("agentToolsClear");
  });

  it("re-raises the permission bubble that a tool clear wiped", () => {
    const t = new PixelAgentsTranslator();
    t.apply(scene(1, [character({ id: "lease-1", status: "tooling", activity: "read" })]));
    const out = t.apply(scene(2, [character({ id: "lease-1", status: "waiting" })]));
    const types = typesOf(out);
    expect(types).toContain("agentToolsClear");
    expect(types).toContain("agentToolPermission");
    // The clear must land first, or it wipes the bubble it was meant to precede.
    expect(types.indexOf("agentToolsClear")).toBeLessThan(types.indexOf("agentToolPermission"));
  });

  it("raises and clears the permission flag around a waiting character", () => {
    const t = new PixelAgentsTranslator();
    t.apply(scene(1, [character({ id: "lease-1" })]));
    const raised = t.apply(scene(2, [character({ id: "lease-1", status: "waiting" })]));
    expect(typesOf(raised)).toContain("agentToolPermission");
    expect(pick(raised, "agentStatus")[0].status).toBe("waiting");

    const cleared = t.apply(scene(3, [character({ id: "lease-1", status: "working" })]));
    expect(typesOf(cleared)).toContain("agentToolPermissionClear");
    expect(pick(cleared, "agentStatus")[0].status).toBe("active");
  });

  it("emits nothing when the scene has not changed", () => {
    const t = new PixelAgentsTranslator();
    t.apply(scene(1, [character({ id: "lease-1" })]));
    expect(t.apply(scene(2, [character({ id: "lease-1" })]))).toEqual([]);
  });
});

describe("PixelAgentsTranslator - delivery hazards", () => {
  it("discards a stale revision", () => {
    const t = new PixelAgentsTranslator();
    t.apply(scene(5, [character({ id: "lease-1" })]));
    expect(t.apply(scene(4, []))).toEqual([]);
  });

  it("discards a duplicated revision", () => {
    const t = new PixelAgentsTranslator();
    t.apply(scene(5, [character({ id: "lease-1" })]));
    expect(t.apply(scene(5, [character({ id: "lease-1" })]))).toEqual([]);
  });

  it("re-sends the whole roster after reset, so a reloaded renderer recovers", () => {
    const t = new PixelAgentsTranslator();
    t.apply(scene(1, [character({ id: "lease-1" })]));
    t.reset();
    const out = t.apply(scene(2, [character({ id: "lease-1" })]));
    expect(typesOf(out)).toContain("existingAgents");
    expect(pick(out, "existingAgents")[0].agents).toHaveLength(1);
  });

  it("accepts a lower revision after reset, because the renderer lost its state", () => {
    const t = new PixelAgentsTranslator();
    t.apply(scene(9, [character({ id: "lease-1" })]));
    t.reset();
    expect(t.apply(scene(2, [character({ id: "lease-1" })]))).not.toEqual([]);
  });
});

describe("PixelAgentsTranslator - agent ids", () => {
  // The renderer keeps a closed agent alive through a despawn animation and
  // ignores `addAgent` for an id it still holds, so a recycled id makes the
  // re-create a silent no-op and the character never returns. Found in the
  // browser spike.
  it("never reuses the id of a closed agent", () => {
    const t = new PixelAgentsTranslator();
    t.apply(scene(1, [character({ id: "lease-1" })]));
    const closed = t.apply(scene(2, []));
    const reopened = t.apply(scene(3, [character({ id: "lease-2" })]));
    expect(pick(reopened, "agentCreated")[0].id).not.toBe(pick(closed, "agentClosed")[0].id);
  });

  // A handover with no gap keeps the character: emitting close+create for one
  // desk in a single batch is precisely the pattern the renderer cannot take.
  it("keeps the same agent when a desk changes occupant without emptying", () => {
    const t = new PixelAgentsTranslator();
    t.apply(scene(1, [character({ id: "lease-1" })]));
    const out = t.apply(scene(2, [character({ id: "lease-2" })]));
    expect(typesOf(out)).not.toContain("agentClosed");
    expect(typesOf(out)).not.toContain("agentCreated");
  });

  it("keeps desk ids stable across a reset", () => {
    const t = new PixelAgentsTranslator({ mode: "staff" });
    const before = pick(t.apply(scene(1, [])), "existingAgents")[0];
    t.reset();
    const after = pick(t.apply(scene(2, [])), "existingAgents")[0];
    expect(after.agents).toEqual(before.agents);
    expect(after.folderNames).toEqual(before.folderNames);
  });
});

describe("PixelAgentsTranslator - queued work", () => {
  it("does not seat queued characters", () => {
    const t = new PixelAgentsTranslator();
    const out = t.apply(
      scene(1, [
        character({ id: "lease-1" }),
        character({ id: "lease-2", deskId: null, status: "queued" }),
        character({ id: "lease-3", deskId: null, status: "queued", roomId: "bd" }),
      ]),
    );
    expect(pick(out, "existingAgents")[0].agents).toHaveLength(1);
  });

  it("reports queue depth per room for the host UI", () => {
    const t = new PixelAgentsTranslator();
    t.apply(
      scene(1, [
        character({ id: "lease-2", deskId: null, status: "queued" }),
        character({ id: "lease-3", deskId: null, status: "queued" }),
        character({ id: "lease-4", deskId: null, status: "queued", roomId: "bd" }),
      ]),
    );
    expect(t.queuedByRoom().get("cs")).toBe(2);
    expect(t.queuedByRoom().get("bd")).toBe(1);
  });
});

describe("PixelAgentsTranslator - activity captions", () => {
  it("sends the resolved caption as the display status and keeps the raw name", () => {
    const t = new PixelAgentsTranslator({
      resolveActivity: (raw) => `caption:${raw}`,
    });
    t.apply(scene(1, [character({ id: "lease-1" })]));
    const start = pick(
      t.apply(
        scene(2, [
          character({ id: "lease-1", status: "tooling", activity: "ecom_cs_get_order" }),
        ]),
      ),
      "agentToolStart",
    );
    expect(start[0].status).toBe("caption:ecom_cs_get_order");
    // The identifier survives on `toolName`: it is what the renderer matches
    // its animation on, and what makes a recorded session debuggable.
    expect(start[0].toolName).toBe("ecom_cs_get_order");
  });

  it("falls back to the raw name when the host supplies no resolver", () => {
    const t = new PixelAgentsTranslator();
    t.apply(scene(1, [character({ id: "lease-1" })]));
    const start = pick(
      t.apply(scene(2, [character({ id: "lease-1", status: "tooling", activity: "read" })])),
      "agentToolStart",
    );
    expect(start[0].status).toBe("read");
  });

  // Captions collapse - several tools read as the same sentence over a head -
  // so an episode keyed on the caption would merge a real tool switch into one
  // episode and leave the renderer animating the tool that already finished.
  it("opens a new episode when the tool changes but the caption does not", () => {
    const t = new PixelAgentsTranslator({ resolveActivity: () => "Reading an order" });
    t.apply(scene(1, [character({ id: "lease-1", status: "tooling", activity: "ecom_get_order" })]));
    const out = t.apply(
      scene(2, [character({ id: "lease-1", status: "tooling", activity: "ecom_cs_get_order" })]),
    );
    expect(typesOf(out)).toEqual(["agentToolDone", "agentToolStart"]);
    expect(pick(out, "agentToolStart")[0].toolName).toBe("ecom_cs_get_order");
  });
});

// The renderer draws exactly one caption, and it is the tool label. A status
// change on its own shows nothing at all, so a phase that is worth reading has
// to travel as a pseudo-tool episode.
describe("PixelAgentsTranslator - phase captions", () => {
  const PHASES = ["arriving", "preparing", "thinking", "replying"] as const;

  for (const status of PHASES) {
    it(`captions ${status} as a pseudo-tool`, () => {
      const t = new PixelAgentsTranslator();
      t.apply(scene(1, [character({ id: "lease-1" })]));
      const start = pick(t.apply(scene(2, [character({ id: "lease-1", status })])), "agentToolStart");
      expect(start).toHaveLength(1);
      expect(start[0].toolName).toBe(`phase:${status}`);
    });
  }

  // `leaving` names its own outcome, because the office's single caption slot
  // has nowhere else to say whether the run finished or fell over.
  it("captions leaving with the outcome the scene gave it", () => {
    const t = new PixelAgentsTranslator();
    t.apply(scene(1, [character({ id: "lease-1", status: "replying" })]));
    const start = pick(
      t.apply(
        scene(2, [
          character({ id: "lease-1", status: "leaving", activity: "phase:leaving-success" }),
        ]),
      ),
      "agentToolStart",
    );
    expect(start).toHaveLength(1);
    expect(start[0].toolName).toBe("phase:leaving-success");
  });

  it("keeps each outcome its own episode", () => {
    const t = new PixelAgentsTranslator();
    t.apply(
      scene(1, [character({ id: "lease-1", status: "leaving", activity: "phase:leaving-success" })]),
    );
    const out = t.apply(
      scene(2, [character({ id: "lease-1", status: "leaving", activity: "phase:leaving-failure" })]),
    );
    expect(typesOf(out)).toEqual(["agentToolDone", "agentToolStart"]);
    expect(pick(out, "agentToolStart")[0].toolName).toBe("phase:leaving-failure");
  });

  it("falls back to the bare phase when leaving names no outcome", () => {
    const t = new PixelAgentsTranslator();
    t.apply(scene(1, [character({ id: "lease-1", status: "replying" })]));
    const start = pick(
      t.apply(scene(2, [character({ id: "lease-1", status: "leaving" })])),
      "agentToolStart",
    );
    expect(start[0].toolName).toBe("phase:leaving");
  });

  it("resolves a phase caption through the host, like any other activity", () => {
    const t = new PixelAgentsTranslator({ resolveActivity: (raw) => `caption:${raw}` });
    t.apply(scene(1, [character({ id: "lease-1" })]));
    const start = pick(
      t.apply(scene(2, [character({ id: "lease-1", status: "thinking" })])),
      "agentToolStart",
    );
    expect(start[0].status).toBe("caption:phase:thinking");
  });

  // `working` means "running, nothing more specific known". There is no
  // sentence to draw for it, and captioning it would put a permanent label over
  // a character that is simply at its desk.
  it("leaves working uncaptioned", () => {
    const t = new PixelAgentsTranslator();
    t.apply(scene(1, [character({ id: "lease-1", status: "thinking" })]));
    const out = t.apply(scene(2, [character({ id: "lease-1", status: "working" })]));
    // The label is torn down and nothing replaces it. The character stays
    // active throughout, so there is not even a status message to send.
    expect(typesOf(out)).toEqual(["agentToolDone", "agentToolsClear"]);
  });

  it("swaps the caption when one phase follows another", () => {
    const t = new PixelAgentsTranslator();
    t.apply(scene(1, [character({ id: "lease-1", status: "preparing" })]));
    const out = t.apply(scene(2, [character({ id: "lease-1", status: "thinking" })]));
    expect(typesOf(out)).toEqual(["agentToolDone", "agentToolStart"]);
    expect(pick(out, "agentToolStart")[0].toolName).toBe("phase:thinking");
  });

  it("swaps the caption when a tool follows a phase", () => {
    const t = new PixelAgentsTranslator();
    t.apply(scene(1, [character({ id: "lease-1", status: "thinking" })]));
    const out = t.apply(
      scene(2, [character({ id: "lease-1", status: "tooling", activity: "web_search" })]),
    );
    expect(pick(out, "agentToolStart")[0].toolName).toBe("web_search");
  });

  // A phase caption is announced through the same taxonomy as a tool, so the
  // host can give thinking its reading pose without a second channel.
  it("announces a phase the host classifies as reading", () => {
    const t = new PixelAgentsTranslator({ isReadingTool: (raw) => raw === "phase:thinking" });
    t.apply(scene(1, [character({ id: "lease-1" })]));
    const out = t.apply(scene(2, [character({ id: "lease-1", status: "thinking" })]));
    expect(pick(out, "providerCapabilities")[0].readingTools).toEqual(["phase:thinking"]);
    expect(typesOf(out).indexOf("providerCapabilities")).toBeLessThan(
      typesOf(out).indexOf("agentToolStart"),
    );
  });

  it("still shows a waiting character its permission bubble, not a phase", () => {
    const t = new PixelAgentsTranslator();
    t.apply(scene(1, [character({ id: "lease-1", status: "replying" })]));
    const out = t.apply(scene(2, [character({ id: "lease-1", status: "waiting" })]));
    expect(typesOf(out)).toContain("agentToolsClear");
    expect(typesOf(out)).toContain("agentToolPermission");
    expect(typesOf(out)).not.toContain("agentToolStart");
  });
});

describe("PixelAgentsTranslator - reading tool taxonomy", () => {
  const readsAnythingNamedGet = (raw: string) => raw.includes("get");

  it("announces the taxonomy before any character exists", () => {
    const t = new PixelAgentsTranslator({ isReadingTool: readsAnythingNamedGet });
    const types = typesOf(t.apply(scene(1, [])));
    expect(types.indexOf("providerCapabilities")).toBe(0);
  });

  // Sub-agent characters are never emitted by this bridge, so naming a spawn
  // tool would seat a worker the admission controller never authorised.
  it("never names a sub-agent tool", () => {
    const t = new PixelAgentsTranslator({ isReadingTool: readsAnythingNamedGet });
    expect(pick(t.apply(scene(1, [])), "providerCapabilities")[0].subagentToolNames).toEqual([]);
  });

  it("teaches the renderer an unfamiliar read tool before the episode that needs it", () => {
    const t = new PixelAgentsTranslator({ isReadingTool: readsAnythingNamedGet });
    t.apply(scene(1, [character({ id: "lease-1" })]));
    const out = t.apply(
      scene(2, [character({ id: "lease-1", status: "tooling", activity: "ecom_cs_get_order" })]),
    );
    const types = typesOf(out);
    expect(types.indexOf("providerCapabilities")).toBeLessThan(types.indexOf("agentToolStart"));
    expect(pick(out, "providerCapabilities")[0].readingTools).toEqual(["ecom_cs_get_order"]);
  });

  it("does not re-announce a tool it has already taught", () => {
    const t = new PixelAgentsTranslator({ isReadingTool: readsAnythingNamedGet });
    t.apply(scene(1, [character({ id: "lease-1", status: "tooling", activity: "ecom_get_order" })]));
    t.apply(scene(2, [character({ id: "lease-1", status: "working" })]));
    const out = t.apply(
      scene(3, [character({ id: "lease-1", status: "tooling", activity: "ecom_get_order" })]),
    );
    expect(typesOf(out)).not.toContain("providerCapabilities");
  });

  it("leaves a write tool out of the taxonomy entirely", () => {
    const t = new PixelAgentsTranslator({ isReadingTool: readsAnythingNamedGet });
    t.apply(scene(1, [character({ id: "lease-1" })]));
    const out = t.apply(
      scene(2, [character({ id: "lease-1", status: "tooling", activity: "ecom_update_shop" })]),
    );
    expect(typesOf(out)).not.toContain("providerCapabilities");
  });

  // The renderer forgets its taxonomy on reload; this side must not, or every
  // tool learned before the reload would animate wrongly until it ran again.
  it("re-announces everything it has learned after a reset", () => {
    const t = new PixelAgentsTranslator({ isReadingTool: readsAnythingNamedGet });
    t.apply(scene(1, [character({ id: "lease-1", status: "tooling", activity: "ecom_get_order" })]));
    t.reset();
    const out = t.apply(scene(2, [character({ id: "lease-1" })]));
    expect(pick(out, "providerCapabilities")[0].readingTools).toEqual(["ecom_get_order"]);
  });
});
