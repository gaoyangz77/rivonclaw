import { describe, expect, it } from "vitest";
import { parseUnixProcessTree, parseWindowsProcessTree } from "./gateway-process-tree.js";

describe("gateway process tree diagnostics", () => {
  it("parses Unix ps snapshots", () => {
    const rows = parseUnixProcessTree(
      "  100   1  95.5  4.2 1536000 4096000 R 01:02:03 node openclaw gateway\n" +
        "  101 100   2.5  0.3  100000  500000 S    00:10 node worker.js\n",
    );

    expect(rows).toEqual([
      expect.objectContaining({
        pid: 100,
        ppid: 1,
        cpuPercent: 95.5,
        rssBytes: 1_572_864_000,
        command: "node openclaw gateway",
      }),
      expect.objectContaining({ pid: 101, ppid: 100, cpuPercent: 2.5 }),
    ]);
  });

  it("parses Windows CIM snapshots", () => {
    const rows = parseWindowsProcessTree(
      JSON.stringify([
        {
          ProcessId: 100,
          ParentProcessId: 1,
          WorkingSetSize: 1_500_000,
          VirtualSize: 4_000_000,
          ThreadCount: 12,
          CommandLine: "node openclaw gateway",
        },
      ]),
    );

    expect(rows).toEqual([
      expect.objectContaining({
        pid: 100,
        ppid: 1,
        rssBytes: 1_500_000,
        threadCount: 12,
      }),
    ]);
  });
});
