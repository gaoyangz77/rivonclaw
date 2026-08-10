const TUTORIAL_ATTRIBUTE = "data-tutorial-id"

export function tutorialTarget(id: string): string {
  return `[${TUTORIAL_ATTRIBUTE}="${id}"]`
}

export function findTutorialTarget(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(tutorialTarget(id))
}

export function clickTutorialTarget(id: string): boolean {
  const element = findTutorialTarget(id)
  if (!element) return false
  element.click()
  return true
}

export async function waitForTutorialTarget(
  selector: string,
  timeoutMs = 1200,
): Promise<Element | null> {
  const immediate = document.querySelector(selector)
  if (immediate) return immediate
  if (timeoutMs <= 0) return null

  return await new Promise((resolve) => {
    let settled = false
    const finish = (element: Element | null) => {
      if (settled) return
      settled = true
      observer.disconnect()
      window.clearTimeout(timeout)
      resolve(element)
    }
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector)
      if (element) finish(element)
    })
    const timeout = window.setTimeout(() => finish(document.querySelector(selector)), timeoutMs)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true })
  })
}
