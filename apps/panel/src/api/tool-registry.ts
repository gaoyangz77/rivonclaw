/** REST client for the tool capability registry (desktop panel-server endpoints). */

import { fetchJson } from "./client.js";

/** Set a RunProfile for a scope (chat session, cron job) by ID. Pass null to clear. */
export async function setRunProfileForScope(
  scopeKey: string,
  runProfileId: string | null,
): Promise<void> {
  await fetchJson("/tools/run-profile", {
    method: "PUT",
    body: JSON.stringify({ scopeKey, runProfileId }),
  });
}

/** Get the RunProfile ID currently set for a scope. Returns null if none. */
export async function getRunProfileForScope(
  scopeKey: string,
): Promise<string | null> {
  try {
    const params = new URLSearchParams({ scopeKey });
    const data = await fetchJson<{ runProfileId: string | null }>(`/tools/run-profile?${params}`);
    return data.runProfileId;
  } catch {
    return null;
  }
}

// defaultRunProfileId is stored on the User entity (backend GraphQL).
// Desktop reads it from currentUser via MST view — no separate REST endpoint needed.
