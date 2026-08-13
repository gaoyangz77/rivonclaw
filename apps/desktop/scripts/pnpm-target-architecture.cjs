// @ts-check

const fs = require("fs");

/**
 * Temporarily asks pnpm to install optional dependencies for a target CPU in
 * addition to the current host. The original workspace file is always
 * restored so packaging cannot leave the canonical vendor checkout modified.
 *
 * @param {{
 *   workspacePath: string,
 *   targetArch: "arm64" | "x64",
 *   yaml: { parse(source: string): any, stringify(value: any): string },
 *   run: () => any,
 * }} options
 */
function withPnpmTargetArchitecture({ workspacePath, targetArch, yaml, run }) {
  const originalWorkspace = fs.readFileSync(workspacePath, "utf-8");
  const workspace = yaml.parse(originalWorkspace) ?? {};
  workspace.supportedArchitectures = {
    ...workspace.supportedArchitectures,
    os: ["current"],
    cpu: ["current", targetArch],
    libc: ["current"],
  };

  fs.writeFileSync(workspacePath, yaml.stringify(workspace));
  try {
    return run();
  } finally {
    fs.writeFileSync(workspacePath, originalWorkspace);
  }
}

module.exports = { withPnpmTargetArchitecture };
