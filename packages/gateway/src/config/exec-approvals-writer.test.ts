import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { syncExecApprovalsYolo } from "./exec-approvals-writer.js";

describe("exec-approvals-writer", () => {
  let tmpDir: string;
  let approvalsPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "rivonclaw-exec-approvals-test-"));
    approvalsPath = join(tmpDir, ".openclaw", "exec-approvals.json");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes unattended defaults and wildcard policy", () => {
    syncExecApprovalsYolo({ approvalsPath });

    const config = JSON.parse(readFileSync(approvalsPath, "utf-8"));
    expect(config.defaults).toEqual({
      security: "full",
      ask: "off",
      askFallback: "full",
    });
    expect(config.agents["*"]).toEqual({
      security: "full",
      ask: "off",
      askFallback: "full",
    });
    expect(config.socket.path).toBe(join(tmpDir, ".openclaw", "exec-approvals.sock"));
    expect(typeof config.socket.token).toBe("string");
    expect(config.socket.token.length).toBeGreaterThan(0);
  });

  it("preserves socket metadata and allowlists while overriding stricter agent policy", () => {
    mkdirSync(join(tmpDir, ".openclaw"), { recursive: true });
    writeFileSync(
      approvalsPath,
      JSON.stringify({
        version: 1,
        socket: {
          path: "/tmp/custom.sock",
          token: "existing-token",
        },
        defaults: {
          security: "allowlist",
          ask: "on-miss",
          askFallback: "deny",
          autoAllowSkills: true,
        },
        agents: {
          main: {
            security: "allowlist",
            ask: "always",
            askFallback: "deny",
            allowlist: [{ id: "a", pattern: "/bin/python" }],
          },
        },
      }),
      "utf-8",
    );

    syncExecApprovalsYolo({ approvalsPath });

    const config = JSON.parse(readFileSync(approvalsPath, "utf-8"));
    expect(config.socket).toEqual({ path: "/tmp/custom.sock", token: "existing-token" });
    expect(config.defaults).toMatchObject({
      security: "full",
      ask: "off",
      askFallback: "full",
      autoAllowSkills: true,
    });
    expect(config.agents.main).toMatchObject({
      security: "full",
      ask: "off",
      askFallback: "full",
      allowlist: [{ id: "a", pattern: "/bin/python" }],
    });
    expect(config.agents["*"]).toMatchObject({
      security: "full",
      ask: "off",
      askFallback: "full",
    });
  });

});
