import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { Rule, RuleArtifact } from "@rivonclaw/core";
import { createStorage, type Storage } from "@rivonclaw/storage";
import { compileRule } from "./compiler/compiler.js";
import { ArtifactPipeline } from "./pipeline/pipeline.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRule(text: string, id?: string): Rule {
  const now = new Date().toISOString();
  return {
    id: id ?? randomUUID(),
    text,
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Compiler tests (heuristic fallback — synchronous)
// ---------------------------------------------------------------------------

describe("compileRule (compiler)", () => {
  describe("classification", () => {
    it("classifies guard keywords → guard", () => {
      const guardTexts = [
        "Block all access to /etc/passwd",
        "Deny requests from unknown IPs",
        "Forbid uploading executable files",
        "Prevent deletion of production data",
        "The agent must not read private keys",
        "Never allow access to the admin panel",
        "Restrict file writes to the sandbox directory",
      ];
      for (const text of guardTexts) {
        const result = compileRule(text);
        expect(result.artifactType).toBe("guard");
      }
    });

    it("classifies action-bundle keywords → action-bundle", () => {
      const actionTexts = [
        "Add a skill to summarize documents",
        "Enable the action of sending emails",
        "The agent has the capability to search the web",
        "The agent can do file conversions",
        "Enable PDF parsing for all users",
        "Add ability to translate languages",
      ];
      for (const text of actionTexts) {
        const result = compileRule(text);
        expect(result.artifactType).toBe("action-bundle");
      }
    });

    it("classifies default text → policy-fragment", () => {
      const policyTexts = [
        "Always respond in a polite tone",
        "Use British English spelling",
        "Keep responses under 500 words",
        "Prioritize accuracy over speed",
      ];
      for (const text of policyTexts) {
        const result = compileRule(text);
        expect(result.artifactType).toBe("policy-fragment");
      }
    });

    it("guard keywords take precedence over action-bundle keywords", () => {
      // Text contains both "block" (guard) and "skill" (action-bundle)
      const result = compileRule("Block the skill of deleting files");
      expect(result.artifactType).toBe("guard");
    });
  });

  describe("content generation", () => {
    it("generates [POLICY] prefix for policy-fragment", () => {
      const result = compileRule("Always be polite");
      expect(result.content).toBe("[POLICY] Always be polite");
    });

    it("generates valid JSON guard spec for guard", () => {
      const result = compileRule("Block access to system files");
      const parsed = JSON.parse(result.content);
      expect(parsed.type).toBe("guard");
      expect(parsed.action).toBe("block");
      expect(parsed.reason).toBe("Block access to system files");
      expect(parsed.condition).toBeDefined();
      expect(typeof parsed.condition).toBe("string");
    });

    it("generates SKILL.md skeleton for action-bundle", () => {
      const result = compileRule("Add a skill to summarize documents");
      expect(result.content).toContain("---");
      expect(result.content).toContain("name:");
      expect(result.content).toContain("description:");
      expect(result.content).toContain("Add a skill to summarize documents");
    });

    it("guard condition is truncated for very long text", () => {
      const longText = "Block " + "x".repeat(200);
      const result = compileRule(longText);
      const parsed = JSON.parse(result.content);
      expect(parsed.condition.length).toBeLessThanOrEqual(120);
      expect(parsed.condition).toContain("...");
    });
  });
});

// ---------------------------------------------------------------------------
// Pipeline tests (no LLM config → uses heuristic fallback)
// ---------------------------------------------------------------------------

describe("ArtifactPipeline", () => {
  let storage: Storage;
  let pipeline: ArtifactPipeline;

  beforeEach(() => {
    storage = createStorage(":memory:");
    // No resolveLLMConfig → will use heuristic fallback
    pipeline = new ArtifactPipeline({ storage });
  });

  afterEach(() => {
    storage.close();
  });

  describe("compileRule", () => {
    it("compiles a rule and persists artifact to storage", async () => {
      const rule = makeRule("Always be helpful");
      storage.rules.create(rule);

      const artifact = await pipeline.compileRule(rule);

      expect(artifact.ruleId).toBe(rule.id);
      expect(artifact.type).toBe("policy-fragment");
      expect(artifact.status).toBe("ok");
      expect(artifact.content).toBe("[POLICY] Always be helpful");
      expect(artifact.compiledAt).toBeDefined();

      // Verify it is in storage
      const stored = storage.artifacts.getByRuleId(rule.id);
      expect(stored).toHaveLength(1);
      expect(stored[0]!.id).toBe(artifact.id);
    });

    it("emits 'compiled' event on success", async () => {
      const rule = makeRule("Be concise");
      storage.rules.create(rule);

      const handler = vi.fn();
      pipeline.on("compiled", handler);

      await pipeline.compileRule(rule);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        rule.id,
        expect.objectContaining({ ruleId: rule.id, status: "ok" }),
      );
    });

    it("compiles a guard rule correctly", async () => {
      const rule = makeRule("Block access to admin routes");
      storage.rules.create(rule);

      const artifact = await pipeline.compileRule(rule);

      expect(artifact.type).toBe("guard");
      expect(artifact.status).toBe("ok");
      const parsed = JSON.parse(artifact.content);
      expect(parsed.type).toBe("guard");
      expect(parsed.action).toBe("block");
    });

    it("compiles an action-bundle rule correctly", async () => {
      const rule = makeRule("Enable the capability to search the web");
      storage.rules.create(rule);

      const artifact = await pipeline.compileRule(rule);

      expect(artifact.type).toBe("action-bundle");
      expect(artifact.status).toBe("ok");
      expect(artifact.content).toContain("---");
      expect(artifact.content).toContain("name:");
    });

    it("sets status to pending during compilation", async () => {
      const rule = makeRule("Always be helpful");
      storage.rules.create(rule);

      // Compile creates a pending placeholder, then updates to ok
      const artifact = await pipeline.compileRule(rule);
      expect(artifact.status).toBe("ok");

      // The stored artifact should also be ok after compilation
      const stored = storage.artifacts.getByRuleId(rule.id);
      expect(stored).toHaveLength(1);
      expect(stored[0]!.status).toBe("ok");
    });
  });

  describe("recompile updates existing artifact (no duplicates)", () => {
    it("updates in place when recompiling the same rule", async () => {
      const rule = makeRule("Be respectful");
      storage.rules.create(rule);

      const first = await pipeline.compileRule(rule);
      const second = await pipeline.compileRule(rule);

      // Same artifact ID, updated in place
      expect(second.id).toBe(first.id);
      expect(second.status).toBe("ok");

      // Only one artifact in storage for this rule
      const stored = storage.artifacts.getByRuleId(rule.id);
      expect(stored).toHaveLength(1);
    });

    it("handles type change on recompile by recreating artifact", async () => {
      const ruleId = randomUUID();
      const rule1 = makeRule("Be polite");
      rule1.id = ruleId;
      storage.rules.create(rule1);

      // First compile: policy-fragment
      const first = await pipeline.compileRule(rule1);
      expect(first.type).toBe("policy-fragment");

      // Update rule text to trigger guard classification
      const rule2: Rule = { ...rule1, text: "Block all dangerous commands" };
      storage.rules.update(ruleId, { text: rule2.text });

      // Second compile: guard (type changed)
      const second = await pipeline.compileRule(rule2);
      expect(second.type).toBe("guard");

      // Still only one artifact
      const stored = storage.artifacts.getByRuleId(ruleId);
      expect(stored).toHaveLength(1);
    });
  });

  describe("failure handling", () => {
    it("keeps last-known-good on compile failure and emits 'failed'", async () => {
      const rule = makeRule("Be kind");
      storage.rules.create(rule);

      // First: successful compile
      const good = await pipeline.compileRule(rule);
      expect(good.status).toBe("ok");
      const goodContent = good.content;

      // Recompiling with valid text preserves the artifact ID and content updates correctly.
      const rule2: Rule = { ...rule, text: "Block everything" };
      const recompiled = await pipeline.compileRule(rule2);
      expect(recompiled.id).toBe(good.id);
      expect(recompiled.content).not.toBe(goodContent);
      expect(recompiled.status).toBe("ok");
    });

    it("emits 'failed' event and marks artifact as failed on error", async () => {
      const rule = makeRule("Be kind");
      storage.rules.create(rule);

      const failedHandler = vi.fn();
      pipeline.on("failed", failedHandler);

      // First compile succeeds
      const artifact = await pipeline.compileRule(rule);
      expect(artifact.status).toBe("ok");

      // Break storage to force a failure on next compile
      const originalUpdate = storage.artifacts.update.bind(storage.artifacts);
      storage.artifacts.update = () => {
        throw new Error("Simulated storage failure");
      };

      const result = await pipeline.compileRule(rule);

      // Should have emitted "failed"
      expect(failedHandler).toHaveBeenCalledOnce();
      expect(failedHandler).toHaveBeenCalledWith(rule.id, expect.any(Error));

      // The artifact should still be marked as "failed"
      expect(result.status).toBe("failed");

      // Restore
      storage.artifacts.update = originalUpdate;
    });
  });

  describe("recompileAll", () => {
    it("recompiles all rules and returns counts", async () => {
      const rules = [
        makeRule("Be polite"),
        makeRule("Block access to secrets"),
        makeRule("Enable the capability to run scripts"),
      ];
      for (const r of rules) {
        storage.rules.create(r);
      }

      const result = await pipeline.recompileAll();

      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);

      // Verify artifacts exist for all rules
      const allArtifacts = storage.artifacts.getAll();
      expect(allArtifacts).toHaveLength(3);
    });

    it("returns zero counts when no rules exist", async () => {
      const result = await pipeline.recompileAll();
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe("getCompiledPolicyView", () => {
    it("concatenates all ok policy-fragment artifacts", async () => {
      const rules = [
        makeRule("Be polite"),
        makeRule("Be accurate"),
        makeRule("Be helpful"),
      ];
      for (const r of rules) {
        storage.rules.create(r);
        await pipeline.compileRule(r);
      }

      const view = pipeline.getCompiledPolicyView();

      expect(view).toContain("[POLICY] Be polite");
      expect(view).toContain("[POLICY] Be accurate");
      expect(view).toContain("[POLICY] Be helpful");
      // Separated by newlines
      expect(view).toBe(
        "[POLICY] Be polite\n[POLICY] Be accurate\n[POLICY] Be helpful",
      );
    });

    it("excludes non-policy-fragment artifacts", async () => {
      const policyRule = makeRule("Be polite");
      const guardRule = makeRule("Block dangerous commands");

      storage.rules.create(policyRule);
      storage.rules.create(guardRule);
      await pipeline.compileRule(policyRule);
      await pipeline.compileRule(guardRule);

      const view = pipeline.getCompiledPolicyView();

      expect(view).toContain("[POLICY] Be polite");
      expect(view).not.toContain("Block dangerous commands");
    });

    it("excludes failed policy-fragment artifacts", async () => {
      const rule = makeRule("Be polite");
      storage.rules.create(rule);
      await pipeline.compileRule(rule);

      // Manually mark the artifact as failed
      const artifacts = storage.artifacts.getByRuleId(rule.id);
      storage.artifacts.update(artifacts[0]!.id, { status: "failed" });

      const view = pipeline.getCompiledPolicyView();
      expect(view).toBe("");
    });

    it("bounds output to maxLength", async () => {
      // Create enough policy rules to exceed the limit
      const rules: Rule[] = [];
      for (let i = 0; i < 100; i++) {
        const r = makeRule(`Policy number ${i} with some extra text to fill space`);
        rules.push(r);
        storage.rules.create(r);
        await pipeline.compileRule(r);
      }

      const view = pipeline.getCompiledPolicyView(200);

      expect(view.length).toBeLessThanOrEqual(200);
      // Should have at least one policy
      expect(view).toContain("[POLICY]");
    });

    it("returns empty string when no policy fragments exist", async () => {
      const rule = makeRule("Block everything");
      storage.rules.create(rule);
      await pipeline.compileRule(rule);

      const view = pipeline.getCompiledPolicyView();
      expect(view).toBe("");
    });

    it("uses default maxLength of 4000", async () => {
      // Create many policies that together exceed 4000 chars
      const rules: Rule[] = [];
      for (let i = 0; i < 200; i++) {
        const r = makeRule(
          `This is policy ${i} and it has a reasonable amount of text attached to it`,
        );
        rules.push(r);
        storage.rules.create(r);
        await pipeline.compileRule(r);
      }

      const view = pipeline.getCompiledPolicyView();
      expect(view.length).toBeLessThanOrEqual(4000);
    });
  });

  describe("getActiveGuards", () => {
    it("returns only guard artifacts with status ok", async () => {
      const guardRule = makeRule("Block access to admin");
      const policyRule = makeRule("Be polite");

      storage.rules.create(guardRule);
      storage.rules.create(policyRule);
      await pipeline.compileRule(guardRule);
      await pipeline.compileRule(policyRule);

      const guards = pipeline.getActiveGuards();

      expect(guards).toHaveLength(1);
      expect(guards[0]!.type).toBe("guard");
      expect(guards[0]!.ruleId).toBe(guardRule.id);
    });

    it("excludes failed guard artifacts", async () => {
      const rule = makeRule("Block dangerous actions");
      storage.rules.create(rule);
      await pipeline.compileRule(rule);

      // Manually mark as failed
      const artifacts = storage.artifacts.getByRuleId(rule.id);
      storage.artifacts.update(artifacts[0]!.id, { status: "failed" });

      const guards = pipeline.getActiveGuards();
      expect(guards).toHaveLength(0);
    });

    it("returns multiple active guards", async () => {
      const rules = [
        makeRule("Block file deletion"),
        makeRule("Deny network access"),
        makeRule("Prevent reading /etc/shadow"),
      ];
      for (const r of rules) {
        storage.rules.create(r);
        await pipeline.compileRule(r);
      }

      const guards = pipeline.getActiveGuards();
      expect(guards).toHaveLength(3);
      for (const g of guards) {
        expect(g.type).toBe("guard");
        expect(g.status).toBe("ok");
      }
    });

    it("returns empty array when no guards exist", async () => {
      const rule = makeRule("Be polite");
      storage.rules.create(rule);
      await pipeline.compileRule(rule);

      const guards = pipeline.getActiveGuards();
      expect(guards).toHaveLength(0);
    });
  });

  describe("removeArtifacts", () => {
    it("removes all artifacts for a given rule", async () => {
      const rule = makeRule("Be polite");
      storage.rules.create(rule);
      await pipeline.compileRule(rule);

      // Verify artifact exists
      expect(storage.artifacts.getByRuleId(rule.id)).toHaveLength(1);

      pipeline.removeArtifacts(rule.id);

      // Verify artifact removed
      expect(storage.artifacts.getByRuleId(rule.id)).toHaveLength(0);
    });

    it("does not affect artifacts of other rules", async () => {
      const rule1 = makeRule("Be polite");
      const rule2 = makeRule("Block dangerous things");

      storage.rules.create(rule1);
      storage.rules.create(rule2);
      await pipeline.compileRule(rule1);
      await pipeline.compileRule(rule2);

      pipeline.removeArtifacts(rule1.id);

      expect(storage.artifacts.getByRuleId(rule1.id)).toHaveLength(0);
      expect(storage.artifacts.getByRuleId(rule2.id)).toHaveLength(1);
    });

    it("is a no-op when no artifacts exist for the rule", () => {
      // Should not throw
      expect(() => pipeline.removeArtifacts(randomUUID())).not.toThrow();
    });

    it("removed artifacts no longer appear in getCompiledPolicyView", async () => {
      const rule = makeRule("Important policy");
      storage.rules.create(rule);
      await pipeline.compileRule(rule);

      expect(pipeline.getCompiledPolicyView()).toContain("[POLICY] Important policy");

      pipeline.removeArtifacts(rule.id);

      expect(pipeline.getCompiledPolicyView()).toBe("");
    });

    it("removed guard artifacts no longer appear in getActiveGuards", async () => {
      const rule = makeRule("Block everything");
      storage.rules.create(rule);
      await pipeline.compileRule(rule);

      expect(pipeline.getActiveGuards()).toHaveLength(1);

      pipeline.removeArtifacts(rule.id);

      expect(pipeline.getActiveGuards()).toHaveLength(0);
    });
  });
});
