/**
 * How many runs each department may execute at once.
 *
 * ONE definition, used in two places that must never disagree:
 *
 *   1. the admission controllers that actually enforce the limit
 *      (`CsAutomaticRunAdmission`, `AffiliateInbound`), and
 *   2. the office layout generator, which draws that many desks.
 *
 * They used to be separate numbers. A department allowed more concurrent runs
 * than it has chairs does not fail loudly - the renderer prefers free seats
 * inside a department's Area and then silently falls through to any free seat
 * anywhere, so the extra workers just appear in the wrong rooms. Deriving both
 * from here makes that impossible to introduce by editing one side.
 *
 * Deliberately dependency-free so the layout generator can import this source
 * file directly without building the package.
 */

/** Concurrent automatic customer-service runs. */
export const DEFAULT_CS_MAX_CONCURRENT = 4;

/** Concurrent affiliate work-item runs. */
export const DEFAULT_AFFILIATE_MAX_CONCURRENT = 6;

/**
 * Desks drawn for shop operations.
 *
 * A DISPLAY cap, unlike the two above: the `main` agent has no Desktop-side
 * admission controller, so nothing enforces this. Runs beyond it render as
 * queued while really executing - the office understates activity rather than
 * inventing capacity, which is the safer of the two available inaccuracies
 * until shop operations gets an admission layer of its own.
 */
export const DEFAULT_SHOP_OPERATIONS_MAX_CONCURRENT = 6;

export const CS_MAX_CONCURRENT_ENV = "RIVONCLAW_CS_AUTO_MAX_CONCURRENT";
export const AFFILIATE_MAX_CONCURRENT_ENV = "RIVONCLAW_MAX_ACTIVE_AFFILIATE_AGENT_RUNS";
export const SHOP_OPERATIONS_MAX_CONCURRENT_ENV = "RIVONCLAW_SHOP_OPERATIONS_DESKS";

function parsePositiveInteger(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** Reads an override, falling back to the shared default. */
export function resolveConcurrency(
  envKey: string,
  fallback: number,
  env: NodeJS.ProcessEnv = process.env,
): number {
  return parsePositiveInteger(env[envKey]) ?? fallback;
}
