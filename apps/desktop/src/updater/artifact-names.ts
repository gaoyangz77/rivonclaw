import { isNewerVersion } from "@rivonclaw/updater";

export const LAST_RIVONCLAW_ARTIFACT_VERSION = "1.8.79";

function artifactBrand(version: string): "RivonClaw" | "TK-Copilot" {
  return isNewerVersion(LAST_RIVONCLAW_ARTIFACT_VERSION, version) ? "TK-Copilot" : "RivonClaw";
}

export function resolveMacUpdateZipAssetName(version: string, arch: NodeJS.Architecture): string {
  const artifactArch = arch === "arm64" ? "arm64" : "x64";
  return `${artifactBrand(version)}-${version}-${artifactArch}.zip`;
}

export function resolveReleaseAssetNameFor(
  version: string,
  platform: NodeJS.Platform,
  arch: NodeJS.Architecture,
): string | null {
  const brand = artifactBrand(version);
  switch (platform) {
    case "darwin":
      return `${brand}-${version}-${arch === "arm64" ? "arm64" : "x64"}.dmg`;
    case "win32":
      return brand === "TK-Copilot"
        ? `TK-Copilot.Setup.${version}.exe`
        : `RivonClaw.Setup.${version}.exe`;
    case "linux":
      return `${brand}-${version}-${arch === "arm64" ? "arm64" : "x86_64"}.AppImage`;
    default:
      return null;
  }
}
