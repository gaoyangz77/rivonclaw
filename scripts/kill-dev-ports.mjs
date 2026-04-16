#!/usr/bin/env node
// Cross-platform port killer for dev lifecycle.
// Kills any process listening on the given ports so `pnpm dev` can
// re-bind cleanly. Silent if nothing is listening. Never throws.

import { execSync } from "node:child_process";

const PORTS = [5180, 3210];
const isWindows = process.platform === "win32";

function killPort(port) {
  try {
    if (isWindows) {
      // netstat prints one line per connection; grab PIDs of LISTENING sockets only.
      const output = execSync(`netstat -ano -p TCP`, { encoding: "utf8" });
      const pids = new Set();
      for (const line of output.split(/\r?\n/)) {
        if (!line.includes("LISTENING")) continue;
        if (!line.includes(`:${port} `)) continue;
        const match = line.match(/(\d+)\s*$/);
        if (match) pids.add(match[1]);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
        } catch {
          // Process already gone or not killable — fine.
        }
      }
    } else {
      // Unix: lsof -ti returns PIDs, pipe through kill.
      execSync(`lsof -ti :${port} | xargs kill -9`, {
        stdio: "ignore",
        shell: "/bin/sh",
      });
    }
  } catch {
    // No listener on the port — expected path.
  }
}

for (const port of PORTS) {
  killPort(port);
}
