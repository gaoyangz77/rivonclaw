import { describe, it, expect } from "vitest";
import { detectCommandObfuscation } from "../../../vendor/openclaw/src/infra/exec-obfuscation-detect.js";
import { requiresExecApproval } from "../../../vendor/openclaw/src/infra/exec-approvals.js";

/**
 * Validates that EasyClaw's ask=off + security=full configuration works
 * correctly with obfuscation detection.
 *
 * EasyClaw configures exec.ask="off" for the Chat Page (localhost, no approval
 * UI). OpenClaw's obfuscation detector must not force approval when the admin
 * has explicitly disabled it via ask="off".
 *
 * The actual enforcement lives in the vendor patch (0003):
 *   (obfuscation.detected && hostAsk !== "off")
 */
describe("exec obfuscation + ask=off", () => {
  it("detectCommandObfuscation flags long commands", () => {
    const longCommand = "echo " + "x".repeat(11_000);
    const result = detectCommandObfuscation(longCommand);
    expect(result.detected).toBe(true);
    expect(result.matchedPatterns).toContain("command-too-long");
  });

  it("detectCommandObfuscation does not flag short safe commands", () => {
    const result = detectCommandObfuscation("echo hello");
    expect(result.detected).toBe(false);
    expect(result.matchedPatterns).toHaveLength(0);
  });

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

  it("obfuscation detection should not force approval when ask=off", () => {
    // Documents the combined behavior enforced by vendor patch 0003:
    // 1. detectCommandObfuscation correctly identifies obfuscated commands
    // 2. requiresExecApproval returns false when ask="off"
    // 3. The patch adds: (obfuscation.detected && hostAsk !== "off")
    //    so that obfuscation alone cannot override the ask=off decision.
    //
    // Simulates the patched requiresAsk logic from bash-tools.exec-host-gateway.ts:
    const hostAsk = "off" as const;
    const obfuscation = detectCommandObfuscation("echo " + "x".repeat(11_000));
    const execApprovalNeeded = requiresExecApproval({
      ask: hostAsk,
      security: "full",
      analysisOk: true,
      allowlistSatisfied: true,
    });

    expect(obfuscation.detected).toBe(true);
    expect(execApprovalNeeded).toBe(false);

    // The patched requiresAsk formula:
    const requiresAsk =
      execApprovalNeeded || (obfuscation.detected && hostAsk !== "off");
    expect(requiresAsk).toBe(false);
  });

  it("obfuscation detection still forces approval when ask is not off", () => {
    // Verify the patch does not suppress obfuscation for other ask modes.
    const hostAsk: string = "on-miss";
    const obfuscation = detectCommandObfuscation("echo " + "x".repeat(11_000));

    const requiresAsk =
      requiresExecApproval({
        ask: hostAsk as "on-miss",
        security: "full",
        analysisOk: true,
        allowlistSatisfied: true,
      }) || (obfuscation.detected && hostAsk !== "off");
    expect(requiresAsk).toBe(true);
  });
});
