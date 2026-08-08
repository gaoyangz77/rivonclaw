// AUTO-GENERATED from vendor/openclaw — do not edit manually.
// Re-generate with: node scripts/generate-vendor-artifacts.mjs

var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) =>
  function __require() {
    return (
      mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports
    );
  };
var __copyProps = (to, from, except, desc) => {
  if ((from && typeof from === "object") || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, {
          get: () => from[key],
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
        });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (
  (target = mod != null ? __create(__getProtoOf(mod)) : {}),
  __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule
      ? __defProp(target, "default", { value: mod, enumerable: true })
      : target,
    mod,
  )
);

// vendor/openclaw/node_modules/ms/index.js
var require_ms = __commonJS({
  "vendor/openclaw/node_modules/ms/index.js"(exports, module) {
    var s = 1e3;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    var w = d * 7;
    var y = d * 365.25;
    module.exports = function (val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0) {
        return parse(val);
      } else if (type === "number" && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        "val is not a non-empty string or a valid number. val=" + JSON.stringify(val),
      );
    };
    function parse(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match =
        /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
          str,
        );
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || "ms").toLowerCase();
      switch (type) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return n * y;
        case "weeks":
        case "week":
        case "w":
          return n * w;
        case "days":
        case "day":
        case "d":
          return n * d;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return n * h;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return n * m;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return n * s;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return n;
        default:
          return void 0;
      }
    }
    function fmtShort(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return Math.round(ms / d) + "d";
      }
      if (msAbs >= h) {
        return Math.round(ms / h) + "h";
      }
      if (msAbs >= m) {
        return Math.round(ms / m) + "m";
      }
      if (msAbs >= s) {
        return Math.round(ms / s) + "s";
      }
      return ms + "ms";
    }
    function fmtLong(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return plural(ms, msAbs, d, "day");
      }
      if (msAbs >= h) {
        return plural(ms, msAbs, h, "hour");
      }
      if (msAbs >= m) {
        return plural(ms, msAbs, m, "minute");
      }
      if (msAbs >= s) {
        return plural(ms, msAbs, s, "second");
      }
      return ms + " ms";
    }
    function plural(ms, msAbs, n, name) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
    }
  },
});

// vendor/openclaw/src/config/zod-schema.ts
import { z as z20 } from "zod";

// vendor/openclaw/packages/normalization-core/src/string-coerce.ts
function normalizeNullableString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
function normalizeOptionalString(value) {
  return normalizeNullableString(value) ?? void 0;
}
function normalizeStringifiedOptionalString(value) {
  if (typeof value === "string") {
    return normalizeOptionalString(value);
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return normalizeOptionalString(String(value));
  }
  return void 0;
}
function normalizeOptionalLowercaseString(value) {
  return normalizeOptionalString(value)?.toLowerCase();
}
function normalizeLowercaseStringOrEmpty(value) {
  return normalizeOptionalLowercaseString(value) ?? "";
}

// vendor/openclaw/src/utils.ts
import fs from "node:fs";
import os2 from "node:os";
import path2 from "node:path";

// vendor/openclaw/node_modules/@openclaw/fs-safe/dist/native-config.js
var overrideConfig = {};
function configureFsSafeNative(config) {
  overrideConfig = { ...overrideConfig, ...config };
}

// vendor/openclaw/src/infra/fs-safe-defaults.ts
var hasModeOverride = Object.keys(process.env).some((key) =>
  /^(?:OPENCLAW_)?FS_SAFE_(?:NATIVE|PYTHON)_MODE$/u.test(
    process.platform === "win32" ? key.toUpperCase() : key,
  ),
);
if (!hasModeOverride) {
  configureFsSafeNative({ mode: "off" });
}

// vendor/openclaw/src/infra/home-dir.ts
import os from "node:os";
import path from "node:path";

// vendor/openclaw/src/infra/safe-cwd.ts
function tryProcessCwd() {
  try {
    return process.cwd();
  } catch {
    return void 0;
  }
}

// vendor/openclaw/src/infra/home-dir.ts
function normalize(value) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") {
    return void 0;
  }
  return trimmed;
}
function normalizeSafe(homedir) {
  try {
    return normalize(homedir());
  } catch {
    return void 0;
  }
}
function resolveTermuxHome(env) {
  const prefix = normalize(env.PREFIX);
  if (!prefix || !normalize(env.ANDROID_DATA)) {
    return void 0;
  }
  if (!/(?:^|\/)com\.termux\/files\/usr\/?$/u.test(prefix.replace(/\\/gu, "/"))) {
    return void 0;
  }
  return path.resolve(prefix, "..", "home");
}
function resolveRawOsHomeDir(env, homedir) {
  return (
    normalize(env.HOME) ??
    normalize(env.USERPROFILE) ??
    resolveTermuxHome(env) ??
    normalizeSafe(homedir)
  );
}
function resolveRawHomeDir(env, homedir) {
  const explicitHome = normalize(env.OPENCLAW_HOME);
  if (!explicitHome) {
    return resolveRawOsHomeDir(env, homedir);
  }
  if (explicitHome === "~" || explicitHome.startsWith("~/") || explicitHome.startsWith("~\\")) {
    const fallbackHome = resolveRawOsHomeDir(env, homedir);
    return fallbackHome ? explicitHome.replace(/^~(?=$|[\\/])/, fallbackHome) : void 0;
  }
  return explicitHome;
}
function resolveEffectiveHomeDir(env = process.env, homedir = os.homedir) {
  const raw = resolveRawHomeDir(env, homedir);
  return raw ? path.resolve(raw) : void 0;
}
function resolveRequiredHomeDir(env = process.env, homedir = os.homedir) {
  const resolved = resolveEffectiveHomeDir(env, homedir) ?? tryProcessCwd();
  if (resolved) {
    return path.resolve(resolved);
  }
  throw new Error(
    "Unable to resolve an OpenClaw home: set OPENCLAW_HOME, HOME, or USERPROFILE, or run from an existing directory.",
  );
}
function expandHomePrefix(input, opts) {
  if (!input.startsWith("~")) {
    return input;
  }
  const home =
    normalize(opts?.home) ??
    resolveEffectiveHomeDir(opts?.env ?? process.env, opts?.homedir ?? os.homedir);
  if (!home) {
    return input;
  }
  return input.replace(/^~(?=$|[\\/])/, home);
}
function resolveHomeRelativePath(input, opts) {
  const trimmed = input.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.startsWith("~")) {
    const expanded = expandHomePrefix(trimmed, {
      home: resolveRequiredHomeDir(opts?.env ?? process.env, opts?.homedir ?? os.homedir),
      env: opts?.env,
      homedir: opts?.homedir,
    });
    return path.resolve(expanded);
  }
  return path.resolve(trimmed);
}
function resolveUserPath(input, env = process.env, homedir = os.homedir) {
  if (!input) {
    return "";
  }
  return resolveHomeRelativePath(input, { env, homedir });
}

// vendor/openclaw/packages/normalization-core/src/number-coercion.ts
var MAX_TIMER_TIMEOUT_MS = 2147e6;
var MAX_TIMER_TIMEOUT_SECONDS = Math.floor(MAX_TIMER_TIMEOUT_MS / 1e3);

// vendor/openclaw/packages/normalization-core/src/record-coerce.ts
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// vendor/openclaw/src/utils.ts
function resolveConfigDir(env = process.env, homedir = os2.homedir) {
  const override = env.OPENCLAW_STATE_DIR?.trim();
  if (override) {
    return resolveUserPath(override, env, homedir);
  }
  const configPath = env.OPENCLAW_CONFIG_PATH?.trim();
  if (configPath) {
    return path2.dirname(resolveUserPath(configPath, env, homedir));
  }
  const newDir = path2.join(resolveRequiredHomeDir(env, homedir), ".openclaw");
  try {
    const hasNew = fs.existsSync(newDir);
    if (hasNew) {
      return newDir;
    }
  } catch {}
  return newDir;
}
var CONFIG_DIR = resolveConfigDir();

// vendor/openclaw/src/config/paths.ts
import fs2 from "node:fs";
import os3 from "node:os";
import path3 from "node:path";

// vendor/openclaw/src/infra/test-runtime-env.ts
function isVitestRuntimeEnv(env = process.env) {
  return (
    env.VITEST === "true" ||
    env.VITEST === "1" ||
    env.VITEST_POOL_ID !== void 0 ||
    env.VITEST_WORKER_ID !== void 0 ||
    env.NODE_ENV === "test"
  );
}
function isFastTestRuntimeEnv(env = process.env) {
  const isTestRuntime =
    isVitestRuntimeEnv(env) || (env !== process.env && isVitestRuntimeEnv(process.env));
  return isTestRuntime && env.OPENCLAW_TEST_FAST === "1";
}

// vendor/openclaw/src/config/paths.ts
function resolveIsNixMode(env = process.env) {
  return env.OPENCLAW_NIX_MODE === "1";
}
var isNixMode = resolveIsNixMode();
var LEGACY_STATE_DIRNAMES = [".clawdbot"];
var NEW_STATE_DIRNAME = ".openclaw";
var CONFIG_FILENAME = "openclaw.json";
var LEGACY_CONFIG_FILENAMES = ["clawdbot.json"];
function resolveDefaultHomeDir() {
  return resolveRequiredHomeDir(process.env, os3.homedir);
}
function envHomedir(env) {
  return () => resolveRequiredHomeDir(env, os3.homedir);
}
function legacyStateDirs(homedir = resolveDefaultHomeDir) {
  return LEGACY_STATE_DIRNAMES.map((dir) => path3.join(homedir(), dir));
}
function newStateDir(homedir = resolveDefaultHomeDir) {
  return path3.join(homedir(), NEW_STATE_DIRNAME);
}
function resolveStateDir(env = process.env, homedir = envHomedir(env)) {
  const effectiveHomedir = () => resolveRequiredHomeDir(env, homedir);
  const override = env.OPENCLAW_STATE_DIR?.trim();
  if (override) {
    return resolveUserPath2(override, env, effectiveHomedir);
  }
  const newDir = newStateDir(effectiveHomedir);
  if (isFastTestRuntimeEnv(env)) {
    return newDir;
  }
  const legacyDirs = legacyStateDirs(effectiveHomedir);
  const hasNew = fs2.existsSync(newDir);
  if (hasNew) {
    return newDir;
  }
  const existingLegacy = legacyDirs.find((dir) => {
    try {
      return fs2.existsSync(dir);
    } catch {
      return false;
    }
  });
  if (existingLegacy) {
    return existingLegacy;
  }
  return newDir;
}
function resolveUserPath2(input, env = process.env, homedir = envHomedir(env)) {
  return resolveHomeRelativePath(input, { env, homedir });
}
var STATE_DIR = resolveStateDir();
function resolveCanonicalConfigPath(
  env = process.env,
  stateDir = resolveStateDir(env, envHomedir(env)),
) {
  const override = env.OPENCLAW_CONFIG_PATH?.trim();
  if (override) {
    return resolveUserPath2(override, env, envHomedir(env));
  }
  return path3.join(stateDir, CONFIG_FILENAME);
}
function resolveConfigPathCandidate(env = process.env, homedir = envHomedir(env)) {
  if (isFastTestRuntimeEnv(env)) {
    return resolveCanonicalConfigPath(env, resolveStateDir(env, homedir));
  }
  const candidates = resolveDefaultConfigCandidates(env, homedir);
  const existing = candidates.find((candidate) => {
    try {
      return fs2.existsSync(candidate);
    } catch {
      return false;
    }
  });
  if (existing) {
    return existing;
  }
  return resolveCanonicalConfigPath(env, resolveStateDir(env, homedir));
}
var CONFIG_PATH = resolveConfigPathCandidate();
function resolveDefaultConfigCandidates(env = process.env, homedir = envHomedir(env)) {
  const effectiveHomedir = () => resolveRequiredHomeDir(env, homedir);
  const explicit = env.OPENCLAW_CONFIG_PATH?.trim();
  if (explicit) {
    return [resolveUserPath2(explicit, env, effectiveHomedir)];
  }
  const candidates = [];
  const openclawStateDir = env.OPENCLAW_STATE_DIR?.trim();
  if (openclawStateDir) {
    const resolved = resolveUserPath2(openclawStateDir, env, effectiveHomedir);
    candidates.push(path3.join(resolved, CONFIG_FILENAME));
    candidates.push(...LEGACY_CONFIG_FILENAMES.map((name) => path3.join(resolved, name)));
  }
  const defaultDirs = [newStateDir(effectiveHomedir), ...legacyStateDirs(effectiveHomedir)];
  for (const dir of defaultDirs) {
    candidates.push(path3.join(dir, CONFIG_FILENAME));
    candidates.push(...LEGACY_CONFIG_FILENAMES.map((name) => path3.join(dir, name)));
  }
  return candidates;
}

// vendor/openclaw/packages/normalization-core/src/agent-id.ts
var DEFAULT_AGENT_ID = "main";
var VALID_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
var INVALID_CHARS_RE = /[^a-z0-9_-]+/g;
var LEADING_DASH_RE = /^-+/;
var TRAILING_DASH_RE = /-+$/;
function normalizeAgentId(value) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return DEFAULT_AGENT_ID;
  }
  const normalized = normalizeLowercaseStringOrEmpty(trimmed);
  if (VALID_ID_RE.test(trimmed)) {
    return normalized;
  }
  return (
    normalized
      .replace(INVALID_CHARS_RE, "-")
      .replace(LEADING_DASH_RE, "")
      .replace(TRAILING_DASH_RE, "")
      .slice(0, 64) || DEFAULT_AGENT_ID
  );
}

// vendor/openclaw/src/infra/prototype-keys.ts
var BLOCKED_OBJECT_KEYS = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
function isBlockedObjectKey(key) {
  return BLOCKED_OBJECT_KEYS.has(key);
}

// vendor/openclaw/src/routing/session-key.ts
var LEGACY_IMPLICIT_AGENT_ID = "main";
var DEFAULT_AGENT_ID2 = LEGACY_IMPLICIT_AGENT_ID;

// vendor/openclaw/src/agents/workspace-default.ts
import os4 from "node:os";
import path4 from "node:path";
function resolveDefaultAgentWorkspaceDir(env = process.env, homedir = os4.homedir) {
  const workspaceDir = env.OPENCLAW_WORKSPACE_DIR?.trim();
  if (workspaceDir) {
    return path4.resolve(workspaceDir);
  }
  const home = resolveRequiredHomeDir(env, homedir);
  const profile = env.OPENCLAW_PROFILE?.trim();
  if (profile && normalizeOptionalLowercaseString(profile) !== "default") {
    return path4.join(home, ".openclaw", `workspace-${profile}`);
  }
  return path4.join(home, ".openclaw", "workspace");
}
var DEFAULT_AGENT_WORKSPACE_DIR = resolveDefaultAgentWorkspaceDir();

// vendor/openclaw/src/agents/agent-scope-config.ts
function listAgentEntriesWithSource(cfg) {
  const roster = readAgentRosterProperty(cfg);
  if (roster?.kind === "entries" && roster.value && typeof roster.value === "object") {
    return Object.entries(roster.value).map(([id, entry]) => ({
      entry: { ...entry, id },
      source: { kind: "entries", key: id },
    }));
  }
  if (roster?.kind !== "list" || !Array.isArray(roster.value)) {
    return [];
  }
  return roster.value.flatMap((entry, index) =>
    entry !== null && typeof entry === "object" ? [{ entry, source: { kind: "list", index } }] : [],
  );
}
function listAgentEntries(cfg) {
  return listAgentEntriesWithSource(cfg).map(({ entry }) => entry);
}
function readAgentRosterProperty(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return void 0;
  }
  const agents = raw.agents;
  if (!agents || typeof agents !== "object" || Array.isArray(agents)) {
    return void 0;
  }
  const entries = agents["entries"];
  if (Object.hasOwn(agents, "entries") && entries !== void 0) {
    return { kind: "entries", value: entries };
  }
  const list = agents["list"];
  if (Object.hasOwn(agents, "list") && list !== void 0) {
    return { kind: "list", value: list };
  }
  return void 0;
}

// vendor/openclaw/src/config/zod-schema.root-shape.ts
import { z as z19 } from "zod";

// vendor/openclaw/src/cli/parse-duration.ts
var import_ms = __toESM(require_ms(), 1);
function invalidDuration(raw, reason) {
  const value = raw.trim() ? `"${raw}"` : "empty value";
  const prefix = reason ? `Invalid duration (${reason}): ${value}.` : `Invalid duration: ${value}.`;
  return new Error(`${prefix} Use values like 500ms, 30s, 5m, 2h, or 1h30m.`);
}
function parseDurationToken(raw, value, unit) {
  const parsed = (0, import_ms.default)(`${value}${unit}`);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw invalidDuration(raw);
  }
  return parsed;
}
function roundSafeDurationMs(raw, value) {
  const ms = Math.round(value);
  if (!Number.isSafeInteger(ms)) {
    throw invalidDuration(raw);
  }
  return ms;
}
function parseDurationMs(raw, opts) {
  const trimmed = normalizeLowercaseStringOrEmpty(normalizeOptionalString(raw) ?? "");
  if (!trimmed) {
    throw invalidDuration(raw, "empty");
  }
  const single = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)?$/.exec(trimmed);
  if (single) {
    const value = single[1] ?? "";
    const unit = single[2] ?? opts?.defaultUnit ?? "ms";
    return roundSafeDurationMs(raw, parseDurationToken(raw, value, unit));
  }
  let totalMs = 0;
  let consumed = 0;
  const tokenRe = /(\d+(?:\.\d+)?)(ms|s|m|h|d)/g;
  for (const match of trimmed.matchAll(tokenRe)) {
    const [full, valueRaw, unitRaw] = match;
    const index = match.index ?? -1;
    if (!full || !valueRaw || !unitRaw || index < 0) {
      throw invalidDuration(raw);
    }
    if (index !== consumed) {
      throw invalidDuration(raw, "each composite segment needs a unit");
    }
    totalMs += parseDurationToken(raw, valueRaw, unitRaw);
    consumed += full.length;
  }
  if (consumed !== trimmed.length || consumed === 0) {
    throw invalidDuration(raw);
  }
  return roundSafeDurationMs(raw, totalMs);
}

// vendor/openclaw/src/config/zod-schema.agent-defaults.ts
import { z as z6 } from "zod";

// vendor/openclaw/src/cli/parse-bytes.ts
var UNIT_MULTIPLIERS = {
  b: 1,
  kb: 1024,
  k: 1024,
  mb: 1024 ** 2,
  m: 1024 ** 2,
  gb: 1024 ** 3,
  g: 1024 ** 3,
  tb: 1024 ** 4,
  t: 1024 ** 4,
};
function invalidByteSize(raw, reason) {
  const value = raw.trim() ? `"${raw}"` : "empty value";
  const prefix = reason
    ? `Invalid byte size (${reason}): ${value}.`
    : `Invalid byte size: ${value}.`;
  return new Error(`${prefix} Use values like 512kb, 10mb, 1gb, or 500.`);
}
function parseByteSize(raw, opts) {
  const trimmed = normalizeLowercaseStringOrEmpty(normalizeOptionalString(raw) ?? "");
  if (!trimmed) {
    throw invalidByteSize(raw, "empty");
  }
  const m = /^(\d+(?:\.\d+)?)([a-z]+)?$/.exec(trimmed);
  if (!m) {
    throw invalidByteSize(raw);
  }
  const value = Number(m[1]);
  if (!Number.isFinite(value) || value < 0) {
    throw invalidByteSize(raw);
  }
  const unit = normalizeLowercaseStringOrEmpty(m[2] ?? opts?.defaultUnit ?? "b");
  const multiplier = UNIT_MULTIPLIERS[unit];
  if (!multiplier) {
    throw invalidByteSize(raw, `unknown unit "${unit}"`);
  }
  const bytes = Math.round(value * multiplier);
  if (!Number.isSafeInteger(bytes)) {
    throw invalidByteSize(raw);
  }
  return bytes;
}

// vendor/openclaw/src/config/byte-size.ts
function parseNonNegativeByteSize(value) {
  if (typeof value === "number") {
    const int = Math.floor(value);
    return Number.isSafeInteger(int) && int >= 0 ? int : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    try {
      const bytes = parseByteSize(trimmed, { defaultUnit: "b" });
      return bytes >= 0 ? bytes : null;
    } catch {
      return null;
    }
  }
  return null;
}
function isValidNonNegativeByteSizeString(value) {
  return parseNonNegativeByteSize(value) !== null;
}

// vendor/openclaw/packages/normalization-core/src/string-normalization.ts
function uniqueValues(values) {
  return [...new Set(values)];
}
function uniqueStrings(values) {
  return uniqueValues(values);
}

// vendor/openclaw/src/config/zod-schema.agent-runtime.ts
import { z as z5 } from "zod";

// vendor/openclaw/src/agents/sandbox/bind-spec.ts
function splitSandboxBindSpec(spec) {
  const separator = getHostContainerSeparatorIndex(spec);
  if (separator === -1) {
    return null;
  }
  const host = spec.slice(0, separator);
  const rest = spec.slice(separator + 1);
  const optionsStart = rest.indexOf(":");
  if (optionsStart === -1) {
    return { host, container: rest, options: "" };
  }
  return {
    host,
    container: rest.slice(0, optionsStart),
    options: rest.slice(optionsStart + 1),
  };
}
function getHostContainerSeparatorIndex(spec) {
  const hasDriveLetterPrefix = /^[A-Za-z]:[\\/]/.test(spec);
  for (let i = hasDriveLetterPrefix ? 2 : 0; i < spec.length; i += 1) {
    if (spec[i] === ":") {
      return i;
    }
  }
  return -1;
}

// vendor/openclaw/src/agents/sandbox/host-paths.ts
function stripWindowsNamespacePrefix(input) {
  if (input.startsWith("\\\\?\\")) {
    const withoutPrefix = input.slice(4);
    if (withoutPrefix.toUpperCase().startsWith("UNC\\")) {
      return `\\\\${withoutPrefix.slice(4)}`;
    }
    return withoutPrefix;
  }
  if (input.startsWith("//?/")) {
    const withoutPrefix = input.slice(4);
    if (withoutPrefix.toUpperCase().startsWith("UNC/")) {
      return `//${withoutPrefix.slice(4)}`;
    }
    return withoutPrefix;
  }
  return input;
}
function isWindowsDriveAbsolutePath(raw) {
  return /^[A-Za-z]:[\\/]/.test(stripWindowsNamespacePrefix(raw.trim()));
}
function isSandboxHostPathAbsolute(raw) {
  const trimmed = stripWindowsNamespacePrefix(raw.trim());
  return trimmed.startsWith("/") || isWindowsDriveAbsolutePath(trimmed);
}

// vendor/openclaw/src/agents/sandbox/network-mode.ts
function normalizeNetworkMode(network) {
  const normalized = normalizeOptionalLowercaseString(network);
  return normalized || void 0;
}
function getBlockedNetworkModeReason(params) {
  const normalized = normalizeNetworkMode(params.network);
  if (!normalized) {
    return null;
  }
  if (normalized === "host") {
    return "host";
  }
  if (normalized.startsWith("container:") && params.allowContainerNamespaceJoin !== true) {
    return "container_namespace_join";
  }
  return null;
}

// vendor/openclaw/src/config/web-search-legacy-provider-keys.ts
var LEGACY_WEB_SEARCH_PROVIDER_CONFIG_KEYS = /* @__PURE__ */ new Set([
  "brave",
  "duckduckgo",
  "exa",
  "firecrawl",
  "gemini",
  "grok",
  "kimi",
  "minimax",
  "ollama",
  "perplexity",
  "searxng",
  "tavily",
]);

// vendor/openclaw/src/config/zod-schema.agent-model.ts
import { z } from "zod";
var AgentModelSchema = z.union([
  z.string(),
  z
    .object({
      primary: z.string().optional(),
      fallbacks: z.array(z.string()).optional(),
    })
    .strict(),
]);
var AgentToolModelSchema = z.union([
  z.string(),
  z
    .object({
      primary: z.string().optional(),
      fallbacks: z.array(z.string()).optional(),
      timeoutMs: z.number().int().positive().optional(),
    })
    .strict(),
]);

// vendor/openclaw/src/config/zod-schema.core.ts
import path5 from "node:path";

// vendor/openclaw/packages/model-catalog-core/src/provider-id.ts
function normalizeProviderId(provider) {
  return normalizeLowercaseStringOrEmpty(provider);
}

// vendor/openclaw/src/config/zod-schema.core.ts
import { z as z4 } from "zod";

// vendor/openclaw/src/infra/exec-safety.ts
var SHELL_METACHARS = /[;&|`$<>]/;
var CONTROL_CHARS = /[\r\n]/;
var QUOTE_CHARS = /["']/;
var BARE_NAME_PATTERN = /^[A-Za-z0-9._+-]+$/;
function isLikelyPath(value) {
  if (value.startsWith(".") || value.startsWith("~")) {
    return true;
  }
  if (value.includes("/") || value.includes("\\")) {
    return true;
  }
  return /^[A-Za-z]:[\\/]/.test(value);
}
function isSafeExecutableValue(value) {
  if (!value) {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.includes("\0")) {
    return false;
  }
  if (CONTROL_CHARS.test(trimmed)) {
    return false;
  }
  if (SHELL_METACHARS.test(trimmed)) {
    return false;
  }
  if (QUOTE_CHARS.test(trimmed)) {
    return false;
  }
  if (isLikelyPath(trimmed)) {
    return true;
  }
  if (trimmed.startsWith("-")) {
    return false;
  }
  return BARE_NAME_PATTERN.test(trimmed);
}

// vendor/openclaw/src/config/types.secrets.ts
var ENV_SECRET_REF_ID_RE = /^[A-Z][A-Z0-9_]{0,127}$/;
function isValidEnvSecretRefId(value) {
  return ENV_SECRET_REF_ID_RE.test(value);
}
function isSecretRef(value) {
  if (!isRecord(value)) {
    return false;
  }
  if (Object.keys(value).length !== 3) {
    return false;
  }
  return (
    (value.source === "env" || value.source === "file" || value.source === "exec") &&
    typeof value.provider === "string" &&
    value.provider.trim().length > 0 &&
    typeof value.id === "string" &&
    value.id.trim().length > 0
  );
}

// vendor/openclaw/src/secrets/ref-contract.ts
var FILE_SECRET_REF_SEGMENT_PATTERN = /^(?:[^~]|~0|~1)*$/;
var SECRET_PROVIDER_ALIAS_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
var EXEC_SECRET_REF_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,255}$/;
var SINGLE_VALUE_FILE_REF_ID = "value";
function isValidFileSecretRefId(value) {
  if (value === SINGLE_VALUE_FILE_REF_ID) {
    return true;
  }
  if (!value.startsWith("/")) {
    return false;
  }
  return value
    .slice(1)
    .split("/")
    .every((segment) => FILE_SECRET_REF_SEGMENT_PATTERN.test(segment));
}
function isValidSecretProviderAlias(value) {
  return SECRET_PROVIDER_ALIAS_PATTERN.test(value);
}
function validateExecSecretRefId(value) {
  if (!EXEC_SECRET_REF_ID_PATTERN.test(value)) {
    return { ok: false, reason: "pattern" };
  }
  for (const segment of value.split("/")) {
    if (segment === "." || segment === "..") {
      return { ok: false, reason: "traversal-segment" };
    }
  }
  return { ok: true };
}
function isValidExecSecretRefId(value) {
  return validateExecSecretRefId(value).ok;
}
function isValidSecretRef(ref) {
  if (!isSecretRef(ref)) {
    return false;
  }
  if (!isValidSecretProviderAlias(ref.provider)) {
    return false;
  }
  if (ref.source === "env") {
    return isValidEnvSecretRefId(ref.id);
  }
  if (ref.source === "file") {
    return isValidFileSecretRefId(ref.id);
  }
  return isValidExecSecretRefId(ref.id);
}
function formatExecSecretRefIdValidationMessage() {
  return [
    "Exec secret reference id must match /^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,255}$/",
    'and must not include "." or ".." path segments',
    '(example: "vault/openai/api-key" or "aws/secret#json_key").',
  ].join(" ");
}

// vendor/openclaw/src/config/types.models.ts
var MODEL_APIS = [
  "openai-completions",
  "openai-responses",
  "openai-chatgpt-responses",
  "anthropic-messages",
  "google-generative-ai",
  "google-vertex",
  "github-copilot",
  "bedrock-converse-stream",
  "ollama",
  "azure-openai-responses",
];
var MODEL_THINKING_FORMATS = [
  "openai",
  "openrouter",
  "deepseek",
  "together",
  "qwen",
  "qwen-chat-template",
  "zai",
];

// vendor/openclaw/src/config/zod-schema.allowdeny.ts
import { z as z2 } from "zod";
var AllowDenyActionSchema = z2.union([z2.literal("allow"), z2.literal("deny")]);
var AllowDenyChatTypeSchema = z2
  .union([z2.literal("direct"), z2.literal("group"), z2.literal("channel")])
  .optional();
function createAllowDenyChannelRulesSchema() {
  return z2
    .object({
      default: AllowDenyActionSchema.optional(),
      rules: z2
        .array(
          z2
            .object({
              action: AllowDenyActionSchema,
              match: z2
                .object({
                  channel: z2.string().optional(),
                  chatType: AllowDenyChatTypeSchema,
                  keyPrefix: z2.string().optional(),
                  rawKeyPrefix: z2.string().optional(),
                })
                .strict()
                .optional(),
            })
            .strict(),
        )
        .optional(),
    })
    .strict()
    .optional();
}

// vendor/openclaw/src/config/zod-schema.sensitive.ts
import { z as z3 } from "zod";
var sensitive = z3.registry();
var configUiMetadata = z3.registry();

// vendor/openclaw/src/config/zod-schema.core.ts
var ENV_SECRET_REF_ID_PATTERN = /^[A-Z][A-Z0-9_]{0,127}$/;
var SECRET_PROVIDER_ALIAS_PATTERN2 = /^[a-z][a-z0-9_-]{0,63}$/;
var WINDOWS_ABS_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
var WINDOWS_UNC_PATH_PATTERN = /^\\\\[^\\]+\\[^\\]+/;
function isAbsolutePath(value) {
  return (
    path5.isAbsolute(value) ||
    WINDOWS_ABS_PATH_PATTERN.test(value) ||
    WINDOWS_UNC_PATH_PATTERN.test(value)
  );
}
var EnvSecretRefSchema = z4
  .object({
    source: z4.literal("env"),
    provider: z4
      .string()
      .regex(
        SECRET_PROVIDER_ALIAS_PATTERN2,
        'Secret reference provider must match /^[a-z][a-z0-9_-]{0,63}$/ (example: "default").',
      ),
    id: z4
      .string()
      .regex(
        ENV_SECRET_REF_ID_PATTERN,
        'Env secret reference id must match /^[A-Z][A-Z0-9_]{0,127}$/ (example: "OPENAI_API_KEY").',
      ),
  })
  .strict();
var FileSecretRefSchema = z4
  .object({
    source: z4.literal("file"),
    provider: z4
      .string()
      .regex(
        SECRET_PROVIDER_ALIAS_PATTERN2,
        'Secret reference provider must match /^[a-z][a-z0-9_-]{0,63}$/ (example: "default").',
      ),
    id: z4
      .string()
      .refine(
        isValidFileSecretRefId,
        'File secret reference id must be an absolute JSON pointer (example: "/providers/openai/apiKey"), or "value" for singleValue mode.',
      ),
  })
  .strict();
var ExecSecretRefSchema = z4
  .object({
    source: z4.literal("exec"),
    provider: z4
      .string()
      .regex(
        SECRET_PROVIDER_ALIAS_PATTERN2,
        'Secret reference provider must match /^[a-z][a-z0-9_-]{0,63}$/ (example: "default").',
      ),
    id: z4.string().refine(isValidExecSecretRefId, formatExecSecretRefIdValidationMessage()),
  })
  .strict();
var SecretRefSchema = z4.discriminatedUnion("source", [
  EnvSecretRefSchema,
  FileSecretRefSchema,
  ExecSecretRefSchema,
]);
var SecretInputSchema = z4.union([z4.string(), SecretRefSchema]);
var SecretsEnvProviderSchema = z4
  .object({
    source: z4.literal("env"),
    allowlist: z4.array(z4.string().regex(ENV_SECRET_REF_ID_PATTERN)).max(256).optional(),
  })
  .strict();
var SecretsFileProviderSchema = z4
  .object({
    source: z4.literal("file"),
    path: z4.string().min(1),
    mode: z4.union([z4.literal("singleValue"), z4.literal("json")]).optional(),
    timeoutMs: z4.number().int().positive().max(12e4).optional(),
    maxBytes: z4
      .number()
      .int()
      .positive()
      .max(20 * 1024 * 1024)
      .optional(),
  })
  .strict();
var SecretsManualExecProviderSchema = z4
  .object({
    source: z4.literal("exec"),
    command: z4
      .string()
      .min(1)
      .refine((value) => isSafeExecutableValue(value), "secrets.providers.*.command is unsafe.")
      .refine(
        (value) => isAbsolutePath(value),
        "secrets.providers.*.command must be an absolute path.",
      ),
    args: z4.array(z4.string().max(1024)).max(128).optional(),
    timeoutMs: z4.number().int().positive().max(12e4).optional(),
    noOutputTimeoutMs: z4.number().int().positive().max(12e4).optional(),
    maxOutputBytes: z4
      .number()
      .int()
      .positive()
      .max(20 * 1024 * 1024)
      .optional(),
    jsonOnly: z4.boolean().optional(),
    env: z4.record(z4.string(), z4.string()).optional(),
    passEnv: z4.array(z4.string().regex(ENV_SECRET_REF_ID_PATTERN)).max(128).optional(),
    trustedDirs: z4
      .array(
        z4
          .string()
          .min(1)
          .refine((value) => isAbsolutePath(value), "trustedDirs entries must be absolute paths."),
      )
      .max(64)
      .optional(),
  })
  .strict();
var SecretsPluginIntegrationExecProviderSchema = z4
  .object({
    source: z4.literal("exec"),
    pluginIntegration: z4
      .object({
        pluginId: z4.string().min(1).max(128),
        integrationId: z4.string().min(1).max(128),
      })
      .strict(),
  })
  .strict();
var SecretsExecProviderSchema = z4.union([
  SecretsManualExecProviderSchema,
  SecretsPluginIntegrationExecProviderSchema,
]);
var SecretProviderSchema = z4.union([
  SecretsEnvProviderSchema,
  SecretsFileProviderSchema,
  SecretsExecProviderSchema,
]);
var SecretsConfigSchema = z4
  .object({
    providers: z4
      .object({
        // Keep this as a record so users can define multiple named providers per source.
      })
      .catchall(SecretProviderSchema)
      .optional(),
    defaults: z4
      .object({
        env: z4.string().regex(SECRET_PROVIDER_ALIAS_PATTERN2).optional(),
        file: z4.string().regex(SECRET_PROVIDER_ALIAS_PATTERN2).optional(),
        exec: z4.string().regex(SECRET_PROVIDER_ALIAS_PATTERN2).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional();
var LEGACY_OPENAI_CODEX_RESPONSES_API = "openai-codex-responses";
var OPENAI_CHATGPT_RESPONSES_API = "openai-chatgpt-responses";
var ModelApiSchema = z4.enum(MODEL_APIS, {
  error: (issue) =>
    issue.input === LEGACY_OPENAI_CODEX_RESPONSES_API
      ? `"${LEGACY_OPENAI_CODEX_RESPONSES_API}" is a removed api id; use "${OPENAI_CHATGPT_RESPONSES_API}"`
      : void 0,
});
var ModelCompatSchema = z4
  .object({
    supportsStore: z4.boolean().optional(),
    supportsPromptCacheKey: z4.boolean().optional(),
    supportsDeveloperRole: z4.boolean().optional(),
    supportsReasoningEffort: z4.boolean().optional(),
    supportsTemperature: z4.boolean().optional(),
    supportsUsageInStreaming: z4.boolean().optional(),
    supportsTools: z4.boolean().optional(),
    codeMode: z4.enum(["preferred", "capable"]).optional(),
    supportsStrictMode: z4.boolean().optional(),
    supportsJsonSchemaResponseFormat: z4.boolean().optional(),
    requiresStringContent: z4.boolean().optional(),
    strictMessageKeys: z4.boolean().optional(),
    visibleReasoningDetailTypes: z4.array(z4.string().min(1)).optional(),
    supportedReasoningEfforts: z4.array(z4.string().min(1)).optional(),
    reasoningEffortMap: z4.record(z4.string().min(1), z4.string().min(1)).optional(),
    maxTokensField: z4
      .union([z4.literal("max_completion_tokens"), z4.literal("max_tokens")])
      .optional(),
    thinkingFormat: z4.enum(MODEL_THINKING_FORMATS).optional(),
    requiresToolResultName: z4.boolean().optional(),
    requiresAssistantAfterToolResult: z4.boolean().optional(),
    requiresThinkingAsText: z4.boolean().optional(),
    requiresReasoningContentOnAssistantMessages: z4.boolean().optional(),
    toolSchemaProfile: z4.string().optional(),
    unsupportedToolSchemaKeywords: z4.array(z4.string().min(1)).optional(),
    toolCallArgumentsEncoding: z4.string().optional(),
    requiresOpenAiAnthropicToolPayload: z4.boolean().optional(),
  })
  .strict()
  .optional();
var ConfiguredProviderRequestTlsSchema = z4
  .object({
    ca: SecretInputSchema.optional().register(sensitive),
    cert: SecretInputSchema.optional().register(sensitive),
    key: SecretInputSchema.optional().register(sensitive),
    passphrase: SecretInputSchema.optional().register(sensitive),
    serverName: z4.string().optional(),
    insecureSkipVerify: z4.boolean().optional(),
  })
  .strict()
  .optional();
var ConfiguredProviderRequestAuthSchema = z4
  .union([
    z4
      .object({
        mode: z4.literal("provider-default"),
      })
      .strict(),
    z4
      .object({
        mode: z4.literal("authorization-bearer"),
        token: SecretInputSchema.register(sensitive),
      })
      .strict(),
    z4
      .object({
        mode: z4.literal("header"),
        headerName: z4.string().min(1),
        value: SecretInputSchema.register(sensitive),
        prefix: z4.string().optional(),
      })
      .strict(),
  ])
  .optional();
var ConfiguredProviderRequestProxySchema = z4
  .union([
    z4
      .object({
        mode: z4.literal("env-proxy"),
        tls: ConfiguredProviderRequestTlsSchema,
      })
      .strict(),
    z4
      .object({
        mode: z4.literal("explicit-proxy"),
        url: z4.string().min(1),
        tls: ConfiguredProviderRequestTlsSchema,
      })
      .strict(),
  ])
  .optional();
var ConfiguredProviderRequestFields = {
  headers: z4.record(z4.string(), SecretInputSchema.register(sensitive)).optional(),
  auth: ConfiguredProviderRequestAuthSchema,
  proxy: ConfiguredProviderRequestProxySchema,
  tls: ConfiguredProviderRequestTlsSchema,
};
var ConfiguredProviderRequestSchema = z4
  .object(ConfiguredProviderRequestFields)
  .strict()
  .optional();
var ConfiguredModelProviderRequestSchema = z4
  .object({
    ...ConfiguredProviderRequestFields,
    allowPrivateNetwork: z4.boolean().optional(),
  })
  .strict()
  .optional();
var ModelAgentRuntimePolicySchema = z4
  .object({
    id: z4.string().optional(),
  })
  .strict()
  .optional();
var ModelImageInputSchema = z4
  .object({
    maxBytes: z4.number().int().positive().optional(),
    maxPixels: z4.number().int().positive().optional(),
    maxSidePx: z4.number().int().positive().optional(),
    preferredSidePx: z4.number().int().positive().optional(),
    tokenMode: z4
      .union([z4.literal("tile"), z4.literal("detail"), z4.literal("provider")])
      .optional(),
  })
  .strict();
var ModelMediaInputSchema = z4
  .object({
    image: ModelImageInputSchema.optional(),
  })
  .strict();
var ThinkingLevelMapValueSchema = z4.string().nullable();
var ThinkingLevelMapSchema = z4
  .object({
    off: ThinkingLevelMapValueSchema.optional(),
    minimal: ThinkingLevelMapValueSchema.optional(),
    low: ThinkingLevelMapValueSchema.optional(),
    medium: ThinkingLevelMapValueSchema.optional(),
    high: ThinkingLevelMapValueSchema.optional(),
    xhigh: ThinkingLevelMapValueSchema.optional(),
    max: ThinkingLevelMapValueSchema.optional(),
  })
  .strict();
var ModelDefinitionSchema = z4
  .object({
    id: z4.string().min(1),
    name: z4.string().min(1),
    api: ModelApiSchema.optional(),
    baseUrl: z4.string().min(1).optional(),
    reasoning: z4.boolean().optional(),
    input: z4
      .array(
        z4.union([
          z4.literal("text"),
          z4.literal("image"),
          z4.literal("video"),
          z4.literal("audio"),
        ]),
      )
      .optional(),
    cost: z4
      .object({
        input: z4.number().optional(),
        output: z4.number().optional(),
        cacheRead: z4.number().optional(),
        cacheWrite: z4.number().optional(),
        tieredPricing: z4
          .array(
            z4
              .object({
                input: z4.number(),
                output: z4.number(),
                cacheRead: z4.number(),
                cacheWrite: z4.number(),
                range: z4.union([z4.tuple([z4.number(), z4.number()]), z4.tuple([z4.number()])]),
              })
              .strict(),
          )
          .optional(),
      })
      .strict()
      .optional(),
    contextWindow: z4.number().positive().optional(),
    contextTokens: z4.number().int().positive().optional(),
    maxTokens: z4.number().positive().optional(),
    thinkingLevelMap: ThinkingLevelMapSchema.optional(),
    params: z4.record(z4.string(), z4.unknown()).optional(),
    agentRuntime: ModelAgentRuntimePolicySchema,
    headers: z4.record(z4.string(), z4.string()).optional(),
    compat: ModelCompatSchema,
    mediaInput: ModelMediaInputSchema.optional(),
    metadataSource: z4.literal("models-add").optional(),
  })
  .strict();
var ModelProviderLocalServiceSchema = z4
  .object({
    command: z4.string().min(1),
    args: z4.array(z4.string()).optional(),
    cwd: z4.string().min(1).optional(),
    env: z4.record(z4.string(), z4.string().register(sensitive)).optional(),
    healthUrl: z4.string().min(1).optional(),
    readyTimeoutMs: z4.number().int().positive().optional(),
    idleStopMs: z4.number().int().nonnegative().optional(),
  })
  .strict()
  .optional();
var BUILT_IN_MODEL_PROVIDER_OVERLAY_IDS = /* @__PURE__ */ new Set([
  "amazon-bedrock",
  "amazon-bedrock-mantle",
  "anthropic",
  "anthropic-vertex",
  "arcee",
  "azure-openai-responses",
  "byteplus",
  "byteplus-plan",
  "cerebras",
  "chutes",
  "claude-cli",
  "clawrouter",
  "cloudflare-ai-gateway",
  "codex",
  "comfy",
  "copilot-proxy",
  "dashscope",
  "deepinfra",
  "deepseek",
  "fal",
  "fireworks",
  "github-copilot",
  "gmi",
  "gmi-cloud",
  "gmicloud",
  "google",
  "google-antigravity",
  "google-gemini-cli",
  "google-vertex",
  "groq",
  "huggingface",
  "kilocode",
  "kimi",
  "kimi-coding",
  "litellm",
  "lmstudio",
  "meta",
  "microsoft-foundry",
  "minimax",
  "minimax-portal",
  "mistral",
  "modelstudio",
  "moonshot",
  "moonshot-ai",
  "moonshotai",
  "nvidia",
  "novita",
  "novita-ai",
  "novitaai",
  "ollama",
  "ollama-cloud",
  "openai",
  "opencode",
  "opencode-go",
  "openrouter",
  "qianfan",
  "qwen",
  "qwen-token-plan",
  "qwencloud",
  "sglang",
  "stepfun",
  "stepfun-plan",
  "synthetic",
  "tencent-tokenhub",
  "tencent-tokenplan",
  "together",
  "venice",
  "vercel-ai-gateway",
  "vllm",
  "volcengine",
  "volcengine-plan",
  "vydra",
  "x-ai",
  "xai",
  "xiaomi",
  "xiaomi-token-plan",
  "z.ai",
  "z-ai",
  "zai",
]);
function isBuiltInModelProviderOverlayId(providerId) {
  return BUILT_IN_MODEL_PROVIDER_OVERLAY_IDS.has(normalizeProviderId(providerId));
}
var ModelProviderSchema = z4
  .object({
    // Bundled provider overlays are materialized with an empty-string sentinel.
    // ModelProvidersSchema below still rejects empty baseUrl values for custom providers.
    baseUrl: z4.string().optional(),
    apiKey: SecretInputSchema.optional().register(sensitive),
    auth: z4
      .union([
        z4.literal("api-key"),
        z4.literal("aws-sdk"),
        z4.literal("oauth"),
        z4.literal("token"),
      ])
      .optional(),
    api: ModelApiSchema.optional(),
    contextWindow: z4.number().positive().optional(),
    contextTokens: z4.number().int().positive().optional(),
    maxTokens: z4.number().positive().optional(),
    timeoutSeconds: z4.number().int().positive().optional(),
    region: z4.string().min(1).optional(),
    injectNumCtxForOpenAICompat: z4.boolean().optional(),
    params: z4.record(z4.string(), z4.unknown()).optional(),
    agentRuntime: ModelAgentRuntimePolicySchema,
    localService: ModelProviderLocalServiceSchema,
    headers: z4.record(z4.string(), SecretInputSchema.register(sensitive)).optional(),
    authHeader: z4.boolean().optional(),
    request: ConfiguredModelProviderRequestSchema,
    models: z4.array(ModelDefinitionSchema).optional(),
  })
  .strict();
var ModelProvidersSchema = z4
  .record(z4.string(), ModelProviderSchema)
  .superRefine((providers, ctx) => {
    for (const [providerId, provider] of Object.entries(providers)) {
      if (isBuiltInModelProviderOverlayId(providerId)) {
        continue;
      }
      if (!provider.baseUrl) {
        ctx.addIssue({
          code: "custom",
          path: [providerId, "baseUrl"],
          message:
            "custom model providers must declare baseUrl; provider overlays without baseUrl are only supported for bundled providers",
        });
      }
      if (!Array.isArray(provider.models)) {
        ctx.addIssue({
          code: "custom",
          path: [providerId, "models"],
          message:
            "custom model providers must declare models; provider overlays without models are only supported for bundled providers",
        });
      }
    }
  });
var ModelCatalogRefreshConfigSchema = z4
  .object({
    enabled: z4.boolean().optional(),
    url: z4
      .string()
      .refine(
        (value) => {
          try {
            const parsed = new URL(value);
            return (
              parsed.protocol === "https:" ||
              (parsed.protocol === "http:" &&
                ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname))
            );
          } catch {
            return false;
          }
        },
        {
          message: "models.catalogRefresh.url must use https, or http on localhost",
        },
      )
      .optional(),
  })
  .strict()
  .optional();
var ModelsConfigSchema = z4
  .object({
    mode: z4.union([z4.literal("merge"), z4.literal("replace")]).optional(),
    providers: ModelProvidersSchema.optional(),
    catalogRefresh: ModelCatalogRefreshConfigSchema,
  })
  .strict()
  .optional();
var VisibleRepliesValueSchema = z4.enum(["automatic", "message_tool"]);
var AmbientGroupInboundSchema = z4.enum(["user_request", "room_event"]);
var VisibleRepliesSchema = z4
  .union([VisibleRepliesValueSchema, z4.boolean()])
  .overwrite((value) => {
    if (value === true) {
      return "automatic";
    }
    if (value === false) {
      return "message_tool";
    }
    return value;
  });
var MentionPatternsModeSchema = z4.union([z4.literal("allow"), z4.literal("deny")]);
var MentionPatternsPolicySchema = z4
  .object({
    mode: MentionPatternsModeSchema.optional(),
    allowIn: z4.array(z4.string()).optional(),
    denyIn: z4.array(z4.string()).optional(),
  })
  .strict();
var GroupChatSchema = z4
  .object({
    mentionPatterns: z4.array(z4.string()).optional(),
    historyLimit: z4.number().int().min(0).optional(),
    unmentionedInbound: AmbientGroupInboundSchema.optional(),
    visibleReplies: VisibleRepliesSchema.optional(),
  })
  .strict()
  .optional();
var DmConfigSchema = z4
  .object({
    historyLimit: z4.number().int().min(0).optional(),
  })
  .strict();
var IdentitySchema = z4
  .object({
    name: z4.string().optional(),
    theme: z4.string().optional(),
    emoji: z4.string().optional(),
    avatar: z4.string().optional(),
  })
  .strict()
  .optional();
var QueueModeSchema = z4.union([
  z4.literal("steer"),
  z4.literal("followup"),
  z4.literal("collect"),
  z4.literal("interrupt"),
]);
var QueueDropSchema = z4.union([z4.literal("old"), z4.literal("new"), z4.literal("summarize")]);
var ReplyToModeSchema = z4.union([
  z4.literal("off"),
  z4.literal("first"),
  z4.literal("all"),
  z4.literal("batched"),
]);
var TypingModeSchema = z4.union([
  z4.literal("never"),
  z4.literal("instant"),
  z4.literal("thinking"),
  z4.literal("message"),
]);
var GroupPolicySchema = z4.enum(["open", "disabled", "allowlist"]);
var DmPolicySchema = z4.enum(["pairing", "allowlist", "open", "disabled"]);
var ContextVisibilityModeSchema = z4.enum(["all", "allowlist", "allowlist_quote"]);
var BlockStreamingCoalesceSchema = z4
  .object({
    minChars: z4.number().int().positive().optional(),
    maxChars: z4.number().int().positive().optional(),
    idleMs: z4.number().int().nonnegative().optional(),
  })
  .strict();
var TextChunkModeSchema = z4.enum(["length", "newline"]);
var ChannelStreamingBlockSchema = z4
  .object({
    enabled: z4.boolean().optional(),
    coalesce: BlockStreamingCoalesceSchema.optional(),
  })
  .strict();
var ChannelDeliveryStreamingConfigSchema = z4
  .object({
    chunkMode: TextChunkModeSchema.optional(),
    block: ChannelStreamingBlockSchema.optional(),
  })
  .strict();
var ReplyRuntimeConfigSchemaShape = {
  historyLimit: z4.number().int().min(0).optional(),
  dmHistoryLimit: z4.number().int().min(0).optional(),
  contextVisibility: ContextVisibilityModeSchema.optional(),
  dms: z4.record(z4.string(), DmConfigSchema.optional()).optional(),
  textChunkLimit: z4.number().int().positive().optional(),
  streaming: ChannelDeliveryStreamingConfigSchema.optional(),
  responsePrefix: z4.string().optional(),
  mediaMaxMb: z4.number().positive().optional(),
};
var BlockStreamingChunkSchema = z4
  .object({
    minChars: z4.number().int().positive().optional(),
    maxChars: z4.number().int().positive().optional(),
    breakPreference: z4
      .union([z4.literal("paragraph"), z4.literal("newline"), z4.literal("sentence")])
      .optional(),
  })
  .strict();
var MarkdownTableModeSchema = z4.enum(["off", "bullets", "code", "block"]);
var MarkdownConfigSchema = z4
  .object({
    tables: MarkdownTableModeSchema.optional(),
  })
  .strict()
  .optional();
var TtsProviderSchema = z4.string().min(1);
var TtsModeSchema = z4.enum(["final", "all"]);
var TtsAutoSchema = z4.enum(["off", "always", "inbound", "tagged"]);
var TtsProviderConfigSchema = z4
  .object({
    apiKey: SecretInputSchema.optional().register(sensitive),
  })
  .catchall(
    z4.union([
      z4.string(),
      z4.number(),
      z4.boolean(),
      z4.null(),
      z4.array(z4.unknown()),
      z4.record(z4.string(), z4.unknown()),
    ]),
  );
var TtsPersonaSchema = z4
  .object({
    label: z4.string().optional(),
    description: z4.string().optional(),
    provider: TtsProviderSchema.optional(),
    fallbackPolicy: z4
      .union([z4.literal("preserve-persona"), z4.literal("provider-defaults"), z4.literal("fail")])
      .optional(),
    providers: z4.record(z4.string(), TtsProviderConfigSchema).optional(),
  })
  .strict();
var TtsConfigSchema = z4
  .object({
    auto: TtsAutoSchema.optional(),
    enabled: z4.boolean().optional(),
    mode: TtsModeSchema.optional(),
    provider: TtsProviderSchema.optional(),
    persona: z4.string().optional(),
    personas: z4.record(z4.string(), TtsPersonaSchema).optional(),
    summaryModel: z4.string().optional(),
    modelOverrides: z4
      .object({
        enabled: z4.boolean().optional(),
        allowText: z4.boolean().optional(),
        allowProvider: z4.boolean().optional(),
        allowVoice: z4.boolean().optional(),
        allowModelId: z4.boolean().optional(),
        allowVoiceSettings: z4.boolean().optional(),
        allowNormalization: z4.boolean().optional(),
        allowSeed: z4.boolean().optional(),
      })
      .strict()
      .optional(),
    providers: z4.record(z4.string(), TtsProviderConfigSchema).optional(),
    maxTextLength: z4.number().int().min(1).optional(),
    timeoutMs: z4.number().int().min(1e3).max(12e4).optional(),
  })
  .strict()
  .optional();
var HumanDelaySchema = z4
  .object({
    mode: z4.union([z4.literal("off"), z4.literal("natural"), z4.literal("custom")]).optional(),
    minMs: z4.number().int().nonnegative().optional(),
    maxMs: z4.number().int().nonnegative().optional(),
  })
  .strict();
var MSTeamsReplyStyleSchema = z4.enum(["thread", "top-level"]);
var QueueModeBySurfaceSchema = z4
  .object({
    whatsapp: QueueModeSchema.optional(),
    telegram: QueueModeSchema.optional(),
    discord: QueueModeSchema.optional(),
    irc: QueueModeSchema.optional(),
    googlechat: QueueModeSchema.optional(),
    slack: QueueModeSchema.optional(),
    mattermost: QueueModeSchema.optional(),
    signal: QueueModeSchema.optional(),
    imessage: QueueModeSchema.optional(),
    msteams: QueueModeSchema.optional(),
    webchat: QueueModeSchema.optional(),
    matrix: QueueModeSchema.optional(),
  })
  .strict()
  .optional();
var DebounceMsBySurfaceSchema = z4.record(z4.string(), z4.number().int().nonnegative()).optional();
var QueueSchema = z4
  .object({
    mode: QueueModeSchema.optional(),
    byChannel: QueueModeBySurfaceSchema,
    debounceMsByChannel: DebounceMsBySurfaceSchema,
    cap: z4.number().int().positive().optional(),
    drop: QueueDropSchema.optional(),
  })
  .strict()
  .optional();
var InboundDebounceSchema = z4
  .object({
    debounceMs: z4.number().int().nonnegative().optional(),
    byChannel: DebounceMsBySurfaceSchema,
  })
  .strict()
  .optional();
var HexColorSchema = z4.string().regex(/^#?[0-9a-fA-F]{6}$/, "expected hex color (RRGGBB)");
var ExecutableTokenSchema = z4
  .string()
  .refine(isSafeExecutableValue, "expected safe executable name or path");
var MediaUnderstandingScopeSchema = createAllowDenyChannelRulesSchema();
var MediaUnderstandingAttachmentsSchema = z4
  .object({
    mode: z4.union([z4.literal("first"), z4.literal("all")]).optional(),
    maxAttachments: z4.number().int().positive().optional(),
    prefer: z4
      .union([z4.literal("first"), z4.literal("last"), z4.literal("path"), z4.literal("url")])
      .optional(),
  })
  .strict()
  .optional();
var MediaUnderstandingCapabilitiesSchema = z4
  .array(z4.union([z4.literal("image"), z4.literal("audio"), z4.literal("video")]))
  .optional();
var ProviderOptionValueSchema = z4.union([z4.string(), z4.number(), z4.boolean()]);
var ProviderOptionsSchema = z4
  .record(z4.string(), z4.record(z4.string(), ProviderOptionValueSchema))
  .optional();
var MediaUnderstandingRuntimeFields = {
  prompt: z4.string().optional(),
  timeoutSeconds: z4.number().int().positive().optional(),
  language: z4.string().optional(),
  providerOptions: ProviderOptionsSchema,
  baseUrl: z4.string().optional(),
  headers: z4.record(z4.string(), z4.string()).optional(),
  request: ConfiguredProviderRequestSchema,
};
var MediaUnderstandingModelSchema = z4
  .object({
    provider: z4.string().optional(),
    model: z4.string().optional(),
    capabilities: MediaUnderstandingCapabilitiesSchema,
    type: z4.union([z4.literal("provider"), z4.literal("cli")]).optional(),
    command: z4.string().optional(),
    args: z4.array(z4.string()).optional(),
    maxChars: z4.number().int().positive().optional(),
    maxBytes: z4.number().int().positive().optional(),
    ...MediaUnderstandingRuntimeFields,
    profile: z4.string().optional(),
    preferredProfile: z4.string().optional(),
  })
  .strict()
  .optional();
var ToolsMediaCapabilitySchema = z4
  .object({
    enabled: z4.boolean().optional(),
    preferredModel: z4.string().trim().min(1).optional(),
    scope: MediaUnderstandingScopeSchema,
    maxBytes: z4.number().int().positive().optional(),
    maxChars: z4.number().int().positive().optional(),
    ...MediaUnderstandingRuntimeFields,
    attachments: MediaUnderstandingAttachmentsSchema,
  })
  .strict()
  .optional();
var ToolsMediaAudioSchema = z4
  .object({
    enabled: z4.boolean().optional(),
    preferredModel: z4.string().trim().min(1).optional(),
    scope: MediaUnderstandingScopeSchema,
    maxBytes: z4.number().int().positive().optional(),
    maxChars: z4.number().int().positive().optional(),
    ...MediaUnderstandingRuntimeFields,
    attachments: MediaUnderstandingAttachmentsSchema,
    echoTranscript: z4.boolean().optional(),
    echoFormat: z4.string().optional(),
  })
  .strict()
  .optional();
var ToolsMediaSchema = z4
  .object({
    models: z4.array(MediaUnderstandingModelSchema).optional(),
    concurrency: z4.number().int().positive().optional(),
    image: ToolsMediaCapabilitySchema.optional(),
    audio: ToolsMediaAudioSchema.optional(),
    video: ToolsMediaCapabilitySchema.optional(),
  })
  .strict()
  .optional();
var LinkModelSchema = z4
  .object({
    type: z4.literal("cli").optional(),
    command: z4.string().min(1),
    args: z4.array(z4.string()).optional(),
    timeoutSeconds: z4.number().int().positive().optional(),
  })
  .strict();
var ToolsLinksSchema = z4
  .object({
    enabled: z4.boolean().optional(),
    scope: MediaUnderstandingScopeSchema,
    maxLinks: z4.number().int().positive().optional(),
    timeoutSeconds: z4.number().int().positive().optional(),
    models: z4.array(LinkModelSchema).optional(),
  })
  .strict()
  .optional();
var NativeCommandsSettingSchema = z4.union([z4.boolean(), z4.literal("auto")]);
var ProviderCommandsSchema = z4
  .object({
    native: NativeCommandsSettingSchema.optional(),
    nativeSkills: NativeCommandsSettingSchema.optional(),
  })
  .strict()
  .optional();

// vendor/openclaw/src/config/zod-schema.agent-runtime.ts
function validateSandboxBindEntries(binds, ctx) {
  if (!binds) {
    return;
  }
  for (let i = 0; i < binds.length; i += 1) {
    const bind = normalizeOptionalString(binds[i]) ?? "";
    if (!bind) {
      ctx.addIssue({
        code: z5.ZodIssueCode.custom,
        path: ["binds", i],
        message: "Sandbox security: bind mount entry must be a non-empty string.",
      });
      continue;
    }
    const parsed = splitSandboxBindSpec(bind);
    const source = (parsed ? parsed.host : bind).trim();
    if (!isSandboxHostPathAbsolute(source)) {
      ctx.addIssue({
        code: z5.ZodIssueCode.custom,
        path: ["binds", i],
        message: `Sandbox security: bind mount "${bind}" uses a non-absolute source path "${source}". Only absolute POSIX or Windows drive-letter paths are supported for sandbox binds.`,
      });
    }
  }
}
var AgentEntryEmbeddedAgentConfigSchema = z5
  .object({
    executionContract: z5.union([z5.literal("default"), z5.literal("strict-agentic")]).optional(),
  })
  .strict();
var AgentTtsConfigSchema = TtsConfigSchema.unwrap()
  .extend({ prefsPath: z5.string().optional() })
  .strict()
  .optional();
var HeartbeatSchema = z5
  .object({
    every: z5.string().optional(),
    activeHours: z5
      .object({
        start: z5.string().optional(),
        end: z5.string().optional(),
        timezone: z5.string().optional(),
      })
      .strict()
      .optional(),
    model: z5.string().optional(),
    session: z5.string().optional(),
    target: z5.string().optional(),
    directPolicy: z5.union([z5.literal("allow"), z5.literal("block")]).optional(),
    to: z5.string().optional(),
    accountId: z5.string().optional(),
    prompt: z5.string().optional(),
    timeoutSeconds: z5.number().int().positive().optional(),
    lightContext: z5.boolean().optional(),
    isolatedSession: z5.boolean().optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.every) {
      try {
        parseDurationMs(val.every, { defaultUnit: "m" });
      } catch {
        ctx.addIssue({
          code: z5.ZodIssueCode.custom,
          path: ["every"],
          message: "invalid duration (use ms, s, m, h)",
        });
      }
    }
    const active = val.activeHours;
    if (!active) {
      return;
    }
    const timePattern = /^([01]\d|2[0-3]|24):([0-5]\d)$/;
    const validateTime = (raw, opts, path7) => {
      if (!raw) {
        return;
      }
      if (!timePattern.test(raw)) {
        ctx.addIssue({
          code: z5.ZodIssueCode.custom,
          path: ["activeHours", path7],
          message: 'invalid time (use "HH:MM" 24h format)',
        });
        return;
      }
      const [hourStr, minuteStr] = raw.split(":");
      const hour = Number(hourStr);
      const minute = Number(minuteStr);
      if (hour === 24 && minute !== 0) {
        ctx.addIssue({
          code: z5.ZodIssueCode.custom,
          path: ["activeHours", path7],
          message: "invalid time (24:00 is the only allowed 24:xx value)",
        });
        return;
      }
      if (hour === 24 && !opts.allow24) {
        ctx.addIssue({
          code: z5.ZodIssueCode.custom,
          path: ["activeHours", path7],
          message: "invalid time (start cannot be 24:00)",
        });
      }
    };
    validateTime(active.start, { allow24: false }, "start");
    validateTime(active.end, { allow24: true }, "end");
  })
  .optional();
var SandboxDockerSchema = z5
  .object({
    image: z5.string().optional(),
    containerPrefix: z5.string().optional(),
    workdir: z5.string().optional(),
    readOnlyRoot: z5.boolean().optional(),
    tmpfs: z5.array(z5.string()).optional(),
    network: z5.string().optional(),
    user: z5.string().optional(),
    capDrop: z5.array(z5.string()).optional(),
    env: z5.record(z5.string(), z5.string()).optional(),
    setupCommand: z5
      .union([z5.string(), z5.array(z5.string())])
      .transform((value) => (Array.isArray(value) ? value.join("\n") : value))
      .pipe(z5.string())
      .optional(),
    pidsLimit: z5.number().int().positive().optional(),
    memory: z5.union([z5.string(), z5.number()]).optional(),
    memorySwap: z5.union([z5.string(), z5.number()]).optional(),
    cpus: z5.number().positive().optional(),
    gpus: z5.string().min(1).optional(),
    ulimits: z5
      .record(
        z5.string(),
        z5.union([
          z5.string(),
          z5.number(),
          z5
            .object({
              soft: z5.number().int().nonnegative().optional(),
              hard: z5.number().int().nonnegative().optional(),
            })
            .strict(),
        ]),
      )
      .optional(),
    seccompProfile: z5.string().optional(),
    apparmorProfile: z5.string().optional(),
    dns: z5.array(z5.string()).optional(),
    extraHosts: z5.array(z5.string()).optional(),
    binds: z5.array(z5.string()).optional(),
    dangerouslyAllowReservedContainerTargets: z5.boolean().optional(),
    dangerouslyAllowExternalBindSources: z5.boolean().optional(),
    dangerouslyAllowContainerNamespaceJoin: z5.boolean().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    validateSandboxBindEntries(data.binds, ctx);
    const blockedNetworkReason = getBlockedNetworkModeReason({
      network: data.network,
      allowContainerNamespaceJoin: data.dangerouslyAllowContainerNamespaceJoin === true,
    });
    if (blockedNetworkReason === "host") {
      ctx.addIssue({
        code: z5.ZodIssueCode.custom,
        path: ["network"],
        message:
          'Sandbox security: network mode "host" is blocked. Use "bridge" or "none" instead.',
      });
    }
    if (blockedNetworkReason === "container_namespace_join") {
      ctx.addIssue({
        code: z5.ZodIssueCode.custom,
        path: ["network"],
        message:
          'Sandbox security: network mode "container:*" is blocked by default. Use a custom bridge network, or set dangerouslyAllowContainerNamespaceJoin=true only when you fully trust this runtime.',
      });
    }
    if (normalizeLowercaseStringOrEmpty(data.seccompProfile ?? "") === "unconfined") {
      ctx.addIssue({
        code: z5.ZodIssueCode.custom,
        path: ["seccompProfile"],
        message:
          'Sandbox security: seccomp profile "unconfined" is blocked. Use a custom seccomp profile file or omit this setting.',
      });
    }
    if (normalizeLowercaseStringOrEmpty(data.apparmorProfile ?? "") === "unconfined") {
      ctx.addIssue({
        code: z5.ZodIssueCode.custom,
        path: ["apparmorProfile"],
        message:
          'Sandbox security: apparmor profile "unconfined" is blocked. Use a named AppArmor profile or omit this setting.',
      });
    }
  })
  .optional();
var SandboxBrowserSchema = z5
  .object({
    enabled: z5.boolean().optional(),
    image: z5.string().optional(),
    containerPrefix: z5.string().optional(),
    network: z5.string().optional(),
    cdpPort: z5.number().int().positive().optional(),
    cdpSourceRange: z5.string().optional(),
    vncPort: z5.number().int().positive().optional(),
    noVncPort: z5.number().int().positive().optional(),
    headless: z5.boolean().optional(),
    noVncEnabled: z5.boolean().optional(),
    allowHostControl: z5.boolean().optional(),
    autoStart: z5.boolean().optional(),
    autoStartTimeoutMs: z5.number().int().positive().optional(),
    binds: z5.array(z5.string()).optional(),
  })
  .superRefine((data, ctx) => {
    validateSandboxBindEntries(data.binds, ctx);
    if (normalizeLowercaseStringOrEmpty(data.network ?? "") === "host") {
      ctx.addIssue({
        code: z5.ZodIssueCode.custom,
        path: ["network"],
        message:
          'Sandbox security: browser network mode "host" is blocked. Use "bridge" or a custom bridge network instead.',
      });
    }
  })
  .strict()
  .optional();
var SandboxPruneSchema = z5
  .object({
    idleHours: z5.number().int().nonnegative().optional(),
    maxAgeDays: z5.number().int().nonnegative().optional(),
  })
  .strict()
  .optional();
var AgentContextLimitsSchema = z5
  .object({
    memoryGetMaxChars: z5.number().int().min(1).max(25e4).optional(),
    postCompactionMaxChars: z5.number().int().min(1).max(5e4).optional(),
  })
  .strict()
  .optional();
var AgentSkillsLimitsSchema = z5
  .object({
    maxSkillsPromptChars: z5.number().int().min(0).optional(),
  })
  .strict()
  .optional();
var ToolPolicyBaseSchema = z5
  .object({
    allow: z5.array(z5.string()).optional(),
    alsoAllow: z5.array(z5.string()).optional(),
    deny: z5.array(z5.string()).optional(),
  })
  .strict();
var ToolPolicySchema = ToolPolicyBaseSchema.superRefine((value, ctx) => {
  if (value.allow && value.allow.length > 0 && value.alsoAllow && value.alsoAllow.length > 0) {
    ctx.addIssue({
      code: z5.ZodIssueCode.custom,
      message:
        "tools policy cannot set both allow and alsoAllow in the same scope (merge alsoAllow into allow, or remove allow and use profile + alsoAllow)",
    });
  }
}).optional();
var ToolPolicyBySenderSchema = z5.record(z5.string(), ToolPolicySchema).optional();
var TrimmedOptionalConfigStringSchema = z5
  .string()
  .transform((value) => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : void 0;
  })
  .optional();
var CodexAllowedDomainsSchema = z5
  .array(z5.string())
  .transform((values) => {
    const deduped = uniqueStrings(
      values.map((value) => value.trim()).filter((value) => value.length > 0),
    );
    return deduped.length > 0 ? deduped : void 0;
  })
  .optional();
var CodexUserLocationSchema = z5
  .object({
    country: TrimmedOptionalConfigStringSchema,
    region: TrimmedOptionalConfigStringSchema,
    city: TrimmedOptionalConfigStringSchema,
    timezone: TrimmedOptionalConfigStringSchema,
  })
  .strict()
  .transform((value) => {
    return value.country || value.region || value.city || value.timezone ? value : void 0;
  })
  .optional();
var BLOCKED_WEB_SEARCH_KEYS_ISSUE_FIELD = "__openclawBlockedWebSearchKeys";
var ToolsWebSearchSchema = z5
  .preprocess(
    (value) => {
      if (!isRecord(value)) {
        return value;
      }
      const blockedKeys = Object.getOwnPropertyNames(value).filter((key) =>
        isBlockedObjectKey(key),
      );
      if (blockedKeys.length === 0) {
        return value;
      }
      return {
        ...value,
        [BLOCKED_WEB_SEARCH_KEYS_ISSUE_FIELD]: blockedKeys,
      };
    },
    z5
      .object({
        enabled: z5.boolean().optional(),
        provider: z5.string().optional(),
        maxResults: z5.number().int().positive().optional(),
        timeoutSeconds: z5.number().int().positive().optional(),
        cacheTtlMinutes: z5.number().nonnegative().optional(),
        openaiCodex: z5
          .object({
            enabled: z5.boolean().optional(),
            mode: z5.union([z5.literal("cached"), z5.literal("live")]).optional(),
            allowedDomains: CodexAllowedDomainsSchema,
            contextSize: z5
              .union([z5.literal("low"), z5.literal("medium"), z5.literal("high")])
              .optional(),
            userLocation: CodexUserLocationSchema,
          })
          .strict()
          .optional(),
      })
      .catchall(z5.unknown())
      .superRefine((value, ctx) => {
        const blockedKeys = value[BLOCKED_WEB_SEARCH_KEYS_ISSUE_FIELD];
        if (Array.isArray(blockedKeys)) {
          for (const key of blockedKeys) {
            if (typeof key !== "string") {
              continue;
            }
            ctx.addIssue({
              code: z5.ZodIssueCode.custom,
              path: [key],
              message: "tools.web.search must not contain blocked object keys",
            });
          }
        }
        for (const [key, entry] of Object.entries(value)) {
          if (key === BLOCKED_WEB_SEARCH_KEYS_ISSUE_FIELD || isBlockedObjectKey(key)) {
            continue;
          }
          if (
            key === "apiKey" ||
            (LEGACY_WEB_SEARCH_PROVIDER_CONFIG_KEYS.has(key) && isRecord(entry))
          ) {
            ctx.addIssue({
              code: z5.ZodIssueCode.custom,
              path: [key],
              message:
                "legacy web_search provider config must use plugins.entries.<plugin>.config.webSearch",
            });
          }
        }
      }),
  )
  .optional();
var ToolsWebFetchSchema = z5
  .object({
    enabled: z5.boolean().optional(),
    provider: z5.string().optional(),
    maxChars: z5.number().int().positive().optional(),
    maxCharsCap: z5.number().int().positive().optional(),
    maxResponseBytes: z5.number().int().positive().optional(),
    timeoutSeconds: z5.number().int().positive().optional(),
    cacheTtlMinutes: z5.number().nonnegative().optional(),
    maxRedirects: z5.number().int().nonnegative().optional(),
    userAgent: z5.string().optional(),
    readability: z5.boolean().optional(),
    useTrustedEnvProxy: z5.boolean().optional(),
    ssrfPolicy: z5
      .object({
        allowRfc2544BenchmarkRange: z5.boolean().optional(),
        allowIpv6UniqueLocalRange: z5.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional();
var ToolsWebSchema = z5
  .object({
    search: ToolsWebSearchSchema,
    fetch: ToolsWebFetchSchema,
  })
  .strict()
  .optional();
var ToolProfileSchema = z5
  .union([z5.literal("minimal"), z5.literal("coding"), z5.literal("messaging"), z5.literal("full")])
  .optional();
function addAllowAlsoAllowConflictIssue(value, ctx, message) {
  if (value.allow && value.allow.length > 0 && value.alsoAllow && value.alsoAllow.length > 0) {
    ctx.addIssue({
      code: z5.ZodIssueCode.custom,
      message,
    });
  }
}
var ToolPolicyWithProfileSchema = z5
  .object({
    allow: z5.array(z5.string()).optional(),
    alsoAllow: z5.array(z5.string()).optional(),
    deny: z5.array(z5.string()).optional(),
    profile: ToolProfileSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    addAllowAlsoAllowConflictIssue(
      value,
      ctx,
      "tools.byProvider policy cannot set both allow and alsoAllow in the same scope (merge alsoAllow into allow, or remove allow and use profile + alsoAllow)",
    );
  });
var ElevatedAllowFromSchema = z5
  .record(z5.string(), z5.array(z5.union([z5.string(), z5.number()])))
  .optional();
var ToolExecApplyPatchSchema = z5
  .object({
    enabled: z5.boolean().optional(),
    workspaceOnly: z5.boolean().optional(),
    allowModels: z5.array(z5.string()).optional(),
  })
  .strict()
  .optional();
var ToolExecSafeBinProfileSchema = z5
  .object({
    minPositional: z5.number().int().nonnegative().optional(),
    maxPositional: z5.number().int().nonnegative().optional(),
    allowedValueFlags: z5.array(z5.string()).optional(),
    deniedFlags: z5.array(z5.string()).optional(),
  })
  .strict();
var ToolExecBaseShape = {
  host: z5.enum(["auto", "sandbox", "gateway", "node"]).optional(),
  mode: z5.enum(["deny", "allowlist", "ask", "auto", "full"]).optional(),
  security: z5.enum(["deny", "allowlist", "full"]).optional(),
  ask: z5.enum(["off", "on-miss", "always"]).optional(),
  node: z5.string().optional(),
  pathPrepend: z5.array(z5.string()).optional(),
  safeBins: z5.array(z5.string()).optional(),
  strictInlineEval: z5.boolean().optional(),
  commandHighlighting: z5.boolean().optional(),
  safeBinTrustedDirs: z5.array(z5.string()).optional(),
  safeBinProfiles: z5.record(z5.string(), ToolExecSafeBinProfileSchema).optional(),
  reviewer: z5
    .object({
      model: AgentModelSchema.optional(),
      timeoutMs: z5.number().int().positive().optional(),
    })
    .strict()
    .optional(),
  backgroundMs: z5.number().int().positive().optional(),
  // The documented global setting and per-agent override share one strict contract.
  approvalRunningNoticeMs: z5.number().int().nonnegative().optional(),
  timeoutSeconds: z5.number().int().positive().optional(),
  cleanupMs: z5.number().int().positive().optional(),
  notifyOnExit: z5.boolean().optional(),
  notifyOnExitEmptySuccess: z5.boolean().optional(),
  applyPatch: ToolExecApplyPatchSchema,
};
function addExecPolicyModeConflictIssue(value, ctx) {
  if (value.mode === void 0 || (value.security === void 0 && value.ask === void 0)) {
    return;
  }
  ctx.addIssue({
    code: z5.ZodIssueCode.custom,
    path: ["mode"],
    message: "tools.exec.mode cannot be combined with tools.exec.security or tools.exec.ask",
  });
}
var ToolExecSchema = z5
  .object(ToolExecBaseShape)
  .strict()
  .superRefine(addExecPolicyModeConflictIssue)
  .optional();
var ToolFsSchema = z5
  .object({
    workspaceOnly: z5.boolean().optional(),
  })
  .strict()
  .optional();
var ToolLoopDetectionSchema = z5
  .object({
    enabled: z5.boolean().optional(),
  })
  .strict()
  .optional();
var ToolSearchSchema = z5
  .union([
    z5.boolean(),
    z5
      .object({
        enabled: z5.boolean().optional(),
        mode: z5.enum(["code", "tools", "directory"]).optional(),
        codeTimeoutMs: z5.number().int().positive().optional(),
        searchDefaultLimit: z5.number().int().positive().optional(),
        maxSearchLimit: z5.number().int().positive().optional(),
      })
      .strict(),
  ])
  .optional();
var CodeModeSchema = z5
  .union([
    z5.boolean(),
    z5.literal("auto"),
    z5
      .object({
        enabled: z5.union([z5.boolean(), z5.literal("auto")]).optional(),
        runtime: z5.literal("quickjs-wasi").optional(),
        mode: z5.literal("only").optional(),
        languages: z5.array(z5.enum(["javascript", "typescript"])).optional(),
        timeoutMs: z5.number().int().positive().optional(),
        memoryLimitBytes: z5.number().int().positive().optional(),
        maxOutputBytes: z5.number().int().positive().optional(),
        maxSnapshotBytes: z5.number().int().positive().optional(),
        maxPendingToolCalls: z5.number().int().positive().optional(),
        snapshotTtlSeconds: z5.number().int().positive().optional(),
        searchDefaultLimit: z5.number().int().positive().optional(),
        maxSearchLimit: z5.number().int().positive().optional(),
      })
      .strict(),
  ])
  .optional();
var SwarmSchema = z5
  .union([
    z5.boolean(),
    z5
      .object({
        enabled: z5.boolean().optional(),
        maxConcurrent: z5.number().int().positive().optional(),
        maxChildrenPerGroup: z5.number().int().positive().optional(),
        maxTotalPerGroup: z5.number().int().positive().optional(),
        waitTimeoutSecondsMax: z5.number().int().positive().optional(),
        defaultAgentId: z5.string().optional(),
      })
      .strict(),
  ])
  .optional();
var SandboxSshSchema = z5
  .object({
    target: z5.string().min(1).optional(),
    command: z5.string().min(1).optional(),
    workspaceRoot: z5.string().min(1).optional(),
    strictHostKeyChecking: z5.boolean().optional(),
    updateHostKeys: z5.boolean().optional(),
    identityFile: z5.string().min(1).optional(),
    certificateFile: z5.string().min(1).optional(),
    knownHostsFile: z5.string().min(1).optional(),
    identityData: SecretInputSchema.optional().register(sensitive),
    certificateData: SecretInputSchema.optional().register(sensitive),
    knownHostsData: SecretInputSchema.optional().register(sensitive),
  })
  .strict()
  .optional();
var AgentSandboxSchema = z5
  .object({
    mode: z5.union([z5.literal("off"), z5.literal("non-main"), z5.literal("all")]).optional(),
    backend: z5.string().min(1).optional(),
    workspaceAccess: z5.union([z5.literal("none"), z5.literal("ro"), z5.literal("rw")]).optional(),
    sessionToolsVisibility: z5.union([z5.literal("spawned"), z5.literal("all")]).optional(),
    scope: z5.union([z5.literal("session"), z5.literal("agent"), z5.literal("shared")]).optional(),
    workspaceRoot: z5.string().optional(),
    docker: SandboxDockerSchema,
    ssh: SandboxSshSchema,
    browser: SandboxBrowserSchema,
    prune: SandboxPruneSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    const blockedBrowserNetworkReason = getBlockedNetworkModeReason({
      network: data.browser?.network,
      allowContainerNamespaceJoin: data.docker?.dangerouslyAllowContainerNamespaceJoin === true,
    });
    if (blockedBrowserNetworkReason === "container_namespace_join") {
      ctx.addIssue({
        code: z5.ZodIssueCode.custom,
        path: ["browser", "network"],
        message:
          'Sandbox security: browser network mode "container:*" is blocked by default. Set sandbox.docker.dangerouslyAllowContainerNamespaceJoin=true only when you fully trust this runtime.',
      });
    }
  })
  .optional();
var CommonToolPolicyFields = {
  profile: ToolProfileSchema,
  allow: z5.array(z5.string()).optional(),
  alsoAllow: z5.array(z5.string()).optional(),
  deny: z5.array(z5.string()).optional(),
  byProvider: z5.record(z5.string(), ToolPolicyWithProfileSchema).optional(),
  toolsBySender: ToolPolicyBySenderSchema,
};
var MessageToolConfigSchema = z5
  .object({
    crossContext: z5
      .object({
        allowWithinProvider: z5.boolean().optional(),
        allowAcrossProviders: z5.boolean().optional(),
        marker: z5
          .object({
            enabled: z5.boolean().optional(),
            prefix: z5.string().optional(),
            suffix: z5.string().optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    actions: z5
      .object({
        allow: z5.array(z5.string()).optional(),
      })
      .strict()
      .optional(),
    broadcast: z5
      .object({
        enabled: z5.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional();
var AgentToolsSchema = z5
  .object({
    ...CommonToolPolicyFields,
    codeMode: CodeModeSchema,
    swarm: SwarmSchema,
    elevated: z5
      .object({
        enabled: z5.boolean().optional(),
        allowFrom: ElevatedAllowFromSchema,
      })
      .strict()
      .optional(),
    exec: ToolExecSchema,
    fs: ToolFsSchema,
    loopDetection: ToolLoopDetectionSchema,
    message: MessageToolConfigSchema,
    sandbox: z5
      .object({
        tools: ToolPolicySchema,
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    addAllowAlsoAllowConflictIssue(
      value,
      ctx,
      "agent tools cannot set both allow and alsoAllow in the same scope (merge alsoAllow into allow, or remove allow and use profile + alsoAllow)",
    );
  })
  .optional();
var MemorySearchSchema = z5
  .object({
    enabled: z5.boolean().optional(),
    rememberAcrossConversations: z5.boolean().optional(),
    sources: z5.array(z5.union([z5.literal("memory"), z5.literal("sessions")])).optional(),
    extraPaths: z5.array(z5.string()).optional(),
    qmd: z5
      .object({
        extraCollections: z5
          .array(
            z5
              .object({
                path: z5.string(),
                name: z5.string().optional(),
                pattern: z5.string().optional(),
              })
              .strict(),
          )
          .optional(),
      })
      .strict()
      .optional(),
    multimodal: z5
      .object({
        enabled: z5.boolean().optional(),
        modalities: z5
          .array(z5.union([z5.literal("image"), z5.literal("audio"), z5.literal("all")]))
          .optional(),
        maxFileBytes: z5.number().int().positive().optional(),
      })
      .strict()
      .optional(),
    experimental: z5.object({ sessionMemory: z5.boolean().optional() }).strict().optional(),
    provider: z5.string().optional(),
    remote: z5
      .object({
        baseUrl: z5.string().optional(),
        apiKey: SecretInputSchema.optional().register(sensitive),
        headers: z5.record(z5.string(), z5.string()).optional(),
        batch: z5
          .object({
            enabled: z5.boolean().optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    fallback: z5.string().optional(),
    model: z5.string().optional(),
    inputType: z5.string().min(1).optional(),
    queryInputType: z5.string().min(1).optional(),
    documentInputType: z5.string().min(1).optional(),
    outputDimensionality: z5.number().int().positive().optional(),
    local: z5
      .object({
        modelPath: z5.string().optional(),
      })
      .strict()
      .optional(),
    store: z5
      .object({
        fts: z5
          .object({
            tokenizer: z5.union([z5.literal("unicode61"), z5.literal("trigram")]).optional(),
          })
          .strict()
          .optional(),
        vector: z5
          .object({
            enabled: z5.boolean().optional(),
            extensionPath: z5.string().optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    query: z5
      .object({
        maxResults: z5.number().int().positive().optional(),
        minScore: z5.number().min(0).max(1).optional(),
      })
      .strict()
      .optional(),
    cache: z5
      .object({
        enabled: z5.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional();
var AgentRuntimeAcpSchema = z5
  .object({
    agent: z5.string().optional(),
    backend: z5.string().optional(),
    mode: z5.enum(["persistent", "oneshot"]).optional(),
    cwd: z5.string().optional(),
  })
  .strict()
  .optional();
var AgentRuntimeSchema = z5
  .union([
    z5
      .object({
        type: z5.literal("embedded"),
      })
      .strict(),
    z5
      .object({
        type: z5.literal("acp"),
        acp: AgentRuntimeAcpSchema,
      })
      .strict(),
  ])
  .optional();
var AgentRuntimePolicySchema = z5
  .object({
    id: z5.string().optional(),
  })
  .strict()
  .optional();
var AgentModelRuntimeEntrySchema = z5
  .object({
    alias: z5.string().optional(),
    params: z5.record(z5.string(), z5.unknown()).optional(),
    agentRuntime: AgentRuntimePolicySchema,
    streaming: z5.boolean().optional(),
  })
  .strict();
var AgentModelPolicySchema = z5
  .object({
    allow: z5.array(z5.string()).optional(),
  })
  .strict();
var AgentEntrySchema = z5
  .object({
    id: z5.string(),
    default: z5.boolean().optional(),
    name: z5.string().optional(),
    description: z5.string().optional(),
    workspace: z5.string().optional(),
    agentDir: z5.string().optional(),
    model: AgentModelSchema.optional(),
    utilityModel: z5.string().optional(),
    models: z5.record(z5.string(), AgentModelRuntimeEntrySchema).optional(),
    modelPolicy: AgentModelPolicySchema.optional(),
    thinkingDefault: z5
      .enum(["off", "minimal", "low", "medium", "high", "xhigh", "adaptive", "max", "ultra"])
      .optional(),
    verboseDefault: z5.enum(["off", "on", "full"]).optional(),
    toolProgressDetail: z5.enum(["explain", "raw"]).optional(),
    reasoningDefault: z5.enum(["on", "off", "stream"]).optional(),
    fastModeDefault: z5.union([z5.boolean(), z5.literal("auto")]).optional(),
    contextInjection: z5
      .union([z5.literal("always"), z5.literal("continuation-skip"), z5.literal("never")])
      .optional(),
    bootstrapMaxChars: z5.number().int().positive().optional(),
    bootstrapTotalMaxChars: z5.number().int().positive().optional(),
    experimental: z5
      .object({
        localModelLean: z5.boolean().optional(),
      })
      .strict()
      .optional(),
    skills: z5.array(z5.string()).optional(),
    memory: z5
      .object({
        search: MemorySearchSchema,
      })
      .strict()
      .optional(),
    humanDelay: HumanDelaySchema.optional(),
    typingMode: TypingModeSchema.optional(),
    tts: AgentTtsConfigSchema,
    skillsLimits: AgentSkillsLimitsSchema,
    contextLimits: AgentContextLimitsSchema,
    contextTokens: z5.number().int().positive().optional(),
    heartbeat: HeartbeatSchema,
    identity: IdentitySchema,
    groupChat: GroupChatSchema.unwrap().omit({ visibleReplies: true }).optional(),
    subagents: z5
      .object({
        delegationMode: z5.enum(["suggest", "prefer"]).optional(),
        allowAgents: z5.array(z5.string()).optional(),
        model: AgentModelSchema.optional(),
        thinking: z5.string().optional(),
        requireAgentId: z5.boolean().optional(),
      })
      .strict()
      .optional(),
    embeddedAgent: AgentEntryEmbeddedAgentConfigSchema.optional(),
    sandbox: AgentSandboxSchema,
    params: z5.record(z5.string(), z5.unknown()).optional(),
    tools: AgentToolsSchema,
    runtime: AgentRuntimeSchema,
  })
  .strict();
var ToolsSchema = z5
  .object({
    ...CommonToolPolicyFields,
    web: ToolsWebSchema,
    media: ToolsMediaSchema,
    links: ToolsLinksSchema,
    sessions: z5
      .object({
        visibility: z5.enum(["self", "tree", "agent", "all"]).optional(),
      })
      .strict()
      .optional(),
    loopDetection: ToolLoopDetectionSchema,
    toolSearch: ToolSearchSchema,
    codeMode: CodeModeSchema,
    swarm: SwarmSchema,
    message: MessageToolConfigSchema,
    agentToAgent: z5
      .object({
        enabled: z5.boolean().optional(),
        allow: z5.array(z5.string()).optional(),
      })
      .strict()
      .optional(),
    elevated: z5
      .object({
        enabled: z5.boolean().optional(),
        allowFrom: ElevatedAllowFromSchema,
      })
      .strict()
      .optional(),
    exec: ToolExecSchema,
    fs: ToolFsSchema,
    subagents: z5
      .object({
        tools: ToolPolicySchema,
      })
      .strict()
      .optional(),
    sandbox: z5
      .object({
        tools: ToolPolicySchema,
      })
      .strict()
      .optional(),
    sessions_spawn: z5
      .object({
        attachments: z5
          .object({
            enabled: z5.boolean().optional(),
            maxTotalBytes: z5.number().optional(),
            maxFiles: z5.number().optional(),
            maxFileBytes: z5.number().optional(),
            retainOnSessionKeep: z5.boolean().optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    updatePlan: z5.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    addAllowAlsoAllowConflictIssue(
      value,
      ctx,
      "tools cannot set both allow and alsoAllow in the same scope (merge alsoAllow into allow, or remove allow and use profile + alsoAllow)",
    );
  })
  .optional();

// vendor/openclaw/src/config/zod-schema.agent-defaults.ts
var SilentReplyPolicySchema = z6.union([z6.literal("allow"), z6.literal("disallow")]);
var NonNegativeByteSizeSchema = z6.union([
  z6.number().int().nonnegative(),
  z6.string().refine(isValidNonNegativeByteSizeString, "Expected byte size string like 2mb"),
]);
var OptionalBootstrapFileNameSchema = z6.enum([
  "SOUL.md",
  "USER.md",
  "HEARTBEAT.md",
  "IDENTITY.md",
]);
var AgentThinkingLevelSchema = z6.enum([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "adaptive",
  "max",
  "ultra",
]);
var EmbeddedAgentConfigSchema = z6
  .object({
    projectSettingsPolicy: z6
      .union([z6.literal("trusted"), z6.literal("sanitize"), z6.literal("ignore")])
      .optional(),
    executionContract: z6.union([z6.literal("default"), z6.literal("strict-agentic")]).optional(),
  })
  .strict();
var SilentReplyPolicyConfigSchema = z6
  .object({
    group: SilentReplyPolicySchema.optional(),
    internal: SilentReplyPolicySchema.optional(),
  })
  .strict();
var AgentDefaultsSchema = z6
  .object({
    /** Global default provider params applied to all models before per-model and per-agent overrides. */
    params: z6.record(z6.string(), z6.unknown()).optional(),
    model: AgentModelSchema.optional(),
    utilityModel: z6.string().optional(),
    imageModel: AgentToolModelSchema.optional(),
    mediaModels: z6
      .object({
        image: AgentToolModelSchema.optional(),
        video: AgentToolModelSchema.optional(),
        music: AgentToolModelSchema.optional(),
      })
      .strict()
      .optional(),
    voiceModel: AgentToolModelSchema.optional(),
    pdfModel: AgentToolModelSchema.optional(),
    pdfMaxMb: z6.number().positive().optional(),
    pdfMaxPages: z6.number().int().positive().optional(),
    models: z6.record(z6.string(), AgentModelRuntimeEntrySchema).optional(),
    modelPolicy: AgentModelPolicySchema.optional(),
    workspace: z6.string().optional(),
    skills: z6.array(z6.string()).optional(),
    silentReply: SilentReplyPolicyConfigSchema.optional(),
    repoRoot: z6.string().optional(),
    skipBootstrap: z6.boolean().optional(),
    skipOptionalBootstrapFiles: z6.array(OptionalBootstrapFileNameSchema).optional(),
    contextInjection: z6
      .union([z6.literal("always"), z6.literal("continuation-skip"), z6.literal("never")])
      .optional(),
    bootstrapMaxChars: z6.number().int().positive().optional(),
    bootstrapTotalMaxChars: z6.number().int().positive().optional(),
    experimental: z6
      .object({
        localModelLean: z6.boolean().optional(),
      })
      .strict()
      .optional(),
    userTimezone: z6.string().optional(),
    startupContext: z6
      .object({
        enabled: z6.boolean().optional(),
        applyOn: z6.array(z6.union([z6.literal("new"), z6.literal("reset")])).optional(),
        dailyMemoryDays: z6.number().int().min(1).max(14).optional(),
        maxFileBytes: z6
          .number()
          .int()
          .min(1)
          .max(64 * 1024)
          .optional(),
        maxFileChars: z6.number().int().min(1).max(1e4).optional(),
        maxTotalChars: z6.number().int().min(1).max(5e4).optional(),
      })
      .strict()
      .optional(),
    contextLimits: AgentContextLimitsSchema,
    contextTokens: z6.number().int().positive().optional(),
    contextPruning: z6
      .object({
        mode: z6.union([z6.literal("off"), z6.literal("cache-ttl")]).optional(),
        ttl: z6.string().optional(),
        tools: z6
          .object({
            allow: z6.array(z6.string()).optional(),
            deny: z6.array(z6.string()).optional(),
          })
          .strict()
          .optional(),
        hardClear: z6
          .object({
            enabled: z6.boolean().optional(),
            placeholder: z6.string().optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    compaction: z6
      .object({
        enabled: z6.boolean().optional(),
        mode: z6.union([z6.literal("default"), z6.literal("safeguard")]).optional(),
        provider: z6.string().optional(),
        thinkingLevel: AgentThinkingLevelSchema.optional(),
        keepRecentTokens: z6.number().int().positive().optional(),
        identifierPolicy: z6.union([z6.literal("strict"), z6.literal("off")]).optional(),
        recentTurnsPreserve: z6.number().int().min(0).max(12).optional(),
        qualityGuard: z6
          .object({
            enabled: z6.boolean().optional(),
            maxRetries: z6.number().int().nonnegative().optional(),
          })
          .strict()
          .optional(),
        midTurnPrecheck: z6
          .object({
            enabled: z6.boolean().optional(),
          })
          .strict()
          .optional(),
        postIndexSync: z6.enum(["off", "async", "await"]).optional(),
        postCompactionSections: z6.array(z6.string()).optional(),
        model: z6.string().optional(),
        timeoutSeconds: z6.number().int().positive().optional(),
        memoryFlush: z6
          .object({
            enabled: z6.boolean().optional(),
            model: z6.string().optional(),
            softThresholdTokens: z6.number().int().nonnegative().optional(),
            forceFlushTranscriptBytes: NonNegativeByteSizeSchema.optional(),
          })
          .strict()
          .optional(),
        maxActiveTranscriptBytes: NonNegativeByteSizeSchema.optional(),
        notifyUser: z6.boolean().optional(),
      })
      .strict()
      .optional(),
    embeddedAgent: EmbeddedAgentConfigSchema.optional(),
    thinkingDefault: AgentThinkingLevelSchema.optional(),
    fastModeDefault: z6.union([z6.boolean(), z6.literal("auto")]).optional(),
    verboseDefault: z6.union([z6.literal("off"), z6.literal("on"), z6.literal("full")]).optional(),
    toolProgressDetail: z6.union([z6.literal("explain"), z6.literal("raw")]).optional(),
    reasoningDefault: z6
      .union([z6.literal("off"), z6.literal("on"), z6.literal("stream")])
      .optional(),
    elevatedDefault: z6
      .union([z6.literal("off"), z6.literal("on"), z6.literal("ask"), z6.literal("full")])
      .optional(),
    blockStreamingDefault: z6.union([z6.literal("off"), z6.literal("on")]).optional(),
    blockStreamingBreak: z6.union([z6.literal("text_end"), z6.literal("message_end")]).optional(),
    blockStreamingChunk: BlockStreamingChunkSchema.optional(),
    blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
    humanDelay: HumanDelaySchema.optional(),
    // 0 = unlimited run budget; stream liveness watchdogs still apply.
    timeoutSeconds: z6.number().int().nonnegative().optional(),
    mediaMaxMb: z6.number().positive().optional(),
    imageMaxDimensionPx: z6.number().int().positive().optional(),
    imageQuality: z6.enum(["auto", "efficient", "balanced", "high"]).optional(),
    typingIntervalSeconds: z6.number().int().positive().optional(),
    typingMode: TypingModeSchema.optional(),
    heartbeat: HeartbeatSchema.unwrap()
      .safeExtend({ agentId: z6.string().trim().min(1).optional() })
      .optional(),
    systemAgent: z6
      .object({
        agentId: z6.string().trim().min(1).optional(),
      })
      .strict()
      .optional(),
    maxConcurrent: z6.number().int().positive().optional(),
    subagents: z6
      .object({
        delegationMode: z6.enum(["suggest", "prefer"]).optional(),
        allowAgents: z6.array(z6.string()).optional(),
        maxConcurrent: z6.number().int().positive().optional(),
        maxSpawnDepth: z6
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .describe(
            "Maximum nesting depth for sub-agent spawning. 1 = no nesting (default), 2 = sub-agents can spawn sub-sub-agents.",
          ),
        maxChildrenPerAgent: z6
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe(
            "Maximum number of active children a single agent session can spawn (default: 5).",
          ),
        archiveAfterMinutes: z6.number().int().min(0).optional(),
        model: AgentModelSchema.optional(),
        thinking: z6.string().optional(),
        runTimeoutSeconds: z6.number().int().min(0).optional(),
        announceTimeoutMs: z6.number().int().positive().optional(),
        requireAgentId: z6.boolean().optional(),
      })
      .strict()
      .optional(),
    sandbox: AgentSandboxSchema,
  })
  .strict()
  .optional();

// vendor/openclaw/src/config/zod-schema.agents.ts
import { z as z7 } from "zod";
var AgentEntryConfigSchema = z7.preprocess(
  (value, ctx) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const key of Object.getOwnPropertyNames(value)) {
        if (!isBlockedObjectKey(key)) {
          continue;
        }
        ctx.addIssue({
          code: z7.ZodIssueCode.custom,
          path: [key],
          message: "agent entries must not contain blocked object keys",
        });
        return z7.NEVER;
      }
    }
    return value;
  },
  AgentEntrySchema.omit({ id: true }),
);
var AgentsSchema = z7
  .object({
    defaults: z7.lazy(() => AgentDefaultsSchema).optional(),
    entries: z7
      .record(
        z7.string().regex(/^[a-z0-9_][a-z0-9_-]{0,63}$/i, "Invalid agent id"),
        AgentEntryConfigSchema,
      )
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const agents = Object.values(value.entries ?? {});
    const defaultCount = agents.filter((agent) => agent.default === true).length;
    if (defaultCount !== 1) {
      ctx.addIssue({
        code: z7.ZodIssueCode.custom,
        path: ["entries"],
        message: `agents.entries must contain exactly one default=true entry (found ${defaultCount})`,
      });
    }
  })
  .optional();
var BindingMatchSchema = z7
  .object({
    channel: z7.string(),
    accountId: z7.string().optional(),
    peer: z7
      .object({
        kind: z7.union([z7.literal("direct"), z7.literal("group"), z7.literal("channel")]),
        id: z7.string(),
      })
      .strict()
      .optional(),
    guildId: z7.string().optional(),
    teamId: z7.string().optional(),
    roles: z7.array(z7.string()).optional(),
  })
  .strict();
var BindingSessionSchema = z7
  .object({
    dmScope: z7
      .union([
        z7.literal("main"),
        z7.literal("per-peer"),
        z7.literal("per-channel-peer"),
        z7.literal("per-account-channel-peer"),
      ])
      .optional(),
  })
  .strict();
var RouteBindingSchema = z7
  .object({
    type: z7.literal("route").optional(),
    agentId: z7.string(),
    comment: z7.string().optional(),
    match: BindingMatchSchema,
    session: BindingSessionSchema.optional(),
  })
  .strict();
var AcpBindingSchema = z7
  .object({
    type: z7.literal("acp"),
    agentId: z7.string(),
    comment: z7.string().optional(),
    match: BindingMatchSchema,
    acp: z7
      .object({
        mode: z7.enum(["persistent", "oneshot"]).optional(),
        label: z7.string().optional(),
        cwd: z7.string().optional(),
        backend: z7.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const peerId = normalizeOptionalString(value.match.peer?.id) ?? "";
    if (!peerId) {
      ctx.addIssue({
        code: z7.ZodIssueCode.custom,
        path: ["match", "peer"],
        message: "ACP bindings require match.peer.id to target a concrete conversation.",
      });
    }
  });
var BindingsSchema = z7.array(z7.union([RouteBindingSchema, AcpBindingSchema])).optional();
var BroadcastStrategySchema = z7.enum(["parallel", "sequential"]);
var BroadcastSchema = z7
  .object({
    strategy: BroadcastStrategySchema.optional(),
  })
  .catchall(z7.array(z7.string()))
  .optional();

// vendor/openclaw/src/config/zod-schema.approvals.ts
import { z as z8 } from "zod";
var NativeExecApprovalEnableModeSchema = z8.union([z8.boolean(), z8.literal("auto")]);
var ExecApprovalForwardTargetSchema = z8
  .object({
    channel: z8.string().min(1),
    to: z8.string().min(1),
    accountId: z8.string().optional(),
    threadId: z8.union([z8.string(), z8.number()]).optional(),
  })
  .strict();
var ExecApprovalForwardingSchema = z8
  .object({
    enabled: z8.boolean().optional(),
    mode: z8.union([z8.literal("session"), z8.literal("targets"), z8.literal("both")]).optional(),
    agentFilter: z8.array(z8.string()).optional(),
    sessionFilter: z8.array(z8.string()).optional(),
    targets: z8.array(ExecApprovalForwardTargetSchema).optional(),
  })
  .strict()
  .optional();
var ApprovalsSchema = z8
  .object({
    exec: ExecApprovalForwardingSchema,
    plugin: ExecApprovalForwardingSchema,
  })
  .strict()
  .optional();

// vendor/openclaw/src/config/zod-schema.channels-config.ts
import { z as z11 } from "zod";

// vendor/openclaw/src/config/zod-schema.channels.ts
import { z as z9 } from "zod";
var ChannelHeartbeatVisibilitySchema = z9
  .object({
    showOk: z9.boolean().optional(),
    showAlerts: z9.boolean().optional(),
    useIndicator: z9.boolean().optional(),
  })
  .strict()
  .optional();
var ChannelHealthMonitorSchema = z9
  .object({
    enabled: z9.boolean().optional(),
  })
  .strict()
  .optional();

// vendor/openclaw/src/config/zod-schema.implicit-mentions.ts
import { z as z10 } from "zod";
var ChannelImplicitMentionsSchema = z10
  .object({
    replyToBot: z10.boolean().optional(),
    quotedBot: z10.boolean().optional(),
    threadParticipation: z10.boolean().optional(),
  })
  .strict();

// vendor/openclaw/src/config/zod-schema.channels-config.ts
var ChannelModelByChannelSchema = z11
  .record(z11.string(), z11.record(z11.string(), z11.string()))
  .optional();
var ChannelBotLoopProtectionSchema = z11
  .object({
    enabled: z11.boolean().optional(),
    maxEventsPerWindow: z11.number().int().positive().optional(),
    windowSeconds: z11.number().int().positive().optional(),
    cooldownSeconds: z11.number().int().positive().optional(),
  })
  .strict();
function addLegacyChannelAcpBindingIssues(value, ctx, path7 = []) {
  if (!value || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      addLegacyChannelAcpBindingIssues(entry, ctx, [...path7, index]),
    );
    return;
  }
  const record = value;
  const bindings = record.bindings;
  if (bindings && typeof bindings === "object" && !Array.isArray(bindings)) {
    const acp = bindings.acp;
    if (acp && typeof acp === "object") {
      ctx.addIssue({
        code: z11.ZodIssueCode.custom,
        path: [...path7, "bindings", "acp"],
        message:
          "Legacy channel-local ACP bindings were removed; use top-level bindings[] entries.",
      });
    }
  }
  for (const [key, entry] of Object.entries(record)) {
    addLegacyChannelAcpBindingIssues(entry, ctx, [...path7, key]);
  }
}
var ChannelsSchema = z11
  .object({
    defaults: z11
      .object({
        groupPolicy: GroupPolicySchema.optional(),
        contextVisibility: ContextVisibilityModeSchema.optional(),
        heartbeatVisibility: ChannelHeartbeatVisibilitySchema,
        botLoopProtection: ChannelBotLoopProtectionSchema.optional(),
        implicitMentions: ChannelImplicitMentionsSchema.optional(),
      })
      .strict()
      .optional(),
    modelByChannel: ChannelModelByChannelSchema,
  })
  .passthrough()
  .superRefine((value, ctx) => {
    addLegacyChannelAcpBindingIssues(value, ctx);
  })
  .optional();

// vendor/openclaw/src/config/zod-schema.cloud-workers.ts
import { z as z12 } from "zod";

// vendor/openclaw/src/plugins/host-hook-json.ts
var PLUGIN_JSON_VALUE_LIMITS = {
  maxDepth: 32,
  maxNodes: 4096,
  maxObjectKeys: 512,
  maxStringLength: 64 * 1024,
  maxSerializedBytes: 256 * 1024,
};
function isPluginJsonValueWithinLimits(value, limits, state) {
  state.nodes += 1;
  if (state.nodes > limits.maxNodes || state.depth > limits.maxDepth) {
    return false;
  }
  if (value === null || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "string") {
    return value.length <= limits.maxStringLength;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    state.depth += 1;
    const ok2 = value.every((entry) => isPluginJsonValueWithinLimits(entry, limits, state));
    state.depth -= 1;
    return ok2;
  }
  if (typeof value !== "object") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }
  const entries = Object.entries(value);
  if (entries.length > limits.maxObjectKeys) {
    return false;
  }
  state.depth += 1;
  const ok = entries.every(
    ([key, entry]) =>
      key.length <= limits.maxStringLength && isPluginJsonValueWithinLimits(entry, limits, state),
  );
  state.depth -= 1;
  return ok;
}
function isPluginJsonValue(value) {
  if (!isPluginJsonValueWithinLimits(value, PLUGIN_JSON_VALUE_LIMITS, { depth: 0, nodes: 0 })) {
    return false;
  }
  try {
    return (
      Buffer.byteLength(JSON.stringify(value), "utf8") <=
      PLUGIN_JSON_VALUE_LIMITS.maxSerializedBytes
    );
  } catch {
    return false;
  }
}

// vendor/openclaw/src/config/sensitive-paths.ts
var SENSITIVE_KEY_WHITELIST_SUFFIXES = [
  "maxtokens",
  "maxoutputtokens",
  "maxinputtokens",
  "maxcompletiontokens",
  "contexttokens",
  "totaltokens",
  "tokencount",
  "tokenlimit",
  "tokenbudget",
  "passwordFile",
];
var NORMALIZED_SENSITIVE_KEY_WHITELIST_SUFFIXES = SENSITIVE_KEY_WHITELIST_SUFFIXES.map((suffix) =>
  normalizeLowercaseStringOrEmpty(suffix),
);
var SENSITIVE_PATTERNS = [
  /token$/i,
  /password/i,
  /secret/i,
  /api.?key/i,
  /encrypt.?key/i,
  /private.?key/i,
  /serviceaccount(?:ref)?$/i,
];
function isWhitelistedSensitivePath(path7) {
  const lowerPath = normalizeLowercaseStringOrEmpty(path7);
  return NORMALIZED_SENSITIVE_KEY_WHITELIST_SUFFIXES.some((suffix) => lowerPath.endsWith(suffix));
}
function matchesSensitivePattern(path7) {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(path7));
}
function isLocalServiceEnvValuePath(path7) {
  const lowerPath = normalizeLowercaseStringOrEmpty(path7);
  return lowerPath.includes("localservice.env.");
}
function isSensitiveConfigPath(path7) {
  return (
    // Every local service env value is sensitive, even innocuous-looking names.
    isLocalServiceEnvValuePath(path7) ||
    (!isWhitelistedSensitivePath(path7) && matchesSensitivePattern(path7))
  );
}

// vendor/openclaw/src/config/zod-schema.cloud-workers.ts
function validateCloudWorkerProfileSettings(value) {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !isPluginJsonValue(value)
  ) {
    return "Worker profile settings must be bounded finite JSON";
  }
  const visit = (entry) => {
    if (Array.isArray(entry)) {
      return entry.map(visit).find((error) => error !== void 0);
    }
    if (typeof entry !== "object" || entry === null) {
      return void 0;
    }
    for (const [key, child] of Object.entries(entry)) {
      const baseKey = key.replace(/ref$/i, "");
      const isSensitive =
        key.toLowerCase() === "keyref" ||
        isSensitiveConfigPath(key) ||
        (baseKey !== key && isSensitiveConfigPath(baseKey));
      if (isSensitive) {
        if (!isSecretRef(child) || !isValidSecretRef(child)) {
          return `Worker profile ${key} must use a SecretRef`;
        }
        continue;
      }
      const error = visit(child);
      if (error) {
        return error;
      }
    }
    return void 0;
  };
  return visit(value);
}
var CloudWorkerSettingsSchema = z12
  .record(z12.string(), z12.unknown())
  .superRefine((value, ctx) => {
    const message = validateCloudWorkerProfileSettings(value);
    if (message) {
      ctx.addIssue({ code: "custom", message });
    }
  });
var CloudWorkerProfileShape = {
  provider: z12.string().trim().min(1).register(configUiMetadata, {
    label: "Cloud Worker Provider",
    help: "Worker provider id registered by a plugin. The configured plugin must expose this id before the gateway can provision environments from the profile.",
  }),
  install: z12.enum(["bundle", "npm"]).optional().default("bundle").register(configUiMetadata, {
    label: "Cloud Worker Install Method",
    help: `Worker installation method: "bundle" (default) transfers the gateway's content-hashed installed build and supports released, development, and unreleased versions; "npm" installs the exact gateway version and is available only when that version is released.`,
  }),
  settings: CloudWorkerSettingsSchema.optional().register(configUiMetadata, {
    label: "Cloud Worker Provider Settings",
    help: "Provider-owned settings validated by the selected plugin. Use SecretRef objects for secret-bearing values; opaque settings do not gain automatic secret resolution.",
  }),
};
var CloudWorkerProfileSchema = z12
  .object(CloudWorkerProfileShape)
  .strict()
  .register(configUiMetadata, {
    label: "Cloud Worker Profile",
    help: "One cloud worker profile selected by name when creating an environment. Keep provider credentials in supported references rather than embedding secret material in this block.",
  });
var CloudWorkerProfileIdSchema = z12
  .string()
  .min(1)
  .refine(
    (value) => value === value.trim(),
    "Worker profile ids must not contain outer whitespace",
  );
var CloudWorkersConfigShape = {
  profiles: z12
    .record(CloudWorkerProfileIdSchema, CloudWorkerProfileSchema)
    .optional()
    .register(configUiMetadata, {
      label: "Cloud Worker Profiles",
      help: "Named cloud worker profiles. Each profile selects a worker provider registered by a plugin and carries provider-owned settings.",
    }),
};
var CloudWorkersConfigSchema = z12.object(CloudWorkersConfigShape).strict().optional();
var CLOUD_WORKER_FIELD_SCHEMAS = {
  "cloudWorkers.profiles": CloudWorkersConfigShape.profiles,
  "cloudWorkers.profiles.*": CloudWorkerProfileSchema,
  "cloudWorkers.profiles.*.provider": CloudWorkerProfileShape.provider,
  "cloudWorkers.profiles.*.install": CloudWorkerProfileShape.install,
  "cloudWorkers.profiles.*.settings": CloudWorkerProfileShape.settings,
};
function projectCloudWorkerFieldMetadata(field) {
  return Object.fromEntries(
    Object.entries(CLOUD_WORKER_FIELD_SCHEMAS).flatMap(([path7, schema]) => {
      const value = configUiMetadata.get(schema)?.[field];
      return typeof value === "string" ? [[path7, value]] : [];
    }),
  );
}
var CLOUD_WORKER_FIELD_LABELS = projectCloudWorkerFieldMetadata("label");
var CLOUD_WORKER_FIELD_HELP = projectCloudWorkerFieldMetadata("help");

// vendor/openclaw/src/config/zod-schema.gateway.ts
import { z as z16 } from "zod";

// vendor/openclaw/packages/net-policy/src/url-protocol.ts
function parseUrl(value) {
  if (value instanceof URL) {
    return value;
  }
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
function isHttpUrl(value) {
  const url = parseUrl(value);
  return url?.protocol === "http:" || url?.protocol === "https:";
}
function isHttpsUrl(value) {
  return parseUrl(value)?.protocol === "https:";
}

// vendor/openclaw/src/config/zod-schema.root-support.ts
import { z as z15 } from "zod";

// vendor/openclaw/src/config/zod-schema.node-host.ts
import { z as z13 } from "zod";
var BrowserSnapshotDefaultsSchema = z13
  .object({
    mode: z13.literal("efficient").optional(),
  })
  .strict()
  .optional();
var NodeHostAgentRunsSchema = z13
  .object({
    claude: z13
      .object({
        enabled: z13.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional();

// vendor/openclaw/src/config/zod-schema.session.ts
import { z as z14 } from "zod";
var SessionResetConfigSchema = z14
  .object({
    mode: z14.union([z14.literal("none"), z14.literal("daily"), z14.literal("idle")]).optional(),
    atHour: z14.number().int().min(0).max(23).optional(),
    idleMinutes: z14.number().int().positive().optional(),
  })
  .strict();
var PositiveDurationSchema = z14.union([z14.string(), z14.number()]).superRefine((value, ctx) => {
  try {
    const ms = parseDurationMs(normalizeStringifiedOptionalString(value) ?? "", {
      defaultUnit: "d",
    });
    if (ms <= 0) {
      ctx.addIssue({
        code: z14.ZodIssueCode.custom,
        message: "duration must be positive (use ms, s, m, h, d), e.g. 30d",
      });
    }
  } catch {
    ctx.addIssue({
      code: z14.ZodIssueCode.custom,
      message: "invalid duration (use ms, s, m, h, d)",
    });
  }
});
var SessionSendPolicySchema = createAllowDenyChannelRulesSchema();
var SessionSchema = z14
  .object({
    scope: z14.union([z14.literal("per-sender"), z14.literal("global")]).optional(),
    dmScope: z14
      .union([
        z14.literal("main"),
        z14.literal("per-peer"),
        z14.literal("per-channel-peer"),
        z14.literal("per-account-channel-peer"),
      ])
      .optional(),
    identityLinks: z14.record(z14.string(), z14.array(z14.string())).optional(),
    resetTriggers: z14.array(z14.string()).optional(),
    reset: SessionResetConfigSchema.optional(),
    resetByType: z14
      .object({
        direct: SessionResetConfigSchema.optional(),
        group: SessionResetConfigSchema.optional(),
        thread: SessionResetConfigSchema.optional(),
      })
      .strict()
      .optional(),
    resetByChannel: z14.record(z14.string(), SessionResetConfigSchema).optional(),
    store: z14.string().optional(),
    mainKey: z14.string().optional(),
    sendPolicy: SessionSendPolicySchema.optional(),
    threadBindings: z14
      .object({
        enabled: z14.boolean().optional(),
        idleHours: z14.number().nonnegative().optional(),
        maxAgeHours: z14.number().nonnegative().optional(),
        spawnSessions: z14.boolean().optional(),
        defaultSpawnContext: z14.enum(["isolated", "fork"]).optional(),
      })
      .strict()
      .optional(),
    sharing: z14
      .object({
        readOnly: z14.boolean().optional(),
        suggest: z14.boolean().optional(),
        drafts: z14.boolean().optional(),
      })
      .strict()
      .optional(),
    maintenance: z14
      .object({
        mode: z14.enum(["enforce", "warn"]).optional(),
        pruneAfter: PositiveDurationSchema.optional(),
        maxEntries: z14.number().int().positive().optional(),
        resetArchiveRetention: z14.union([PositiveDurationSchema, z14.literal(false)]).optional(),
        maxDiskBytes: z14.union([z14.string(), z14.number(), z14.literal(false)]).optional(),
        highWaterBytes: z14.union([z14.string(), z14.number()]).optional(),
      })
      .strict()
      .superRefine((val, ctx) => {
        if (val.maxDiskBytes !== void 0 && val.maxDiskBytes !== false) {
          try {
            parseByteSize(normalizeStringifiedOptionalString(val.maxDiskBytes) ?? "", {
              defaultUnit: "b",
            });
          } catch {
            ctx.addIssue({
              code: z14.ZodIssueCode.custom,
              path: ["maxDiskBytes"],
              message: "invalid size (use b, kb, mb, gb, tb)",
            });
          }
        }
        if (val.highWaterBytes !== void 0) {
          try {
            parseByteSize(normalizeStringifiedOptionalString(val.highWaterBytes) ?? "", {
              defaultUnit: "b",
            });
          } catch {
            ctx.addIssue({
              code: z14.ZodIssueCode.custom,
              path: ["highWaterBytes"],
              message: "invalid size (use b, kb, mb, gb, tb)",
            });
          }
        }
      })
      .optional(),
  })
  .strict()
  .optional();
var ResponseUsageModeSchema = z14.enum(["on", "off", "tokens", "full"]);
var MessagesSchema = z14
  .object({
    visibleReplies: VisibleRepliesSchema.optional(),
    responsePrefix: z14.string().optional(),
    usageTemplate: z14.union([z14.string(), z14.record(z14.string(), z14.unknown())]).optional(),
    responseUsage: z14
      .union([ResponseUsageModeSchema, z14.record(z14.string(), ResponseUsageModeSchema)])
      .optional(),
    groupChat: GroupChatSchema,
    queue: QueueSchema,
    inbound: InboundDebounceSchema,
    ackReaction: z14.string().optional(),
    ackReactionScope: z14
      .enum(["group-mentions", "group-all", "direct", "all", "off", "none"])
      .optional(),
    statusReactions: z14
      .object({
        enabled: z14.boolean().optional(),
      })
      .strict()
      .optional(),
    suppressToolErrors: z14.boolean().optional(),
  })
  .strict()
  .optional();
var CommandsSchema = z14
  .object({
    native: NativeCommandsSettingSchema.optional().default("auto"),
    nativeSkills: NativeCommandsSettingSchema.optional().default("auto"),
    text: z14.boolean().optional(),
    bash: z14.boolean().optional(),
    bashForegroundMs: z14.number().int().min(0).max(3e4).optional(),
    config: z14.boolean().optional(),
    mcp: z14.boolean().optional(),
    plugins: z14.boolean().optional(),
    debug: z14.boolean().optional(),
    restart: z14.boolean().optional().default(true),
    ownerAllowFrom: z14.array(z14.union([z14.string(), z14.number()])).optional(),
    allowFrom: ElevatedAllowFromSchema.optional(),
  })
  .strict()
  .optional()
  .default(() => ({
    native: "auto",
    nativeSkills: "auto",
    restart: true,
  }));

// vendor/openclaw/src/config/zod-schema.root-support.ts
var GatewayRemoteSchemaShape = {
  url: z15.string().optional(),
  transport: z15.union([z15.literal("ssh"), z15.literal("direct")]).optional(),
  remotePort: z15.number().int().min(1).max(65535).optional(),
  token: SecretInputSchema.optional().register(sensitive),
  password: SecretInputSchema.optional().register(sensitive),
  tlsFingerprint: z15.string().optional(),
  sshTarget: z15.string().optional(),
  sshIdentity: z15.string().optional(),
  sshHostKeyPolicy: z15.union([z15.literal("strict"), z15.literal("openssh")]).optional(),
};
var GatewayRemoteConfigSchema = z15.strictObject(GatewayRemoteSchemaShape).optional();
var TailscaleServiceNameSchema = z15.string().regex(/^svc:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, {
  message:
    'Tailscale serviceName must use the "svc:<dns-label>" format, for example "svc:openclaw"',
});
var SecuritySchema = z15
  .strictObject({
    audit: z15
      .strictObject({
        suppressions: z15
          .array(
            z15.strictObject({
              checkId: z15.string().min(1),
              titleIncludes: z15.string().min(1).optional(),
              detailIncludes: z15.string().min(1).optional(),
              reason: z15.string().min(1).optional(),
            }),
          )
          .optional(),
      })
      .optional(),
    installPolicy: z15
      .strictObject({
        enabled: z15.boolean().optional(),
        targets: z15
          .array(z15.union([z15.literal("skill"), z15.literal("plugin")]))
          .min(1)
          .optional(),
        exec: z15
          .strictObject({
            source: z15.literal("exec"),
            command: z15.string().min(1),
            args: z15.array(z15.string()).optional(),
            timeoutMs: z15.number().int().min(1).optional(),
            noOutputTimeoutMs: z15.number().int().min(1).optional(),
            maxOutputBytes: z15.number().int().min(1).optional(),
            env: z15.record(z15.string(), z15.string().register(sensitive)).optional(),
            passEnv: z15.array(z15.string()).optional(),
            trustedDirs: z15.array(z15.string()).optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .optional();
var AccessGroupsSchema = z15
  .record(
    z15.string().min(1),
    z15.discriminatedUnion("type", [
      z15.strictObject({
        type: z15.literal("discord.channelAudience"),
        guildId: z15.string().min(1),
        channelId: z15.string().min(1),
        membership: z15.literal("canViewChannel").optional(),
      }),
      z15.strictObject({
        type: z15.literal("message.senders"),
        members: z15.record(z15.string().min(1), z15.array(z15.string().min(1))),
      }),
    ]),
  )
  .optional();
var MemoryQmdPathSchema = z15.strictObject({
  path: z15.string(),
  name: z15.string().optional(),
  pattern: z15.string().optional(),
});
var MemoryQmdSessionSchema = z15.strictObject({
  enabled: z15.boolean().optional(),
  exportDir: z15.string().optional(),
  retentionDays: z15.number().int().nonnegative().optional(),
});
var MemoryQmdLimitsSchema = z15.strictObject({
  maxResults: z15.number().int().positive().optional(),
  maxSnippetChars: z15.number().int().positive().optional(),
  maxInjectedChars: z15.number().int().positive().optional(),
  timeoutMs: z15.number().int().nonnegative().optional(),
});
var LoggingLevelSchema = z15.union([
  z15.literal("silent"),
  z15.literal("fatal"),
  z15.literal("error"),
  z15.literal("warn"),
  z15.literal("info"),
  z15.literal("debug"),
  z15.literal("trace"),
]);
var MemoryQmdSchema = z15.strictObject({
  command: z15.string().optional(),
  searchMode: z15
    .union([z15.literal("query"), z15.literal("search"), z15.literal("vsearch")])
    .optional(),
  rerank: z15.boolean().optional(),
  searchTool: z15.string().trim().min(1).optional(),
  includeDefaultMemory: z15.boolean().optional(),
  paths: z15.array(MemoryQmdPathSchema).optional(),
  sessions: MemoryQmdSessionSchema.optional(),
  limits: MemoryQmdLimitsSchema.optional(),
  scope: SessionSendPolicySchema.optional(),
});
var MemorySchema = z15
  .strictObject({
    backend: z15.union([z15.literal("builtin"), z15.literal("qmd")]).optional(),
    citations: z15.union([z15.literal("auto"), z15.literal("on"), z15.literal("off")]).optional(),
    search: MemorySearchSchema,
    qmd: MemoryQmdSchema.optional(),
  })
  .optional();
var HttpUrlSchema = z15.string().url().refine(isHttpUrl, "Expected http:// or https:// URL");
var McpOAuthClientMetadataUrlSchema = z15
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return isHttpsUrl(url) && url.pathname !== "/";
  }, "Expected https:// URL with a non-root pathname");
var ResponsesEndpointUrlFetchShape = {
  allowUrl: z15.boolean().optional(),
  urlAllowlist: z15.array(z15.string()).optional(),
  allowedMimes: z15.array(z15.string()).optional(),
  maxBytes: z15.number().int().positive().optional(),
  maxRedirects: z15.number().int().nonnegative().optional(),
  timeoutMs: z15.number().int().positive().optional(),
};
var SkillEntrySchema = z15.strictObject({
  enabled: z15.boolean().optional(),
  apiKey: SecretInputSchema.optional().register(sensitive),
  env: z15.record(z15.string(), z15.string()).optional(),
  config: z15.record(z15.string(), z15.unknown()).optional(),
});
var PluginEntrySchema = z15.strictObject({
  enabled: z15.boolean().optional(),
  hooks: z15
    .strictObject({
      allowPromptInjection: z15.boolean().optional(),
      allowConversationAccess: z15.boolean().optional(),
      timeoutMs: z15.number().int().positive().max(6e5).optional(),
      timeouts: z15.record(z15.string(), z15.number().int().positive().max(6e5)).optional(),
    })
    .optional(),
  subagent: z15
    .strictObject({
      allowModelOverride: z15.boolean().optional(),
      allowedModels: z15.array(z15.string()).optional(),
    })
    .optional(),
  llm: z15
    .strictObject({
      allowModelOverride: z15.boolean().optional(),
      allowedModels: z15.array(z15.string()).optional(),
      allowAgentIdOverride: z15.boolean().optional(),
    })
    .optional(),
  config: z15.record(z15.string(), z15.unknown()).optional(),
});
var TalkProviderEntrySchema = z15
  .object({
    apiKey: SecretInputSchema.optional().register(sensitive),
  })
  .catchall(z15.unknown());
var TalkRealtimeSchema = z15
  .strictObject({
    provider: z15.string().optional(),
    providers: z15.record(z15.string(), TalkProviderEntrySchema).optional(),
    model: z15.string().optional(),
    speakerVoice: z15.string().optional(),
    speakerVoiceId: z15.string().optional(),
    instructions: z15.string().optional(),
    mode: z15.enum(["realtime", "stt-tts", "transcription"]).optional(),
    transport: z15
      .enum(["webrtc", "provider-websocket", "gateway-relay", "managed-room"])
      .optional(),
    vadThreshold: z15.number().min(0).max(1).optional(),
    silenceDurationMs: z15.number().int().positive().optional(),
    prefixPaddingMs: z15.number().int().nonnegative().optional(),
    reasoningEffort: z15.string().min(1).optional(),
    brain: z15.enum(["agent-consult", "direct-tools", "none"]).optional(),
    consultRouting: z15.enum(["provider-direct", "force-agent-consult"]).optional(),
  })
  .superRefine((realtime, ctx) => {
    const provider = normalizeLowercaseStringOrEmpty(realtime.provider ?? "");
    const providers = realtime.providers ? Object.keys(realtime.providers) : [];
    if (provider && providers.length > 0 && !Object.hasOwn(realtime.providers, provider)) {
      ctx.addIssue({
        code: z15.ZodIssueCode.custom,
        path: ["provider"],
        message: `talk.realtime.provider must match a key in talk.realtime.providers (missing "${provider}")`,
      });
    }
    if (!provider && providers.length > 1) {
      ctx.addIssue({
        code: z15.ZodIssueCode.custom,
        path: ["provider"],
        message:
          "talk.realtime.provider is required when talk.realtime.providers defines multiple providers",
      });
    }
  });
var TalkSchema = z15
  .strictObject({
    agentId: z15.string().trim().min(1).optional(),
    provider: z15.string().optional(),
    providers: z15.record(z15.string(), TalkProviderEntrySchema).optional(),
    realtime: TalkRealtimeSchema.optional(),
    consultThinkingLevel: z15
      .enum(["off", "minimal", "low", "medium", "high", "xhigh", "adaptive", "max", "ultra"])
      .optional(),
    consultFastMode: z15.boolean().optional(),
    speechLocale: z15.string().optional(),
    interruptOnSpeech: z15.boolean().optional(),
    silenceTimeoutMs: z15.number().int().positive().optional(),
  })
  .superRefine((talk, ctx) => {
    const provider = normalizeLowercaseStringOrEmpty(talk.provider ?? "");
    const providers = talk.providers ? Object.keys(talk.providers) : [];
    if (provider && providers.length > 0 && !Object.hasOwn(talk.providers, provider)) {
      ctx.addIssue({
        code: z15.ZodIssueCode.custom,
        path: ["provider"],
        message: `talk.provider must match a key in talk.providers (missing "${provider}")`,
      });
    }
    if (!provider && providers.length > 1) {
      ctx.addIssue({
        code: z15.ZodIssueCode.custom,
        path: ["provider"],
        message: "talk.provider is required when talk.providers defines multiple providers",
      });
    }
  });
var McpServerSchema = z15
  .object({
    enabled: z15.boolean().optional(),
    command: z15.string().optional(),
    args: z15.array(z15.string()).optional(),
    env: z15
      .record(
        z15.string(),
        z15
          .union([z15.string().register(sensitive), z15.number(), z15.boolean()])
          .register(sensitive),
      )
      .optional(),
    cwd: z15.string().optional(),
    url: HttpUrlSchema.optional(),
    transport: z15
      .union([z15.literal("stdio"), z15.literal("sse"), z15.literal("streamable-http")])
      .optional(),
    headers: z15
      .record(
        z15.string(),
        z15
          .union([z15.string().register(sensitive), z15.number(), z15.boolean()])
          .register(sensitive),
      )
      .optional(),
    connectionTimeoutMs: z15.number().finite().positive().optional(),
    requestTimeoutMs: z15.number().finite().positive().optional(),
    supportsParallelToolCalls: z15.boolean().optional(),
    auth: z15.literal("oauth").optional(),
    oauth: z15
      .strictObject({
        authProfileId: z15.string().trim().min(1).optional(),
        scope: z15.string().trim().min(1).optional(),
        redirectUrl: HttpUrlSchema.optional(),
        clientMetadataUrl: McpOAuthClientMetadataUrlSchema.optional(),
      })
      .optional(),
    sslVerify: z15.boolean().optional(),
    clientCert: z15.string().optional(),
    clientKey: z15.string().optional(),
    toolFilter: z15
      .strictObject({
        include: z15.array(z15.string().trim().min(1)).min(1).optional(),
        exclude: z15.array(z15.string().trim().min(1)).min(1).optional(),
      })
      .optional(),
    codex: z15
      .strictObject({
        agents: z15
          .array(
            z15
              .string()
              .trim()
              .regex(/^[a-z0-9][a-z0-9_-]{0,63}$/i),
          )
          .min(1)
          .optional(),
        defaultToolsApprovalMode: z15.enum(["auto", "prompt", "approve"]).optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    for (const key of [
      "connectTimeout",
      "connect_timeout",
      "timeout",
      "workingDirectory",
      "supports_parallel_tool_calls",
      "ssl_verify",
      "client_cert",
      "client_key",
    ]) {
      if (Object.hasOwn(data, key)) {
        ctx.addIssue({
          code: z15.ZodIssueCode.custom,
          message: `Unrecognized key: "${key}"`,
        });
      }
    }
    const codex = data.codex;
    if (codex && Object.hasOwn(codex, "default_tools_approval_mode")) {
      ctx.addIssue({
        code: z15.ZodIssueCode.custom,
        path: ["codex", "default_tools_approval_mode"],
        message: 'Unrecognized key: "default_tools_approval_mode"',
      });
    }
    if (Object.hasOwn(data, "disabled")) {
      const disabled = Reflect.get(data, "disabled");
      const replacement =
        typeof disabled === "boolean"
          ? `"enabled: ${!disabled}" instead, then run "openclaw doctor --fix" to migrate existing config`
          : 'the canonical "enabled" boolean instead';
      ctx.addIssue({
        code: z15.ZodIssueCode.custom,
        message: `unsupported key "disabled"; use ${replacement}`,
        path: ["disabled"],
      });
    }
    if (
      data.transport === "stdio" &&
      (typeof data.command !== "string" || data.command.trim().length === 0)
    ) {
      ctx.addIssue({
        code: z15.ZodIssueCode.custom,
        message: '"stdio" transport requires a non-empty command',
        path: ["transport"],
      });
    }
  })
  .catchall(z15.unknown());
var RESERVED_MCP_SERVER_NAME = "__proto__";
var RESERVED_MCP_SERVER_NAME_ERROR = 'MCP server name "__proto__" is reserved; rename the server';
var McpServerNameSchema = z15
  .string()
  .refine((value) => value !== RESERVED_MCP_SERVER_NAME, RESERVED_MCP_SERVER_NAME_ERROR);
var NodeHostMcpServerNameSchema = McpServerNameSchema.refine(
  (value) => value.length > 0 && value === value.trim(),
  "MCP server name must be non-empty and must not have surrounding whitespace",
);
function createMcpServersSchema(serverNameSchema) {
  return z15.preprocess(
    (value, ctx) => {
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.hasOwn(value, RESERVED_MCP_SERVER_NAME)
      ) {
        ctx.addIssue({
          code: z15.ZodIssueCode.custom,
          path: [RESERVED_MCP_SERVER_NAME],
          message: RESERVED_MCP_SERVER_NAME_ERROR,
        });
        return z15.NEVER;
      }
      return value;
    },
    z15.record(serverNameSchema, McpServerSchema),
  );
}
var McpConfigSchema = z15
  .strictObject({
    servers: createMcpServersSchema(McpServerNameSchema).optional(),
    apps: z15
      .strictObject({
        enabled: z15.boolean().optional(),
        sandboxOrigin: z15
          .string()
          .url()
          .refine((value) => {
            try {
              const url = new URL(value);
              return (
                (url.protocol === "http:" || url.protocol === "https:") &&
                url.origin === value.replace(/\/$/u, "") &&
                !url.username &&
                !url.password
              );
            } catch {
              return false;
            }
          }, "sandboxOrigin must be an HTTP(S) origin without a path, query, or credentials")
          .optional(),
        sandboxPort: z15.number().int().min(1).max(65535).optional(),
      })
      .optional(),
  })
  .optional();
var NodeHostSchema = z15
  .strictObject({
    agentRuns: NodeHostAgentRunsSchema,
    browserProxy: z15
      .strictObject({
        enabled: z15.boolean().optional(),
        allowProfiles: z15.array(z15.string()).optional(),
      })
      .optional(),
    mcp: z15
      .strictObject({
        servers: createMcpServersSchema(NodeHostMcpServerNameSchema).optional(),
      })
      .optional(),
    skills: z15
      .strictObject({
        enabled: z15.boolean().optional(),
      })
      .optional(),
  })
  .optional();

// vendor/openclaw/src/config/zod-schema.gateway.ts
var GatewayConfigSchema = z16
  .strictObject({
    port: z16.number().int().min(1).max(65535).optional(),
    mode: z16.union([z16.literal("local"), z16.literal("remote")]).optional(),
    bind: z16
      .union([
        z16.literal("auto"),
        z16.literal("lan"),
        z16.literal("loopback"),
        z16.literal("custom"),
        z16.literal("tailnet"),
      ])
      .optional(),
    customBindHost: z16.string().optional(),
    controlUi: z16
      .strictObject({
        // Shipped legacy input. Doctor removes it after recording migration state.
        dangerouslyDisableDeviceAuth: z16.boolean().optional(),
        enabled: z16.boolean().optional(),
        basePath: z16.string().optional(),
        root: z16.string().optional(),
        toolTitles: z16.boolean().optional(),
        sessionObserver: z16.boolean().optional(),
        embedSandbox: z16
          .union([z16.literal("strict"), z16.literal("scripts"), z16.literal("trusted")])
          .optional(),
        allowExternalEmbedUrls: z16.boolean().optional(),
        allowedOrigins: z16.array(z16.string()).optional(),
        dangerouslyAllowHostHeaderOriginFallback: z16.boolean().optional(),
      })
      .optional(),
    terminal: z16
      .strictObject({
        enabled: z16.boolean().optional(),
        shell: z16.string().optional(),
        detachedSessionTimeoutSeconds: z16.number().int().min(0).optional(),
      })
      .optional(),
    auth: z16
      .strictObject({
        mode: z16
          .union([
            z16.literal("none"),
            z16.literal("token"),
            z16.literal("password"),
            z16.literal("trusted-proxy"),
          ])
          .optional(),
        token: SecretInputSchema.optional().register(sensitive),
        password: SecretInputSchema.optional().register(sensitive),
        allowTailscale: z16.boolean().optional(),
        rateLimit: z16
          .strictObject({
            maxAttempts: z16.number().optional(),
            windowMs: z16.number().optional(),
            lockoutMs: z16.number().optional(),
            exemptLoopback: z16.boolean().optional(),
          })
          .optional(),
        trustedProxy: z16
          .strictObject({
            userHeader: z16.string().min(1, "userHeader is required for trusted-proxy mode"),
            requiredHeaders: z16.array(z16.string()).optional(),
            allowUsers: z16.array(z16.string()).optional(),
            allowLoopback: z16.boolean().optional(),
            deviceAutoApprove: z16
              .strictObject({
                enabled: z16.boolean().optional(),
                scopes: z16.array(z16.string().min(1)).optional(),
              })
              .optional(),
          })
          .optional(),
      })
      .optional(),
    trustedProxies: z16.array(z16.string()).optional(),
    allowRealIpFallback: z16.boolean().optional(),
    tools: z16
      .strictObject({
        deny: z16.array(z16.string()).optional(),
        allow: z16.array(z16.string()).optional(),
      })
      .optional(),
    tailscale: z16
      .strictObject({
        mode: z16
          .union([z16.literal("off"), z16.literal("serve"), z16.literal("funnel")])
          .optional(),
        resetOnExit: z16.boolean().optional(),
        serviceName: TailscaleServiceNameSchema.optional(),
        preserveFunnel: z16.boolean().optional(),
      })
      .optional(),
    remote: GatewayRemoteConfigSchema,
    reload: z16
      .strictObject({
        mode: z16.union([z16.literal("off"), z16.literal("hybrid")]).optional(),
      })
      .optional(),
    tls: z16
      .object({
        enabled: z16.boolean().optional(),
        autoGenerate: z16.boolean().optional(),
        // Reject blank values without transforming the string. Trimming here would
        // silently rewrite a legitimate filesystem path that contains leading or
        // trailing spaces and persist the trimmed value into validated config;
        // runtime path resolution (resolveUserPath) owns all normalization.
        certPath: z16
          .string()
          .optional()
          .refine((v) => v === void 0 || v.trim().length > 0, "certPath must not be blank"),
        keyPath: z16
          .string()
          .optional()
          .refine((v) => v === void 0 || v.trim().length > 0, "keyPath must not be blank"),
        caPath: z16.string().optional(),
      })
      .optional(),
    http: z16
      .strictObject({
        endpoints: z16
          .strictObject({
            chatCompletions: z16
              .strictObject({
                enabled: z16.boolean().optional(),
                images: z16
                  .strictObject({
                    ...ResponsesEndpointUrlFetchShape,
                  })
                  .optional(),
              })
              .optional(),
            responses: z16
              .strictObject({
                enabled: z16.boolean().optional(),
                maxUrlParts: z16.number().int().nonnegative().optional(),
                files: z16
                  .strictObject({
                    ...ResponsesEndpointUrlFetchShape,
                    maxChars: z16.number().int().positive().optional(),
                    pdf: z16
                      .strictObject({
                        maxPages: z16.number().int().positive().optional(),
                        maxPixels: z16.number().int().positive().optional(),
                        minTextChars: z16.number().int().nonnegative().optional(),
                      })
                      .optional(),
                  })
                  .optional(),
                images: z16
                  .strictObject({
                    ...ResponsesEndpointUrlFetchShape,
                  })
                  .optional(),
              })
              .optional(),
          })
          .optional(),
        securityHeaders: z16
          .strictObject({
            strictTransportSecurity: z16.union([z16.string(), z16.literal(false)]).optional(),
          })
          .optional(),
      })
      .optional(),
    push: z16
      .strictObject({
        apns: z16
          .strictObject({
            relay: z16
              .strictObject({
                baseUrl: z16.string().optional(),
                timeoutMs: z16.number().int().positive().optional(),
              })
              .optional(),
          })
          .optional(),
      })
      .optional(),
    nodes: z16
      .strictObject({
        browser: z16
          .strictObject({
            mode: z16
              .union([z16.literal("auto"), z16.literal("manual"), z16.literal("off")])
              .optional(),
            node: z16.string().optional(),
          })
          .optional(),
        pairing: z16
          .strictObject({
            autoApproveLocal: z16.boolean().optional(),
            autoApproveCidrs: z16.array(z16.string()).optional(),
            sshVerify: z16
              .union([
                z16.boolean(),
                z16.strictObject({
                  user: z16.string().optional(),
                  identity: z16.string().optional(),
                  timeoutMs: z16.number().int().positive().optional(),
                  cidrs: z16.array(z16.string()).optional(),
                }),
              ])
              .optional(),
          })
          .optional(),
        pluginTools: z16
          .strictObject({
            enabled: z16.boolean().optional(),
          })
          .optional(),
        allowSkills: z16.boolean().optional(),
        commands: z16
          .strictObject({
            allow: z16.array(z16.string()).optional(),
            deny: z16.array(z16.string()).optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .optional();

// vendor/openclaw/src/config/zod-schema.hooks.ts
import path6 from "node:path";
import { z as z17 } from "zod";
function isSafeRelativeModulePath(raw) {
  const value = raw.trim();
  if (!value) {
    return false;
  }
  if (path6.isAbsolute(value)) {
    return false;
  }
  if (value.startsWith("~")) {
    return false;
  }
  if (value.includes(":")) {
    return false;
  }
  const parts = value.split(/[\\/]+/g);
  if (parts.some((part) => part === "..")) {
    return false;
  }
  return true;
}
var SafeRelativeModulePathSchema = z17
  .string()
  .refine(isSafeRelativeModulePath, "module must be a safe relative path (no absolute paths)");
var HookMappingSchema = z17
  .object({
    id: z17.string().optional(),
    match: z17
      .object({
        path: z17.string().optional(),
        source: z17.string().optional(),
      })
      .optional(),
    action: z17.union([z17.literal("wake"), z17.literal("agent")]).optional(),
    wakeMode: z17.union([z17.literal("now"), z17.literal("next-heartbeat")]).optional(),
    name: z17.string().optional(),
    agentId: z17.string().optional(),
    sessionKey: z17.string().optional().register(sensitive),
    sessionMode: z17.union([z17.literal("isolated"), z17.literal("persistent")]).optional(),
    messageTemplate: z17.string().optional(),
    textTemplate: z17.string().optional(),
    deliver: z17.boolean().optional(),
    allowUnsafeExternalContent: z17.boolean().optional(),
    // Keep this open-ended so runtime channel plugins (for example feishu) can be
    // referenced without hard-coding every channel id in the config schema.
    // Runtime still validates the resolved value against currently registered channels.
    channel: z17.string().trim().min(1).optional(),
    to: z17.string().optional(),
    model: z17.string().optional(),
    thinking: z17.string().optional(),
    timeoutSeconds: z17.number().int().positive().optional(),
    transform: z17
      .object({
        module: SafeRelativeModulePathSchema,
        export: z17.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional();
var InternalHookHandlerSchema = z17
  .object({
    event: z17.string(),
    module: SafeRelativeModulePathSchema,
    export: z17.string().optional(),
  })
  .strict();
var HookConfigSchema = z17
  .object({
    enabled: z17.boolean().optional(),
    env: z17.record(z17.string(), z17.string()).optional(),
  })
  .passthrough();
var InternalHooksSchema = z17
  .object({
    enabled: z17.boolean().optional(),
    handlers: z17.array(InternalHookHandlerSchema).optional(),
    entries: z17.record(z17.string(), HookConfigSchema).optional(),
    load: z17
      .object({
        extraDirs: z17.array(z17.string()).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional();
var HooksGmailSchema = z17
  .object({
    account: z17.string().optional(),
    label: z17.string().optional(),
    topic: z17.string().optional(),
    subscription: z17.string().optional(),
    pushToken: z17.string().optional().register(sensitive),
    hookUrl: z17.string().optional(),
    includeBody: z17.boolean().optional(),
    maxBytes: z17.number().int().positive().optional(),
    renewEveryMinutes: z17.number().int().positive().optional(),
    allowUnsafeExternalContent: z17.boolean().optional(),
    serve: z17
      .object({
        bind: z17.string().optional(),
        port: z17.number().int().positive().optional(),
        path: z17.string().optional(),
      })
      .strict()
      .optional(),
    tailscale: z17
      .object({
        mode: z17
          .union([z17.literal("off"), z17.literal("serve"), z17.literal("funnel")])
          .optional(),
        path: z17.string().optional(),
        target: z17.string().optional(),
      })
      .strict()
      .optional(),
    model: z17.string().optional(),
    thinking: z17
      .union([
        z17.literal("off"),
        z17.literal("minimal"),
        z17.literal("low"),
        z17.literal("medium"),
        z17.literal("high"),
      ])
      .optional(),
  })
  .strict()
  .optional();

// vendor/openclaw/src/config/zod-schema.proxy.ts
import { z as z18 } from "zod";
var ProxyLoopbackModeSchema = z18.enum(["gateway-only", "proxy", "block"]);
var ProxyTlsConfigSchema = z18
  .object({
    caFile: z18.string().min(1).optional(),
  })
  .strict()
  .optional();
var ProxyConfigSchema = z18
  .object({
    enabled: z18.boolean().optional(),
    proxyUrl: z18
      .url()
      .refine(isHttpUrl, {
        message: "proxyUrl must use http:// or https://",
      })
      .register(sensitive)
      .optional(),
    tls: ProxyTlsConfigSchema,
    loopbackMode: ProxyLoopbackModeSchema.optional(),
  })
  .strict()
  .optional();

// vendor/openclaw/src/config/zod-schema.root-shape.ts
var OpenClawSchemaShape = {
  $schema: z19.string().optional(),
  meta: z19
    .strictObject({
      lastTouchedVersion: z19.string().optional(),
      migrations: z19
        .strictObject({
          modelPolicyAllowlist: z19.literal(true).optional(),
        })
        .optional(),
    })
    .optional(),
  env: z19
    .object({
      shellEnv: z19
        .strictObject({
          enabled: z19.boolean().optional(),
          timeoutMs: z19.number().int().nonnegative().optional(),
        })
        .optional(),
      vars: z19.record(z19.string(), z19.string()).optional(),
    })
    .strict()
    .optional(),
  wizard: z19
    .strictObject({
      accessMode: z19.union([z19.literal("full"), z19.literal("guarded")]).optional(),
      appRecommendations: z19.boolean().optional(),
      lastRunAt: z19.string().optional(),
      lastRunVersion: z19.string().optional(),
      lastRunCommit: z19.string().optional(),
      lastRunCommand: z19.string().optional(),
      lastRunMode: z19.union([z19.literal("local"), z19.literal("remote")]).optional(),
      localModelLeanAutoModel: z19.string().optional(),
      securityAcknowledgedAt: z19.string().optional(),
    })
    .optional(),
  diagnostics: z19
    .strictObject({
      enabled: z19.boolean().optional(),
      flags: z19.array(z19.string()).optional(),
      otel: z19
        .strictObject({
          enabled: z19.boolean().optional(),
          endpoint: z19.string().optional(),
          tracesEndpoint: z19.string().optional(),
          metricsEndpoint: z19.string().optional(),
          logsEndpoint: z19.string().optional(),
          protocol: z19.union([z19.literal("http/protobuf"), z19.literal("grpc")]).optional(),
          headers: z19.record(z19.string(), z19.string()).optional(),
          serviceName: z19.string().optional(),
          traces: z19.boolean().optional(),
          metrics: z19.boolean().optional(),
          logs: z19.boolean().optional(),
          logsExporter: z19
            .union([z19.literal("otlp"), z19.literal("stdout"), z19.literal("both")])
            .optional(),
          sampleRate: z19.number().min(0).max(1).optional(),
          flushIntervalMs: z19.number().int().nonnegative().optional(),
          captureContent: z19.boolean().optional(),
        })
        .optional(),
      cacheTrace: z19.strictObject({ enabled: z19.boolean().optional() }).optional(),
    })
    .optional(),
  logging: z19
    .strictObject({
      level: LoggingLevelSchema.optional(),
      file: z19.string().optional(),
      maxFileBytes: z19.number().int().positive().optional(),
      consoleLevel: LoggingLevelSchema.optional(),
      consoleStyle: z19.union([z19.literal("pretty"), z19.literal("json")]).optional(),
      redactPatterns: z19.array(z19.string()).optional(),
      audit: z19
        .strictObject({
          enabled: z19.boolean().optional(),
          messages: z19
            .union([z19.literal("off"), z19.literal("direct"), z19.literal("all")])
            .optional(),
        })
        .optional(),
    })
    .optional(),
  update: z19
    .strictObject({
      channel: z19
        .union([
          z19.literal("stable"),
          z19.literal("extended-stable"),
          z19.literal("beta"),
          z19.literal("dev"),
        ])
        .optional(),
      checkOnStart: z19.boolean().optional(),
      auto: z19
        .strictObject({
          enabled: z19.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  browser: z19
    .strictObject({
      enabled: z19.boolean().optional(),
      allowSystemProfileImport: z19.boolean().optional(),
      evaluateEnabled: z19.boolean().optional(),
      cdpUrl: z19.string().optional(),
      executablePath: z19.string().optional(),
      headless: z19.boolean().optional(),
      noSandbox: z19.boolean().optional(),
      attachOnly: z19.boolean().optional(),
      defaultProfile: z19.string().optional(),
      snapshotDefaults: BrowserSnapshotDefaultsSchema,
      ssrfPolicy: z19
        .strictObject({
          dangerouslyAllowPrivateNetwork: z19.boolean().optional(),
          allowedHostnames: z19.array(z19.string()).optional(),
        })
        .optional(),
      profiles: z19
        .record(
          z19
            .string()
            .regex(/^[a-z0-9-]+$/, "Profile names must be alphanumeric with hyphens only"),
          z19
            .strictObject({
              cdpPort: z19.number().int().min(1).max(65535).optional(),
              cdpUrl: z19.string().optional(),
              userDataDir: z19.string().optional(),
              mcpCommand: z19.string().optional(),
              mcpArgs: z19.array(z19.string()).optional(),
              driver: z19
                .union([
                  z19.literal("openclaw"),
                  z19.literal("clawd"),
                  z19.literal("existing-session"),
                  z19.literal("extension"),
                ])
                .optional(),
              headless: z19.boolean().optional(),
              executablePath: z19.string().optional(),
              attachOnly: z19.boolean().optional(),
            })
            .refine(
              (value) =>
                value.driver === "existing-session" ||
                value.driver === "extension" ||
                value.cdpPort ||
                value.cdpUrl,
              {
                message: "Profile must set cdpPort or cdpUrl",
              },
            )
            .refine((value) => value.driver === "existing-session" || !value.userDataDir, {
              message: 'Profile userDataDir is only supported with driver="existing-session"',
            })
            .refine((value) => value.driver !== "extension" || !value.cdpUrl, {
              message:
                'Profile cdpUrl is not supported with driver="extension" (the relay owns the endpoint)',
            }),
        )
        .optional(),
      extraArgs: z19.array(z19.string()).optional(),
      tabCleanup: z19
        .strictObject({
          enabled: z19.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  ui: z19
    .strictObject({
      seamColor: HexColorSchema.optional(),
      assistant: z19
        .strictObject({
          name: z19.string().max(50).optional(),
          avatar: z19.string().max(2e6).optional(),
        })
        .optional(),
      // Operator display prefs. Canonical here (agent-writable via approval,
      // synced across devices); the Control UI mirrors them into local
      // storage for instant boot and offline fallback.
      prefs: z19
        .strictObject({
          theme: z19
            .union([
              z19.literal("claw"),
              z19.literal("knot"),
              z19.literal("dash"),
              z19.literal("custom"),
            ])
            .optional(),
          themeMode: z19
            .union([z19.literal("light"), z19.literal("dark"), z19.literal("system")])
            .optional(),
          locale: z19.string().max(20).optional(),
          chatShowThinking: z19.boolean().optional(),
          chatShowToolCalls: z19.boolean().optional(),
          chatPersistCommentary: z19.boolean().optional(),
          chatSendShortcut: z19
            .union([z19.literal("enter"), z19.literal("modifier-enter")])
            .optional(),
          chatFollowUpMode: z19.union([z19.literal("steer"), z19.literal("queue")]).optional(),
          sidebarEntries: z19.array(z19.string()).optional(),
        })
        .optional(),
    })
    .optional(),
  secrets: SecretsConfigSchema,
  auth: z19
    .strictObject({
      profiles: z19
        .record(
          z19.string(),
          z19.strictObject({
            provider: z19.string(),
            mode: z19.union([
              z19.literal("api_key"),
              z19.literal("aws-sdk"),
              z19.literal("oauth"),
              z19.literal("token"),
            ]),
            email: z19.string().optional(),
            displayName: z19.string().optional(),
          }),
        )
        .optional(),
      order: z19.record(z19.string(), z19.array(z19.string())).optional(),
    })
    .optional(),
  accessGroups: AccessGroupsSchema,
  acp: z19
    .strictObject({
      enabled: z19.boolean().optional(),
      dispatch: z19
        .strictObject({
          enabled: z19.boolean().optional(),
        })
        .optional(),
      backend: z19.string().optional(),
      fallbacks: z19.array(z19.string()).optional(),
      defaultAgent: z19.string().optional(),
      allowedAgents: z19.array(z19.string()).optional(),
      stream: z19
        .strictObject({
          repeatSuppression: z19.boolean().optional(),
          deliveryMode: z19.union([z19.literal("live"), z19.literal("final_only")]).optional(),
          tagVisibility: z19.record(z19.string(), z19.boolean()).optional(),
        })
        .optional(),
      runtime: z19
        .strictObject({
          installCommand: z19.string().optional(),
        })
        .optional(),
    })
    .optional(),
  models: ModelsConfigSchema,
  nodeHost: NodeHostSchema,
  agents: AgentsSchema,
  tools: ToolsSchema,
  security: SecuritySchema,
  bindings: BindingsSchema,
  broadcast: BroadcastSchema,
  attachments: z19
    .strictObject({
      ttlHours: z19
        .number()
        .int()
        .min(1)
        .max(24 * 7)
        .optional(),
    })
    .optional(),
  messages: MessagesSchema,
  tts: TtsConfigSchema,
  commands: CommandsSchema,
  approvals: ApprovalsSchema,
  session: SessionSchema,
  cron: z19
    .strictObject({
      enabled: z19.boolean().optional(),
      triggers: z19
        .strictObject({
          enabled: z19.boolean().optional(),
        })
        .optional(),
      webhookToken: SecretInputSchema.optional().register(sensitive),
      sessionRetention: z19.union([z19.string(), z19.literal(false)]).optional(),
      failureAlert: z19
        .strictObject({
          enabled: z19.boolean().optional(),
          after: z19.number().int().min(1).optional(),
          cooldownMs: z19.number().int().min(0).optional(),
          includeSkipped: z19.boolean().optional(),
          mode: z19.enum(["announce", "webhook"]).optional(),
          accountId: z19.string().optional(),
          channel: z19.string().optional(),
          to: z19.string().optional(),
        })
        .optional(),
    })
    .superRefine((val, ctx) => {
      if (val.sessionRetention !== void 0 && val.sessionRetention !== false) {
        try {
          parseDurationMs(normalizeStringifiedOptionalString(val.sessionRetention) ?? "", {
            defaultUnit: "h",
          });
        } catch {
          ctx.addIssue({
            code: z19.ZodIssueCode.custom,
            path: ["sessionRetention"],
            message: "invalid duration (use ms, s, m, h, d)",
          });
        }
      }
    })
    .optional(),
  transcripts: z19
    .strictObject({
      enabled: z19.boolean().optional(),
      autoStart: z19
        .array(
          z19.strictObject({
            providerId: z19.string().min(1),
            sessionId: z19.string().min(1).optional(),
            title: z19.string().min(1).optional(),
            accountId: z19.string().min(1).optional(),
            guildId: z19.string().min(1).optional(),
            channelId: z19.string().min(1).optional(),
            meetingUrl: z19.string().min(1).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  hooks: z19
    .strictObject({
      enabled: z19.boolean().optional(),
      path: z19.string().optional(),
      token: z19.string().optional().register(sensitive),
      defaultSessionKey: z19.string().optional(),
      allowRequestSessionKey: z19.boolean().optional(),
      allowedSessionKeyPrefixes: z19.array(z19.string()).optional(),
      allowedAgentIds: z19.array(z19.string()).optional(),
      presets: z19.array(z19.string()).optional(),
      transformsDir: z19.string().optional(),
      mappings: z19.array(HookMappingSchema).optional(),
      gmail: HooksGmailSchema,
      internal: InternalHooksSchema,
    })
    .superRefine((hooks, ctx) => {
      const hasDefaultSessionKey = hooks.defaultSessionKey?.trim();
      for (const [index, mapping] of (hooks.mappings ?? []).entries()) {
        if (!mapping) {
          continue;
        }
        if (
          (mapping.action ?? "agent") === "agent" &&
          mapping.sessionMode === "persistent" &&
          !mapping.sessionKey?.trim() &&
          !hasDefaultSessionKey &&
          !mapping.transform
        ) {
          ctx.addIssue({
            code: z19.ZodIssueCode.custom,
            path: ["mappings", index, "sessionKey"],
            message:
              "persistent hook mappings require sessionKey, hooks.defaultSessionKey, or a transform",
          });
        }
      }
    })
    .optional(),
  channels: ChannelsSchema,
  discovery: z19
    .strictObject({
      wideArea: z19
        .strictObject({
          domain: z19.string().optional(),
        })
        .optional(),
      mdns: z19
        .strictObject({
          mode: z19.enum(["off", "minimal", "full"]).optional(),
        })
        .optional(),
    })
    .optional(),
  talk: TalkSchema.optional(),
  gateway: GatewayConfigSchema,
  cloudWorkers: CloudWorkersConfigSchema,
  memory: MemorySchema,
  mcp: McpConfigSchema,
  skills: z19
    .strictObject({
      allowBundled: z19.array(z19.string()).optional(),
      load: z19
        .strictObject({
          extraDirs: z19.array(z19.string()).optional(),
          allowSymlinkTargets: z19.array(z19.string()).optional(),
          watch: z19.boolean().optional(),
        })
        .optional(),
      install: z19
        .strictObject({
          preferBrew: z19.boolean().optional(),
          nodeManager: z19
            .union([
              z19.literal("npm"),
              z19.literal("pnpm"),
              z19.literal("yarn"),
              z19.literal("bun"),
            ])
            .optional(),
          allowUploadedArchives: z19.boolean().optional(),
        })
        .optional(),
      limits: z19
        .strictObject({
          maxCandidatesPerRoot: z19.number().int().min(1).optional(),
          maxSkillsLoadedPerSource: z19.number().int().min(1).optional(),
          maxSkillsInPrompt: z19.number().int().min(0).optional(),
          maxSkillsPromptChars: z19.number().int().min(0).optional(),
          maxSkillFileBytes: z19.number().int().min(0).optional(),
        })
        .optional(),
      workshop: z19
        .strictObject({
          autonomous: z19
            .strictObject({
              mode: z19
                .union([z19.literal("off"), z19.literal("propose"), z19.literal("auto")])
                .optional(),
            })
            .optional(),
          approvalPolicy: z19.union([z19.literal("pending"), z19.literal("auto")]).optional(),
          allowSymlinkTargetWrites: z19.boolean().optional(),
          maxPending: z19.number().int().min(1).optional(),
          maxSkillBytes: z19.number().int().min(1).optional(),
        })
        .optional(),
      entries: z19.record(z19.string(), SkillEntrySchema).optional(),
    })
    .optional(),
  plugins: z19
    .strictObject({
      enabled: z19.boolean().optional(),
      allow: z19.array(z19.string()).optional(),
      deny: z19.array(z19.string()).optional(),
      load: z19
        .strictObject({
          paths: z19.array(z19.string()).optional(),
        })
        .optional(),
      slots: z19
        .strictObject({
          memory: z19.string().optional(),
          contextEngine: z19.string().optional(),
        })
        .optional(),
      entries: z19.record(z19.string(), PluginEntrySchema).optional(),
    })
    .optional(),
  surfaces: z19
    .record(
      z19.string(),
      z19.strictObject({
        silentReply: SilentReplyPolicyConfigSchema.optional(),
      }),
    )
    .optional(),
  proxy: ProxyConfigSchema,
};

// vendor/openclaw/src/config/zod-schema.ts
function installZodDefaultLocale() {
  z20.config(z20.locales.en());
}
installZodDefaultLocale();
var OpenClawSchema = z20.strictObject(OpenClawSchemaShape).superRefine((cfg, ctx) => {
  const agents = listAgentEntries(cfg);
  const agentIds = new Set(agents.map((agent) => agent.id));
  const effectiveAgentIds = new Set(agents.map((agent) => normalizeAgentId(agent.id)));
  if (agents.length === 0) {
    effectiveAgentIds.add("main");
  }
  const explicitTargets = [
    {
      path: ["agents", "defaults", "heartbeat", "agentId"],
      agentId: cfg.agents?.defaults?.heartbeat?.agentId,
    },
    {
      path: ["agents", "defaults", "systemAgent", "agentId"],
      agentId: cfg.agents?.defaults?.systemAgent?.agentId,
    },
    { path: ["talk", "agentId"], agentId: cfg.talk?.agentId },
  ];
  for (const target of explicitTargets) {
    if (
      typeof target.agentId === "string" &&
      !effectiveAgentIds.has(normalizeAgentId(target.agentId))
    ) {
      ctx.addIssue({
        code: z20.ZodIssueCode.custom,
        path: [...target.path],
        message: `Unknown agent id "${target.agentId}" (not in agents.entries).`,
      });
    }
  }
  if (agents.length === 0) {
    return;
  }
  const bindings = cfg.bindings;
  if (Array.isArray(bindings)) {
    for (let idx = 0; idx < bindings.length; idx += 1) {
      const binding = bindings[idx];
      if (!binding || typeof binding !== "object") {
        continue;
      }
      const agentId = binding.agentId;
      if (
        typeof agentId === "string" &&
        agentId !== DEFAULT_AGENT_ID2 &&
        !effectiveAgentIds.has(normalizeAgentId(agentId))
      ) {
        ctx.addIssue({
          code: z20.ZodIssueCode.custom,
          path: ["bindings", idx, "agentId"],
          message: `Unknown agent id "${agentId}" (not in agents.entries).`,
        });
      }
    }
  }
  const broadcast = cfg.broadcast;
  if (!broadcast) {
    return;
  }
  for (const [peerId, ids] of Object.entries(broadcast)) {
    if (peerId === "strategy") {
      continue;
    }
    if (!Array.isArray(ids)) {
      continue;
    }
    for (const [idx, agentId] of ids.entries()) {
      if (!agentIds.has(agentId)) {
        ctx.addIssue({
          code: z20.ZodIssueCode.custom,
          path: ["broadcast", peerId, idx],
          message: `Unknown agent id "${agentId}" (not in agents.entries).`,
        });
      }
    }
  }
});
export { OpenClawSchema };
