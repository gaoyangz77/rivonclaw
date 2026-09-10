import assert from "node:assert/strict";
import test from "node:test";
import { bundledModuleLabelRanges } from "./bundled-module-labels.mjs";

test("only the inlined CommonJS module name is exempt, not its body", () => {
  const content = `var require_ms = __commonJS({
    "vendor/openclaw/node_modules/ms/index.js"(exports, module) {
      module.exports = require("vendor/openclaw/node_modules/other/index.js");
    }
  });`;
  const ranges = bundledModuleLabelRanges(content);
  assert.deepEqual(
    ranges.map(({ start, end }) => content.slice(start, end)),
    ['"vendor/openclaw/node_modules/ms/index.js"'],
  );
  const runtimePath = content.indexOf('"vendor/openclaw/node_modules/other');
  assert.ok(!ranges.some(({ start, end }) => runtimePath >= start && runtimePath < end));
});

test("runtime references and unrelated property names stay subject to the guard", () => {
  for (const content of [
    'import schema from "vendor/openclaw/src/schema.js";',
    'require("vendor/openclaw/node_modules/ms/index.js");',
    'import("vendor/openclaw/src/schema.js");',
    'resolve(root, "vendor/openclaw/src/schema.js");',
    'readFileSync("vendor/openclaw/src/schema.js");',
    'const path = "vendor/openclaw/src/schema.js";',
    'const object = { "vendor/openclaw/src/schema.js"() {} };',
    '__commonJS({ "vendor/openclaw/src/schema.js": require("bad") });',
  ]) {
    assert.deepEqual(bundledModuleLabelRanges(content), [], content);
  }
});
