import { afterEach, describe, expect, it } from "vitest"
import {
  clickTutorialTarget,
  findTutorialTarget,
  tutorialTarget,
  waitForTutorialTarget,
} from "./targets.js"

afterEach(() => {
  document.body.replaceChildren()
})

describe("tutorial targets", () => {
  it("builds, finds, and clicks a stable target", async () => {
    const button = document.createElement("button")
    button.dataset.tutorialId = "save-action"
    let clicks = 0
    button.addEventListener("click", () => { clicks += 1 })
    document.body.append(button)

    expect(tutorialTarget("save-action")).toBe('[data-tutorial-id="save-action"]')
    expect(findTutorialTarget("save-action")).toBe(button)
    expect(clickTutorialTarget("save-action")).toBe(true)
    expect(clicks).toBe(1)
    await expect(waitForTutorialTarget(tutorialTarget("save-action"))).resolves.toBe(button)
  })

  it("waits for an asynchronously rendered target", async () => {
    const pending = waitForTutorialTarget(tutorialTarget("late-target"), 100)
    const element = document.createElement("div")
    element.dataset.tutorialId = "late-target"
    document.body.append(element)

    await expect(pending).resolves.toBe(element)
  })

  it("returns null when the target does not render before the timeout", async () => {
    await expect(waitForTutorialTarget(tutorialTarget("missing"), 5)).resolves.toBeNull()
    expect(clickTutorialTarget("missing")).toBe(false)
  })
})
