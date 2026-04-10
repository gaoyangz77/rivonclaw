export type DepName = "git" | "python" | "node" | "uv";

export interface DepStatus {
  name: DepName;
  available: boolean;
  version?: string; // e.g. "2.43.0"
  path?: string; // e.g. "/usr/bin/git"
}

export interface ProvisionProgress {
  phase: "detecting" | "installing" | "configuring" | "done" | "error";
  dep?: DepName;
  message: string;
  percent?: number; // 0-100
}

export interface ProvisionResult {
  installed: DepName[];
  skipped: DepName[];
  failed: Array<{ dep: DepName; error: string }>;
}
