import { afterAll, beforeAll } from "vitest";

/**
 * Runs the surrounding `describe` under a fixed device timezone. Node re-reads
 * `process.env.TZ` on assignment, so every `Date` local-time reading inside the
 * block follows `zone` instead of the machine's own timezone.
 */
export function useTimeZone(zone: string): void {
  let previous: string | undefined;
  beforeAll(() => {
    previous = process.env.TZ;
    process.env.TZ = zone;
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  });
}
