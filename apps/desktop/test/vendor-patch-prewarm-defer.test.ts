import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("vendor patch: prewarm defer", () => {
  const sourcePath = resolve(
    __dirname,
    "../../../vendor/openclaw/src/gateway/server-startup-post-attach.ts",
  );

  const source = readFileSync(sourcePath, "utf-8");

  it("publishes lightweight static model snapshots before chat metadata", () => {
    expect(source).toContain("async function prewarmConfiguredPrimaryModel(params:");
    expect(source).toMatch(
      /async function prewarmConfiguredPrimaryModel[\s\S]*?await publishConfiguredModelRuntimeSnapshots\(params\);\n}/,
    );

    const modelRuntimeIndex = source.indexOf('"sidecars.model-runtime"');
    const chatMetadataIndex = source.indexOf('"sidecars.chat-metadata"');
    const channelStartIndex = source.indexOf('"sidecars.channel-start"');
    expect(modelRuntimeIndex).toBeGreaterThan(-1);
    expect(chatMetadataIndex).toBeGreaterThan(modelRuntimeIndex);
    expect(channelStartIndex).toBeGreaterThan(chatMetadataIndex);
  });
});
