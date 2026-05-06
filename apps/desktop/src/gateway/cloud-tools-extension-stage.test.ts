import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stageMerchantExtensionsForCloudTools } from "./cloud-tools-extension-stage.js";

const tmpRoots: string[] = [];

function makeTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "rivonclaw-cloud-tools-stage-"));
  tmpRoots.push(root);
  return root;
}

function writeCloudToolsFixture(merchantDir: string): void {
  const cloudDir = join(merchantDir, "rivonclaw-cloud-tools");
  mkdirSync(join(cloudDir, "dist"), { recursive: true });
  writeFileSync(join(cloudDir, "package.json"), JSON.stringify({
    name: "@rivonclaw/rivonclaw-cloud-tools",
    type: "module",
    openclaw: { extensions: ["./dist/rivonclaw-cloud-tools.mjs"] },
  }, null, 2));
  writeFileSync(join(cloudDir, "dist", "rivonclaw-cloud-tools.mjs"), "export default {};\n");
  writeFileSync(join(cloudDir, "openclaw.plugin.json"), JSON.stringify({
    id: "rivonclaw-cloud-tools",
    name: "E-commerce",
    contracts: { tools: ["old_tool"] },
    configSchema: {},
  }, null, 2));
}

function writeStaticMerchantFixture(merchantDir: string): string {
  const staticDir = join(merchantDir, "rivonclaw-local-tools");
  mkdirSync(staticDir, { recursive: true });
  writeFileSync(join(staticDir, "openclaw.plugin.json"), JSON.stringify({
    id: "rivonclaw-local-tools",
    contracts: { tools: ["local_tool"] },
    configSchema: {},
  }, null, 2));
  return staticDir;
}

afterEach(() => {
  for (const root of tmpRoots.splice(0)) {
    vi.resetModules();
    try {
      rmSync(root, { force: true, recursive: true });
    } catch {
      // best-effort cleanup
    }
  }
});

describe("stageMerchantExtensionsForCloudTools", () => {
  it("writes a staged cloud-tools manifest from backend tool specs", async () => {
    const root = makeTempRoot();
    const merchantDir = join(root, "extensions-merchant");
    const stateDir = join(root, "state");
    mkdirSync(merchantDir, { recursive: true });
    writeCloudToolsFixture(merchantDir);
    const staticDir = writeStaticMerchantFixture(merchantDir);

    const paths = await stageMerchantExtensionsForCloudTools({
      sourceMerchantExtensionsDir: merchantDir,
      stateDir,
      authSession: {
        getAccessToken: () => "token",
        graphqlFetch: async <T = unknown>(_query: string): Promise<T> => ({
          toolSpecs: [
            { name: "cs_start_session" },
            { name: "ecom_list_shops" },
            { name: "cs_start_session" },
          ],
        } as T),
      },
    });

    const stagedCloudDir = join(stateDir, "runtime-extensions", "rivonclaw-cloud-tools");
    expect(paths).toEqual([stagedCloudDir, staticDir]);

    const manifest = JSON.parse(readFileSync(join(stagedCloudDir, "openclaw.plugin.json"), "utf-8"));
    expect(manifest.contracts.tools).toEqual(["cs_start_session", "ecom_list_shops"]);

    const distManifest = JSON.parse(readFileSync(join(stagedCloudDir, "dist", "openclaw.plugin.json"), "utf-8"));
    expect(distManifest.contracts.tools).toEqual(["cs_start_session", "ecom_list_shops"]);
  });

  it("falls back to bundled cloud-tools when signed out", async () => {
    const root = makeTempRoot();
    const merchantDir = join(root, "extensions-merchant");
    mkdirSync(merchantDir, { recursive: true });
    writeCloudToolsFixture(merchantDir);
    const staticDir = writeStaticMerchantFixture(merchantDir);

    const paths = await stageMerchantExtensionsForCloudTools({
      sourceMerchantExtensionsDir: merchantDir,
      stateDir: join(root, "state"),
      authSession: {
        getAccessToken: () => null,
        graphqlFetch: async <T = unknown>(_query: string): Promise<T> => ({} as T),
      },
    });

    expect(paths).toEqual([
      join(merchantDir, "rivonclaw-cloud-tools"),
      staticDir,
    ]);
  });
});
