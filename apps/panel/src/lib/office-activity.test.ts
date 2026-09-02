import { describe, expect, it } from "vitest";
import { LANGUAGE_OPTIONS, LANGUAGE_RESOURCES } from "../i18n/languages.js";
import {
  ACTIVITY_CAPTION_KINDS,
  GENERIC_ACTIVITY_CAPTION,
  PHASE_ACTIVITY_KINDS,
  TOOL_ACTIVITY_CAPTIONS,
  VERB_ACTIVITY_CAPTIONS,
  activityCaptionId,
  activityCaptionKey,
  isReadingTool,
} from "./office-activity.js";

/** The caption a given locale would actually draw for a tool. */
function caption(locale: string, rawToolName: string | null | undefined): string {
  const path = activityCaptionKey(rawToolName).split(".");
  let node: unknown = LANGUAGE_RESOURCES[locale as keyof typeof LANGUAGE_RESOURCES].translation;
  for (const segment of path) {
    node = (node as Record<string, unknown>)[segment];
  }
  return node as string;
}

describe("activityCaptionId - tier 1, exact match", () => {
  it("resolves a cloud tool by its runtime name, which is the ToolId lowercased", () => {
    expect(activityCaptionId("ecom_cs_get_order")).toBe("readOrder");
  });

  it("resolves the same tool written as its uppercase ToolId", () => {
    expect(activityCaptionId("ECOM_CS_GET_ORDER")).toBe("readOrder");
  });

  it("resolves a vendor system tool, whose id is lowercase at the source", () => {
    expect(activityCaptionId("web_search")).toBe("searchWeb");
  });

  // Several tools are one act to a viewer; that collapse is the whole reason
  // captions are keyed separately from tool ids.
  it("gives session-scoped and shop-scoped variants of a tool the same caption", () => {
    expect(activityCaptionId("ecom_get_order")).toBe(activityCaptionId("ecom_cs_get_order"));
  });
});

describe("activityCaptionId - tier 2, verb rule", () => {
  // One case per branch of the verb table, on names that are deliberately not
  // in the tool map: this is the path a tool shipped after this build takes.
  const branches: Array<[string, string]> = [
    ["ecom_get_warehouse_slot", "lookingUp"],
    ["ecom_list_warehouse_slots", "listing"],
    ["affiliate_search_creator_reels", "searching"],
    ["ecom_predict_restock_date", "analysing"],
    ["ecom_update_warehouse_slot", "updating"],
    ["affiliate_create_brief", "creating"],
    ["cs_send_survey", "sending"],
    ["affiliate_approve_brief", "deciding"],
    ["ecom_delete_draft_listing", "removing"],
    ["ecom_run_repricer", "running"],
  ];

  for (const [rawToolName, expected] of branches) {
    it(`captions "${rawToolName}" as ${expected}`, () => {
      expect(activityCaptionId(rawToolName)).toBe(expected);
    });
  }

  // `ecom_cs_` has to be stripped before `ecom_`, or the verb reads as "cs".
  it("strips the longest namespace prefix, not the first one that matches", () => {
    expect(activityCaptionId("ecom_cs_get_warehouse_slot")).toBe("lookingUp");
  });

  it("reads the verb of an unprefixed tool", () => {
    expect(activityCaptionId("search_invoices")).toBe("searching");
  });
});

describe("activityCaptionId - tier 3, last resort", () => {
  it("falls back when the verb is unknown", () => {
    expect(activityCaptionId("ecom_frobnicate_widget")).toBe(GENERIC_ACTIVITY_CAPTION);
  });

  it("falls back on the projector's sentinel for a tool event with no name", () => {
    expect(activityCaptionId("tool")).toBe(GENERIC_ACTIVITY_CAPTION);
  });

  it("falls back on an empty or blank name", () => {
    expect(activityCaptionId("")).toBe(GENERIC_ACTIVITY_CAPTION);
    expect(activityCaptionId("   ")).toBe(GENERIC_ACTIVITY_CAPTION);
  });

  it("falls back on a missing name", () => {
    expect(activityCaptionId(undefined)).toBe(GENERIC_ACTIVITY_CAPTION);
    expect(activityCaptionId(null)).toBe(GENERIC_ACTIVITY_CAPTION);
  });
});

// The defect this whole module exists to fix: a 35-character snake_case
// identifier drawn over a pixel character's head.
describe("no identifier ever reaches the screen", () => {
  const rawNames = [
    ...Object.keys(TOOL_ACTIVITY_CAPTIONS),
    ...Object.keys(TOOL_ACTIVITY_CAPTIONS).map((name) => name.toLowerCase()),
    "ecom_get_cs_unpaid_order_evaluation",
    "ecom_frobnicate_widget",
    "some_tool_nobody_has_written_yet",
    "tool",
    "",
  ];

  for (const language of LANGUAGE_OPTIONS) {
    it(`never draws the identifier, or any identifier, in ${language.code}`, () => {
      for (const rawToolName of rawNames) {
        const drawn = caption(language.code, rawToolName);
        expect(drawn, `${language.code} caption for "${rawToolName}"`).toBeTruthy();
        expect(drawn).not.toBe(rawToolName);
        // Underscores and the key path are the two shapes an unresolved lookup
        // takes: i18next returns the key itself when nothing matches.
        expect(drawn).not.toMatch(/_/);
        expect(drawn).not.toContain("tools.activity.");
      }
    });
  }
});

describe("caption catalog", () => {
  it("translates every caption in every supported locale", () => {
    for (const language of LANGUAGE_OPTIONS) {
      for (const captionId of Object.keys(ACTIVITY_CAPTION_KINDS)) {
        const values = (
          LANGUAGE_RESOURCES[language.code].translation as {
            tools: { activity: Record<string, string> };
          }
        ).tools.activity;
        expect(values[captionId]?.trim(), `${language.code} ${captionId}`).toBeTruthy();
      }
    }
  });

  it("has no caption that nothing points at", () => {
    const used = new Set<string>([
      ...Object.values(TOOL_ACTIVITY_CAPTIONS),
      ...Object.values(VERB_ACTIVITY_CAPTIONS),
      GENERIC_ACTIVITY_CAPTION,
    ]);
    const orphans = Object.keys(ACTIVITY_CAPTION_KINDS).filter((id) => !used.has(id));
    expect(orphans).toEqual([]);
  });
});

// Most of a run's wall clock is spent in a phase, not in a tool call, and the
// renderer draws only one caption - the tool label. So the phases travel as
// pseudo-tools and are captioned from the office's own vocabulary.
describe("run phase captions", () => {
  const PHASES = Object.keys(PHASE_ACTIVITY_KINDS);

  it("captions every phase the bridge can send", () => {
    for (const phase of PHASES) {
      expect(activityCaptionKey(`phase:${phase}`)).toBe(`office.phase.${phase}`);
    }
  });

  it("translates every phase in every supported locale", () => {
    for (const language of LANGUAGE_OPTIONS) {
      for (const phase of PHASES) {
        const drawn = caption(language.code, `phase:${phase}`);
        expect(drawn?.trim(), `${language.code} ${phase}`).toBeTruthy();
        expect(drawn).not.toContain("phase:");
        expect(drawn).not.toContain("office.phase.");
      }
    }
  });

  // The one phase with nothing on screen to look at; the reading pose is what
  // says something is happening while the model has not come back yet.
  it("reads while thinking and types through the rest", () => {
    expect(isReadingTool("phase:thinking")).toBe(true);
    for (const phase of PHASES.filter((p) => p !== "thinking")) {
      expect(isReadingTool(`phase:${phase}`), phase).toBe(false);
    }
  });

  // The last line of a run. A finished worker used to go straight from "Typing
  // a reply" to an idle label, which read as falling asleep mid-sentence.
  it("gives every way a run can end its own caption", () => {
    const endings = ["success", "failure", "aborted", "reclaimed"];
    for (const tone of endings) {
      expect(PHASES).toContain(`leaving-${tone}`);
      expect(activityCaptionKey(`phase:leaving-${tone}`)).toBe(`office.phase.leaving-${tone}`);
    }
    // Four distinct sentences, not one caption wearing four names.
    const drawn = endings.map((tone) => caption("en", `phase:leaving-${tone}`));
    expect(new Set(drawn).size).toBe(endings.length);
  });

  // A phase added to the bridge before this build knew about it gets the same
  // guarantee an unknown tool gets: a caption, never an identifier.
  it("falls back to the tool tiers for a phase it does not know", () => {
    expect(activityCaptionKey("phase:daydreaming")).toBe(
      `tools.activity.${GENERIC_ACTIVITY_CAPTION}`,
    );
    expect(caption("en", "phase:daydreaming")).not.toContain("phase");
  });

  it("does not mistake a tool whose name merely contains the word", () => {
    expect(activityCaptionKey("ecom_get_phase")).toBe("tools.activity.lookingUp");
  });
});

// One classification, used twice: it picks the unknown-tool caption AND decides
// whether the renderer plays its reading sprites.
describe("isReadingTool", () => {
  it("reads for a lookup tool", () => {
    expect(isReadingTool("ecom_cs_get_order")).toBe(true);
    expect(isReadingTool("read")).toBe(true);
  });

  it("types for a tool that changes something", () => {
    expect(isReadingTool("ecom_approve_refund")).toBe(false);
    expect(isReadingTool("exec")).toBe(false);
  });

  it("classifies a tool this build has never seen, from its verb alone", () => {
    expect(isReadingTool("ecom_get_warehouse_slot")).toBe(true);
    expect(isReadingTool("ecom_update_warehouse_slot")).toBe(false);
  });

  // Typing is the renderer's own default, so an unclassifiable tool must land
  // there: a wrong "read" shows a character reading a book while it deletes.
  it("types when nothing can be told about the tool", () => {
    expect(isReadingTool("ecom_frobnicate_widget")).toBe(false);
    expect(isReadingTool(undefined)).toBe(false);
  });
});
