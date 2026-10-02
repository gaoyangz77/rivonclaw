import { afterEach, describe, expect, it } from "vitest";
import {
  clickTutorialTarget,
  findTutorialTarget,
  tutorialTarget,
  waitForTutorialTarget,
} from "./targets.js";

afterEach(() => {
  document.body.replaceChildren();
});

describe("tutorial targets", () => {
  it.each(["hidden", "inert", "display", "visibility"])(
    "does not find or click a duplicate target in a %s workspace",
    (mode) => {
      const inactive = document.createElement("section");
      if (mode === "hidden" || mode === "inert") inactive.setAttribute(mode, "");
      if (mode === "display") inactive.style.display = "none";
      if (mode === "visibility") inactive.style.visibility = "hidden";
      const stale = document.createElement("button");
      stale.dataset.tutorialId = "shared-action";
      let staleClicks = 0;
      stale.onclick = () => {
        staleClicks += 1;
      };
      inactive.append(stale);
      const active = stale.cloneNode() as HTMLButtonElement;
      let activeClicks = 0;
      active.onclick = () => {
        activeClicks += 1;
      };
      document.body.append(inactive, active);
      expect(findTutorialTarget("shared-action")).toBe(active);
      expect(clickTutorialTarget("shared-action")).toBe(true);
      expect(staleClicks).toBe(0);
      expect(activeClicks).toBe(1);
    },
  );

  it("waits for a retained inner tab to become visible", async () => {
    const tab = document.createElement("section");
    tab.hidden = true;
    const node = document.createElement("div");
    node.dataset.tutorialId = "retained";
    tab.append(node);
    document.body.append(tab);
    expect(findTutorialTarget("retained")).toBeNull();
    const pending = waitForTutorialTarget(tutorialTarget("retained"), 100);
    tab.hidden = false;
    await expect(pending).resolves.toBe(node);
  });

  it("builds, finds, and clicks a stable target", async () => {
    const button = document.createElement("button");
    button.dataset.tutorialId = "save-action";
    let clicks = 0;
    button.addEventListener("click", () => {
      clicks += 1;
    });
    document.body.append(button);

    expect(tutorialTarget("save-action")).toBe('[data-tutorial-id="save-action"]');
    expect(findTutorialTarget("save-action")).toBe(button);
    expect(clickTutorialTarget("save-action")).toBe(true);
    expect(clicks).toBe(1);
    await expect(waitForTutorialTarget(tutorialTarget("save-action"))).resolves.toBe(button);
  });

  it("waits for an asynchronously rendered target", async () => {
    const pending = waitForTutorialTarget(tutorialTarget("late-target"), 100);
    const element = document.createElement("div");
    element.dataset.tutorialId = "late-target";
    document.body.append(element);

    await expect(pending).resolves.toBe(element);
  });

  it("returns null when the target does not render before the timeout", async () => {
    await expect(waitForTutorialTarget(tutorialTarget("missing"), 5)).resolves.toBeNull();
    expect(clickTutorialTarget("missing")).toBe(false);
  });
});
