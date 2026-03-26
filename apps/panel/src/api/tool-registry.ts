/** REST client for the tool capability registry (desktop panel-server endpoints). */

import { ScopeType } from "@rivonclaw/core";

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

const BASE = "/api/tools";

/** Fetch all available tools from CapabilityResolver (system + extension + entitled). */
export async function fetchAvailableTools(): Promise<AvailableTool[]> {
  const res = await fetch(`${BASE}/available`);
  if (!res.ok) return [];
  const data = (await res.json()) as { tools: AvailableTool[] };
  return data.tools;
}

/** Set a RunProfile for a scope (chat session, cron job). Pass null to clear. */
export async function setRunProfileForScope(
  scopeType: ScopeType,
  scopeKey: string,
  runProfile: RunProfilePayload | null,
): Promise<void> {
  const res = await fetch(`${BASE}/run-profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scopeType, scopeKey, runProfile }),
  });
  if (!res.ok) throw new Error(`setRunProfileForScope failed: ${res.status}`);
}

/** Get the RunProfile currently set for a scope. Returns null if none. */
export async function getRunProfileForScope(
  scopeType: ScopeType,
  scopeKey: string,
): Promise<RunProfilePayload | null> {
  const params = new URLSearchParams({ scopeType, scopeKey });
  const res = await fetch(`${BASE}/run-profile?${params}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { runProfile: RunProfilePayload | null };
  return data.runProfile;
}

/** Set/clear the user's default RunProfile (trusted scope fallback). */
export async function setDefaultRunProfile(
  runProfile: RunProfilePayload | null,
): Promise<void> {
  const res = await fetch(`${BASE}/default-run-profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ runProfile }),
  });
  if (!res.ok) throw new Error(`setDefaultRunProfile failed: ${res.status}`);
}
