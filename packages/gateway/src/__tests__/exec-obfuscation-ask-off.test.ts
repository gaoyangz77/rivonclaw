import { describe, it, expect } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { requiresExecApproval } from "../../../../vendor/openclaw/dist/plugin-sdk/infra-runtime.js";
import { writeGatewayConfig } from "../config/config-writer.js";

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

  /**
   * The unattended policy used to be pushed through a host-local
   * exec-approvals.json. OpenClaw retired that store in favour of SQLite, and
   * its mere presence now hard-blocks every run with
   * ExecApprovalsMigrationRequiredError -- so the config is the only route left.
   */
  it("carries the unattended policy in tools.exec so no approval is ever required", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "rivonclaw-exec-approval-policy-test-"));
    try {
      const configPath = join(tmpDir, "openclaw.json");
      writeGatewayConfig({ configPath });
      const config = JSON.parse(readFileSync(configPath, "utf-8"));

      expect(config.tools.exec).toMatchObject({ security: "full", ask: "off" });

      // Vendor's own resolver must agree that this pair needs no approval,
      // including on an allowlist miss with failed analysis.
      expect(
        requiresExecApproval({
          ask: config.tools.exec.ask,
          security: config.tools.exec.security,
          analysisOk: false,
          allowlistSatisfied: false,
        }),
      ).toBe(false);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("never writes the retired host-local exec approvals file", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "rivonclaw-exec-approval-file-test-"));
    try {
      const configPath = join(tmpDir, "openclaw.json");
      writeGatewayConfig({ configPath });

      // Recreating this file is what put customers into a permanent
      // ExecApprovalsMigrationRequiredError loop: OpenClaw's Doctor removes it,
      // and the next gateway start wrote it straight back.
      expect(existsSync(join(tmpDir, "exec-approvals.json"))).toBe(false);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
