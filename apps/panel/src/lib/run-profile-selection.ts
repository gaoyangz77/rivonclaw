import { GQL } from "@rivonclaw/core";

/** The identity fields of a run profile row from `RootStore.allRunProfiles`. */
export interface RunProfileIdentity {
  id: string;
  /** Empty for system profiles (derived from tool metadata); set for user-created ones. */
  userId: string;
}

/**
 * System run profiles staff may pick for their own sessions.
 *
 * The other system profiles (customer service, affiliate operator) drive the
 * external-facing agents; a staff member who picks one for their own chat or
 * channel sessions gets a tool set that looks broken. This is an allowlist so a
 * future system profile stays hidden until someone decides it belongs here.
 */
const STAFF_SELECTABLE_SYSTEM_RUN_PROFILES: ReadonlySet<string> = new Set([
  GQL.SystemRunProfile.ShopOperations,
]);

/**
 * Whether staff may pick this run profile in the Panel's run-profile pickers
 * (the account default, the Chat Page and scheduled tasks). User-created profiles are
 * always selectable. This only limits UI choice; Desktop and backend resolve
 * whatever profile id is stored.
 */
export function isStaffSelectableRunProfile(profile: RunProfileIdentity): boolean {
  return Boolean(profile.userId) || STAFF_SELECTABLE_SYSTEM_RUN_PROFILES.has(profile.id);
}

export interface RunProfileChoice<T extends RunProfileIdentity> {
  profile: T;
  /**
   * False only for the current value when it is no longer selectable: it is
   * kept in the list so the picker still shows what is in effect, but once
   * the user switches away it disappears.
   */
  selectable: boolean;
}

/**
 * The run profiles a staff-facing picker offers, in their original order:
 * every selectable profile, plus the current value if it is a restricted one.
 */
export function staffRunProfileChoices<T extends RunProfileIdentity>(
  profiles: readonly T[],
  currentId: string | null | undefined,
): RunProfileChoice<T>[] {
  const choices: RunProfileChoice<T>[] = [];
  for (const profile of profiles) {
    if (isStaffSelectableRunProfile(profile)) {
      choices.push({ profile, selectable: true });
    } else if (currentId && profile.id === currentId) {
      choices.push({ profile, selectable: false });
    }
  }
  return choices;
}
