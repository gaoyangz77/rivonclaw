import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir, arch } from "node:os";
import { posix } from "node:path";
import { DEFAULTS } from "@rivonclaw/core";
import { createLogger } from "@rivonclaw/logger";
import type { DepName } from "./types.js";
import { getAugmentedPath } from "./dep-detector.js";
import { getMirrorEnv } from "./mirror-config.js";
import type { Region } from "./region-detector.js";

const log = createLogger("deps-provisioner");

const INSTALL_TIMEOUT = DEFAULTS.depsProvisioner.installTimeoutMs;

// ---------------------------------------------------------------------------
// Core spawn helper
// ---------------------------------------------------------------------------

interface SpawnOpts {
  env?: NodeJS.ProcessEnv;
  shell?: boolean;
  timeout?: number;
}

/** Env vars that force child processes to emit UTF-8 on Windows (GBK default). */
const UTF8_ENV: Record<string, string> =
  process.platform === "win32"
    ? { PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" }
    : {};

function spawnAsync(
  cmd: string,
  args: string[],
  onOutput: (line: string) => void,
  opts: SpawnOpts = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutMs = opts.timeout ?? INSTALL_TIMEOUT;
    let timedOut = false;
    const env = {
      ...(opts.env ?? { ...process.env, PATH: getAugmentedPath() }),
      ...UTF8_ENV,
    };
    const child = spawn(cmd, args, {
      env,
      shell: opts.shell ?? false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    const handleData = (data: Buffer): void => {
      // Replace invalid UTF-8 sequences with U+FFFD to avoid garbled output
      const text = data.toString("utf-8").replace(/\uFFFD/g, "");
      for (const line of text.split(/\r?\n/)) {
        if (line.length > 0) {
          onOutput(line);
        }
      }
    };

    child.stdout?.on("data", handleData);
    child.stderr?.on("data", handleData);

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to spawn ${cmd}: ${err.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (timedOut) {
        reject(
          new Error(
            `${cmd} timed out after ${Math.round(timeoutMs / 1000)}s. ` +
              "The installer may be waiting for confirmation or stalled while downloading.",
          ),
        );
        return;
      }
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${cmd} exited with code ${code}`));
      }
    });
  });
}

// ---------------------------------------------------------------------------
// macOS
// ---------------------------------------------------------------------------

function getBrewPrefix(): string {
  return arch() === "arm64" ? "/opt/homebrew" : "/usr/local";
}

function getBrewBin(): string {
  return posix.join(getBrewPrefix(), "bin", "brew");
}

async function ensureHomebrew(
  region: Region,
  onOutput: (line: string) => void,
): Promise<void> {
  // Check if brew is already available
  try {
    await spawnAsync(getBrewBin(), ["--version"], onOutput, {
      timeout: 10_000,
    });
    log.info("Homebrew already installed");
    return;
  } catch {
    // Not installed — proceed with installation.
  }

  log.info("Installing Homebrew");
  onOutput("Installing Homebrew...");

  const mirrorEnv = getMirrorEnv(region);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: getAugmentedPath(),
    NONINTERACTIVE: "1",
    ...mirrorEnv,
  };

  if (region === "cn") {
    onOutput("Installing Homebrew from China mirror...");
    await spawnAsync(
      "/bin/bash",
      [
        "-c",
        [
          'tmpdir="$(mktemp -d)"',
          'git clone --depth=1 https://mirrors.aliyun.com/homebrew/install.git "$tmpdir/brew-install"',
          '/bin/bash "$tmpdir/brew-install/install.sh"',
          'rm -rf "$tmpdir"',
        ].join(" && "),
      ],
      onOutput,
      { env },
    );
  } else {
    await spawnAsync(
      "/bin/bash",
      [
        "-c",
        `$(curl -fsSL ${DEFAULTS.installers.homebrew})`,
      ],
      onOutput,
      { env },
    );
  }

  // For cn region, inject mirror env vars into the user's shell profile
  if (region === "cn" && mirrorEnv) {
    await injectBrewMirrorToProfile(mirrorEnv, onOutput);
  }
}

async function injectBrewMirrorToProfile(
  mirrorEnv: Record<string, string>,
  onOutput: (line: string) => void,
): Promise<void> {
  const home = homedir();
  const profilePath = posix.join(home, ".zprofile");

  const exportLines = Object.entries(mirrorEnv)
    .map(([key, val]) => `export ${key}="${val}"`)
    .join("\n");

  const marker = "# RivonClaw Homebrew mirrors";
  const block = `\n${marker}\n${exportLines}\n`;

  try {
    let existing = "";
    try {
      existing = await readFile(profilePath, "utf-8");
    } catch {
      // File doesn't exist yet — will create.
    }

    if (existing.includes(marker)) {
      log.info("Homebrew mirror exports already in shell profile");
      return;
    }

    const { writeFile } = await import("node:fs/promises");
    await writeFile(profilePath, existing + block, "utf-8");
    onOutput("Added Homebrew mirror configuration to ~/.zprofile");
    log.info("Injected Homebrew mirror env into shell profile");
  } catch (err) {
    log.warn(`Failed to inject mirror env into profile: ${err}`);
  }
}

async function installDepMacOS(
  dep: DepName,
  region: Region,
  onOutput: (line: string) => void,
): Promise<void> {
  await ensureHomebrew(region, onOutput);

  const mirrorEnv = getMirrorEnv(region);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: getAugmentedPath(),
    ...mirrorEnv,
  };

  if (dep === "uv") {
    if (region === "cn") {
      // In China, astral.sh redirects to GitHub which is blocked by GFW.
      // Use Homebrew instead (already configured with USTC mirrors).
      onOutput("Installing uv via Homebrew...");
      await spawnAsync(getBrewBin(), ["install", "uv"], onOutput, { env });
    } else {
      onOutput("Installing uv via curl...");
      await spawnAsync(
        "/bin/bash",
        ["-c", `curl -LsSf ${DEFAULTS.installers.uvUnix} | sh`],
        onOutput,
        { env: { ...process.env, PATH: getAugmentedPath() } },
      );
    }
    return;
  }

  const brewFormula: Record<Exclude<DepName, "uv">, string> = {
    git: "git",
    python: "python@3",
    node: "node",
  };

  const formula = brewFormula[dep];
  onOutput(`Installing ${formula} via Homebrew...`);
  await spawnAsync(getBrewBin(), ["install", formula], onOutput, { env });
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

async function isWingetAvailable(): Promise<boolean> {
  try {
    await spawnAsync("where.exe", ["winget"], () => {}, {
      shell: true,
      timeout: 10_000,
    });
    return true;
  } catch {
    return false;
  }
}

const WINGET_IDS: Record<DepName, string> = {
  git: "Git.Git",
  python: "Python.Python.3.12",
  node: "OpenJS.NodeJS.LTS",
  uv: "astral-sh.uv",
};

const GIT_FOR_WINDOWS_CN_RELEASE = "v2.54.0.windows.1";
const GIT_FOR_WINDOWS_CN_VERSION = "2.54.0";
const GIT_FOR_WINDOWS_CN_MIRROR_BASE =
  `https://repo.huaweicloud.com/git-for-windows/${GIT_FOR_WINDOWS_CN_RELEASE}`;

const GIT_FOR_WINDOWS_CN_INSTALLERS = {
  x64: {
    fileName: `Git-${GIT_FOR_WINDOWS_CN_VERSION}-64-bit.exe`,
    sha256: "2B96E7854F0520F0F6B709C21041D9801B1BE44D5E1A0D9FA621B2FBC40F1983",
  },
  arm64: {
    fileName: `Git-${GIT_FOR_WINDOWS_CN_VERSION}-arm64.exe`,
    sha256: "97BF63E5C65152C14B488E191C107AA1CCBEAE2435690693241BE4B2B5EDD0D2",
  },
} as const;

const NODE_WINDOWS_CN_VERSION = "24.16.0";
const NODE_WINDOWS_CN_MIRROR_BASE =
  `https://mirrors.huaweicloud.com/nodejs/v${NODE_WINDOWS_CN_VERSION}`;

const PYTHON_WINDOWS_CN_VERSION = "3.13.13";
const PYTHON_WINDOWS_CN_MIRROR_BASE =
  `https://mirrors.huaweicloud.com/python/${PYTHON_WINDOWS_CN_VERSION}`;

const PYTHON_WINDOWS_CN_INSTALLERS = {
  x64: {
    fileName: `python-${PYTHON_WINDOWS_CN_VERSION}-amd64.exe`,
    sha256: "3C9C81D80F91C002CED86D645422D81432C68C7D9B6B0E974768CA2E449A4D00",
  },
  arm64: {
    fileName: `python-${PYTHON_WINDOWS_CN_VERSION}-arm64.exe`,
    sha256: "7925FC1D40DC75379AE70EDE7A6217FAF5549BB93CA89A3EA519185D8BC657BF",
  },
} as const;

function quotePowerShellString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function getGitForWindowsCnInstaller(): {
  fileName: string;
  sha256: string;
  url: string;
} {
  const installer =
    arch() === "arm64"
      ? GIT_FOR_WINDOWS_CN_INSTALLERS.arm64
      : GIT_FOR_WINDOWS_CN_INSTALLERS.x64;

  return {
    ...installer,
    url: `${GIT_FOR_WINDOWS_CN_MIRROR_BASE}/${installer.fileName}`,
  };
}

async function installGitWindowsFromChinaMirror(
  onOutput: (line: string) => void,
): Promise<void> {
  const installer = getGitForWindowsCnInstaller();
  onOutput(`Installing git from China mirror (${installer.fileName})...`);

  const tempFileName = `RivonClaw-${installer.fileName}`;
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12",
    `$url = ${quotePowerShellString(installer.url)}`,
    `$out = Join-Path $env:TEMP ${quotePowerShellString(tempFileName)}`,
    `Write-Output ${quotePowerShellString(`Downloading ${installer.fileName} from Huawei Cloud mirror...`)}`,
    "Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing",
    `$expected = ${quotePowerShellString(installer.sha256)}`,
    "$actual = (Get-FileHash -Algorithm SHA256 $out).Hash.ToUpperInvariant()",
    'if ($actual -ne $expected) { throw "Git installer SHA256 mismatch: expected $expected, got $actual" }',
    `Write-Output ${quotePowerShellString("Installing Git for Windows silently...")}`,
    "$arguments = @('/SP-', '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/CURRENTUSER')",
    "$process = Start-Process -FilePath $out -ArgumentList $arguments -Wait -PassThru",
    'if ($process.ExitCode -ne 0) { throw "Git installer exited with code $($process.ExitCode)" }',
    "Remove-Item $out -Force -ErrorAction SilentlyContinue",
  ].join("; ");

  await spawnAsync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    onOutput,
    { shell: true },
  );
}

function getNodeWindowsCnInstaller(): {
  fileName: string;
  url: string;
} {
  const archName = arch() === "arm64" ? "arm64" : "x64";
  const fileName = `node-v${NODE_WINDOWS_CN_VERSION}-${archName}.msi`;
  return {
    fileName,
    url: `${NODE_WINDOWS_CN_MIRROR_BASE}/${fileName}`,
  };
}

async function installNodeWindowsFromChinaMirror(
  onOutput: (line: string) => void,
): Promise<void> {
  const installer = getNodeWindowsCnInstaller();
  onOutput(`Installing node from China mirror (${installer.fileName})...`);

  const tempFileName = `RivonClaw-${installer.fileName}`;
  const shasumsUrl = `${NODE_WINDOWS_CN_MIRROR_BASE}/SHASUMS256.txt`;
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12",
    `$url = ${quotePowerShellString(installer.url)}`,
    `$shasumsUrl = ${quotePowerShellString(shasumsUrl)}`,
    `$fileName = ${quotePowerShellString(installer.fileName)}`,
    `$out = Join-Path $env:TEMP ${quotePowerShellString(tempFileName)}`,
    `Write-Output ${quotePowerShellString(`Downloading ${installer.fileName} from Huawei Cloud mirror...`)}`,
    "$shasums = (Invoke-WebRequest -Uri $shasumsUrl -UseBasicParsing).Content",
    "$line = ($shasums -split \"`n\" | Where-Object { $_.Trim().EndsWith($fileName) } | Select-Object -First 1)",
    'if (-not $line) { throw "Cannot find SHA256 entry for $fileName" }',
    "$expected = ($line.Trim() -split '\\s+')[0].ToUpperInvariant()",
    "Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing",
    "$actual = (Get-FileHash -Algorithm SHA256 $out).Hash.ToUpperInvariant()",
    'if ($actual -ne $expected) { throw "Node installer SHA256 mismatch: expected $expected, got $actual" }',
    `Write-Output ${quotePowerShellString("Installing Node.js silently...")}`,
    "$arguments = @('/i', $out, '/qn', '/norestart', 'ALLUSERS=2', 'MSIINSTALLPERUSER=1')",
    "$process = Start-Process -FilePath 'msiexec.exe' -ArgumentList $arguments -Wait -PassThru",
    'if ($process.ExitCode -ne 0) { throw "Node installer exited with code $($process.ExitCode)" }',
    "Remove-Item $out -Force -ErrorAction SilentlyContinue",
  ].join("; ");

  await spawnAsync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    onOutput,
    { shell: true },
  );
}

function getPythonWindowsCnInstaller(): {
  fileName: string;
  sha256: string;
  url: string;
} {
  const installer =
    arch() === "arm64"
      ? PYTHON_WINDOWS_CN_INSTALLERS.arm64
      : PYTHON_WINDOWS_CN_INSTALLERS.x64;

  return {
    ...installer,
    url: `${PYTHON_WINDOWS_CN_MIRROR_BASE}/${installer.fileName}`,
  };
}

async function installPythonWindowsFromChinaMirror(
  onOutput: (line: string) => void,
): Promise<void> {
  const installer = getPythonWindowsCnInstaller();
  onOutput(`Installing python from China mirror (${installer.fileName})...`);

  const tempFileName = `RivonClaw-${installer.fileName}`;
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12",
    `$url = ${quotePowerShellString(installer.url)}`,
    `$out = Join-Path $env:TEMP ${quotePowerShellString(tempFileName)}`,
    `Write-Output ${quotePowerShellString(`Downloading ${installer.fileName} from Huawei Cloud mirror...`)}`,
    "Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing",
    `$expected = ${quotePowerShellString(installer.sha256)}`,
    "$actual = (Get-FileHash -Algorithm SHA256 $out).Hash.ToUpperInvariant()",
    'if ($actual -ne $expected) { throw "Python installer SHA256 mismatch: expected $expected, got $actual" }',
    `Write-Output ${quotePowerShellString("Installing Python silently...")}`,
    "$arguments = @('/quiet', 'InstallAllUsers=0', 'PrependPath=1', 'Include_launcher=1', 'Include_pip=1')",
    "$process = Start-Process -FilePath $out -ArgumentList $arguments -Wait -PassThru",
    'if ($process.ExitCode -ne 0) { throw "Python installer exited with code $($process.ExitCode)" }',
    "Remove-Item $out -Force -ErrorAction SilentlyContinue",
  ].join("; ");

  await spawnAsync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    onOutput,
    { shell: true },
  );
}

async function installDepWindows(
  dep: DepName,
  region: Region,
  onOutput: (line: string) => void,
): Promise<void> {
  if (region === "cn") {
    if (dep === "git") {
      await installGitWindowsFromChinaMirror(onOutput);
      return;
    }
    if (dep === "python") {
      await installPythonWindowsFromChinaMirror(onOutput);
      return;
    }
    if (dep === "node") {
      await installNodeWindowsFromChinaMirror(onOutput);
      return;
    }
    if (dep === "uv") {
      onOutput("Installing uv via pip...");
      await spawnAsync("pip", ["install", "uv"], onOutput, { shell: true });
      return;
    }
  }

  const hasWinget = await isWingetAvailable();

  if (hasWinget) {
    const wingetId = WINGET_IDS[dep];
    onOutput(`Installing ${dep} via winget (${wingetId})...`);
    await spawnAsync(
      "winget",
      [
        "install",
        "--id",
        wingetId,
        "-e",
        "--source",
        "winget",
        "--accept-package-agreements",
        "--accept-source-agreements",
        "--disable-interactivity",
      ],
      onOutput,
      { shell: true },
    );
    return;
  }

  // Winget not available — fallback for uv only
  if (dep === "uv") {
    if (region === "cn") {
      // astral.sh redirects to GitHub, blocked by GFW. Use pip as fallback.
      onOutput("Installing uv via pip...");
      await spawnAsync("pip", ["install", "uv"], onOutput, { shell: true });
    } else {
      onOutput("Installing uv via PowerShell...");
      await spawnAsync(
        "powershell",
        [
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          `irm ${DEFAULTS.installers.uvWindows} | iex`,
        ],
        onOutput,
        { shell: true },
      );
    }
    return;
  }

  throw new Error(
    `Cannot install ${dep}: winget is not available. ` +
      `Please install ${dep} manually, or update Windows to a version that includes winget (App Installer). ` +
      `You can get winget from the Microsoft Store: ${DEFAULTS.installers.winget}`,
  );
}

// ---------------------------------------------------------------------------
// Linux
// ---------------------------------------------------------------------------

type PkgManager = "apt-get" | "dnf" | "pacman";

const APT_DISTROS = new Set([
  "ubuntu",
  "debian",
  "linuxmint",
  "pop",
]);
const DNF_DISTROS = new Set([
  "fedora",
  "rhel",
  "centos",
  "rocky",
  "alma",
]);
const PACMAN_DISTROS = new Set([
  "arch",
  "manjaro",
  "endeavouros",
]);

async function detectPkgManager(): Promise<PkgManager> {
  let content: string;
  try {
    content = await readFile("/etc/os-release", "utf-8");
  } catch {
    throw new Error(
      "Cannot detect Linux distribution: /etc/os-release not found",
    );
  }

  const idMatch = content.match(/^ID=["']?([a-z_-]+)["']?/m);
  const distroId = idMatch?.[1] ?? "";

  if (APT_DISTROS.has(distroId)) return "apt-get";
  if (DNF_DISTROS.has(distroId)) return "dnf";
  if (PACMAN_DISTROS.has(distroId)) return "pacman";

  throw new Error(
    `Unsupported Linux distribution: ${distroId}. ` +
      `Supported: Ubuntu, Debian, Linux Mint, Pop!_OS, Fedora, RHEL, CentOS, Rocky, Alma, Arch, Manjaro, EndeavourOS.`,
  );
}

const LINUX_PACKAGES: Record<
  PkgManager,
  Record<Exclude<DepName, "uv">, string[]>
> = {
  "apt-get": {
    git: ["git"],
    python: ["python3"],
    node: ["nodejs", "npm"],
  },
  dnf: {
    git: ["git"],
    python: ["python3"],
    node: ["nodejs", "npm"],
  },
  pacman: {
    git: ["git"],
    python: ["python"],
    node: ["nodejs", "npm"],
  },
};

async function getSudoPrefix(
  onOutput: (line: string) => void,
): Promise<string> {
  // Prefer pkexec for graphical sudo prompt
  try {
    await spawnAsync("which", ["pkexec"], () => {}, { timeout: 5_000 });
    return "pkexec";
  } catch {
    // Fall back to sudo
    onOutput("pkexec not found, falling back to sudo");
    return "sudo";
  }
}

function buildInstallArgs(
  pkgMgr: PkgManager,
  packages: string[],
): string[] {
  switch (pkgMgr) {
    case "apt-get":
      return ["apt-get", "install", "-y", ...packages];
    case "dnf":
      return ["dnf", "install", "-y", ...packages];
    case "pacman":
      return ["pacman", "-S", "--noconfirm", ...packages];
  }
}

async function installDepLinux(
  dep: DepName,
  region: Region,
  onOutput: (line: string) => void,
): Promise<void> {
  if (dep === "uv") {
    if (region === "cn") {
      // astral.sh redirects to GitHub, blocked by GFW. Use pip as fallback.
      onOutput("Installing uv via pip...");
      await spawnAsync("pip3", ["install", "uv"], onOutput);
    } else {
      onOutput("Installing uv via curl...");
      await spawnAsync(
        "/bin/bash",
        ["-c", `curl -LsSf ${DEFAULTS.installers.uvUnix} | sh`],
        onOutput,
      );
    }
    return;
  }

  const pkgMgr = await detectPkgManager();
  const packages = LINUX_PACKAGES[pkgMgr][dep];
  const sudoCmd = await getSudoPrefix(onOutput);
  const installArgs = buildInstallArgs(pkgMgr, packages);

  onOutput(`Installing ${packages.join(", ")} via ${pkgMgr}...`);
  await spawnAsync(sudoCmd, installArgs, onOutput);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function installDep(
  dep: DepName,
  platform: NodeJS.Platform,
  region: Region,
  onOutput: (line: string) => void,
): Promise<void> {
  log.info(`Installing ${dep} on ${platform} (region: ${region})`);

  switch (platform) {
    case "darwin":
      await installDepMacOS(dep, region, onOutput);
      break;
    case "win32":
      await installDepWindows(dep, region, onOutput);
      break;
    case "linux":
      await installDepLinux(dep, region, onOutput);
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  log.info(`Successfully installed ${dep}`);
}
