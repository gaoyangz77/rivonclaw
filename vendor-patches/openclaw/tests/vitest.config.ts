import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const root = import.meta.dirname;
const repoRoot = resolve(root, "../../..");
const vendorRoot = resolve(
  process.env.OPENCLAW_VENDOR_ROOT ?? resolve(repoRoot, "vendor/openclaw"),
);
const vendorRequire = createRequire(resolve(vendorRoot, "package.json"));
const alias: Array<{ find: string | RegExp; replacement: string }> = [
  { find: /^@vendor\//, replacement: `${vendorRoot}/src/` },
  {
    find: /^vitest$/,
    replacement: resolve(dirname(vendorRequire.resolve("vitest/package.json")), "dist/index.js"),
  },
];

// Match upstream's source exports without loading its full test-project graph.
for (const subpath of ["diagnostics", "event-stream"]) {
  alias.push({
    find: `@openclaw/ai/${subpath}`,
    replacement: resolve(vendorRoot, "packages/ai/src/utils", `${subpath}.ts`),
  });
}
for (const dir of readdirSync(resolve(vendorRoot, "packages"))) {
  const manifest = resolve(vendorRoot, "packages", dir, "package.json");
  if (!existsSync(manifest)) continue;
  const pkg = JSON.parse(readFileSync(manifest, "utf8"));
  for (const [key, value] of Object.entries(pkg.exports ?? {})) {
    if (!key.startsWith(".")) continue;
    const exported = value as string | { import?: string; default?: string };
    const target = typeof exported === "string" ? exported : (exported.import ?? exported.default);
    const subpath = key === "." ? "index" : key.slice(2);
    const relative = target?.startsWith("./dist/")
      ? target.slice(7).replace(/\.(mjs|cjs|js)$/, ".ts")
      : `${subpath}.ts`;
    const source = resolve(vendorRoot, "packages", dir, "src", relative);
    if (existsSync(source)) {
      alias.push({ find: `${pkg.name}${key === "." ? "" : key.slice(1)}`, replacement: source });
    }
  }
}
alias.sort((a, b) => String(b.find).length - String(a.find).length);

export default {
  root,
  envDir: false,
  cacheDir: resolve(repoRoot, "tmp/vendor-retirement-tests/.vite"),
  resolve: { alias },
  test: {
    include: ["*-retirement.test.ts"],
    maxWorkers: 1,
    fileParallelism: false,
    isolate: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    env: { OPENCLAW_TEST: "1" },
  },
};
