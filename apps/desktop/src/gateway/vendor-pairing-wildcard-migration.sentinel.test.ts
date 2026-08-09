import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATION_FILE = resolve(
  __dirname,
  "../../../../vendor/openclaw/src/infra/state-migrations.channel-pairing.ts",
);
const DOCTOR_FILE = resolve(
  __dirname,
  "../../../../vendor/openclaw/src/infra/state-migrations.doctor.ts",
);

describe("upstream wildcard pairing migration", () => {
  const migrationSource = readFileSync(MIGRATION_FILE, "utf-8");
  const doctorSource = readFileSync(DOCTOR_FILE, "utf-8");

  it("does not treat wildcard route bindings as concrete pairing accounts", () => {
    expect(doctorSource).toContain("resolveConcreteBindingAccountId");
    expect(doctorSource).toContain('accountId !== "*"');
  });

  it("keeps one invalid account candidate from aborting the migration", () => {
    expect(migrationSource).toContain(
      "One invalid configured candidate must not abort every legacy migration",
    );
    expect(migrationSource).toContain("safeAccountKey(accountId)");
  });
});
