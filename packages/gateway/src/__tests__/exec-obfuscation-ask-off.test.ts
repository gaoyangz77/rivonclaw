import { describe, it, expect } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  requiresExecApproval,
  resolveExecApprovalsFromFile,
} from "../../../../vendor/openclaw/src/infra/exec-approvals.js";
import { syncExecApprovalsYolo } from "../config/exec-approvals-writer.js";

/**
 * Validates that EasyClaw's ask=off + security=full configuration works
 * correctly with the vendor's exec approval logic.
 *
 * EasyClaw configures exec.ask="off" for the Chat Page (localhost, no approval
 * UI). The vendor must not force approval when the admin has explicitly
 * disabled it via ask="off".
 *
 * As of v2026.4.5, upstream removed obfuscation-based approval gating entirely
 * (commit a74fb94fa3), so the original vendor patch 0003 is no longer needed.
 * These tests verify the remaining ask=off contract holds.
 */
describe("exec approval + ask=off contract", () => {
  it("requiresExecApproval returns false when ask=off regardless of security", () => {
    // This is the core EasyClaw expectation: ask=off means no approval prompts.
    const result = requiresExecApproval({
      ask: "off",
      security: "full",
      analysisOk: true,
      allowlistSatisfied: true,
    });
    expect(result).toBe(false);
  });

  it("requiresExecApproval returns false when ask=off even on allowlist miss", () => {
    const result = requiresExecApproval({
      ask: "off",
      security: "allowlist",
      analysisOk: true,
      allowlistSatisfied: false,
    });
    expect(result).toBe(false);
  });

  it("requiresExecApproval returns true when ask=always (control case)", () => {
    const result = requiresExecApproval({
      ask: "always",
      security: "full",
      analysisOk: true,
      allowlistSatisfied: true,
    });
    expect(result).toBe(true);
  });

  it("RivonClaw host approval sync resolves to no approval under vendor policy logic", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "rivonclaw-exec-approval-policy-test-"));
    try {
      const approvalsPath = join(tmpDir, ".openclaw", "exec-approvals.json");
      mkdirSync(join(tmpDir, ".openclaw"), { recursive: true });
      writeFileSync(
        approvalsPath,
        JSON.stringify({
          version: 1,
          defaults: {
            security: "allowlist",
            ask: "on-miss",
            askFallback: "deny",
          },
          agents: {
            main: {
              security: "allowlist",
              ask: "always",
              askFallback: "deny",
            },
          },
        }),
        "utf-8",
      );

      syncExecApprovalsYolo({ approvalsPath });

      const file = JSON.parse(readFileSync(approvalsPath, "utf-8"));
      const mainPolicy = resolveExecApprovalsFromFile({
        file,
        agentId: "main",
        path: approvalsPath,
      });
      const cronPolicy = resolveExecApprovalsFromFile({
        file,
        agentId: "cron-job-agent",
        path: approvalsPath,
      });

      expect(mainPolicy.agent).toMatchObject({
        security: "full",
        ask: "off",
        askFallback: "full",
      });
      expect(cronPolicy.agent).toMatchObject({
        security: "full",
        ask: "off",
        askFallback: "full",
      });
      expect(
        requiresExecApproval({
          ask: mainPolicy.agent.ask,
          security: mainPolicy.agent.security,
          analysisOk: false,
          allowlistSatisfied: false,
        }),
      ).toBe(false);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
