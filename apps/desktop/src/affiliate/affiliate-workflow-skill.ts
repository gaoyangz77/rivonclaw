import { promises as fs } from "node:fs";
import { join } from "node:path";
import {
  AFFILIATE_WORKFLOW_SKILL_SLUG,
  resolveAffiliateWorkflowSkillDir,
} from "@rivonclaw/core/node";

export interface AffiliateWorkflowSkillDescriptor {
  name: string;
  description: string;
  version: string;
  location: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function parseRequiredFrontmatter(
  content: string,
  location: string,
): {
  name: string;
  description: string;
  version: string;
} {
  if (!content.startsWith("---\n")) {
    throw new Error(`Affiliate workflow skill has no frontmatter: ${location}`);
  }
  const end = content.indexOf("\n---", 4);
  if (end < 0) {
    throw new Error(`Affiliate workflow skill has invalid frontmatter: ${location}`);
  }
  const values = new Map<string, string>();
  for (const line of content.slice(4, end).split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    values.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }
  const name = values.get("name") ?? "";
  const description = values.get("description") ?? "";
  const version = values.get("version") ?? "";
  if (name !== AFFILIATE_WORKFLOW_SKILL_SLUG || !description || !version) {
    throw new Error(
      `Affiliate workflow skill must declare name=${AFFILIATE_WORKFLOW_SKILL_SLUG}, description, and version: ${location}`,
    );
  }
  return { name, description, version };
}

export async function loadAffiliateWorkflowSkillDescriptor(
  env: Record<string, string | undefined> = process.env,
): Promise<AffiliateWorkflowSkillDescriptor> {
  const location = join(resolveAffiliateWorkflowSkillDir(env), "SKILL.md");
  let content: string;
  try {
    content = await fs.readFile(location, "utf-8");
  } catch (error) {
    throw new Error(`Required Affiliate workflow skill is unavailable at ${location}`, {
      cause: error,
    });
  }
  return {
    ...parseRequiredFrontmatter(content, location),
    location,
  };
}

export function renderAffiliateWorkflowSkillCatalog(
  descriptor: AffiliateWorkflowSkillDescriptor,
): string {
  return [
    "## Skills",
    "Use the available Skill only when it applies to the current Agent Working Agenda.",
    "Read its SKILL.md from the exact listed path with `read`, then load only the referenced sections needed for this run.",
    "Resolve relative references against the directory containing that SKILL.md.",
    "If its version changes from a previous turn, re-read SKILL.md. Never invent Skill paths.",
    "",
    "<available_skills>",
    "  <skill>",
    `    <name>${escapeXml(descriptor.name)}</name>`,
    `    <description>${escapeXml(descriptor.description)}</description>`,
    `    <version>${escapeXml(descriptor.version)}</version>`,
    `    <location>${escapeXml(descriptor.location)}</location>`,
    "  </skill>",
    "</available_skills>",
  ].join("\n");
}

export async function buildAffiliateWorkflowSkillCatalog(
  env: Record<string, string | undefined> = process.env,
): Promise<string> {
  return renderAffiliateWorkflowSkillCatalog(await loadAffiliateWorkflowSkillDescriptor(env));
}
