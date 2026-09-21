import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ecommerceAffiliateAttentionSteps,
  ecommerceAffiliateManualWorkbenchSteps,
} from "./ecommerceAffiliateAttention.js";
import { productKnowledgeSteps } from "./productKnowledge.js";
import { ecommerceAffiliateTeamSteps } from "./ecommerceAffiliateTeam.js";
import { TUTORIAL_WORKBENCHES_TRANSLATIONS } from "../../i18n/tutorial-workbenches-translations.js";
import { LANGUAGE_OPTIONS, LANGUAGE_RESOURCES } from "../../i18n/languages.js";

function target(id: string, onClick: () => void = vi.fn()) {
  const node = document.createElement("button");
  node.dataset.tutorialId = id;
  node.addEventListener("click", onClick);
  document.body.append(node);
  return node;
}

afterEach(async () => {
  await productKnowledgeSteps[3].cleanup?.();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("refreshed tutorial lifecycles", () => {
  it.each([
    [
      "Agent",
      ecommerceAffiliateAttentionSteps,
      ["pending-agent", "all-agent", "escalations"],
      "pending-agent",
    ],
    ["Manual", ecommerceAffiliateManualWorkbenchSteps, ["samples", "messages"], "samples"],
  ] as const)(
    "keeps %s steps within their own route and restores its default tab",
    async (_, steps, tabs, defaultTab) => {
      const clicked: string[] = [];
      for (const tab of ["pending-agent", "all-agent", "escalations", "samples", "messages"]) {
        target(`affiliate-workbench-tab-${tab}`, () => clicked.push(tab));
      }
      for (const step of steps) {
        await step.prepare?.();
        await step.cleanup?.();
      }
      expect(new Set(clicked)).toEqual(new Set(tabs));
      expect(clicked.at(-1)).toBe(defaultTab);
    },
  );

  it("starts the team tour on its visible default tab", async () => {
    const select = vi.fn();
    target("affiliate-team-tab-team", select);
    await ecommerceAffiliateTeamSteps[0].prepare?.();
    expect(select).toHaveBeenCalledOnce();
  });

  it("opens an existing knowledge record and closes it without saving", async () => {
    const save = vi.fn();
    target("knowledge-save", save);
    const open = vi.fn(() => target("product-knowledge-editor"));
    target("product-knowledge-item", open);
    const dispatch = vi.spyOn(document, "dispatchEvent");
    const [content, bindings] = productKnowledgeSteps.slice(3);
    expect(content.lifecycleGroup).toBe(bindings.lifecycleGroup);
    // Entering either end of the lifecycle group (Next or Previous) opens it.
    await bindings.prepare?.();
    expect(open).toHaveBeenCalledOnce();
    await bindings.cleanup?.();
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ key: "Escape" }));
    expect(save).not.toHaveBeenCalled();
  });

  it("does not close or replace an editor that was already open", async () => {
    target("product-knowledge-editor");
    const open = vi.fn();
    target("product-knowledge-item", open);
    const dispatch = vi.spyOn(document, "dispatchEvent");
    await productKnowledgeSteps[3].prepare?.();
    await productKnowledgeSteps[3].cleanup?.();
    expect(open).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("does not create data or dispatch a close when the knowledge library is empty", async () => {
    const create = vi.fn();
    target("product-knowledge-create", create);
    const dispatch = vi.spyOn(document, "dispatchEvent");
    await productKnowledgeSteps[3].prepare?.();
    await productKnowledgeSteps[3].cleanup?.();
    expect(create).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
});

function strings(value: object, prefix = ""): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return typeof child === "string" ? [[path, child]] : Object.entries(strings(child, path));
    }),
  );
}

describe("September workbench copy", () => {
  it("merges every refreshed key in all eight languages without English fallback", () => {
    const english = strings(TUTORIAL_WORKBENCHES_TRANSLATIONS.en);
    for (const language of LANGUAGE_OPTIONS) {
      const copy = strings(TUTORIAL_WORKBENCHES_TRANSLATIONS[language.code]);
      expect(Object.keys(copy)).toEqual(Object.keys(english));
      const resolved = strings(LANGUAGE_RESOURCES[language.code].translation);
      for (const [key, value] of Object.entries(copy)) {
        expect(resolved[key], `${language.code} ${key}`).toBe(value);
        if (language.code !== "en") expect(value).not.toBe(english[key]);
      }
    }
  });
});
