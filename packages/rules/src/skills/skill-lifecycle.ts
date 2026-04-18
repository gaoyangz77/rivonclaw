import type { Rule, RuleArtifact } from "@rivonclaw/core";
import { createLogger } from "@rivonclaw/logger";
import type { ArtifactPipeline } from "../pipeline/pipeline.js";
import {
  writeSkillFile,
  removeSkillFile,
  extractSkillName,
} from "./skill-writer.js";

const log = createLogger("rules:skill-lifecycle");

/**
 * Materialize an action-bundle artifact as a SKILL.md file on disk.
 *
 * If the artifact is not of type "action-bundle", returns undefined.
 * Otherwise writes the SKILL.md and returns the output path.
 */
export function materializeSkill(
  artifact: RuleArtifact,
  skillsDir?: string,
): string | undefined {
  if (artifact.type !== "action-bundle") {
    log.debug(
      `Skipping materialize for artifact ${artifact.id}: type is "${artifact.type}", not "action-bundle"`,
    );
    return undefined;
  }

  const skillName = extractSkillName(artifact.content);
  const outputPath = writeSkillFile(skillName, artifact.content, skillsDir);
  log.info(
    `Materialized skill "${skillName}" for artifact ${artifact.id} at ${outputPath}`,
  );
  return outputPath;
}

/**
 * Dematerialize (remove) a SKILL.md file for an action-bundle artifact.
 *
 * If the artifact has an outputPath, removes the file from disk.
 * Returns true if the file was successfully removed.
 */
export function dematerializeSkill(artifact: RuleArtifact): boolean {
  if (!artifact.outputPath) {
    log.debug(
      `No outputPath on artifact ${artifact.id}; nothing to dematerialize`,
    );
    return false;
  }

  const removed = removeSkillFile(artifact.outputPath);
  if (removed) {
    log.info(
      `Dematerialized skill for artifact ${artifact.id} at ${artifact.outputPath}`,
    );
  } else {
    log.warn(
      `Failed to dematerialize skill for artifact ${artifact.id} at ${artifact.outputPath}`,
    );
  }
  return removed;
}

/**
 * High-level orchestrator: compile a rule through the pipeline and
 * materialize or dematerialize the skill file as needed.
 *
 * - If the compiled artifact is action-bundle, materialize and update outputPath.
 * - If the artifact was previously action-bundle but the type changed,
 *   dematerialize the old skill file.
 *
 * Returns the resulting artifact.
 */
export async function syncSkillsForRule(
  pipeline: ArtifactPipeline,
  rule: Rule,
  skillsDir?: string,
): Promise<RuleArtifact> {
  // Access the pipeline's internal storage to read previous artifact state
  const pipelineAny = pipeline as unknown as { storage: { artifacts: { getByRuleId(ruleId: string): RuleArtifact[]; update(id: string, fields: Partial<Pick<RuleArtifact, "content" | "outputPath" | "status" | "compiledAt">>): RuleArtifact | undefined } } };
  const existingArtifacts = pipelineAny.storage.artifacts.getByRuleId(rule.id);
  const previousArtifact = existingArtifacts.length > 0 ? existingArtifacts[0] : undefined;

  // Compile the rule (creates or updates artifact in storage)
  const artifact = await pipeline.compileRule(rule);

  // If compilation failed, don't touch skill files
  if (artifact.status !== "ok") {
    log.warn(
      `Compilation failed for rule ${rule.id}; skipping skill sync`,
    );
    return artifact;
  }

  // If the type changed away from action-bundle, dematerialize the old skill
  if (
    previousArtifact &&
    previousArtifact.type === "action-bundle" &&
    artifact.type !== "action-bundle"
  ) {
    dematerializeSkill(previousArtifact);
    if (artifact.outputPath) {
      pipelineAny.storage.artifacts.update(artifact.id, {
        outputPath: undefined,
      });
    }
  }

  // If the artifact is action-bundle, materialize it
  if (artifact.type === "action-bundle") {
    // If there was a previous skill file at a different path, clean it up first
    if (previousArtifact?.outputPath) {
      dematerializeSkill(previousArtifact);
    }

    const outputPath = materializeSkill(artifact, skillsDir);
    if (outputPath) {
      pipelineAny.storage.artifacts.update(artifact.id, { outputPath });
      artifact.outputPath = outputPath;
    }
  }

  return artifact;
}

/**
 * Clean up skill files and artifacts when a rule is deleted.
 *
 * - Dematerializes any action-bundle artifacts (removes SKILL.md files)
 * - Removes all artifacts for the rule from storage
 */
export function cleanupSkillsForDeletedRule(
  pipeline: ArtifactPipeline,
  ruleId: string,
): void {
  const pipelineAny = pipeline as unknown as { storage: { artifacts: { getByRuleId(ruleId: string): RuleArtifact[]; update(id: string, fields: Partial<Pick<RuleArtifact, "content" | "outputPath" | "status" | "compiledAt">>): RuleArtifact | undefined } } };
  const artifacts = pipelineAny.storage.artifacts.getByRuleId(ruleId);

  for (const artifact of artifacts) {
    if (artifact.type === "action-bundle" && artifact.outputPath) {
      dematerializeSkill(artifact);
      log.info(
        `Cleaned up skill file for deleted rule ${ruleId}, artifact ${artifact.id}`,
      );
    }
  }

  // Remove all artifacts from storage
  pipeline.removeArtifacts(ruleId);
  log.info(`Removed all artifacts for deleted rule ${ruleId}`);
}
