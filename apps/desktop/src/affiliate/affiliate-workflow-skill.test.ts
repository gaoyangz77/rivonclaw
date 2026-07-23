import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildAffiliateWorkflowSkillCatalog,
  loadAffiliateWorkflowSkillDescriptor,
  renderAffiliateWorkflowSkillCatalog,
} from "./affiliate-workflow-skill.js";

describe("Affiliate workflow skill catalog", () => {
  let stateDir: string;

  beforeEach(async () => {
    stateDir = await mkdtemp(join(tmpdir(), "affiliate-workflow-skill-"));
  });

  afterEach(async () => {
    await rm(stateDir, { recursive: true, force: true });
  });

  async function writeSkill(content: string): Promise<string> {
    const skillDir = join(stateDir, "workspace-affiliate", "skills", "affiliate-workflow");
    await mkdir(skillDir, { recursive: true });
    const location = join(skillDir, "SKILL.md");
    await writeFile(location, content, "utf-8");
    return location;
  }

  it("publishes only metadata and the exact workspace-local path", async () => {
    const location = await writeSkill(
      [
        "---",
        "name: affiliate-workflow",
        "description: Read the workflow only when Affiliate work needs it.",
        "version: 2.4.0",
        "---",
        "",
        "# Secret body that must remain progressively disclosed",
      ].join("\n"),
    );

    const catalog = await buildAffiliateWorkflowSkillCatalog({
      OPENCLAW_STATE_DIR: stateDir,
    });

    expect(catalog).toContain("<name>affiliate-workflow</name>");
    expect(catalog).toContain("<version>2.4.0</version>");
    expect(catalog).toContain(`<location>${location}</location>`);
    expect(catalog).not.toContain("Secret body");
  });

  it("fails closed before dispatch when the required skill is absent", async () => {
    await expect(
      loadAffiliateWorkflowSkillDescriptor({ OPENCLAW_STATE_DIR: stateDir }),
    ).rejects.toThrow("Required Affiliate workflow skill is unavailable");
  });

  it("rejects a skill whose canonical identity is invalid", async () => {
    await writeSkill(
      ["---", "name: another-skill", "description: Wrong identity.", "version: 1.0.0", "---"].join(
        "\n",
      ),
    );

    await expect(
      loadAffiliateWorkflowSkillDescriptor({ OPENCLAW_STATE_DIR: stateDir }),
    ).rejects.toThrow("must declare name=affiliate-workflow");
  });

  it("escapes catalog metadata without changing the local path contract", () => {
    const catalog = renderAffiliateWorkflowSkillCatalog({
      name: "affiliate-workflow",
      description: "Use A & B <together>",
      version: "1.0.0",
      location: "/tmp/workspace-affiliate/skills/affiliate-workflow/SKILL.md",
    });

    expect(catalog).toContain("Use A &amp; B &lt;together&gt;");
  });
});
