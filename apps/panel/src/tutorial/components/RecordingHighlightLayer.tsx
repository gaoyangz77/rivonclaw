import { useCallback, useEffect, useState } from "react"
import type { CSSProperties } from "react"

interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

interface RecordingHighlightState {
  selector: string
  id?: string
  padding?: number
  style?: "spotlight" | "ring"
  dim?: boolean
}

interface RecordingHighlightApi {
  show: (selector: string, options?: Omit<RecordingHighlightState, "selector">) => boolean
  clear: () => void
  getState: () => RecordingHighlightState | null
}

declare global {
  interface Window {
    __RIVONCLAW_TUTORIAL_HIGHLIGHT__?: RecordingHighlightApi
  }
}

function rectForElement(el: Element, padding: number): SpotlightRect {
  const rect = el.getBoundingClientRect()
  const top = Math.max(0, rect.top - padding)
  const left = Math.max(0, rect.left - padding)
  const width = Math.min(window.innerWidth - left, rect.width + padding * 2)
  const height = Math.min(window.innerHeight - top, rect.height + padding * 2)

  return { top, left, width, height }
}

export function RecordingHighlightLayer() {
  const [highlight, setHighlight] = useState<RecordingHighlightState | null>(null)
  const [rect, setRect] = useState<SpotlightRect | null>(null)

  const updatePosition = useCallback(() => {
    if (!highlight) {
      setRect(null)
      return
    }

    const el = document.querySelector(highlight.selector)
    if (!el) {
      setRect(null)
      return
    }

    el.scrollIntoView({ behavior: "instant", block: "center", inline: "center" })
    requestAnimationFrame(() => {
      setRect(rectForElement(el, highlight.padding ?? 10))
    })
  }, [highlight])

  useEffect(() => {
    const api: RecordingHighlightApi = {
      show(selector, options = {}) {
        const el = document.querySelector(selector)
        if (!el) return false
        setHighlight({ selector, ...options })
        return true
      },
      clear() {
        setHighlight(null)
        setRect(null)
      },
      getState() {
        return highlight
      },
    }

    window.__RIVONCLAW_TUTORIAL_HIGHLIGHT__ = api
    return () => {
      if (window.__RIVONCLAW_TUTORIAL_HIGHLIGHT__ === api) {
        delete window.__RIVONCLAW_TUTORIAL_HIGHLIGHT__
      }
    }
  }, [highlight])

  useEffect(() => {
    updatePosition()
  }, [updatePosition])

  useEffect(() => {
    if (!highlight) return
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)
    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [highlight, updatePosition])

  if (!highlight || !rect) return null

  const style = {
    "--recording-highlight-top": `${rect.top}px`,
    "--recording-highlight-left": `${rect.left}px`,
    "--recording-highlight-width": `${rect.width}px`,
    "--recording-highlight-height": `${rect.height}px`,
  } as CSSProperties

  return (
    <div
      className={`recording-highlight-layer${highlight.dim === false ? "" : " recording-highlight-layer-dim"}`}
      data-highlight-id={highlight.id}
      data-highlight-selector={highlight.selector}
    >
      <div
        className={`recording-highlight-box recording-highlight-${highlight.style ?? "spotlight"}`}
        style={style}
      />
    </div>
  )
}
