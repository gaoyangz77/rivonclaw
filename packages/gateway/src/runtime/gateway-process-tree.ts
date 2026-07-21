import { execFile } from "node:child_process";
import type { GatewayProcessTreeSnapshot } from "./gateway-performance-capture.js";

type ProcessTreeRow = GatewayProcessTreeSnapshot["rows"][number];

function selectProcessFamily(
  rows: ProcessTreeRow[],
  rootPid: number | undefined,
  targetPid: number | undefined,
): ProcessTreeRow[] {
  const selected = new Set<number>();
  if (rootPid) selected.add(rootPid);
  if (targetPid) selected.add(targetPid);

  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) {
      if (selected.has(row.ppid) && !selected.has(row.pid)) {
        selected.add(row.pid);
        changed = true;
      }
    }
  }

  return rows.filter((row) => selected.has(row.pid));
}

export function parseUnixProcessTree(output: string): ProcessTreeRow[] {
  const rows: ProcessTreeRow[] = [];
  for (const line of output.split("\n")) {
    const match = line.match(
      /^\s*(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(.*)$/,
    );
    if (!match) continue;
    rows.push({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      cpuPercent: Number(match[3]),
      memoryPercent: Number(match[4]),
      rssBytes: Number(match[5]) * 1_024,
      virtualBytes: Number(match[6]) * 1_024,
      state: match[7],
      elapsed: match[8],
      command: match[9].slice(0, 500),
    });
  }
  return rows;
}

export function parseWindowsProcessTree(output: string): ProcessTreeRow[] {
  try {
    const parsed = JSON.parse(output) as Record<string, unknown> | Array<Record<string, unknown>>;
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return entries.flatMap((entry) => {
      const pid = Number(entry.ProcessId);
      const ppid = Number(entry.ParentProcessId);
      if (!Number.isFinite(pid) || !Number.isFinite(ppid)) return [];
      return [
        {
          pid,
          ppid,
          rssBytes: Number(entry.WorkingSetSize) || undefined,
          virtualBytes: Number(entry.VirtualSize) || undefined,
          threadCount: Number(entry.ThreadCount) || undefined,
          command:
            typeof entry.CommandLine === "string" ? entry.CommandLine.slice(0, 500) : undefined,
        },
      ];
    });
  } catch {
    return [];
  }
}

export function captureGatewayProcessTree(params: {
  rootPid?: number;
  targetPid?: number;
  callback: (snapshot: GatewayProcessTreeSnapshot) => void;
}): void {
  const { rootPid, targetPid, callback } = params;
  const complete = (rows: ProcessTreeRow[], error?: string) => {
    callback({
      ts: Date.now(),
      platform: process.platform,
      rootPid,
      targetPid,
      rows: selectProcessFamily(rows, rootPid, targetPid),
      ...(error ? { error } : {}),
    });
  };

  if (process.platform === "win32") {
    const script = [
      "Get-CimInstance Win32_Process",
      "Select-Object ProcessId,ParentProcessId,WorkingSetSize,VirtualSize,ThreadCount,CommandLine",
      "ConvertTo-Json -Compress",
    ].join(" | ");
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { timeout: 5_000, maxBuffer: 2 * 1024 * 1024, windowsHide: true },
      (error, stdout) => {
        complete(parseWindowsProcessTree(stdout), error?.message);
      },
    );
    return;
  }

  execFile(
    "ps",
    ["-axo", "pid=,ppid=,pcpu=,pmem=,rss=,vsz=,state=,etime=,command="],
    { timeout: 5_000, maxBuffer: 2 * 1024 * 1024 },
    (error, stdout) => {
      complete(parseUnixProcessTree(stdout), error?.message);
    },
  );
}
