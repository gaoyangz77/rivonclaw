import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react"
import type { ReactNode } from "react"
import { DEFAULTS } from "@rivonclaw/core"
import type { TutorialStep } from "./types.js"
import { getStepsForRoute } from "./steps/index.js"

interface TutorialContextValue {
  enabled: boolean
  setEnabled: (v: boolean) => void
  isPlaying: boolean
  currentStepIndex: number
  steps: TutorialStep[]
  start: () => void
  stop: () => void
  next: () => void
  prev: () => void
}

const TutorialContext = createContext<TutorialContextValue | null>(null)

function readEnabled(): boolean {
  const stored = localStorage.getItem("tutorial.enabled")
  if (stored === null) return DEFAULTS.settings.tutorialEnabled
  return stored === "true"
}

export function TutorialProvider({ currentPath, children }: { currentPath: string; children: ReactNode }) {
  const [enabled, setEnabledState] = useState(readEnabled)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  const steps = useMemo(() => getStepsForRoute(currentPath), [currentPath])

  // Stop tutorial when route changes
  useEffect(() => {
    setIsPlaying(false)
    setCurrentStepIndex(0)
  }, [currentPath])

  // Listen for settings toggle from SettingsPage
  useEffect(() => {
    function onSettingsChanged() {
      setEnabledState(readEnabled())
    }
    window.addEventListener("tutorial-settings-changed", onSettingsChanged)
    return () => window.removeEventListener("tutorial-settings-changed", onSettingsChanged)
  }, [])

  const setEnabled = useCallback((v: boolean) => {
    localStorage.setItem("tutorial.enabled", String(v))
    setEnabledState(v)
    if (!v) {
      setIsPlaying(false)
    }
  }, [])

  const start = useCallback(() => {
    if (steps.length === 0) return
    setCurrentStepIndex(0)
    setIsPlaying(true)
  }, [steps])

  const stop = useCallback(() => {
    setIsPlaying(false)
    setCurrentStepIndex(0)
  }, [])

  const next = useCallback(() => {
    setCurrentStepIndex((prev) => {
      if (prev >= steps.length - 1) {
        setIsPlaying(false)
        return 0
      }
      return prev + 1
    })
  }, [steps.length])

  const prev = useCallback(() => {
    setCurrentStepIndex((prev) => Math.max(0, prev - 1))
  }, [])

  const value = useMemo<TutorialContextValue>(() => ({
    enabled,
    setEnabled,
    isPlaying,
    currentStepIndex,
    steps,
    start,
    stop,
    next,
    prev,
  }), [enabled, setEnabled, isPlaying, currentStepIndex, steps, start, stop, next, prev])

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  )
}

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext)
  if (!ctx) throw new Error("useTutorial must be used within TutorialProvider")
  return ctx
}
