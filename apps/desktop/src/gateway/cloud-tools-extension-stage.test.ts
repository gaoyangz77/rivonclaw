import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
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
  writeFileSync(
    join(cloudDir, "package.json"),
    JSON.stringify(
      {
        name: "@rivonclaw/rivonclaw-cloud-tools",
        type: "module",
        openclaw: { extensions: ["./dist/rivonclaw-cloud-tools.mjs"] },
      },
      null,
      2,
    ),
  );
  writeFileSync(join(cloudDir, "dist", "rivonclaw-cloud-tools.mjs"), "export default {};\n");
  writeFileSync(
    join(cloudDir, "openclaw.plugin.json"),
    JSON.stringify(
      {
        id: "rivonclaw-cloud-tools",
        name: "E-commerce",
        contracts: { tools: ["old_tool"] },
        configSchema: {},
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(cloudDir, "dist", "openclaw.plugin.json"),
    readFileSync(join(cloudDir, "openclaw.plugin.json")),
  );
}

function writeStaticMerchantFixture(merchantDir: string): string {
  const staticDir = join(merchantDir, "rivonclaw-local-tools");
  mkdirSync(staticDir, { recursive: true });
  writeFileSync(
    join(staticDir, "openclaw.plugin.json"),
    JSON.stringify(
      {
        id: "rivonclaw-local-tools",
        contracts: { tools: ["local_tool"] },
        configSchema: {},
      },
      null,
      2,
    ),
  );
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
  it("writes a staged cloud-tools manifest from Desktop-provided tool names", async () => {
    const root = makeTempRoot();
    const merchantDir = join(root, "extensions-merchant");
    const stateDir = join(root, "state");
    mkdirSync(merchantDir, { recursive: true });
    writeCloudToolsFixture(merchantDir);
    const staticDir = writeStaticMerchantFixture(merchantDir);

    const paths = await stageMerchantExtensionsForCloudTools({
      sourceMerchantExtensionsDir: merchantDir,
      stateDir,
      toolNames: ["cs_start_session", "ecom_list_shops", "cs_start_session"],
    });

    const stagedCloudDir = join(stateDir, "runtime-extensions", "rivonclaw-cloud-tools");
    expect(paths).toEqual([stagedCloudDir, staticDir]);

    const manifest = JSON.parse(
      readFileSync(join(stagedCloudDir, "openclaw.plugin.json"), "utf-8"),
    );
    expect(manifest.contracts.tools).toEqual(["cs_start_session", "ecom_list_shops"]);

    const distManifest = JSON.parse(
      readFileSync(join(stagedCloudDir, "dist", "openclaw.plugin.json"), "utf-8"),
    );
    expect(distManifest.contracts.tools).toEqual(["cs_start_session", "ecom_list_shops"]);
  });

  it("falls back to bundled cloud-tools when Desktop has no tool names", async () => {
    const root = makeTempRoot();
    const merchantDir = join(root, "extensions-merchant");
    mkdirSync(merchantDir, { recursive: true });
    writeCloudToolsFixture(merchantDir);
    const staticDir = writeStaticMerchantFixture(merchantDir);

    const paths = await stageMerchantExtensionsForCloudTools({
      sourceMerchantExtensionsDir: merchantDir,
      stateDir: join(root, "state"),
    });

    expect(paths).toEqual([join(merchantDir, "rivonclaw-cloud-tools"), staticDir]);
  });

  it("keeps the OpenClaw plugin root stable and removes old digest stages", async () => {
    const root = makeTempRoot();
    const merchantDir = join(root, "extensions-merchant");
    const stateDir = join(root, "state");
    mkdirSync(merchantDir, { recursive: true });
    writeCloudToolsFixture(merchantDir);
    writeStaticMerchantFixture(merchantDir);
    const oldDigestDir = join(stateDir, "runtime-extensions", "rivonclaw-cloud-tools-digest-one");
    mkdirSync(oldDigestDir, { recursive: true });

    const paths = await stageMerchantExtensionsForCloudTools({
      sourceMerchantExtensionsDir: merchantDir,
      stateDir,
      toolNames: ["ecom_list_shops"],
    });

    expect(paths[0]).toBe(join(stateDir, "runtime-extensions", "rivonclaw-cloud-tools"));
    expect(existsSync(oldDigestDir)).toBe(false);
    expect(existsSync(paths[0])).toBe(true);
  });

  it("reuses an unchanged stage without changing plugin file identity", async () => {
    const root = makeTempRoot();
    const merchantDir = join(root, "extensions-merchant");
    const stateDir = join(root, "state");
    mkdirSync(merchantDir, { recursive: true });
    writeCloudToolsFixture(merchantDir);

    const params = {
      sourceMerchantExtensionsDir: merchantDir,
      stateDir,
      toolNames: ["ecom_list_shops", "cs_start_session"],
    };
    const [stagedCloudDir] = await stageMerchantExtensionsForCloudTools(params);
    const manifestPath = join(stagedCloudDir, "openclaw.plugin.json");
    const packagePath = join(stagedCloudDir, "package.json");
    const firstManifest = statSync(manifestPath);
    const firstPackage = statSync(packagePath);

    await stageMerchantExtensionsForCloudTools(params);

    const secondManifest = statSync(manifestPath);
    const secondPackage = statSync(packagePath);
    expect(secondManifest.ino).toBe(firstManifest.ino);
    expect(secondManifest.mtimeMs).toBe(firstManifest.mtimeMs);
    expect(secondPackage.ino).toBe(firstPackage.ino);
    expect(secondPackage.mtimeMs).toBe(firstPackage.mtimeMs);
  });

  it("adopts an unchanged pre-marker stage without replacing plugin files", async () => {
    const root = makeTempRoot();
    const merchantDir = join(root, "extensions-merchant");
    const stateDir = join(root, "state");
    mkdirSync(merchantDir, { recursive: true });
    writeCloudToolsFixture(merchantDir);

    const params = {
      sourceMerchantExtensionsDir: merchantDir,
      stateDir,
      toolNames: ["ecom_list_shops"],
    };
    const [stagedCloudDir] = await stageMerchantExtensionsForCloudTools(params);
    const manifestPath = join(stagedCloudDir, "openclaw.plugin.json");
    const firstManifest = statSync(manifestPath);
    rmSync(join(stateDir, "runtime-extensions", ".rivonclaw-cloud-tools-stage.json"));

    await stageMerchantExtensionsForCloudTools(params);

    const secondManifest = statSync(manifestPath);
    expect(secondManifest.ino).toBe(firstManifest.ino);
    expect(secondManifest.mtimeMs).toBe(firstManifest.mtimeMs);
    expect(
      existsSync(join(stateDir, "runtime-extensions", ".rivonclaw-cloud-tools-stage.json")),
    ).toBe(true);
  });

  it("rebuilds the stage when the tool contract changes", async () => {
    const root = makeTempRoot();
    const merchantDir = join(root, "extensions-merchant");
    const stateDir = join(root, "state");
    mkdirSync(merchantDir, { recursive: true });
    writeCloudToolsFixture(merchantDir);

    const [stagedCloudDir] = await stageMerchantExtensionsForCloudTools({
      sourceMerchantExtensionsDir: merchantDir,
      stateDir,
      toolNames: ["ecom_list_shops"],
    });
    await stageMerchantExtensionsForCloudTools({
      sourceMerchantExtensionsDir: merchantDir,
      stateDir,
      toolNames: ["cs_start_session", "ecom_list_shops"],
    });

    const manifest = JSON.parse(
      readFileSync(join(stagedCloudDir, "openclaw.plugin.json"), "utf-8"),
    );
    expect(manifest.contracts.tools).toEqual(["cs_start_session", "ecom_list_shops"]);
  });
});
