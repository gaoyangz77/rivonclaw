import { useState, useRef, useCallback, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useTutorial } from "../TutorialProvider.js"

export function TutorialBubble() {
  const { t } = useTranslation()
  const { enabled, isPlaying, steps, start } = useTutorial()
  const [position, setPosition] = useState({ right: 24, bottom: 24 })
  const dragState = useRef<{ startX: number; startY: number; startRight: number; startBottom: number; dragged: boolean } | null>(null)
  const bubbleRef = useRef<HTMLButtonElement>(null)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startRight: position.right,
      startBottom: position.bottom,
      dragged: false,
    }
    bubbleRef.current?.setPointerCapture(e.pointerId)
  }, [position])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current) return
    const dx = dragState.current.startX - e.clientX
    const dy = dragState.current.startY - e.clientY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragState.current.dragged = true
    }
    const newRight = Math.max(8, Math.min(window.innerWidth - 56, dragState.current.startRight + dx))
    const newBottom = Math.max(8, Math.min(window.innerHeight - 56, dragState.current.startBottom + dy))
    setPosition({ right: newRight, bottom: newBottom })
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const wasDrag = dragState.current?.dragged ?? false
    dragState.current = null
    bubbleRef.current?.releasePointerCapture(e.pointerId)
    // Only trigger start if it was a click, not a drag
    if (!wasDrag) {
      start()
    }
  }, [start])

  // Update CSS custom properties when position changes
  useEffect(() => {
    if (bubbleRef.current) {
      bubbleRef.current.style.setProperty("--bubble-right", `${position.right}px`)
      bubbleRef.current.style.setProperty("--bubble-bottom", `${position.bottom}px`)
    }
  }, [position])

  if (!enabled || steps.length === 0 || isPlaying) return null

  return (
    <button
      ref={bubbleRef}
      className="tutorial-bubble tutorial-bubble-pulse"
      title={t("tutorial.bubble.tooltip")}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2v-5" />
      </svg>
    </button>
  )
}
