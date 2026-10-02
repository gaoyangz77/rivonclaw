const TUTORIAL_ATTRIBUTE = "data-tutorial-id";

export function tutorialTarget(id: string): string {
  return `[${TUTORIAL_ATTRIBUTE}="${id}"]`;
}

export function findTutorialTarget(id: string): HTMLElement | null {
  return findVisibleTutorialTarget(tutorialTarget(id));
}

/** Visited workspace pages and inactive inner tabs stay mounted. */
export function findVisibleTutorialTarget(selector: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>(selector)).find((element) => {
      if (element.closest("[hidden], [inert]")) return false;
      for (
        let ancestor: HTMLElement | null = element;
        ancestor;
        ancestor = ancestor.parentElement
      ) {
        const style = window.getComputedStyle(ancestor);
        if (style.display === "none" || style.visibility === "hidden") return false;
      }
      return true;
    }) ?? null
  );
}

export function clickTutorialTarget(id: string): boolean {
  const element = findTutorialTarget(id);
  if (!element) return false;
  element.click();
  return true;
}

export async function waitForTutorialTarget(
  selector: string,
  timeoutMs = 1200,
): Promise<Element | null> {
  const immediate = findVisibleTutorialTarget(selector);
  if (immediate) return immediate;
  if (timeoutMs <= 0) return null;

  return await new Promise((resolve) => {
    let settled = false;
    const finish = (element: Element | null) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearTimeout(timeout);
      resolve(element);
    };
    const observer = new MutationObserver(() => {
      const element = findVisibleTutorialTarget(selector);
      if (element) finish(element);
    });
    const timeout = window.setTimeout(() => finish(findVisibleTutorialTarget(selector)), timeoutMs);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  });
}
