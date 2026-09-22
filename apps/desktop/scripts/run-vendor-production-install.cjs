// @ts-check
//
// Runs the vendor's pnpm production install and returns only once pnpm has
// really finished.
//
// `execSync`'s `timeout` stops waiting but does not stop the install: pnpm and
// its workers keep writing to node_modules after the caller has moved on. The
// previous "verified timeout" accepted `.modules.yaml` as proof of completion,
// but pnpm writes it before linking ends. On the macOS x64 runner, where the
// install takes over two minutes, pnpm re-linked `@openclaw/ai` after
// prune-vendor-deps had materialized it, and the packaged runtime shipped
// without the package.
//
// Completion is pnpm's own "Done in" line followed by process exit. The decision
// table lives in `decideVendorInstallWait`. pnpm runs in its own process group so
// that a kill removes every worker, and this runner waits for the group to close
// before it exits, so nothing can write to node_modules afterwards.
//
// Usage:
//   node run-vendor-production-install.cjs --cwd <dir> [--deadline-ms N]
//     [--grace-ms N] -- <command> [args...]

const { spawn, spawnSync } = require("child_process");
const { PNPM_INSTALL_DONE_LINE, decideVendorInstallWait } = require("./vendor-package-manager.cjs");

const DEFAULT_DEADLINE_MS = 15 * 60_000;
const DEFAULT_GRACE_MS = 30_000;
const POLL_MS = 250;
const KILL_WAIT_MS = 30_000;
// Long enough to hold any "Done in ... using pnpm vX.Y.Z" line across chunks.
const OUTPUT_TAIL_CHARS = 512;

/** @param {string[]} argv */
function parseArgs(argv) {
  const separator = argv.indexOf("--");
  if (separator === -1 || separator === argv.length - 1) {
    throw new Error("usage: --cwd <dir> [--deadline-ms N] [--grace-ms N] -- <command> [args...]");
  }
  const options = argv.slice(0, separator);
  const [command, ...args] = argv.slice(separator + 1);
  /** @type {{ cwd?: string, deadlineMs: number, graceMs: number }} */
  const parsed = { deadlineMs: DEFAULT_DEADLINE_MS, graceMs: DEFAULT_GRACE_MS };
  for (let index = 0; index < options.length; index += 2) {
    const name = options[index];
    const value = options[index + 1];
    if (value === undefined) throw new Error(`missing value for ${name}`);
    if (name === "--cwd") parsed.cwd = value;
    else if (name === "--deadline-ms") parsed.deadlineMs = positiveInteger(name, value);
    else if (name === "--grace-ms") parsed.graceMs = positiveInteger(name, value);
    else throw new Error(`unknown option ${name}`);
  }
  if (!parsed.cwd) throw new Error("--cwd is required");
  return { cwd: parsed.cwd, deadlineMs: parsed.deadlineMs, graceMs: parsed.graceMs, command, args };
}

/** @param {string} name @param {string} value */
function positiveInteger(name, value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0)
    throw new Error(`${name} must be a positive integer`);
  return number;
}

/**
 * Resolves true once `promise` settles or false after `ms`. The timer is cleared
 * when the promise wins; a pending timer would otherwise hold the process open.
 * @param {Promise<unknown>} promise @param {number} ms @returns {Promise<boolean>}
 */
function settlesWithin(promise, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    promise.then(() => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

/** @param {number} pid */
function killProcessGroup(pid) {
  if (process.platform === "win32") {
    // Windows has no process groups to signal; taskkill /T walks the tree.
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch (error) {
    // ESRCH: every process in the group has already exited.
    if (/** @type {NodeJS.ErrnoException} */ (error).code !== "ESRCH") throw error;
  }
}

async function main() {
  const { cwd, deadlineMs, graceMs, command, args } = parseArgs(process.argv.slice(2));
  const startedAtMs = Date.now();
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
    windowsHide: true,
  });
  if (child.pid === undefined) {
    await new Promise((resolve) => child.once("error", resolve));
    throw new Error(`failed to start ${command}`);
  }
  const pid = child.pid;

  let outputTail = "";
  /** @type {number | null} */
  let doneAtMs = null;
  /** @param {NodeJS.WriteStream} stream */
  const forward = (stream) => (/** @type {Buffer} */ chunk) => {
    stream.write(chunk);
    outputTail = (outputTail + chunk.toString("utf8")).slice(-OUTPUT_TAIL_CHARS);
    if (doneAtMs === null && PNPM_INSTALL_DONE_LINE.test(outputTail)) doneAtMs = Date.now();
  };
  child.stdout.on("data", forward(process.stdout));
  child.stderr.on("data", forward(process.stderr));

  let exited = false;
  /** @type {number | null} */
  let exitCode = null;
  /** @type {Error | undefined} */
  let spawnError;
  child.once("error", (error) => {
    spawnError = error;
  });
  // `close` waits for stdio to drain, so no output is lost to the final decision.
  const closed = new Promise((resolve) =>
    child.once("close", (code) => {
      exited = true;
      exitCode = code;
      resolve(undefined);
    }),
  );

  for (;;) {
    if (spawnError) throw spawnError;
    const decision = decideVendorInstallWait({
      exited,
      exitCode,
      startedAtMs,
      doneAtMs,
      nowMs: Date.now(),
      graceMs,
      deadlineMs,
    });
    if (decision.action === "wait") {
      await settlesWithin(closed, POLL_MS);
      continue;
    }
    // On a kill decision, stop the whole group. After a clean exit, also reap the
    // group on POSIX to remove any stragglers; the group id cannot be reused while
    // a member lives. Windows has no group to target, and taskkill on an exited
    // pid could hit an unrelated process that reused it, so skip it there.
    if (decision.action === "kill" || process.platform !== "win32") killProcessGroup(pid);
    const stopped = await settlesWithin(closed, KILL_WAIT_MS);
    if (!stopped) throw new Error(`install process ${pid} did not exit after being stopped`);
    if (decision.action === "kill") {
      const log = decision.code === 0 ? console.warn : console.error;
      log(`[vendor-install] ${decision.reason}; stopped the install process group.`);
    } else if (decision.code !== 0) {
      console.error(`[vendor-install] ${decision.reason}.`);
    }
    return decision.code;
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    console.error(`[vendor-install] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  },
);
