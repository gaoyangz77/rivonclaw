import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import AdmZip from "adm-zip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
}));

vi.mock("../infra/proxy/proxy-aware-network.js", () => ({
  proxyNetwork: {
    fetch: mocks.fetch,
  },
}));

function skillZip(localSlug: string, version: string, body = "content"): Buffer {
  const zip = new AdmZip();
  zip.addFile(
    `${localSlug}/SKILL.md`,
    Buffer.from(`---\nname: ${localSlug}\nversion: ${version}\n---\n\n${body}\n`, "utf-8"),
  );
  return zip.toBuffer();
}

function manifest(version: string) {
  return {
    schemaVersion: 1,
    skills: [
      {
        slug: "official-foo",
        localSlug: "preset-foo",
        version,
        downloadUrl: "https://www.rivonclaw.com/skills/official-foo.zip",
      },
    ],
  };
}

describe("syncOfficialPresetSkills", () => {
  let stateDir: string;
  let previousStateDir: string | undefined;
  let currentVersion = "1.0.0";

  beforeEach(async () => {
    vi.clearAllMocks();
    previousStateDir = process.env.OPENCLAW_STATE_DIR;
    stateDir = await mkdtemp(join(tmpdir(), "rivonclaw-preset-skills-"));
    process.env.OPENCLAW_STATE_DIR = stateDir;
    currentVersion = "1.0.0";
    mocks.fetch.mockImplementation(async (url: string | URL) => {
      const href = url.toString();
      if (href.endsWith("/skills/manifest.json")) {
        return new Response(JSON.stringify(manifest(currentVersion)), { status: 200 });
      }
      if (href.endsWith("/skills/official-foo.zip")) {
        return new Response(new Uint8Array(skillZip("preset-foo", currentVersion, `content ${currentVersion}`)), {
          status: 200,
        });
      }
      return new Response("not found", { status: 404 });
    });
  });

  afterEach(async () => {
    if (previousStateDir === undefined) {
      delete process.env.OPENCLAW_STATE_DIR;
    } else {
      process.env.OPENCLAW_STATE_DIR = previousStateDir;
    }
    await rm(stateDir, { recursive: true, force: true });
  });

  it("installs, skips current, and updates official preset skill ZIPs", async () => {
    const { syncOfficialPresetSkills } = await import("./api.js");

    await expect(syncOfficialPresetSkills({ proxyRouterPort: 0 }, "safe")).resolves.toEqual({
      installed: 1,
      updated: 0,
      current: 0,
      skippedCustom: 0,
      failed: 0,
    });

    await expect(syncOfficialPresetSkills({ proxyRouterPort: 0 }, "safe")).resolves.toEqual({
      installed: 0,
      updated: 0,
      current: 1,
      skippedCustom: 0,
      failed: 0,
    });

    currentVersion = "2.0.0";
    await expect(syncOfficialPresetSkills({ proxyRouterPort: 0 }, "safe")).resolves.toEqual({
      installed: 0,
      updated: 1,
      current: 0,
      skippedCustom: 0,
      failed: 0,
    });

    const content = await readFile(join(stateDir, "skills", "preset-foo", "SKILL.md"), "utf-8");
    expect(content).toContain("version: 2.0.0");
    expect(content).toContain("content 2.0.0");
  });
});
