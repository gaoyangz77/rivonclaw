/** REST client for the tool capability registry (desktop panel-server endpoints). */

import { ScopeType } from "@rivonclaw/core";
import { fetchJson } from "./client.js";

export { ScopeType };

export interface AvailableTool {
  id: string;
  displayName: string;
  description: string;
  category: string;
  allowed: boolean;
  source?: "system" | "extension" | "entitled";
}

type RunProfilePayload = { id: string; name: string; selectedToolIds: string[]; surfaceId: string };

/** Fetch all available tools from CapabilityResolver (system + extension + entitled). */
export async function fetchAvailableTools(): Promise<AvailableTool[]> {
  try {
    const data = await fetchJson<{ tools: AvailableTool[] }>("/tools/available");
    return data.tools;
  } catch {
    return [];
  }
}

/** Set a RunProfile for a scope (chat session, cron job). Pass null to clear. */
export async function setRunProfileForScope(
  scopeType: ScopeType,
  scopeKey: string,
  runProfile: RunProfilePayload | null,
): Promise<void> {
  await fetchJson("/tools/run-profile", {
    method: "PUT",
    body: JSON.stringify({ scopeType, scopeKey, runProfile }),
  });
}

/** Get the RunProfile currently set for a scope. Returns null if none. */
export async function getRunProfileForScope(
  scopeType: ScopeType,
  scopeKey: string,
): Promise<RunProfilePayload | null> {
  try {
    const params = new URLSearchParams({ scopeType, scopeKey });
    const data = await fetchJson<{ runProfile: RunProfilePayload | null }>(`/tools/run-profile?${params}`);
    return data.runProfile;
  } catch {
    return null;
  }
}

/** Set/clear the user's default RunProfile (trusted scope fallback). */
export async function setDefaultRunProfile(
  runProfile: RunProfilePayload | null,
): Promise<void> {
  await fetchJson("/tools/default-run-profile", {
    method: "PUT",
    body: JSON.stringify({ runProfile }),
  });
}
