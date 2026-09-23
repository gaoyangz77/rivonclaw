import { API, clientPath, type WorkspaceDescriptor } from "@rivonclaw/core/api-contract";
import { fetchJson } from "./client.js";

export async function fetchWorkspace(userId: string | null): Promise<WorkspaceDescriptor | null> {
  const result = await fetchJson<{ workspace: WorkspaceDescriptor | null }>(
    `${clientPath(API["settings.workspace.get"])}?userId=${encodeURIComponent(userId ?? "")}`,
  );
  return result.workspace;
}

export async function saveWorkspace(
  userId: string | null,
  workspace: WorkspaceDescriptor,
): Promise<void> {
  await fetchJson(clientPath(API["settings.workspace.set"]), {
    method: "PUT",
    body: JSON.stringify({ userId, workspace }),
  });
}
