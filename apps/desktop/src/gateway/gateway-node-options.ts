export const GATEWAY_MAX_OLD_SPACE_SIZE_MB = 8192;

export function buildGatewayNodeOptions(proxySetupPath: string): string {
  const normalizedProxySetupPath = proxySetupPath.replaceAll("\\", "/");
  return [
    `--max-old-space-size=${GATEWAY_MAX_OLD_SPACE_SIZE_MB}`,
    `--require "${normalizedProxySetupPath}"`,
  ].join(" ");
}
