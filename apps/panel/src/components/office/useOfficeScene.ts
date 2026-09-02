import { useEffect, useRef, useState } from "react";
import type { SceneCue, SceneSnapshot } from "@rivonclaw/scene-contract";
import { panelEventBus } from "../../lib/event-bus.js";

type SceneFrame = { snapshot: SceneSnapshot; cues: SceneCue[] };

function isSceneFrame(payload: unknown): payload is SceneFrame {
  if (typeof payload !== "object" || payload === null) return false;
  const snapshot = (payload as { snapshot?: unknown }).snapshot;
  return typeof snapshot === "object" && snapshot !== null && "revision" in snapshot;
}

/**
 * Latest office scene pushed by Desktop.
 *
 * `enabled` is load-bearing rather than a convenience: the office is a
 * screensaver, so for almost all of a session nothing is watching it and this
 * hook must cost nothing. While disabled it holds no subscription at all.
 *
 * Frames arrive on the shared `/api/events` stream. The bus replays the last
 * `*-snapshot` payload to a late subscriber, so a viewer that activates the
 * office mid-session gets the current scene immediately rather than waiting for
 * the next run to change something.
 */
export function useOfficeScene(enabled: boolean): SceneFrame | null {
  const [frame, setFrame] = useState<SceneFrame | null>(null);
  // Guards against a frame that overtakes a newer one already applied.
  const revisionRef = useRef(-1);

  useEffect(() => {
    if (!enabled) return;
    return panelEventBus.subscribe("scene-snapshot", (payload) => {
      if (!isSceneFrame(payload)) return;
      if (payload.snapshot.revision < revisionRef.current) return;
      revisionRef.current = payload.snapshot.revision;
      setFrame(payload);
    });
  }, [enabled]);

  return frame;
}
