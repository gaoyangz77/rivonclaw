import type { ArtifactType } from "@rivonclaw/core";
import { createLogger } from "@rivonclaw/logger";
import type { LLMConfig } from "../llm/llm-client.js";
import { chatCompletion } from "../llm/llm-client.js";

const log = createLogger("rules:compiler");

export interface CompileResult {
  artifactType: ArtifactType;
  content: string;
}

// ---------------------------------------------------------------------------
// LLM-based compilation
// ---------------------------------------------------------------------------

const CLASSIFICATION_SYSTEM_PROMPT = `You are a rule classifier for RivonClaw, a desktop runtime manager.

Given a user-written rule in natural language, classify it into exactly ONE of these artifact types:

1. "policy-fragment" — A behavioral guideline, preference, tone instruction, or soft constraint that should be injected into the agent's system prompt. This is the DEFAULT type for most rules.
   Examples: "Always respond in formal English", "Prefer TypeScript over JavaScript", "Keep responses concise"

2. "guard" — A hard boundary or restriction that must be enforced by intercepting tool calls. Guards BLOCK or MODIFY specific actions. They involve concrete, evaluable conditions (file paths, time, tool names, risk levels).
   Examples: "Never write to /etc", "Block all file deletions after 6pm", "Require confirmation before running shell commands"

3. "action-bundle" — A new capability or skill the agent should have, defined as a reusable action. These ADD functionality rather than restrict it.
   Examples: "Add a skill to deploy to staging", "Create a code review action", "Enable database backup capability"

Respond with ONLY a JSON object (no markdown fences, no extra text):
{"type": "<policy-fragment|guard|action-bundle>", "reasoning": "<one sentence explaining why>"}`;

const POLICY_GENERATION_PROMPT = `You are a policy writer for RivonClaw, a desktop runtime manager.

Given a user-written rule, produce a concise, clear policy directive that will be prepended to the agent's system prompt.

Requirements:
- Write in imperative form ("Do X", "Never Y", "Always Z")
- Be specific and unambiguous
- Keep it to 1-3 sentences
- Do NOT add commentary — output ONLY the policy text`;

const GUARD_GENERATION_PROMPT = `You are a guard specification writer for RivonClaw, a desktop runtime manager.

Given a user-written rule, produce a JSON guard specification that will be used to intercept tool calls.

Output ONLY a valid JSON object (no markdown fences):
{
  "type": "guard",
  "toolPattern": "<glob pattern for tool names to intercept, e.g. '*' for all, 'file_*' for file operations>",
  "condition": "<human-readable condition description>",
  "action": "<block|confirm|modify>",
  "reason": "<message shown to user when guard triggers>",
  "params": {}
}`;

const SKILL_GENERATION_PROMPT = `You are a skill author for RivonClaw, a desktop runtime manager.

Given a user-written rule describing a capability, produce a SKILL.md file with YAML frontmatter.

The output MUST be a valid SKILL.md file:
---
name: <kebab-case-skill-name>
description: <one-line description>
---

<Detailed instructions for the agent on how to perform this skill.
Include step-by-step guidance, relevant context, and any constraints.>

Output ONLY the SKILL.md content (including the frontmatter delimiters).`;

/**
 * Classify a rule into an artifact type using an LLM.
 */
async function classifyWithLLM(
  ruleText: string,
  config: LLMConfig,
): Promise<ArtifactType> {
  const response = await chatCompletion(config, [
    { role: "system", content: CLASSIFICATION_SYSTEM_PROMPT },
    { role: "user", content: ruleText },
  ]);

  // Parse the JSON response
  const raw = response.content.trim();
  // Strip markdown code fences if present
  const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  let parsed: { type?: string };
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    log.warn(`Failed to parse LLM classification response: ${raw.slice(0, 200)}`);
    // Fall back to policy-fragment on parse failure
    return "policy-fragment";
  }

  const validTypes: ArtifactType[] = ["policy-fragment", "guard", "action-bundle"];
  if (parsed.type && validTypes.includes(parsed.type as ArtifactType)) {
    return parsed.type as ArtifactType;
  }

  log.warn(`LLM returned unknown type "${parsed.type}", defaulting to policy-fragment`);
  return "policy-fragment";
}

/**
 * Generate artifact content for a given type using an LLM.
 */
async function generateWithLLM(
  ruleText: string,
  artifactType: ArtifactType,
  config: LLMConfig,
): Promise<string> {
  let systemPrompt: string;
  switch (artifactType) {
    case "guard":
      systemPrompt = GUARD_GENERATION_PROMPT;
      break;
    case "action-bundle":
      systemPrompt = SKILL_GENERATION_PROMPT;
      break;
    case "policy-fragment":
    default:
      systemPrompt = POLICY_GENERATION_PROMPT;
      break;
  }

  const response = await chatCompletion(config, [
    { role: "system", content: systemPrompt },
    { role: "user", content: ruleText },
  ]);

  return response.content.trim();
}

/**
 * Compile a rule's natural language text into a typed artifact using an LLM.
 *
 * Two LLM calls are made:
 * 1. Classification: determine the artifact type
 * 2. Generation: produce the artifact content for the classified type
 */
export async function compileRuleWithLLM(
  ruleText: string,
  config: LLMConfig,
): Promise<CompileResult> {
  log.info("Compiling rule with LLM...");

  // Step 1: Classify
  const artifactType = await classifyWithLLM(ruleText, config);
  log.info(`Classified as: ${artifactType}`);

  // Step 2: Generate content
  const content = await generateWithLLM(ruleText, artifactType, config);
  log.info(`Generated ${artifactType} content (${content.length} chars)`);

  return { artifactType, content };
}

// ---------------------------------------------------------------------------
// Heuristic fallback (used when no LLM config is available)
// ---------------------------------------------------------------------------

const GUARD_KEYWORDS = [
  "block", "deny", "forbid", "prevent", "must not", "never allow", "restrict",
];

const ACTION_BUNDLE_KEYWORDS = [
  "skill", "action", "capability", "can do", "enable", "add ability",
];

function classifyRuleHeuristic(ruleText: string): ArtifactType {
  const lower = ruleText.toLowerCase();
  for (const keyword of GUARD_KEYWORDS) {
    if (lower.includes(keyword)) return "guard";
  }
  for (const keyword of ACTION_BUNDLE_KEYWORDS) {
    if (lower.includes(keyword)) return "action-bundle";
  }
  return "policy-fragment";
}

function extractCondition(ruleText: string): string {
  const firstSentence = ruleText.split(/[.!?\n]/)[0]?.trim() ?? ruleText;
  return firstSentence.length > 120 ? firstSentence.slice(0, 117) + "..." : firstSentence;
}

function deriveSkillName(ruleText: string): string {
  return ruleText.split(/\s+/).slice(0, 5).join("-").toLowerCase().replace(/[^a-z0-9-]/g, "");
}

/**
 * Compile a rule using keyword heuristics (fallback when LLM is unavailable).
 */
export function compileRule(ruleText: string): CompileResult {
  const artifactType = classifyRuleHeuristic(ruleText);

  let content: string;
  switch (artifactType) {
    case "guard":
      content = JSON.stringify(
        { type: "guard", condition: extractCondition(ruleText), action: "block", reason: ruleText },
        null,
        2,
      );
      break;
    case "action-bundle": {
      const name = deriveSkillName(ruleText);
      content = ["---", `name: ${name}`, `description: ${extractCondition(ruleText)}`, "---", "", ruleText, ""].join("\n");
      break;
    }
    case "policy-fragment":
    default:
      content = `[POLICY] ${ruleText}`;
      break;
  }

  return { artifactType, content };
}
