#!/usr/bin/env node
// Adds a bounded wait to @electron/notarize's `xcrun notarytool submit --wait`.

const { spawn } = require("child_process");

const args = process.argv.slice(2);
const timeoutSeconds = process.env.NOTARIZE_TIMEOUT_SECONDS;

if (
  timeoutSeconds &&
  args[0] === "submit" &&
  args.includes("--wait") &&
  !args.includes("--timeout")
) {
  args.push("--timeout", `${timeoutSeconds}s`);
  console.error(`[notarytool-wrapper] Added --timeout ${timeoutSeconds}s`);
}

const child = spawn("xcrun", ["notarytool", ...args], {
  stdio: ["ignore", "pipe", "pipe"],
});

child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);

child.on("error", (err) => {
  console.error(`[notarytool-wrapper] Failed to launch xcrun notarytool: ${err.message}`);
  process.exit(1);
});

child.on("close", (code, signal) => {
  if (signal) {
    console.error(`[notarytool-wrapper] xcrun notarytool exited from signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
