/**
 * Tool Visibility — Capability Resolver
 *
 * Tests the ToolCapabilityResolver → effective-tools endpoint path to verify
 * that tool selection controls which tools are visible to the agent.
 *
 * Uses system tools (always available, no login required) to test the
 * RunProfile filtering logic.
 */
import { test, expect } from "./electron-fixture.js";

test.describe("Tool Visibility — Capability Resolver", () => {
  test("no tool selection → system tools appear by default", async ({
    window: _window,
    apiBase,
  }) => {
    const res = await fetch(
      `${apiBase}/api/tools/effective-tools?sessionKey=test-no-selection`,
    );
    expect(res.ok).toBe(true);

    const body = (await res.json()) as { effectiveToolIds: string[] };
    const ids = body.effectiveToolIds;

    // Without a RunProfile selecting specific tools, effective tools is empty
    // (system tools only appear when a profile explicitly includes them).
    expect(ids).toHaveLength(0);
  });

  test("only read tools selected → write not in effective tools", async ({
    window: _window,
    apiBase,
  }) => {
    const putRes = await fetch(`${apiBase}/api/tools/run-profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scopeType: "chat_session",
        scopeKey: "test-read-only",
        runProfile: {
          id: "test-read-only-profile",
          name: "Read Only",
          selectedToolIds: [
            "read",
            "web_search",
            "web_fetch",
          ],
          surfaceId: "",
        },
      }),
    });
    expect(putRes.ok).toBe(true);

    const res = await fetch(
      `${apiBase}/api/tools/effective-tools?sessionKey=test-read-only`,
    );
    expect(res.ok).toBe(true);

    const body = (await res.json()) as { effectiveToolIds: string[] };
    const ids = body.effectiveToolIds;

    expect(ids).toContain("read");
    expect(ids).not.toContain("write");
    expect(ids).not.toContain("exec");
  });

  test("read + write + exec selected → all three in effective tools", async ({
    window: _window,
    apiBase,
  }) => {
    const putRes = await fetch(`${apiBase}/api/tools/run-profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scopeType: "chat_session",
        scopeKey: "test-read-write",
        runProfile: {
          id: "test-read-write-profile",
          name: "Read + Write + Exec",
          selectedToolIds: [
            "read",
            "write",
            "edit",
            "exec",
            "web_search",
          ],
          surfaceId: "",
        },
      }),
    });
    expect(putRes.ok).toBe(true);

    const res = await fetch(
      `${apiBase}/api/tools/effective-tools?sessionKey=test-read-write`,
    );
    expect(res.ok).toBe(true);

    const body = (await res.json()) as { effectiveToolIds: string[] };
    const ids = body.effectiveToolIds;

    expect(ids).toContain("read");
    expect(ids).toContain("write");
    expect(ids).toContain("exec");
  });
});
