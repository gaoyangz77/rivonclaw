/** REST client for the tool capability registry (desktop panel-server endpoints). */

import { fetchJson } from "./client.js";
import { API, clientPath } from "@rivonclaw/core/api-contract";

/** Set a RunProfile for a scope (chat session, cron job) by ID. Pass null to clear. */
export async function setRunProfileForScope(
  scopeKey: string,
  runProfileId: string | null,
): Promise<void> {
  await fetchJson(clientPath(API["tools.runProfile.set"]), {
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
    const data = await fetchJson<{ runProfileId: string | null }>(clientPath(API["tools.runProfile.get"]) + `?${params}`);
    return data.runProfileId;
  } catch {
    return null;
  }
}

// defaultRunProfileId is stored on the User entity (backend GraphQL).
// Desktop reads it from currentUser via MST view — no separate REST endpoint needed.
