import { describe, it, expect } from "vitest";
import { requiresExecApproval } from "../../../../vendor/openclaw/src/infra/exec-approvals.js";

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
});
