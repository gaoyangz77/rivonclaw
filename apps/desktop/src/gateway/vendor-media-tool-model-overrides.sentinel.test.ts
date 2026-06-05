import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0015-vendor-openclaw-hide-media-tool-model-overrides.patch",
);

describe("vendor patch 0015: hide media tool model overrides", () => {
  const patch = readFileSync(PATCH_FILE, "utf-8");

  it("removes the image tool per-call model override from the schema and execution path", () => {
    expect(patch).toContain("diff --git a/src/agents/tools/image-tool.ts");
    expect(patch).toContain("-  resolvePromptAndModelOverride,");
    expect(patch).toContain("-      model: Type.Optional(Type.String()),");
    expect(patch).toContain("-      const { prompt: promptRaw, modelOverride }");
    expect(patch).toContain("-        modelOverride,");
  });

  it("removes the video_generate per-call model override from the schema and runtime call", () => {
    expect(patch).toContain("diff --git a/src/agents/tools/video-generate-tool.ts");
    expect(patch).toContain(
      '-    Type.String({ description: "Optional provider/model override, e.g. qwen/wan2.6-t2v." }),',
    );
    expect(patch).toContain('-      const model = readStringParam(args, "model");');
    expect(patch).toContain("-    modelOverride: params.model,");
    expect(patch).toContain("-            ...(model ? { model } : {}),");
  });

  it("keeps vendor coverage for legacy model arguments being ignored", () => {
    expect(patch).toContain('it("does not expose or forward a per-call model override"');
    expect(patch).toContain('model: "openai/gpt-4.1"');
    expect(patch).toContain('expect(runtimeParams).not.toHaveProperty("modelOverride")');
  });
});
