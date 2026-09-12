import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const VENDOR_ROOT = resolve(
  process.env.OPENCLAW_VENDOR_ROOT ?? resolve(import.meta.dirname, "../../../../vendor/openclaw"),
);

// Transaction/rollback behavior lives in vendor-patches/openclaw/tests/schema17-retirement.test.ts.
describe("upstream atomic schema-17 repair", () => {
  const source = readFileSync(
    resolve(VENDOR_ROOT, "src/state/openclaw-agent-db-schema.ts"),
    "utf8",
  );

  it("repairs additive columns before validating schema-17 indexes inside the transaction", () => {
    const transaction = source.indexOf("runSqliteImmediateTransactionSync(db,");
    const repair = source.indexOf(
      "if (previousVersion === AGENT_MEDIA_SCHEMA_VERSION)",
      transaction,
    );
    const columns = source.indexOf("ensureSessionAdditiveColumns(db)", repair);
    const indexes = source.indexOf("verifyAndRepairCanonicalSqliteIndexes(db,", columns);
    const validation = source.indexOf("assertAgentSchemaVersion(", indexes);
    const nextPhase = source.indexOf("migrateRetiredAgentStateLeaseSchema(db,", repair);
    expect(transaction).toBeGreaterThanOrEqual(0);
    expect(repair).toBeGreaterThan(transaction);
    expect(columns).toBeGreaterThan(repair);
    expect(indexes).toBeGreaterThan(columns);
    expect(validation).toBeGreaterThan(indexes);
    expect(nextPhase).toBeGreaterThan(validation);
  });

  it("keeps pre-repair validation away from the additive schema-17 path", () => {
    expect(source).toContain("if (readSqliteUserVersion(db) !== AGENT_MEDIA_SCHEMA_VERSION)");
    expect(source).toContain("maintenanceAuthority.assertAgentDatabaseMaintenanceAuthority()");
  });
});
