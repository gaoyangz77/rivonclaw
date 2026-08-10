import { act, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { TutorialStep } from "../types.js"

const tutorial = vi.hoisted(() => ({
  isPlaying: true,
  currentStepIndex: 0,
  steps: [] as TutorialStep[],
  next: vi.fn(),
  prev: vi.fn(),
  stop: vi.fn(),
}))

vi.mock("../TutorialProvider.js", () => ({
  useTutorial: () => tutorial,
}))

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { TutorialOverlay } from "./TutorialOverlay.js"

beforeEach(() => {
  tutorial.isPlaying = true
  tutorial.currentStepIndex = 0
  tutorial.next.mockReset()
  tutorial.prev.mockReset()
  tutorial.stop.mockReset()
  HTMLElement.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  document.body.replaceChildren()
})

describe("TutorialOverlay step lifecycle", () => {
  it("prepares once, only repositions on resize, and cleans up when leaving", async () => {
    const firstPrepare = vi.fn()
    const firstCleanup = vi.fn()
    const secondPrepare = vi.fn()
    const secondCleanup = vi.fn()
    tutorial.steps = [
      {
        id: "first",
        target: '[data-tutorial-id="first"]',
        titleKey: "tutorial.first.title",
        bodyKey: "tutorial.first.body",
        prepare: firstPrepare,
        cleanup: firstCleanup,
      },
      {
        id: "second",
        target: '[data-tutorial-id="second"]',
        titleKey: "tutorial.second.title",
        bodyKey: "tutorial.second.body",
        prepare: secondPrepare,
        cleanup: secondCleanup,
      },
    ]

    const firstTarget = document.createElement("div")
    firstTarget.dataset.tutorialId = "first"
    const secondTarget = document.createElement("div")
    secondTarget.dataset.tutorialId = "second"
    document.body.append(firstTarget, secondTarget)

    const view = render(<TutorialOverlay />)
    await waitFor(() => expect(firstPrepare).toHaveBeenCalledTimes(1))

    act(() => window.dispatchEvent(new Event("resize")))
    expect(firstPrepare).toHaveBeenCalledTimes(1)
    expect(firstCleanup).not.toHaveBeenCalled()

    tutorial.currentStepIndex = 1
    view.rerender(<TutorialOverlay />)
    await waitFor(() => expect(secondPrepare).toHaveBeenCalledTimes(1))
    expect(firstCleanup).toHaveBeenCalledTimes(1)

    view.unmount()
    expect(secondCleanup).toHaveBeenCalledTimes(1)
  })

  it("keeps a shared lifecycle active across adjacent grouped steps", async () => {
    const prepare = vi.fn()
    const cleanup = vi.fn()
    tutorial.steps = [
      {
        id: "form-overview",
        lifecycleGroup: "form",
        target: '[data-tutorial-id="first"]',
        titleKey: "tutorial.form.overviewTitle",
        bodyKey: "tutorial.form.overviewBody",
        prepare,
        cleanup,
      },
      {
        id: "form-details",
        lifecycleGroup: "form",
        target: '[data-tutorial-id="second"]',
        titleKey: "tutorial.form.detailsTitle",
        bodyKey: "tutorial.form.detailsBody",
        prepare,
        cleanup,
      },
    ]

    const firstTarget = document.createElement("div")
    firstTarget.dataset.tutorialId = "first"
    const secondTarget = document.createElement("div")
    secondTarget.dataset.tutorialId = "second"
    document.body.append(firstTarget, secondTarget)

    const view = render(<TutorialOverlay />)
    await waitFor(() => expect(prepare).toHaveBeenCalledTimes(1))

    tutorial.currentStepIndex = 1
    view.rerender(<TutorialOverlay />)
    await waitFor(() => expect(secondTarget.scrollIntoView).toHaveBeenCalled)
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(cleanup).not.toHaveBeenCalled()

    tutorial.isPlaying = false
    view.rerender(<TutorialOverlay />)
    await waitFor(() => expect(cleanup).toHaveBeenCalledTimes(1))
  })
})
