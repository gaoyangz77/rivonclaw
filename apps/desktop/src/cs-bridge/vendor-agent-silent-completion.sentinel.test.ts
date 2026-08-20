import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0030-vendor-openclaw-expose-silent-completion-for-agent-rpc.patch",
);

describe("vendor patch 0030: agent RPC silent completion", () => {
  const patch = readFileSync(PATCH_FILE, "utf-8");

  it("adds a strict optional Gateway agent parameter", () => {
    expect(patch).toContain("+  allowEmptyAssistantReplyAsSilent: Type.Optional(Type.Boolean()),");
    expect(patch).toContain('it("accepts only boolean silent empty-reply overrides"');
  });

  it("forwards the option through Gateway command execution", () => {
    expect(patch).toContain(
      "+          allowEmptyAssistantReplyAsSilent: params.request.allowEmptyAssistantReplyAsSilent,",
    );
    expect(patch).toContain(
      "+      params.opts.allowEmptyAssistantReplyAsSilent === true || isSubagentAnnounceHandoff,",
    );
  });

  it("carries vendor tests for both forwarding boundaries", () => {
    expect(patch).toContain(
      "diff --git a/src/gateway/server-methods/agent.events-and-subagents.test-utils.ts b/src/gateway/server-methods/agent.events-and-subagents.test-utils.ts",
    );
    expect(patch).toContain(
      "diff --git a/src/agents/command/attempt-execution.cli.test.ts b/src/agents/command/attempt-execution.cli.test.ts",
    );
    expect(patch).toContain("allowEmptyAssistantReplyAsSilent: true");
  });
});
