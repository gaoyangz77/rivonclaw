import { fork, type ForkOptions, type SpawnOptions } from "node:child_process";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { createLogger } from "@rivonclaw/logger";
import type { VendorStateMigrationOptions } from "@rivonclaw/gateway";
import { DESKTOP_RESTART_RECOVERY_ENV } from "./restart-recovery-policy.js";

const log = createLogger("vendor-state-migration");

/** Keep vendor's synchronous SQLite workers out of Electron's UI process. */
export async function migrateVendorStateInChild(
  options: VendorStateMigrationOptions,
): Promise<void> {
  const startedAt = Date.now();
  const workerPath = join(dirname(fileURLToPath(import.meta.url)), "vendor-state-migration-worker.cjs");
  log.info("Starting vendor state migration in Node child process");

  await new Promise<void>((resolve, reject) => {
    const childOptions: ForkOptions & Pick<SpawnOptions, "windowsHide"> = {
      execArgv: [],
      env: { ...process.env, ...DESKTOP_RESTART_RECOVERY_ENV, ELECTRON_RUN_AS_NODE: "1" },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
      windowsHide: true,
    };
    const child = fork(workerPath, [JSON.stringify(options)], childOptions);
    let completed = false;
    let failure: string | undefined;
    const output = createInterface({ input: child.stdout! });
    const errors = createInterface({ input: child.stderr! });
    output.on("line", (line) => log.info(line));
    errors.on("line", (line) => log.warn(line));

    const progress = setInterval(() => {
      log.info(`Vendor state migration still running (${Math.round((Date.now() - startedAt) / 1000)}s)`);
    }, 10_000);
    const stopChild = () => { child.kill(); };
    process.once("exit", stopChild);
    child.on("message", (message: unknown) => {
      if (!message || typeof message !== "object") return;
      const result = message as { ok?: unknown; error?: unknown };
      if (result.ok === true) completed = true;
      if (result.ok === false && typeof result.error === "string") failure = result.error;
    });
    child.once("error", (error) => { failure = error.message; });
    child.once("close", (code, signal) => {
      clearInterval(progress);
      process.removeListener("exit", stopChild);
      output.close();
      errors.close();
      if (code === 0 && completed && !failure) {
        resolve();
      } else {
        const detail = failure ?? `exit=${code} signal=${signal ?? "none"}, completed=${completed}`;
        reject(new Error(`Vendor state migration failed: ${detail}`));
      }
    });
  }).catch((error: unknown) => {
    log.error(`Vendor state migration failed after ${Date.now() - startedAt}ms`, error);
    throw error;
  });

  log.info(`Vendor state migration completed in ${Date.now() - startedAt}ms`);
}
