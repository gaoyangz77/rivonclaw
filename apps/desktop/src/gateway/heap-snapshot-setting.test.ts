import { describe, expect, it } from "vitest";
import {
  GATEWAY_HEAP_SNAPSHOT_NODE_FLAG,
  GATEWAY_HEAP_SNAPSHOT_SETTING_KEY,
  isGatewayHeapSnapshotEnabled,
} from "./heap-snapshot-setting.js";

describe("gateway heap snapshot setting", () => {
  it("stays off unless the setting is exactly \"true\"", () => {
    const cases = [undefined, "", "false", "0", "1", "yes", "TRUE", " true"];
    for (const value of cases) {
      expect(isGatewayHeapSnapshotEnabled(() => value)).toBe(false);
    }
  });

  it("turns on for \"true\", and reads the documented key", () => {
    let askedFor: string | undefined;
    const enabled = isGatewayHeapSnapshotEnabled((key) => {
      askedFor = key;
      return "true";
    });

    expect(enabled).toBe(true);
    expect(askedFor).toBe(GATEWAY_HEAP_SNAPSHOT_SETTING_KEY);
  });

  // The flag budget is per process. The Gateway restarts after every OOM, so a
  // higher budget would not stop files accumulating -- it would only make a
  // single crash write several. One per process is the whole intent.
  it("requests exactly one snapshot per process", () => {
    expect(GATEWAY_HEAP_SNAPSHOT_NODE_FLAG).toBe("--heapsnapshot-near-heap-limit=1");
  });
});
