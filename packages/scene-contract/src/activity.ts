/**
 * Marks an activity string as a run phase rather than a real tool call.
 *
 * A character's `activity` is normally the raw identifier of the tool it is
 * running. Renderer bridges that can draw only one caption per character - the
 * pixel office draws the tool label and nothing else - carry the phases worth
 * reading (`arriving`, `preparing`, `thinking`, `replying`) through that same
 * caption channel as pseudo-tools named `phase:<status>`, and the UI that owns
 * translation captions them from its phase vocabulary instead of its tool
 * table. A colon cannot appear in a real tool identifier, which is what keeps
 * the two apart.
 *
 * Lives in the contract, not in a bridge: the convention is between whoever
 * writes the pseudo-tool and whoever captions it, and both must survive the
 * bridge being replaced.
 */
export const PHASE_ACTIVITY_PREFIX = "phase:";

/** `phase:thinking` → `thinking`; a real tool identifier → null. */
export function phaseOfActivity(activity: string | null | undefined): string | null {
  if (typeof activity !== "string") return null;
  const trimmed = activity.trim();
  if (!trimmed.startsWith(PHASE_ACTIVITY_PREFIX)) return null;
  const phase = trimmed.slice(PHASE_ACTIVITY_PREFIX.length);
  return phase.length > 0 ? phase : null;
}
