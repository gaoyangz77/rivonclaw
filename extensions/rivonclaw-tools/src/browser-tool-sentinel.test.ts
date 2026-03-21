import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { createHash } from "crypto";
import { resolve } from "path";

/**
 * Sentinel test: detects when OpenClaw upstream changes the hardcoded
 * browser tool description. When this test fails, our override in
 * browser-mode-context.ts likely needs updating.
 */

const EXPECTED_HASH =
  "e1ee7144c7e5645060462a42f083be83d70feb067a57cea09a4fb8ed8e531351";

const VENDOR_FILE = resolve(
  __dirname,
  "../../../vendor/openclaw/src/agents/tools/browser-tool.ts",
);

function extractDescriptionArray(source: string): string | null {
  const match = source.match(/description: \[[\s\S]*?\]\.join\(" "\)/);
  return match ? match[0] : null;
}

describe("browser tool description sentinel", () => {
  const source = readFileSync(VENDOR_FILE, "utf-8");
  const descriptionSource = extractDescriptionArray(source);

  it("can extract the description array from the vendor source", () => {
    expect(
      descriptionSource,
      `Could not extract description array from ${VENDOR_FILE}. ` +
        "The file structure may have changed significantly.",
    ).not.toBeNull();
  });

  it('contains sentinel string: profile="user"', () => {
    expect(
      descriptionSource,
      formatSentinelMessage(
        'Missing sentinel string profile="user"',
        descriptionSource,
      ),
    ).toContain('profile="user"');
  });

  it('contains sentinel string: profile="chrome-relay"', () => {
    expect(
      descriptionSource,
      formatSentinelMessage(
        'Missing sentinel string profile="chrome-relay"',
        descriptionSource,
      ),
    ).toContain('profile="chrome-relay"');
  });

  it("contains sentinel string: Browser Relay", () => {
    expect(
      descriptionSource,
      formatSentinelMessage(
        "Missing sentinel string 'Browser Relay'",
        descriptionSource,
      ),
    ).toContain("Browser Relay");
  });

  it("matches the expected SHA-256 hash", () => {
    const actualHash = createHash("sha256")
      .update(descriptionSource!)
      .digest("hex");

    expect(actualHash, formatHashFailureMessage(actualHash)).toBe(
      EXPECTED_HASH,
    );
  });
});

function formatHashFailureMessage(actualHash: string): string {
  return `
=== BROWSER TOOL DESCRIPTION SENTINEL FAILURE ===

The upstream OpenClaw browser tool description has changed.
File: vendor/openclaw/src/agents/tools/browser-tool.ts

RivonClaw overrides this description via prependContext in:
  extensions/rivonclaw-tools/src/browser-mode-context.ts

Upstream PR tracking this issue:
  https://github.com/openclaw/openclaw/pull/40350

Action required:
1. Check if PR #40350 has been merged — if so, the upstream now generates
   dynamic descriptions and our override in browser-mode-context.ts may
   no longer be needed. Consider removing the override entirely.
2. If the change is unrelated to #40350, read the new description in the
   vendor file and update browser-mode-context.ts if the override needs
   adjustment (e.g., new profiles, changed profile names, new instructions
   to suppress).
3. Update the EXPECTED_HASH in this test file to the new hash.
4. Run this test again to confirm it passes.

Current hash: ${actualHash}
Expected hash: ${EXPECTED_HASH}
=== END SENTINEL ===`;
}

function formatSentinelMessage(
  reason: string,
  description: string | null,
): string {
  return `
=== BROWSER TOOL DESCRIPTION SENTINEL FAILURE ===

${reason}
File: vendor/openclaw/src/agents/tools/browser-tool.ts

RivonClaw overrides this description via prependContext in:
  extensions/rivonclaw-tools/src/browser-mode-context.ts

Upstream PR tracking this issue:
  https://github.com/openclaw/openclaw/pull/40350

Action required:
1. Check if PR #40350 has been merged — if so, the upstream now generates
   dynamic descriptions and our override in browser-mode-context.ts may
   no longer be needed. Consider removing the override entirely.
2. If the change is unrelated to #40350, read the new description in the
   vendor file and update browser-mode-context.ts if the override needs
   adjustment (e.g., new profiles, changed profile names, new instructions
   to suppress).
3. Update the EXPECTED_HASH in this test file to the new hash.
4. Run this test again to confirm it passes.

Current description source:
${description ?? "(could not extract)"}
=== END SENTINEL ===`;
}
