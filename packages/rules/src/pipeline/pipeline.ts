import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { DEFAULTS } from "@rivonclaw/core";
import type { Rule, RuleArtifact } from "@rivonclaw/core";
import type { Storage } from "@rivonclaw/storage";
import { createLogger } from "@rivonclaw/logger";
import { compileRule, compileRuleWithLLM } from "./compiler.js";
import type { LLMConfig } from "./llm-client.js";

const log = createLogger("rules:pipeline");

export interface ArtifactPipelineEvents {
  compiled: [ruleId: string, artifact: RuleArtifact];
  failed: [ruleId: string, error: Error];
}

/** Options for configuring the artifact pipeline. */
export interface ArtifactPipelineOptions {
  /** Storage instance for persisting artifacts. */
  storage: Storage;
  /**
   * Resolver that returns the current LLM config (provider + API key).
   * Called on each compilation so it always uses the latest settings.
   * If it returns null, the pipeline falls back to heuristic compilation.
   */
  resolveLLMConfig?: () => Promise<LLMConfig | null>;
  /** Maximum number of retry attempts for LLM compilation. Default: 3 */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff between retries. Default: 1000 */
  retryBaseDelayMs?: number;
}

const DEFAULT_MAX_POLICY_LENGTH = DEFAULTS.rules.maxPolicyLength;
const DEFAULT_MAX_RETRIES = DEFAULTS.rules.maxRetries;
const DEFAULT_RETRY_BASE_DELAY_MS = DEFAULTS.rules.retryBaseDelayMs;

export class ArtifactPipeline extends EventEmitter<ArtifactPipelineEvents> {
  private storage: Storage;
  private resolveLLMConfig: (() => Promise<LLMConfig | null>) | undefined;
  private maxRetries: number;
  private retryBaseDelayMs: number;

  constructor(options: ArtifactPipelineOptions) {
    super();
    this.storage = options.storage;
    this.resolveLLMConfig = options.resolveLLMConfig;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
  }

  /**
   * Compile (or recompile) a rule into an artifact, persisting to storage.
   *
   * Uses LLM-based compilation if an LLM config resolver is available.
   * Falls back to keyword heuristics if LLM is unavailable or all retries fail.
   *
   * Each rule produces exactly ONE artifact. If an artifact already exists
   * for this rule, it is updated in place.
   *
   * On failure, the last-known-good artifact is preserved (if any) and its
   * status is set to "failed".
   */
  async compileRule(rule: Rule): Promise<RuleArtifact> {
    const existingArtifacts = this.storage.artifacts.getByRuleId(rule.id);
    const existing = existingArtifacts.length > 0 ? existingArtifacts[0] : undefined;

    // Mark as pending while compilation is in progress (best-effort)
    try {
      if (existing) {
        this.storage.artifacts.update(existing.id, {
          status: "pending",
          compiledAt: new Date().toISOString(),
        });
      } else {
        // Create a pending placeholder so the UI can show "compiling..."
        const pendingId = randomUUID();
        this.storage.artifacts.create({
          id: pendingId,
          ruleId: rule.id,
          type: "policy-fragment",
          content: "",
          status: "pending",
          compiledAt: new Date().toISOString(),
        });
      }
    } catch (pendingErr) {
      log.warn(`Failed to set pending status for rule ${rule.id}: ${pendingErr}`);
    }

    try {
      const result = await this.compileWithRetry(rule.text);
      const now = new Date().toISOString();

      // Re-fetch existing artifacts after async compilation (state may have changed)
      const currentArtifacts = this.storage.artifacts.getByRuleId(rule.id);
      const current = currentArtifacts.length > 0 ? currentArtifacts[0] : undefined;

      let artifact: RuleArtifact;

      if (current) {
        if (current.type !== result.artifactType) {
          // Type changed: delete and recreate
          this.storage.artifacts.deleteByRuleId(rule.id);
          artifact = this.storage.artifacts.create({
            id: current.id,
            ruleId: rule.id,
            type: result.artifactType,
            content: result.content,
            status: "ok",
            compiledAt: now,
          });
        } else {
          const updated = this.storage.artifacts.update(current.id, {
            content: result.content,
            status: "ok",
            compiledAt: now,
          });
          artifact = updated ?? { ...current, content: result.content, status: "ok" as const, compiledAt: now };
        }
      } else {
        artifact = this.storage.artifacts.create({
          id: randomUUID(),
          ruleId: rule.id,
          type: result.artifactType,
          content: result.content,
          status: "ok",
          compiledAt: now,
        });
      }

      log.info(`Compiled rule ${rule.id} → ${result.artifactType} artifact ${artifact.id}`);
      this.emit("compiled", rule.id, artifact);
      return artifact;
    } catch (error) {
      return this.handleCompileFailure(rule.id, error, existing);
    }
  }

  /**
   * Attempt LLM compilation with exponential backoff retry.
   * Falls back to heuristic compilation if LLM is not configured.
   */
  private async compileWithRetry(ruleText: string) {
    // Try to get LLM config
    let llmConfig: LLMConfig | null = null;
    if (this.resolveLLMConfig) {
      try {
        llmConfig = await this.resolveLLMConfig();
      } catch (err) {
        log.warn(`Failed to resolve LLM config: ${err}`);
      }
    }

    // No LLM config → use heuristic fallback immediately
    if (!llmConfig) {
      log.info("No LLM config available, using heuristic fallback");
      return compileRule(ruleText);
    }

    // Attempt LLM compilation with retries
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await compileRuleWithLLM(ruleText, llmConfig);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        log.warn(
          `LLM compilation attempt ${attempt}/${this.maxRetries} failed: ${lastError.message}`,
        );

        if (attempt < this.maxRetries) {
          const delay = this.retryBaseDelayMs * Math.pow(2, attempt - 1);
          log.info(`Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted — fall back to heuristic
    log.warn(
      `All ${this.maxRetries} LLM attempts failed, using heuristic fallback. Last error: ${lastError?.message}`,
    );
    return compileRule(ruleText);
  }

  /**
   * Handle a compile failure: preserve last-known-good artifact, mark as failed.
   */
  private handleCompileFailure(
    ruleId: string,
    error: unknown,
    existing: RuleArtifact | undefined,
  ): RuleArtifact {
    const err = error instanceof Error ? error : new Error(String(error));
    log.warn(`Failed to compile rule ${ruleId}: ${err.message}`);

    if (existing) {
      try {
        const now = new Date().toISOString();
        const failed = this.storage.artifacts.update(existing.id, {
          status: "failed",
          compiledAt: now,
        });
        this.emit("failed", ruleId, err);
        return failed ?? { ...existing, status: "failed" as const };
      } catch {
        this.emit("failed", ruleId, err);
        return { ...existing, status: "failed" as const };
      }
    }

    try {
      const failedArtifact = this.storage.artifacts.create({
        id: randomUUID(),
        ruleId,
        type: "policy-fragment",
        content: "",
        status: "failed",
        compiledAt: new Date().toISOString(),
      });
      this.emit("failed", ruleId, err);
      return failedArtifact;
    } catch {
      this.emit("failed", ruleId, err);
      return {
        id: randomUUID(),
        ruleId,
        type: "policy-fragment" as const,
        content: "",
        status: "failed" as const,
        compiledAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Recompile all rules. Returns count of successes and failures.
   */
  async recompileAll(): Promise<{ succeeded: number; failed: number }> {
    const rules = this.storage.rules.getAll();
    let succeeded = 0;
    let failed = 0;

    for (const rule of rules) {
      const artifact = await this.compileRule(rule);
      if (artifact.status === "ok") {
        succeeded++;
      } else {
        failed++;
      }
    }

    log.info(`Recompiled all rules: ${succeeded} succeeded, ${failed} failed`);
    return { succeeded, failed };
  }

  /**
   * Remove artifacts for a deleted rule.
   */
  removeArtifacts(ruleId: string): void {
    const count = this.storage.artifacts.deleteByRuleId(ruleId);
    log.info(`Removed ${count} artifact(s) for rule ${ruleId}`);
  }

  /**
   * Get the compiled policy view: all policy-fragment artifacts with status "ok"
   * concatenated, bounded to maxLength (default 4000 chars), separated by newlines.
   */
  getCompiledPolicyView(maxLength: number = DEFAULT_MAX_POLICY_LENGTH): string {
    const allArtifacts = this.storage.artifacts.getAll();
    const policyArtifacts = allArtifacts.filter(
      (a) => a.type === "policy-fragment" && a.status === "ok",
    );

    const fragments: string[] = [];
    let totalLength = 0;

    for (const artifact of policyArtifacts) {
      const nextLength = totalLength + (fragments.length > 0 ? 1 : 0) + artifact.content.length;
      if (nextLength > maxLength) {
        break;
      }
      fragments.push(artifact.content);
      totalLength = nextLength;
    }

    return fragments.join("\n");
  }

  /**
   * Get all active guard artifacts (status "ok").
   */
  getActiveGuards(): RuleArtifact[] {
    const allArtifacts = this.storage.artifacts.getAll();
    return allArtifacts.filter((a) => a.type === "guard" && a.status === "ok");
  }
}
