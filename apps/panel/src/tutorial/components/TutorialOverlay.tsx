import { useEffect, useState, useCallback, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useTutorial } from "../TutorialProvider.js"
import { waitForTutorialTarget } from "../targets.js"

interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

interface ActiveLifecycle {
  key: string
  label: string
  cleanup?: () => void | Promise<void>
}

function computePlacement(
  targetRect: SpotlightRect,
  placement: "top" | "bottom" | "left" | "right",
  tooltipEl: HTMLDivElement | null,
): { top: number; left: number } {
  const gap = 12
  const tooltipWidth = tooltipEl?.offsetWidth ?? 320
  const tooltipHeight = tooltipEl?.offsetHeight ?? 200
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  let top = 0
  let left = 0

  switch (placement) {
    case "bottom":
      top = targetRect.top + targetRect.height + gap
      left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2
      break
    case "top":
      top = targetRect.top - tooltipHeight - gap
      left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2
      break
    case "right":
      top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2
      left = targetRect.left + targetRect.width + gap
      break
    case "left":
      top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2
      left = targetRect.left - tooltipWidth - gap
      break
  }

  // Clamp to viewport
  if (left < 8) left = 8
  if (left + tooltipWidth > viewportWidth - 8) left = viewportWidth - tooltipWidth - 8
  if (top < 8) top = 8
  if (top + tooltipHeight > viewportHeight - 8) top = viewportHeight - tooltipHeight - 8

  return { top, left }
}

export function TutorialOverlay() {
  const { t } = useTranslation()
  const { isPlaying, steps, currentStepIndex, next, prev, stop } = useTutorial()
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const spotlightRef = useRef<HTMLDivElement>(null)
  const activeTargetRef = useRef<Element | null>(null)
  const activeLifecycleRef = useRef<ActiveLifecycle | null>(null)
  const mouseDownOnOverlay = useRef(false)
  const directionRef = useRef<"forward" | "backward">("forward")

  const cleanupActiveLifecycle = useCallback(async () => {
    const lifecycle = activeLifecycleRef.current
    activeLifecycleRef.current = null
    if (!lifecycle?.cleanup) return
    try {
      await lifecycle.cleanup()
    } catch (error) {
      console.warn(`[tutorial] cleanup failed for ${lifecycle.label}`, error)
    }
  }, [])

  const positionTarget = useCallback((el: Element, placement: "top" | "bottom" | "left" | "right") => {
    // Scroll target into view instantly — CSS transitions on spotlight handle visual smoothness
    el.scrollIntoView({ behavior: "instant", block: "center" })

    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect()
      const padding = 6

      // Clamp spotlight to viewport for very tall elements
      const clampedRect: SpotlightRect = {
        top: Math.max(0, rect.top - padding),
        left: Math.max(0, rect.left - padding),
        width: rect.width + padding * 2,
        height: 0,
      }
      clampedRect.height = Math.min(
        rect.height + padding * 2,
        window.innerHeight - Math.max(0, clampedRect.top)
      )

      setSpotlightRect(clampedRect)

      // Position spotlight via CSS custom properties
      if (spotlightRef.current) {
        spotlightRef.current.style.setProperty("--spotlight-top", `${clampedRect.top}px`)
        spotlightRef.current.style.setProperty("--spotlight-left", `${clampedRect.left}px`)
        spotlightRef.current.style.setProperty("--spotlight-width", `${clampedRect.width}px`)
        spotlightRef.current.style.setProperty("--spotlight-height", `${clampedRect.height}px`)
      }

      // Position tooltip via CSS custom properties
      const pos = computePlacement(clampedRect, placement, tooltipRef.current)
      if (tooltipRef.current) {
        tooltipRef.current.style.setProperty("--tooltip-top", `${pos.top}px`)
        tooltipRef.current.style.setProperty("--tooltip-left", `${pos.left}px`)
      }
    })
  }, [])

  const updatePosition = useCallback(() => {
    if (!isPlaying || steps.length === 0) return
    const step = steps[currentStepIndex]
    if (!step) return
    const current = activeTargetRef.current
    const el = current && document.contains(current) ? current : document.querySelector(step.target)
    if (!el) return
    activeTargetRef.current = el
    positionTarget(el, step.placement ?? "bottom")
  }, [isPlaying, steps, currentStepIndex, positionTarget])

  useEffect(() => {
    let cancelled = false
    activeTargetRef.current = null
    setSpotlightRect(null)

    if (!isPlaying || steps.length === 0) {
      void cleanupActiveLifecycle()
      return
    }
    const step = steps[currentStepIndex]
    if (!step) return

    async function activateStep() {
      const label = step.id ?? step.titleKey
      const lifecycleKey = step.lifecycleGroup ?? label
      if (activeLifecycleRef.current?.key !== lifecycleKey) {
        await cleanupActiveLifecycle()
        if (cancelled) return

        try {
          await step.prepare?.()
        } catch (error) {
          console.warn(`[tutorial] prepare failed for ${label}`, error)
        }
        if (cancelled) {
          if (step.cleanup) {
            try {
              await step.cleanup()
            } catch (error) {
              console.warn(`[tutorial] cleanup failed for ${label}`, error)
            }
          }
          return
        }
        activeLifecycleRef.current = { key: lifecycleKey, label, cleanup: step.cleanup }
      }

      const el = await waitForTutorialTarget(step.target, step.targetTimeoutMs)
      if (cancelled) return
      if (!el) {
        console.warn(`[tutorial] target not found for ${step.id ?? step.titleKey}: ${step.target}`)
        if (directionRef.current === "backward" && currentStepIndex > 0) {
          prev()
        } else if (currentStepIndex < steps.length - 1) {
          next()
        } else {
          stop()
        }
        return
      }

      activeTargetRef.current = el
      positionTarget(el, step.placement ?? "bottom")
    }

    void activateStep()
    return () => {
      cancelled = true
      activeTargetRef.current = null
    }
  }, [isPlaying, steps, currentStepIndex, next, prev, stop, positionTarget, cleanupActiveLifecycle])

  useEffect(() => () => {
    void cleanupActiveLifecycle()
  }, [cleanupActiveLifecycle])

  // Reposition on window resize
  useEffect(() => {
    if (!isPlaying) return
    window.addEventListener("resize", updatePosition)
    return () => window.removeEventListener("resize", updatePosition)
  }, [isPlaying, updatePosition])

  if (!isPlaying || steps.length === 0) return null

  const step = steps[currentStepIndex]
  if (!step) return null

  const isLast = currentStepIndex === steps.length - 1
  const isFirst = currentStepIndex === 0

  return (
    <div
      className="tutorial-overlay"
      onMouseDown={(e) => { mouseDownOnOverlay.current = e.target === e.currentTarget; }}
      onClick={(e) => {
        if (e.target === e.currentTarget && mouseDownOnOverlay.current) stop();
        mouseDownOnOverlay.current = false;
      }}
    >
      {/* Spotlight cutout */}
      {spotlightRect && (
        <div
          ref={spotlightRef}
          className="tutorial-spotlight"
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="tutorial-tooltip"
      >
        <button className="tutorial-tooltip-close" onClick={stop} title={t("tutorial.nav.close")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <div className="tutorial-tooltip-title">{t(step.titleKey)}</div>
        <div className="tutorial-tooltip-body">{t(step.bodyKey)}</div>
        <div className="tutorial-tooltip-footer">
          <span className="tutorial-tooltip-counter">
            {t("tutorial.nav.stepOf", { current: currentStepIndex + 1, total: steps.length })}
          </span>
          <div className="tutorial-tooltip-nav">
            {!isFirst && (
              <button className="btn btn-secondary btn-sm" onClick={() => { directionRef.current = "backward"; prev(); }}>
                {t("tutorial.nav.prev")}
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={() => { directionRef.current = "forward"; next(); }}>
              {isLast ? t("tutorial.nav.done") : t("tutorial.nav.next")}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
