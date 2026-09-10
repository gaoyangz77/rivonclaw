import { migrateVendorStateBeforeGateway, type VendorStateMigrationOptions } from "@rivonclaw/gateway";

async function run(): Promise<void> {
  if (process.env.ELECTRON_RUN_AS_NODE !== "1" || !process.send) {
    throw new Error("Vendor state migration requires a Node IPC child process");
  }
  const options = JSON.parse(process.argv[2] ?? "null") as VendorStateMigrationOptions | null;
  if (!options || typeof options.stateDir !== "string" || typeof options.vendorDir !== "string"
    || (options.configPath !== undefined && typeof options.configPath !== "string")) {
    throw new Error("Invalid vendor state migration paths");
  }
  await migrateVendorStateBeforeGateway(options);
}

function finish(result: { ok: true } | { ok: false; error: string }): void {
  const code = result.ok ? 0 : 1;
  if (process.send && process.connected) {
    // Wait for IPC to flush before exiting; vendor imports may retain timers.
    process.send(result, () => process.exit(code));
  } else {
    process.exit(code);
  }
}

void run().then(
  () => finish({ ok: true }),
  (error: unknown) => {
    const detail = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(detail);
    finish({ ok: false, error: detail });
  },
);
