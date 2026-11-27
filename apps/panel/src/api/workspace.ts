import type { WorkspaceDescriptor } from "@rivonclaw/core/api-contract";
import { getHost } from "../host/index.js";

export function fetchWorkspace(userId: string | null): Promise<WorkspaceDescriptor | null> {
  return getHost().settings.getWorkspace(userId);
}

export function saveWorkspace(
  userId: string | null,
  workspace: WorkspaceDescriptor,
): Promise<void> {
  return getHost().settings.saveWorkspace(userId, workspace);
}
