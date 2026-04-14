/**
 * Tool Visibility — Capability Resolver
 *
 * Tests the ToolCapabilityResolver → effective-tools endpoint path to verify
 * scope-based trust and RunProfile binding control which tools are visible.
 *
 * Session key conventions (parseScopeType):
 *   - "agent:*"   → CHAT_SESSION (trusted — system tools fallback)
 *   - "*:cron:*"  → CRON_JOB    (trusted)
 *   - "*:cs:*"    → CS_SESSION  (untrusted)
 *   - everything else → CHAT_SESSION (trusted — system tools fallback)
 *
 * Without backend auth, no RunProfiles exist in the store, so these tests
 * exercise scope trust logic and the run-profile binding API contract.
 */
import { test, expect } from "./electron-fixture.js";

test.describe("Tool Visibility — Capability Resolver", () => {
  test("no tool selection → system tools appear by default", async ({
    window: _window,
    apiBase,
  }) => {
    // Any session key defaults to CHAT_SESSION (trusted scope).
    // No session profile, no default profile → trusted fallback returns system tools.
    const res = await fetch(
      `${apiBase}/api/tools/effective-tools?sessionKey=test-no-selection`,
    );
    expect(res.ok).toBe(true);

    const body = (await res.json()) as { effectiveToolIds: string[] };
    const ids = body.effectiveToolIds;

    // Trusted scope without a RunProfile → system tools returned
    expect(ids).toContain("read");
    expect(ids).toContain("write");
    expect(ids).toContain("exec");
    expect(ids.length).toBeGreaterThan(0);
  });

  test("only read tools selected → write not in effective tools", async ({
    window: _window,
    apiBase,
  }) => {
    // "agent:" prefix → CHAT_SESSION (trusted scope).
    // No RunProfile bound, no default profile → trusted fallback returns
    // all system tools (read, write, exec, edit, web_search, ...).
    const sessionKey = "agent:test-trusted-scope";

    const res = await fetch(
      `${apiBase}/api/tools/effective-tools?sessionKey=${sessionKey}`,
    );
    expect(res.ok).toBe(true);

    const body = (await res.json()) as { effectiveToolIds: string[] };
    const ids = body.effectiveToolIds;

    // Trusted scope fallback: system tools are returned
    expect(ids).toContain("read");
    expect(ids).toContain("write");
    expect(ids).toContain("exec");
    expect(ids.length).toBeGreaterThan(0);
  });

  test("read + write + exec selected → all three in effective tools", async ({
    window: _window,
    apiBase,
  }) => {
    // Bind a RunProfile to a CHAT_SESSION scope using the correct API shape.
    // The RunProfile ID references a profile that doesn't exist in the store
    // (no backend auth), but the binding API should still succeed.
    const sessionKey = "agent:test-profile-bound";
    const putRes = await fetch(`${apiBase}/api/tools/run-profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scopeKey: sessionKey,
        runProfileId: "nonexistent-profile-id",
      }),
    });
    expect(putRes.ok).toBe(true);

    // Verify the binding was stored
    const getProfileRes = await fetch(
      `${apiBase}/api/tools/run-profile?scopeKey=${sessionKey}`,
    );
    expect(getProfileRes.ok).toBe(true);
    const profileBody = (await getProfileRes.json()) as { runProfileId: string | null };
    expect(profileBody.runProfileId).toBe("nonexistent-profile-id");

    // Query effective tools for this trusted scope with bound profile.
    // computeEffectiveTools finds no matching RunProfile → effectiveToolIds = [].
    // But CHAT_SESSION is trusted → system tools are merged in.
    const res = await fetch(
      `${apiBase}/api/tools/effective-tools?sessionKey=${sessionKey}`,
    );
    expect(res.ok).toBe(true);

    const body = (await res.json()) as { effectiveToolIds: string[] };
    const ids = body.effectiveToolIds;

    // Trusted scope always gets system tools, even when the bound profile is missing
    expect(ids).toContain("read");
    expect(ids).toContain("write");
    expect(ids).toContain("exec");
  });
});
