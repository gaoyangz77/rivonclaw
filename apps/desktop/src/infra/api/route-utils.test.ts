import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { invalidateSkillsSnapshot } from "./route-utils.js";

describe("invalidateSkillsSnapshot", () => {
  let stateDir: string;
  let previousStateDir: string | undefined;

  beforeEach(async () => {
    previousStateDir = process.env.OPENCLAW_STATE_DIR;
    stateDir = await mkdtemp(join(tmpdir(), "skills-snapshot-invalidation-"));
    process.env.OPENCLAW_STATE_DIR = stateDir;
  });

  afterEach(async () => {
    if (previousStateDir === undefined) {
      delete process.env.OPENCLAW_STATE_DIR;
    } else {
      process.env.OPENCLAW_STATE_DIR = previousStateDir;
    }
    await rm(stateDir, { recursive: true, force: true });
  });

  async function writeSessionStore(agentId: string): Promise<string> {
    const sessionsDir = join(stateDir, "agents", agentId, "sessions");
    await mkdir(sessionsDir, { recursive: true });
    const storePath = join(sessionsDir, "sessions.json");
    await writeFile(
      storePath,
      JSON.stringify({
        [`agent:${agentId}:session`]: {
          sessionId: `${agentId}-session`,
          skillsSnapshot: { version: 1 },
          keep: true,
        },
      }),
      "utf-8",
    );
    return storePath;
  }

  it("clears cached skill catalogs for both main and dedicated agents", async () => {
    const mainStorePath = await writeSessionStore("main");
    const affiliateStorePath = await writeSessionStore("affiliate");

    invalidateSkillsSnapshot();

    for (const storePath of [mainStorePath, affiliateStorePath]) {
      const store = JSON.parse(await readFile(storePath, "utf-8")) as Record<
        string,
        Record<string, unknown>
      >;
      const entry = Object.values(store)[0];
      expect(entry).toEqual({
        sessionId: expect.any(String),
        keep: true,
      });
    }
  });
});
