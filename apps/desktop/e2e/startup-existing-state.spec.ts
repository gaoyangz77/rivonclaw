import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect, getCurrentTempDir } from "./electron-fixture.js";

test.use({ restartWithExistingState: true });

test("restarts with existing SQLite state and reaches Gateway ready", async ({ electronApp, window }) => {
  await expect(window.locator(".chat-status-dot-connected")).toBeVisible();
  expect(await window.title()).toBe("TK Copilot");
  expect(await electronApp.evaluate(() => process.env.ELECTRON_RUN_AS_NODE)).not.toBe("1");
  const log = readFileSync(join(getCurrentTempDir()!, "logs", "rivonclaw.log"), "utf8");
  expect(log.match(/Vendor state migration completed in /g)?.length).toBeGreaterThanOrEqual(2);
  expect(log).not.toContain("SQLite read-only worker returned no JSON result");
});

test.setTimeout(120_000);
