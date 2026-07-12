// AUTO-GENERATED from vendor/openclaw — do not edit manually.
// Re-generate with: node scripts/generate-vendor-artifacts.mjs

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

// vendor/openclaw/src/config/zod-schema.ts
import { z as z15 } from "zod";

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
  t: 1024 ** 4
};
function invalidByteSize(raw, reason) {
  const value = raw.trim() ? `"${raw}"` : "empty value";
  const prefix = reason ? `Invalid byte size (${reason}): ${value}.` : `Invalid byte size: ${value}.`;
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
  if (!Number.isFinite(bytes)) {
    throw invalidByteSize(raw);
  }
  return bytes;
}

// vendor/openclaw/src/cli/parse-duration.ts
var DURATION_MULTIPLIERS = {
  ms: 1,
  s: 1e3,
  m: 6e4,
  h: 36e5,
  d: 864e5
};
function invalidDuration(raw, reason) {
  const value = raw.trim() ? `"${raw}"` : "empty value";
  const prefix = reason ? `Invalid duration (${reason}): ${value}.` : `Invalid duration: ${value}.`;
  return new Error(`${prefix} Use values like 500ms, 30s, 5m, 2h, or 1h30m.`);
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
    const value = Number(single[1]);
    if (!Number.isFinite(value) || value < 0) {
      throw invalidDuration(raw);
    }
    const unit = single[2] ?? opts?.defaultUnit ?? "ms";
    return roundSafeDurationMs(raw, value * DURATION_MULTIPLIERS[unit]);
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
    const value = Number(valueRaw);
    if (!Number.isFinite(value) || value < 0) {
      throw invalidDuration(raw);
    }
    const multiplier = DURATION_MULTIPLIERS[unitRaw];
    if (!multiplier) {
      throw invalidDuration(raw);
    }
    totalMs += value * multiplier;
    consumed += full.length;
  }
  if (consumed !== trimmed.length || consumed === 0) {
    throw invalidDuration(raw);
  }
  return roundSafeDurationMs(raw, totalMs);
}

// vendor/openclaw/src/infra/prototype-keys.ts
var BLOCKED_OBJECT_KEYS = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
function isBlockedObjectKey(key) {
  return BLOCKED_OBJECT_KEYS.has(key);
}

// vendor/openclaw/src/routing/session-key.ts
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
  return normalized.replace(INVALID_CHARS_RE, "-").replace(LEADING_DASH_RE, "").replace(TRAILING_DASH_RE, "").slice(0, 64) || DEFAULT_AGENT_ID;
}

// vendor/openclaw/src/config/control-ui-css.ts
var CSS_WIDTH_KEYWORDS = /* @__PURE__ */ new Set(["none", "min-content", "max-content"]);
var CSS_WIDTH_FUNCTIONS = /* @__PURE__ */ new Set(["calc", "clamp", "fit-content", "max", "min"]);
var CSS_WIDTH_UNITS = /* @__PURE__ */ new Set(["ch", "em", "rem", "vh", "vmax", "vmin", "vw", "px"]);
var CSS_WIDTH_ALLOWED_CHARS = /^[0-9A-Za-z.%+\-*/(),\s]+$/;
var CSS_WIDTH_IDENTIFIER_RE = /[A-Za-z][A-Za-z0-9-]*/g;
var CSS_WIDTH_SIMPLE_RE = /^(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|ch|vw|vh|vmin|vmax|%)$/i;
var CSS_WIDTH_MAX_LENGTH = 96;
function hasBalancedParentheses(value) {
  let depth = 0;
  for (const char of value) {
    if (char === "(") {
      depth++;
    } else if (char === ")") {
      depth--;
      if (depth < 0) {
        return false;
      }
    }
  }
  return depth === 0;
}
function hasAllowedIdentifiers(value) {
  for (const match of value.matchAll(CSS_WIDTH_IDENTIFIER_RE)) {
    const identifier = match[0].toLowerCase();
    if (!CSS_WIDTH_FUNCTIONS.has(identifier) && !CSS_WIDTH_KEYWORDS.has(identifier) && !CSS_WIDTH_UNITS.has(identifier)) {
      return false;
    }
  }
  return true;
}
function normalizeControlUiChatMessageMaxWidth(value) {
  return value.trim().replace(/\s+/g, " ");
}
function isValidControlUiChatMessageMaxWidth(value) {
  const normalized = normalizeControlUiChatMessageMaxWidth(value);
  if (normalized.length === 0 || normalized.length > CSS_WIDTH_MAX_LENGTH) {
    return false;
  }
  if (CSS_WIDTH_KEYWORDS.has(normalized.toLowerCase())) {
    return true;
  }
  if (CSS_WIDTH_SIMPLE_RE.test(normalized)) {
    return true;
  }
  if (!CSS_WIDTH_ALLOWED_CHARS.test(normalized)) {
    return false;
  }
  if (!hasBalancedParentheses(normalized) || !hasAllowedIdentifiers(normalized)) {
    return false;
  }
  return /^(?:calc|clamp|fit-content|max|min)\(.+\)$/i.test(normalized);
}

// vendor/openclaw/src/config/zod-schema.agent-defaults.ts
import { z as z6 } from "zod";

// vendor/openclaw/src/config/byte-size.ts
function parseNonNegativeByteSize(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const int = Math.floor(value);
    return int >= 0 ? int : null;
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

// vendor/openclaw/packages/normalization-core/src/record-coerce.ts
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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
    options: rest.slice(optionsStart + 1)
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

// vendor/openclaw/node_modules/@openclaw/fs-safe/dist/pinned-python-config.js
var overrideConfig = {};
function configureFsSafePython(config) {
  overrideConfig = { ...overrideConfig, ...config };
}

// vendor/openclaw/src/infra/fs-safe-defaults.ts
var hasPythonModeOverride = process.env.FS_SAFE_PYTHON_MODE != null || process.env.OPENCLAW_FS_SAFE_PYTHON_MODE != null;
if (!hasPythonModeOverride) {
  configureFsSafePython({ mode: "off" });
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
  "tavily"
]);

// vendor/openclaw/src/config/zod-schema.agent-model.ts
import { z } from "zod";
var AgentModelSchema = z.union([
  z.string(),
  z.object({
    primary: z.string().optional(),
    fallbacks: z.array(z.string()).optional()
  }).strict()
]);
var AgentToolModelSchema = z.union([
  z.string(),
  z.object({
    primary: z.string().optional(),
    fallbacks: z.array(z.string()).optional(),
    timeoutMs: z.number().int().positive().optional()
  }).strict()
]);

// vendor/openclaw/src/config/zod-schema.core.ts
import path3 from "node:path";

// vendor/openclaw/packages/model-catalog-core/src/provider-id.ts
function normalizeLowercaseStringOrEmpty2(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
function normalizeProviderId(provider) {
  return normalizeLowercaseStringOrEmpty2(provider);
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

// vendor/openclaw/src/utils.ts
import fs from "node:fs";
import os2 from "node:os";
import path2 from "node:path";

// vendor/openclaw/src/infra/home-dir.ts
import os from "node:os";
import path from "node:path";
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
  return normalize(env.HOME) ?? normalize(env.USERPROFILE) ?? resolveTermuxHome(env) ?? normalizeSafe(homedir);
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
  return resolveEffectiveHomeDir(env, homedir) ?? path.resolve(process.cwd());
}
function expandHomePrefix(input, opts) {
  if (!input.startsWith("~")) {
    return input;
  }
  const home = normalize(opts?.home) ?? resolveEffectiveHomeDir(opts?.env ?? process.env, opts?.homedir ?? os.homedir);
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
      homedir: opts?.homedir
    });
    return path.resolve(expanded);
  }
  return path.resolve(trimmed);
}

// vendor/openclaw/packages/normalization-core/src/number-coercion.ts
var MAX_TIMER_TIMEOUT_MS = 2147e6;
var MAX_TIMER_TIMEOUT_SECONDS = Math.floor(MAX_TIMER_TIMEOUT_MS / 1e3);

// vendor/openclaw/src/utils.ts
function resolveUserPath(input, env = process.env, homedir = os2.homedir) {
  if (!input) {
    return "";
  }
  return resolveHomeRelativePath(input, { env, homedir });
}
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
  } catch {
  }
  return newDir;
}
var CONFIG_DIR = resolveConfigDir();

// vendor/openclaw/src/secrets/ref-contract.ts
var FILE_SECRET_REF_SEGMENT_PATTERN = /^(?:[^~]|~0|~1)*$/;
var EXEC_SECRET_REF_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,255}$/;
var SINGLE_VALUE_FILE_REF_ID = "value";
function isValidFileSecretRefId(value) {
  if (value === SINGLE_VALUE_FILE_REF_ID) {
    return true;
  }
  if (!value.startsWith("/")) {
    return false;
  }
  return value.slice(1).split("/").every((segment) => FILE_SECRET_REF_SEGMENT_PATTERN.test(segment));
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
function formatExecSecretRefIdValidationMessage() {
  return [
    "Exec secret reference id must match /^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,255}$/",
    'and must not include "." or ".." path segments',
    '(example: "vault/openai/api-key" or "aws/secret#json_key").'
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
  "azure-openai-responses"
];
var MODEL_THINKING_FORMATS = [
  "openai",
  "openrouter",
  "deepseek",
  "together",
  "qwen",
  "qwen-chat-template",
  "zai"
];

// vendor/openclaw/src/config/zod-schema.allowdeny.ts
import { z as z2 } from "zod";
var AllowDenyActionSchema = z2.union([z2.literal("allow"), z2.literal("deny")]);
var AllowDenyChatTypeSchema = z2.union([
  z2.literal("direct"),
  z2.literal("group"),
  z2.literal("channel"),
  /** @deprecated Use `direct` instead. Kept for backward compatibility. */
  z2.literal("dm")
]).optional();
function createAllowDenyChannelRulesSchema() {
  return z2.object({
    default: AllowDenyActionSchema.optional(),
    rules: z2.array(
      z2.object({
        action: AllowDenyActionSchema,
        match: z2.object({
          channel: z2.string().optional(),
          chatType: AllowDenyChatTypeSchema,
          keyPrefix: z2.string().optional(),
          rawKeyPrefix: z2.string().optional()
        }).strict().optional()
      }).strict()
    ).optional()
  }).strict().optional();
}

// vendor/openclaw/src/config/zod-schema.sensitive.ts
import { z as z3 } from "zod";
var sensitive = z3.registry();

// vendor/openclaw/src/config/zod-schema.core.ts
var ENV_SECRET_REF_ID_PATTERN = /^[A-Z][A-Z0-9_]{0,127}$/;
var SECRET_PROVIDER_ALIAS_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
var WINDOWS_ABS_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
var WINDOWS_UNC_PATH_PATTERN = /^\\\\[^\\]+\\[^\\]+/;
function isAbsolutePath(value) {
  return path3.isAbsolute(value) || WINDOWS_ABS_PATH_PATTERN.test(value) || WINDOWS_UNC_PATH_PATTERN.test(value);
}
var EnvSecretRefSchema = z4.object({
  source: z4.literal("env"),
  provider: z4.string().regex(
    SECRET_PROVIDER_ALIAS_PATTERN,
    'Secret reference provider must match /^[a-z][a-z0-9_-]{0,63}$/ (example: "default").'
  ),
  id: z4.string().regex(
    ENV_SECRET_REF_ID_PATTERN,
    'Env secret reference id must match /^[A-Z][A-Z0-9_]{0,127}$/ (example: "OPENAI_API_KEY").'
  )
}).strict();
var FileSecretRefSchema = z4.object({
  source: z4.literal("file"),
  provider: z4.string().regex(
    SECRET_PROVIDER_ALIAS_PATTERN,
    'Secret reference provider must match /^[a-z][a-z0-9_-]{0,63}$/ (example: "default").'
  ),
  id: z4.string().refine(
    isValidFileSecretRefId,
    'File secret reference id must be an absolute JSON pointer (example: "/providers/openai/apiKey"), or "value" for singleValue mode.'
  )
}).strict();
var ExecSecretRefSchema = z4.object({
  source: z4.literal("exec"),
  provider: z4.string().regex(
    SECRET_PROVIDER_ALIAS_PATTERN,
    'Secret reference provider must match /^[a-z][a-z0-9_-]{0,63}$/ (example: "default").'
  ),
  id: z4.string().refine(isValidExecSecretRefId, formatExecSecretRefIdValidationMessage())
}).strict();
var SecretRefSchema = z4.discriminatedUnion("source", [
  EnvSecretRefSchema,
  FileSecretRefSchema,
  ExecSecretRefSchema
]);
var SecretInputSchema = z4.union([z4.string(), SecretRefSchema]);
var SecretsEnvProviderSchema = z4.object({
  source: z4.literal("env"),
  allowlist: z4.array(z4.string().regex(ENV_SECRET_REF_ID_PATTERN)).max(256).optional()
}).strict();
var SecretsFileProviderSchema = z4.object({
  source: z4.literal("file"),
  path: z4.string().min(1),
  mode: z4.union([z4.literal("singleValue"), z4.literal("json")]).optional(),
  timeoutMs: z4.number().int().positive().max(12e4).optional(),
  maxBytes: z4.number().int().positive().max(20 * 1024 * 1024).optional(),
  allowInsecurePath: z4.boolean().optional()
}).strict();
var SecretsManualExecProviderSchema = z4.object({
  source: z4.literal("exec"),
  command: z4.string().min(1).refine((value) => isSafeExecutableValue(value), "secrets.providers.*.command is unsafe.").refine(
    (value) => isAbsolutePath(value),
    "secrets.providers.*.command must be an absolute path."
  ),
  args: z4.array(z4.string().max(1024)).max(128).optional(),
  timeoutMs: z4.number().int().positive().max(12e4).optional(),
  noOutputTimeoutMs: z4.number().int().positive().max(12e4).optional(),
  maxOutputBytes: z4.number().int().positive().max(20 * 1024 * 1024).optional(),
  jsonOnly: z4.boolean().optional(),
  env: z4.record(z4.string(), z4.string()).optional(),
  passEnv: z4.array(z4.string().regex(ENV_SECRET_REF_ID_PATTERN)).max(128).optional(),
  trustedDirs: z4.array(
    z4.string().min(1).refine((value) => isAbsolutePath(value), "trustedDirs entries must be absolute paths.")
  ).max(64).optional(),
  allowInsecurePath: z4.boolean().optional(),
  allowSymlinkCommand: z4.boolean().optional()
}).strict();
var SecretsPluginIntegrationExecProviderSchema = z4.object({
  source: z4.literal("exec"),
  pluginIntegration: z4.object({
    pluginId: z4.string().min(1).max(128),
    integrationId: z4.string().min(1).max(128)
  }).strict()
}).strict();
var SecretsExecProviderSchema = z4.union([
  SecretsManualExecProviderSchema,
  SecretsPluginIntegrationExecProviderSchema
]);
var SecretProviderSchema = z4.union([
  SecretsEnvProviderSchema,
  SecretsFileProviderSchema,
  SecretsExecProviderSchema
]);
var SecretsConfigSchema = z4.object({
  providers: z4.object({
    // Keep this as a record so users can define multiple named providers per source.
  }).catchall(SecretProviderSchema).optional(),
  defaults: z4.object({
    env: z4.string().regex(SECRET_PROVIDER_ALIAS_PATTERN).optional(),
    file: z4.string().regex(SECRET_PROVIDER_ALIAS_PATTERN).optional(),
    exec: z4.string().regex(SECRET_PROVIDER_ALIAS_PATTERN).optional()
  }).strict().optional(),
  resolution: z4.object({
    maxProviderConcurrency: z4.number().int().positive().max(16).optional(),
    maxRefsPerProvider: z4.number().int().positive().max(4096).optional(),
    maxBatchBytes: z4.number().int().positive().max(5 * 1024 * 1024).optional()
  }).strict().optional()
}).strict().optional();
var ModelApiSchema = z4.enum(MODEL_APIS);
var ModelCompatSchema = z4.object({
  supportsStore: z4.boolean().optional(),
  supportsPromptCacheKey: z4.boolean().optional(),
  supportsDeveloperRole: z4.boolean().optional(),
  supportsReasoningEffort: z4.boolean().optional(),
  supportsUsageInStreaming: z4.boolean().optional(),
  supportsTools: z4.boolean().optional(),
  supportsStrictMode: z4.boolean().optional(),
  requiresStringContent: z4.boolean().optional(),
  strictMessageKeys: z4.boolean().optional(),
  visibleReasoningDetailTypes: z4.array(z4.string().min(1)).optional(),
  supportedReasoningEfforts: z4.array(z4.string().min(1)).optional(),
  reasoningEffortMap: z4.record(z4.string().min(1), z4.string().min(1)).optional(),
  maxTokensField: z4.union([z4.literal("max_completion_tokens"), z4.literal("max_tokens")]).optional(),
  thinkingFormat: z4.enum(MODEL_THINKING_FORMATS).optional(),
  requiresToolResultName: z4.boolean().optional(),
  requiresAssistantAfterToolResult: z4.boolean().optional(),
  requiresThinkingAsText: z4.boolean().optional(),
  requiresReasoningContentOnAssistantMessages: z4.boolean().optional(),
  toolSchemaProfile: z4.string().optional(),
  unsupportedToolSchemaKeywords: z4.array(z4.string().min(1)).optional(),
  nativeWebSearchTool: z4.boolean().optional(),
  toolCallArgumentsEncoding: z4.string().optional(),
  requiresMistralToolIds: z4.boolean().optional(),
  requiresOpenAiAnthropicToolPayload: z4.boolean().optional()
}).strict().optional();
var ConfiguredProviderRequestTlsSchema = z4.object({
  ca: SecretInputSchema.optional().register(sensitive),
  cert: SecretInputSchema.optional().register(sensitive),
  key: SecretInputSchema.optional().register(sensitive),
  passphrase: SecretInputSchema.optional().register(sensitive),
  serverName: z4.string().optional(),
  insecureSkipVerify: z4.boolean().optional()
}).strict().optional();
var ConfiguredProviderRequestAuthSchema = z4.union([
  z4.object({
    mode: z4.literal("provider-default")
  }).strict(),
  z4.object({
    mode: z4.literal("authorization-bearer"),
    token: SecretInputSchema.register(sensitive)
  }).strict(),
  z4.object({
    mode: z4.literal("header"),
    headerName: z4.string().min(1),
    value: SecretInputSchema.register(sensitive),
    prefix: z4.string().optional()
  }).strict()
]).optional();
var ConfiguredProviderRequestProxySchema = z4.union([
  z4.object({
    mode: z4.literal("env-proxy"),
    tls: ConfiguredProviderRequestTlsSchema
  }).strict(),
  z4.object({
    mode: z4.literal("explicit-proxy"),
    url: z4.string().min(1),
    tls: ConfiguredProviderRequestTlsSchema
  }).strict()
]).optional();
var ConfiguredProviderRequestFields = {
  headers: z4.record(z4.string(), SecretInputSchema.register(sensitive)).optional(),
  auth: ConfiguredProviderRequestAuthSchema,
  proxy: ConfiguredProviderRequestProxySchema,
  tls: ConfiguredProviderRequestTlsSchema
};
var ConfiguredProviderRequestSchema = z4.object(ConfiguredProviderRequestFields).strict().optional();
var ConfiguredModelProviderRequestSchema = z4.object({
  ...ConfiguredProviderRequestFields,
  allowPrivateNetwork: z4.boolean().optional()
}).strict().optional();
var ModelAgentRuntimePolicySchema = z4.object({
  id: z4.string().optional()
}).strict().optional();
var ModelImageInputSchema = z4.object({
  maxBytes: z4.number().int().positive().optional(),
  maxPixels: z4.number().int().positive().optional(),
  maxSidePx: z4.number().int().positive().optional(),
  preferredSidePx: z4.number().int().positive().optional(),
  tokenMode: z4.union([z4.literal("tile"), z4.literal("detail"), z4.literal("provider")]).optional()
}).strict();
var ModelMediaInputSchema = z4.object({
  image: ModelImageInputSchema.optional()
}).strict();
var ThinkingLevelMapValueSchema = z4.string().nullable();
var ThinkingLevelMapSchema = z4.object({
  off: ThinkingLevelMapValueSchema.optional(),
  minimal: ThinkingLevelMapValueSchema.optional(),
  low: ThinkingLevelMapValueSchema.optional(),
  medium: ThinkingLevelMapValueSchema.optional(),
  high: ThinkingLevelMapValueSchema.optional(),
  xhigh: ThinkingLevelMapValueSchema.optional(),
  max: ThinkingLevelMapValueSchema.optional()
}).strict();
var ModelDefinitionSchema = z4.object({
  id: z4.string().min(1),
  name: z4.string().min(1),
  api: ModelApiSchema.optional(),
  baseUrl: z4.string().min(1).optional(),
  reasoning: z4.boolean().optional(),
  input: z4.array(
    z4.union([z4.literal("text"), z4.literal("image"), z4.literal("video"), z4.literal("audio")])
  ).optional(),
  cost: z4.object({
    input: z4.number().optional(),
    output: z4.number().optional(),
    cacheRead: z4.number().optional(),
    cacheWrite: z4.number().optional(),
    tieredPricing: z4.array(
      z4.object({
        input: z4.number(),
        output: z4.number(),
        cacheRead: z4.number(),
        cacheWrite: z4.number(),
        range: z4.union([z4.tuple([z4.number(), z4.number()]), z4.tuple([z4.number()])])
      }).strict()
    ).optional()
  }).strict().optional(),
  contextWindow: z4.number().positive().optional(),
  contextTokens: z4.number().int().positive().optional(),
  maxTokens: z4.number().positive().optional(),
  thinkingLevelMap: ThinkingLevelMapSchema.optional(),
  params: z4.record(z4.string(), z4.unknown()).optional(),
  agentRuntime: ModelAgentRuntimePolicySchema,
  headers: z4.record(z4.string(), z4.string()).optional(),
  compat: ModelCompatSchema,
  mediaInput: ModelMediaInputSchema.optional(),
  metadataSource: z4.literal("models-add").optional()
}).strict();
var ModelProviderLocalServiceSchema = z4.object({
  command: z4.string().min(1),
  args: z4.array(z4.string()).optional(),
  cwd: z4.string().min(1).optional(),
  env: z4.record(z4.string(), z4.string().register(sensitive)).optional(),
  healthUrl: z4.string().min(1).optional(),
  readyTimeoutMs: z4.number().int().positive().optional(),
  idleStopMs: z4.number().int().nonnegative().optional()
}).strict().optional();
var BUILT_IN_MODEL_PROVIDER_OVERLAY_IDS = /* @__PURE__ */ new Set([
  "amazon-bedrock",
  "amazon-bedrock-mantle",
  "anthropic",
  "anthropic-vertex",
  "arcee",
  "byteplus",
  "byteplus-plan",
  "cerebras",
  "chutes",
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
  "microsoft-foundry",
  "minimax",
  "minimax-portal",
  "mistral",
  "modelstudio",
  "moonshot",
  "nvidia",
  "ollama",
  "openai",
  "opencode",
  "opencode-go",
  "openrouter",
  "qianfan",
  "qwen",
  "qwencloud",
  "sglang",
  "stepfun",
  "stepfun-plan",
  "synthetic",
  "tencent-tokenhub",
  "together",
  "venice",
  "vercel-ai-gateway",
  "vllm",
  "volcengine",
  "volcengine-plan",
  "vydra",
  "xai",
  "xiaomi",
  "xiaomi-token-plan",
  "zai"
]);
function isBuiltInModelProviderOverlayId(providerId) {
  return BUILT_IN_MODEL_PROVIDER_OVERLAY_IDS.has(normalizeProviderId(providerId));
}
var ModelProviderSchema = z4.object({
  baseUrl: z4.string().min(1).optional(),
  apiKey: SecretInputSchema.optional().register(sensitive),
  auth: z4.union([z4.literal("api-key"), z4.literal("aws-sdk"), z4.literal("oauth"), z4.literal("token")]).optional(),
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
  models: z4.array(ModelDefinitionSchema).optional()
}).strict();
var ModelProvidersSchema = z4.record(z4.string(), ModelProviderSchema).superRefine((providers, ctx) => {
  for (const [providerId, provider] of Object.entries(providers)) {
    if (isBuiltInModelProviderOverlayId(providerId)) {
      continue;
    }
    if (!provider.baseUrl) {
      ctx.addIssue({
        code: "custom",
        path: [providerId, "baseUrl"],
        message: "custom model providers must declare baseUrl; provider overlays without baseUrl are only supported for bundled providers"
      });
    }
    if (!Array.isArray(provider.models)) {
      ctx.addIssue({
        code: "custom",
        path: [providerId, "models"],
        message: "custom model providers must declare models; provider overlays without models are only supported for bundled providers"
      });
    }
  }
});
var ModelPricingConfigSchema = z4.object({
  enabled: z4.boolean().optional()
}).strict().optional();
var ModelsConfigSchema = z4.object({
  mode: z4.union([z4.literal("merge"), z4.literal("replace")]).optional(),
  providers: ModelProvidersSchema.optional(),
  pricing: ModelPricingConfigSchema
}).strict().optional();
var VisibleRepliesValueSchema = z4.enum(["automatic", "message_tool"]);
var AmbientGroupInboundSchema = z4.enum(["user_request", "room_event"]);
var VisibleRepliesSchema = z4.union([VisibleRepliesValueSchema, z4.boolean()]).overwrite((value) => {
  if (value === true) {
    return "automatic";
  }
  if (value === false) {
    return "message_tool";
  }
  return value;
});
var MentionPatternsModeSchema = z4.union([z4.literal("allow"), z4.literal("deny")]);
var MentionPatternsPolicySchema = z4.object({
  mode: MentionPatternsModeSchema.optional(),
  allowIn: z4.array(z4.string()).optional(),
  denyIn: z4.array(z4.string()).optional()
}).strict();
var GroupChatSchema = z4.object({
  mentionPatterns: z4.array(z4.string()).optional(),
  historyLimit: z4.number().int().positive().optional(),
  unmentionedInbound: AmbientGroupInboundSchema.optional(),
  visibleReplies: VisibleRepliesSchema.optional()
}).strict().optional();
var DmConfigSchema = z4.object({
  historyLimit: z4.number().int().min(0).optional()
}).strict();
var IdentitySchema = z4.object({
  name: z4.string().optional(),
  theme: z4.string().optional(),
  emoji: z4.string().optional(),
  avatar: z4.string().optional()
}).strict().optional();
var QueueModeSchema = z4.union([
  z4.literal("steer"),
  z4.literal("followup"),
  z4.literal("collect"),
  z4.literal("interrupt")
]);
var QueueDropSchema = z4.union([z4.literal("old"), z4.literal("new"), z4.literal("summarize")]);
var ReplyToModeSchema = z4.union([
  z4.literal("off"),
  z4.literal("first"),
  z4.literal("all"),
  z4.literal("batched")
]);
var TypingModeSchema = z4.union([
  z4.literal("never"),
  z4.literal("instant"),
  z4.literal("thinking"),
  z4.literal("message")
]);
var GroupPolicySchema = z4.enum(["open", "disabled", "allowlist"]);
var DmPolicySchema = z4.enum(["pairing", "allowlist", "open", "disabled"]);
var ContextVisibilityModeSchema = z4.enum(["all", "allowlist", "allowlist_quote"]);
var BlockStreamingCoalesceSchema = z4.object({
  minChars: z4.number().int().positive().optional(),
  maxChars: z4.number().int().positive().optional(),
  idleMs: z4.number().int().nonnegative().optional()
}).strict();
var ReplyRuntimeConfigSchemaShape = {
  historyLimit: z4.number().int().min(0).optional(),
  dmHistoryLimit: z4.number().int().min(0).optional(),
  contextVisibility: ContextVisibilityModeSchema.optional(),
  dms: z4.record(z4.string(), DmConfigSchema.optional()).optional(),
  textChunkLimit: z4.number().int().positive().optional(),
  chunkMode: z4.enum(["length", "newline"]).optional(),
  blockStreaming: z4.boolean().optional(),
  blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
  responsePrefix: z4.string().optional(),
  mediaMaxMb: z4.number().positive().optional()
};
var BlockStreamingChunkSchema = z4.object({
  minChars: z4.number().int().positive().optional(),
  maxChars: z4.number().int().positive().optional(),
  breakPreference: z4.union([z4.literal("paragraph"), z4.literal("newline"), z4.literal("sentence")]).optional()
}).strict();
var MarkdownTableModeSchema = z4.enum(["off", "bullets", "code", "block"]);
var MarkdownConfigSchema = z4.object({
  tables: MarkdownTableModeSchema.optional()
}).strict().optional();
var TtsProviderSchema = z4.string().min(1);
var TtsModeSchema = z4.enum(["final", "all"]);
var TtsAutoSchema = z4.enum(["off", "always", "inbound", "tagged"]);
var TtsProviderConfigSchema = z4.object({
  apiKey: SecretInputSchema.optional().register(sensitive)
}).catchall(
  z4.union([
    z4.string(),
    z4.number(),
    z4.boolean(),
    z4.null(),
    z4.array(z4.unknown()),
    z4.record(z4.string(), z4.unknown())
  ])
);
var TtsPersonaPromptSchema = z4.object({
  profile: z4.string().optional(),
  scene: z4.string().optional(),
  sampleContext: z4.string().optional(),
  style: z4.string().optional(),
  accent: z4.string().optional(),
  pacing: z4.string().optional(),
  constraints: z4.array(z4.string()).optional()
}).strict();
var TtsPersonaSchema = z4.object({
  label: z4.string().optional(),
  description: z4.string().optional(),
  provider: TtsProviderSchema.optional(),
  fallbackPolicy: z4.union([z4.literal("preserve-persona"), z4.literal("provider-defaults"), z4.literal("fail")]).optional(),
  prompt: TtsPersonaPromptSchema.optional(),
  providers: z4.record(z4.string(), TtsProviderConfigSchema).optional()
}).strict();
var TtsConfigSchema = z4.object({
  auto: TtsAutoSchema.optional(),
  enabled: z4.boolean().optional(),
  mode: TtsModeSchema.optional(),
  provider: TtsProviderSchema.optional(),
  persona: z4.string().optional(),
  personas: z4.record(z4.string(), TtsPersonaSchema).optional(),
  summaryModel: z4.string().optional(),
  modelOverrides: z4.object({
    enabled: z4.boolean().optional(),
    allowText: z4.boolean().optional(),
    allowProvider: z4.boolean().optional(),
    allowVoice: z4.boolean().optional(),
    allowModelId: z4.boolean().optional(),
    allowVoiceSettings: z4.boolean().optional(),
    allowNormalization: z4.boolean().optional(),
    allowSeed: z4.boolean().optional()
  }).strict().optional(),
  providers: z4.record(z4.string(), TtsProviderConfigSchema).optional(),
  prefsPath: z4.string().optional(),
  maxTextLength: z4.number().int().min(1).optional(),
  timeoutMs: z4.number().int().min(1e3).max(12e4).optional()
}).strict().optional();
var HumanDelaySchema = z4.object({
  mode: z4.union([z4.literal("off"), z4.literal("natural"), z4.literal("custom")]).optional(),
  minMs: z4.number().int().nonnegative().optional(),
  maxMs: z4.number().int().nonnegative().optional()
}).strict();
var CliBackendWatchdogModeSchema = z4.object({
  noOutputTimeoutMs: z4.number().int().min(1e3).optional(),
  noOutputTimeoutRatio: z4.number().min(0.05).max(0.95).optional(),
  minMs: z4.number().int().min(1e3).optional(),
  maxMs: z4.number().int().min(1e3).optional()
}).strict().optional();
var CliBackendOutputLimitsSchema = z4.object({
  maxTurnRawChars: z4.number().int().min(1024).max(64 * 1024 * 1024).optional(),
  maxTurnLines: z4.number().int().min(100).max(1e5).optional()
}).strict().optional();
var CliBackendSchema = z4.object({
  command: z4.string(),
  args: z4.array(z4.string()).optional(),
  output: z4.union([z4.literal("json"), z4.literal("text"), z4.literal("jsonl")]).optional(),
  resumeOutput: z4.union([z4.literal("json"), z4.literal("text"), z4.literal("jsonl")]).optional(),
  jsonlDialect: z4.union([z4.literal("claude-stream-json"), z4.literal("gemini-stream-json")]).optional(),
  liveSession: z4.literal("claude-stdio").optional(),
  input: z4.union([z4.literal("arg"), z4.literal("stdin")]).optional(),
  maxPromptArgChars: z4.number().int().positive().optional(),
  env: z4.record(z4.string(), z4.string()).optional(),
  clearEnv: z4.array(z4.string()).optional(),
  modelArg: z4.string().optional(),
  modelAliases: z4.record(z4.string(), z4.string()).optional(),
  sessionArg: z4.string().optional(),
  sessionArgs: z4.array(z4.string()).optional(),
  resumeArgs: z4.array(z4.string()).optional(),
  sessionMode: z4.union([z4.literal("always"), z4.literal("existing"), z4.literal("none")]).optional(),
  sessionIdFields: z4.array(z4.string()).optional(),
  systemPromptArg: z4.string().optional(),
  systemPromptFileArg: z4.string().optional(),
  systemPromptFileConfigArg: z4.string().optional(),
  systemPromptFileConfigKey: z4.string().optional(),
  systemPromptMode: z4.union([z4.literal("append"), z4.literal("replace")]).optional(),
  systemPromptWhen: z4.union([z4.literal("first"), z4.literal("always"), z4.literal("never")]).optional(),
  imageArg: z4.string().optional(),
  imageMode: z4.union([z4.literal("repeat"), z4.literal("list")]).optional(),
  imagePathScope: z4.union([z4.literal("temp"), z4.literal("workspace")]).optional(),
  serialize: z4.boolean().optional(),
  reseedFromRawTranscriptWhenUncompacted: z4.boolean().optional(),
  reliability: z4.object({
    outputLimits: CliBackendOutputLimitsSchema,
    watchdog: z4.object({
      fresh: CliBackendWatchdogModeSchema,
      resume: CliBackendWatchdogModeSchema
    }).strict().optional()
  }).strict().optional()
}).strict();
var MSTeamsReplyStyleSchema = z4.enum(["thread", "top-level"]);
var RetryConfigSchema = z4.object({
  attempts: z4.number().int().min(1).optional(),
  minDelayMs: z4.number().int().min(0).optional(),
  maxDelayMs: z4.number().int().min(0).optional(),
  jitter: z4.number().min(0).max(1).optional()
}).strict().optional();
var QueueModeBySurfaceSchema = z4.object({
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
  matrix: QueueModeSchema.optional()
}).strict().optional();
var DebounceMsBySurfaceSchema = z4.record(z4.string(), z4.number().int().nonnegative()).optional();
var QueueSchema = z4.object({
  mode: QueueModeSchema.optional(),
  byChannel: QueueModeBySurfaceSchema,
  debounceMs: z4.number().int().nonnegative().optional(),
  debounceMsByChannel: DebounceMsBySurfaceSchema,
  cap: z4.number().int().positive().optional(),
  drop: QueueDropSchema.optional()
}).strict().optional();
var InboundDebounceSchema = z4.object({
  debounceMs: z4.number().int().nonnegative().optional(),
  byChannel: DebounceMsBySurfaceSchema
}).strict().optional();
var TranscribeAudioSchema = z4.object({
  command: z4.array(z4.string()).superRefine((value, ctx) => {
    const executable = value[0];
    if (!isSafeExecutableValue(executable)) {
      ctx.addIssue({
        code: z4.ZodIssueCode.custom,
        path: [0],
        message: "expected safe executable name or path"
      });
    }
  }),
  timeoutSeconds: z4.number().int().positive().optional()
}).strict().optional();
var HexColorSchema = z4.string().regex(/^#?[0-9a-fA-F]{6}$/, "expected hex color (RRGGBB)");
var ExecutableTokenSchema = z4.string().refine(isSafeExecutableValue, "expected safe executable name or path");
var MediaUnderstandingScopeSchema = createAllowDenyChannelRulesSchema();
var MediaUnderstandingCapabilitiesSchema = z4.array(z4.union([z4.literal("image"), z4.literal("audio"), z4.literal("video")])).optional();
var MediaUnderstandingAttachmentsSchema = z4.object({
  mode: z4.union([z4.literal("first"), z4.literal("all")]).optional(),
  maxAttachments: z4.number().int().positive().optional(),
  prefer: z4.union([z4.literal("first"), z4.literal("last"), z4.literal("path"), z4.literal("url")]).optional()
}).strict().optional();
var DeepgramAudioSchema = z4.object({
  detectLanguage: z4.boolean().optional(),
  punctuate: z4.boolean().optional(),
  smartFormat: z4.boolean().optional()
}).strict().optional();
var ProviderOptionValueSchema = z4.union([z4.string(), z4.number(), z4.boolean()]);
var ProviderOptionsSchema = z4.record(z4.string(), z4.record(z4.string(), ProviderOptionValueSchema)).optional();
var MediaUnderstandingRuntimeFields = {
  prompt: z4.string().optional(),
  timeoutSeconds: z4.number().int().positive().optional(),
  language: z4.string().optional(),
  providerOptions: ProviderOptionsSchema,
  deepgram: DeepgramAudioSchema,
  baseUrl: z4.string().optional(),
  headers: z4.record(z4.string(), z4.string()).optional(),
  request: ConfiguredProviderRequestSchema
};
var MediaUnderstandingModelSchema = z4.object({
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
  preferredProfile: z4.string().optional()
}).strict().optional();
var ToolsMediaUnderstandingSchema = z4.object({
  enabled: z4.boolean().optional(),
  scope: MediaUnderstandingScopeSchema,
  maxBytes: z4.number().int().positive().optional(),
  maxChars: z4.number().int().positive().optional(),
  ...MediaUnderstandingRuntimeFields,
  attachments: MediaUnderstandingAttachmentsSchema,
  models: z4.array(MediaUnderstandingModelSchema).optional(),
  echoTranscript: z4.boolean().optional(),
  echoFormat: z4.string().optional()
}).strict().optional();
var ToolsMediaSchema = z4.object({
  models: z4.array(MediaUnderstandingModelSchema).optional(),
  concurrency: z4.number().int().positive().optional(),
  asyncCompletion: z4.object({
    directSend: z4.boolean().optional()
  }).strict().optional(),
  image: ToolsMediaUnderstandingSchema.optional(),
  audio: ToolsMediaUnderstandingSchema.optional(),
  video: ToolsMediaUnderstandingSchema.optional()
}).strict().optional();
var LinkModelSchema = z4.object({
  type: z4.literal("cli").optional(),
  command: z4.string().min(1),
  args: z4.array(z4.string()).optional(),
  timeoutSeconds: z4.number().int().positive().optional()
}).strict();
var ToolsLinksSchema = z4.object({
  enabled: z4.boolean().optional(),
  scope: MediaUnderstandingScopeSchema,
  maxLinks: z4.number().int().positive().optional(),
  timeoutSeconds: z4.number().int().positive().optional(),
  models: z4.array(LinkModelSchema).optional()
}).strict().optional();
var NativeCommandsSettingSchema = z4.union([z4.boolean(), z4.literal("auto")]);
var ProviderCommandsSchema = z4.object({
  native: NativeCommandsSettingSchema.optional(),
  nativeSkills: NativeCommandsSettingSchema.optional()
}).strict().optional();

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
        message: "Sandbox security: bind mount entry must be a non-empty string."
      });
      continue;
    }
    const parsed = splitSandboxBindSpec(bind);
    const source = (parsed ? parsed.host : bind).trim();
    if (!isSandboxHostPathAbsolute(source)) {
      ctx.addIssue({
        code: z5.ZodIssueCode.custom,
        path: ["binds", i],
        message: `Sandbox security: bind mount "${bind}" uses a non-absolute source path "${source}". Only absolute POSIX or Windows drive-letter paths are supported for sandbox binds.`
      });
    }
  }
}
var AgentRunRetriesConfigSchema = z5.object({
  base: z5.number().int().positive().optional(),
  perProfile: z5.number().int().nonnegative().optional(),
  min: z5.number().int().positive().optional(),
  max: z5.number().int().positive().optional()
}).strict().refine(
  (data) => {
    if (data.min !== void 0 && data.max !== void 0) {
      return data.max >= data.min;
    }
    return true;
  },
  { message: "max must be greater than or equal to min", path: ["max"] }
);
var AgentEntryEmbeddedAgentConfigSchema = z5.object({
  executionContract: z5.union([z5.literal("default"), z5.literal("strict-agentic")]).optional()
}).strict();
var HeartbeatSchema = z5.object({
  every: z5.string().optional(),
  activeHours: z5.object({
    start: z5.string().optional(),
    end: z5.string().optional(),
    timezone: z5.string().optional()
  }).strict().optional(),
  model: z5.string().optional(),
  session: z5.string().optional(),
  includeReasoning: z5.boolean().optional(),
  target: z5.string().optional(),
  directPolicy: z5.union([z5.literal("allow"), z5.literal("block")]).optional(),
  to: z5.string().optional(),
  accountId: z5.string().optional(),
  prompt: z5.string().optional(),
  includeSystemPromptSection: z5.boolean().optional(),
  ackMaxChars: z5.number().int().nonnegative().optional(),
  suppressToolErrorWarnings: z5.boolean().optional(),
  timeoutSeconds: z5.number().int().positive().optional(),
  lightContext: z5.boolean().optional(),
  isolatedSession: z5.boolean().optional(),
  skipWhenBusy: z5.boolean().optional()
}).strict().superRefine((val, ctx) => {
  if (!val.every) {
    return;
  }
  try {
    parseDurationMs(val.every, { defaultUnit: "m" });
  } catch {
    ctx.addIssue({
      code: z5.ZodIssueCode.custom,
      path: ["every"],
      message: "invalid duration (use ms, s, m, h)"
    });
  }
  const active = val.activeHours;
  if (!active) {
    return;
  }
  const timePattern = /^([01]\d|2[0-3]|24):([0-5]\d)$/;
  const validateTime = (raw, opts, path5) => {
    if (!raw) {
      return;
    }
    if (!timePattern.test(raw)) {
      ctx.addIssue({
        code: z5.ZodIssueCode.custom,
        path: ["activeHours", path5],
        message: 'invalid time (use "HH:MM" 24h format)'
      });
      return;
    }
    const [hourStr, minuteStr] = raw.split(":");
    const hour = Number(hourStr);
    const minute = Number(minuteStr);
    if (hour === 24 && minute !== 0) {
      ctx.addIssue({
        code: z5.ZodIssueCode.custom,
        path: ["activeHours", path5],
        message: "invalid time (24:00 is the only allowed 24:xx value)"
      });
      return;
    }
    if (hour === 24 && !opts.allow24) {
      ctx.addIssue({
        code: z5.ZodIssueCode.custom,
        path: ["activeHours", path5],
        message: "invalid time (start cannot be 24:00)"
      });
    }
  };
  validateTime(active.start, { allow24: false }, "start");
  validateTime(active.end, { allow24: true }, "end");
}).optional();
var SandboxDockerSchema = z5.object({
  image: z5.string().optional(),
  containerPrefix: z5.string().optional(),
  workdir: z5.string().optional(),
  readOnlyRoot: z5.boolean().optional(),
  tmpfs: z5.array(z5.string()).optional(),
  network: z5.string().optional(),
  user: z5.string().optional(),
  capDrop: z5.array(z5.string()).optional(),
  env: z5.record(z5.string(), z5.string()).optional(),
  setupCommand: z5.union([z5.string(), z5.array(z5.string())]).transform((value) => Array.isArray(value) ? value.join("\n") : value).pipe(z5.string()).optional(),
  pidsLimit: z5.number().int().positive().optional(),
  memory: z5.union([z5.string(), z5.number()]).optional(),
  memorySwap: z5.union([z5.string(), z5.number()]).optional(),
  cpus: z5.number().positive().optional(),
  gpus: z5.string().min(1).optional(),
  ulimits: z5.record(
    z5.string(),
    z5.union([
      z5.string(),
      z5.number(),
      z5.object({
        soft: z5.number().int().nonnegative().optional(),
        hard: z5.number().int().nonnegative().optional()
      }).strict()
    ])
  ).optional(),
  seccompProfile: z5.string().optional(),
  apparmorProfile: z5.string().optional(),
  dns: z5.array(z5.string()).optional(),
  extraHosts: z5.array(z5.string()).optional(),
  binds: z5.array(z5.string()).optional(),
  dangerouslyAllowReservedContainerTargets: z5.boolean().optional(),
  dangerouslyAllowExternalBindSources: z5.boolean().optional(),
  dangerouslyAllowContainerNamespaceJoin: z5.boolean().optional()
}).strict().superRefine((data, ctx) => {
  validateSandboxBindEntries(data.binds, ctx);
  const blockedNetworkReason = getBlockedNetworkModeReason({
    network: data.network,
    allowContainerNamespaceJoin: data.dangerouslyAllowContainerNamespaceJoin === true
  });
  if (blockedNetworkReason === "host") {
    ctx.addIssue({
      code: z5.ZodIssueCode.custom,
      path: ["network"],
      message: 'Sandbox security: network mode "host" is blocked. Use "bridge" or "none" instead.'
    });
  }
  if (blockedNetworkReason === "container_namespace_join") {
    ctx.addIssue({
      code: z5.ZodIssueCode.custom,
      path: ["network"],
      message: 'Sandbox security: network mode "container:*" is blocked by default. Use a custom bridge network, or set dangerouslyAllowContainerNamespaceJoin=true only when you fully trust this runtime.'
    });
  }
  if (normalizeLowercaseStringOrEmpty(data.seccompProfile ?? "") === "unconfined") {
    ctx.addIssue({
      code: z5.ZodIssueCode.custom,
      path: ["seccompProfile"],
      message: 'Sandbox security: seccomp profile "unconfined" is blocked. Use a custom seccomp profile file or omit this setting.'
    });
  }
  if (normalizeLowercaseStringOrEmpty(data.apparmorProfile ?? "") === "unconfined") {
    ctx.addIssue({
      code: z5.ZodIssueCode.custom,
      path: ["apparmorProfile"],
      message: 'Sandbox security: apparmor profile "unconfined" is blocked. Use a named AppArmor profile or omit this setting.'
    });
  }
}).optional();
var SandboxBrowserSchema = z5.object({
  enabled: z5.boolean().optional(),
  image: z5.string().optional(),
  containerPrefix: z5.string().optional(),
  network: z5.string().optional(),
  cdpPort: z5.number().int().positive().optional(),
  cdpSourceRange: z5.string().optional(),
  vncPort: z5.number().int().positive().optional(),
  noVncPort: z5.number().int().positive().optional(),
  headless: z5.boolean().optional(),
  enableNoVnc: z5.boolean().optional(),
  allowHostControl: z5.boolean().optional(),
  autoStart: z5.boolean().optional(),
  autoStartTimeoutMs: z5.number().int().positive().optional(),
  binds: z5.array(z5.string()).optional()
}).superRefine((data, ctx) => {
  validateSandboxBindEntries(data.binds, ctx);
  if (normalizeLowercaseStringOrEmpty(data.network ?? "") === "host") {
    ctx.addIssue({
      code: z5.ZodIssueCode.custom,
      path: ["network"],
      message: 'Sandbox security: browser network mode "host" is blocked. Use "bridge" or a custom bridge network instead.'
    });
  }
}).strict().optional();
var SandboxPruneSchema = z5.object({
  idleHours: z5.number().int().nonnegative().optional(),
  maxAgeDays: z5.number().int().nonnegative().optional()
}).strict().optional();
var AgentContextLimitsSchema = z5.object({
  memoryGetMaxChars: z5.number().int().min(1).max(25e4).optional(),
  memoryGetDefaultLines: z5.number().int().min(1).max(5e3).optional(),
  toolResultMaxChars: z5.number().int().min(1).max(1e6).optional(),
  postCompactionMaxChars: z5.number().int().min(1).max(5e4).optional()
}).strict().optional();
var AgentSkillsLimitsSchema = z5.object({
  maxSkillsPromptChars: z5.number().int().min(0).optional()
}).strict().optional();
var ToolPolicyBaseSchema = z5.object({
  allow: z5.array(z5.string()).optional(),
  alsoAllow: z5.array(z5.string()).optional(),
  deny: z5.array(z5.string()).optional()
}).strict();
var ToolPolicySchema = ToolPolicyBaseSchema.superRefine((value, ctx) => {
  if (value.allow && value.allow.length > 0 && value.alsoAllow && value.alsoAllow.length > 0) {
    ctx.addIssue({
      code: z5.ZodIssueCode.custom,
      message: "tools policy cannot set both allow and alsoAllow in the same scope (merge alsoAllow into allow, or remove allow and use profile + alsoAllow)"
    });
  }
}).optional();
var ToolPolicyBySenderSchema = z5.record(z5.string(), ToolPolicySchema).optional();
var TrimmedOptionalConfigStringSchema = z5.string().transform((value) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : void 0;
}).optional();
var CodexAllowedDomainsSchema = z5.array(z5.string()).transform((values) => {
  const deduped = uniqueStrings(
    values.map((value) => value.trim()).filter((value) => value.length > 0)
  );
  return deduped.length > 0 ? deduped : void 0;
}).optional();
var CodexUserLocationSchema = z5.object({
  country: TrimmedOptionalConfigStringSchema,
  region: TrimmedOptionalConfigStringSchema,
  city: TrimmedOptionalConfigStringSchema,
  timezone: TrimmedOptionalConfigStringSchema
}).strict().transform((value) => {
  return value.country || value.region || value.city || value.timezone ? value : void 0;
}).optional();
var BLOCKED_WEB_SEARCH_KEYS_ISSUE_FIELD = "__openclawBlockedWebSearchKeys";
var ToolsWebSearchSchema = z5.preprocess(
  (value) => {
    if (!isRecord(value)) {
      return value;
    }
    const blockedKeys = Object.getOwnPropertyNames(value).filter(
      (key) => isBlockedObjectKey(key)
    );
    if (blockedKeys.length === 0) {
      return value;
    }
    return {
      ...value,
      [BLOCKED_WEB_SEARCH_KEYS_ISSUE_FIELD]: blockedKeys
    };
  },
  z5.object({
    enabled: z5.boolean().optional(),
    provider: z5.string().optional(),
    maxResults: z5.number().int().positive().optional(),
    timeoutSeconds: z5.number().int().positive().optional(),
    cacheTtlMinutes: z5.number().nonnegative().optional(),
    apiKey: SecretInputSchema.optional().register(sensitive),
    openaiCodex: z5.object({
      enabled: z5.boolean().optional(),
      mode: z5.union([z5.literal("cached"), z5.literal("live")]).optional(),
      allowedDomains: CodexAllowedDomainsSchema,
      contextSize: z5.union([z5.literal("low"), z5.literal("medium"), z5.literal("high")]).optional(),
      userLocation: CodexUserLocationSchema
    }).strict().optional()
  }).catchall(z5.unknown()).superRefine((value, ctx) => {
    const blockedKeys = value[BLOCKED_WEB_SEARCH_KEYS_ISSUE_FIELD];
    if (Array.isArray(blockedKeys)) {
      for (const key of blockedKeys) {
        if (typeof key !== "string") {
          continue;
        }
        ctx.addIssue({
          code: z5.ZodIssueCode.custom,
          path: [key],
          message: "tools.web.search must not contain blocked object keys"
        });
      }
    }
    for (const [key, entry] of Object.entries(value)) {
      if (key === BLOCKED_WEB_SEARCH_KEYS_ISSUE_FIELD || isBlockedObjectKey(key)) {
        continue;
      }
      if (LEGACY_WEB_SEARCH_PROVIDER_CONFIG_KEYS.has(key) && isRecord(entry)) {
        ctx.addIssue({
          code: z5.ZodIssueCode.custom,
          path: [key],
          message: "legacy web_search provider config must use plugins.entries.<plugin>.config.webSearch"
        });
      }
    }
  })
).optional();
var ToolsWebFetchSchema = z5.object({
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
  ssrfPolicy: z5.object({
    allowRfc2544BenchmarkRange: z5.boolean().optional(),
    allowIpv6UniqueLocalRange: z5.boolean().optional()
  }).strict().optional(),
  // Keep the legacy Firecrawl fetch shape loadable so existing installs can
  // start and then migrate cleanly through doctor.
  firecrawl: z5.object({
    enabled: z5.boolean().optional(),
    apiKey: SecretInputSchema.optional().register(sensitive),
    baseUrl: z5.string().optional(),
    onlyMainContent: z5.boolean().optional(),
    maxAgeMs: z5.number().int().nonnegative().optional(),
    timeoutSeconds: z5.number().int().positive().optional()
  }).strict().optional()
}).strict().optional();
var ToolsWebXSearchSchema = z5.object({
  enabled: z5.boolean().optional(),
  model: z5.string().optional(),
  inlineCitations: z5.boolean().optional(),
  maxTurns: z5.number().int().optional(),
  timeoutSeconds: z5.number().int().positive().optional(),
  cacheTtlMinutes: z5.number().nonnegative().optional()
}).strict().optional();
var ToolsWebSchema = z5.object({
  search: ToolsWebSearchSchema,
  fetch: ToolsWebFetchSchema,
  x_search: ToolsWebXSearchSchema
}).strict().optional();
var ToolProfileSchema = z5.union([z5.literal("minimal"), z5.literal("coding"), z5.literal("messaging"), z5.literal("full")]).optional();
function addAllowAlsoAllowConflictIssue(value, ctx, message) {
  if (value.allow && value.allow.length > 0 && value.alsoAllow && value.alsoAllow.length > 0) {
    ctx.addIssue({
      code: z5.ZodIssueCode.custom,
      message
    });
  }
}
var ToolPolicyWithProfileSchema = z5.object({
  allow: z5.array(z5.string()).optional(),
  alsoAllow: z5.array(z5.string()).optional(),
  deny: z5.array(z5.string()).optional(),
  profile: ToolProfileSchema
}).strict().superRefine((value, ctx) => {
  addAllowAlsoAllowConflictIssue(
    value,
    ctx,
    "tools.byProvider policy cannot set both allow and alsoAllow in the same scope (merge alsoAllow into allow, or remove allow and use profile + alsoAllow)"
  );
});
var ElevatedAllowFromSchema = z5.record(z5.string(), z5.array(z5.union([z5.string(), z5.number()]))).optional();
var ToolExecApplyPatchSchema = z5.object({
  enabled: z5.boolean().optional(),
  workspaceOnly: z5.boolean().optional(),
  allowModels: z5.array(z5.string()).optional()
}).strict().optional();
var ToolExecSafeBinProfileSchema = z5.object({
  minPositional: z5.number().int().nonnegative().optional(),
  maxPositional: z5.number().int().nonnegative().optional(),
  allowedValueFlags: z5.array(z5.string()).optional(),
  deniedFlags: z5.array(z5.string()).optional()
}).strict();
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
  reviewer: z5.object({
    model: AgentModelSchema.optional(),
    timeoutMs: z5.number().int().positive().optional()
  }).strict().optional(),
  backgroundMs: z5.number().int().positive().optional(),
  timeoutSec: z5.number().int().positive().optional(),
  cleanupMs: z5.number().int().positive().optional(),
  notifyOnExit: z5.boolean().optional(),
  notifyOnExitEmptySuccess: z5.boolean().optional(),
  applyPatch: ToolExecApplyPatchSchema
};
function addExecPolicyModeConflictIssue(value, ctx) {
  if (value.mode === void 0 || value.security === void 0 && value.ask === void 0) {
    return;
  }
  ctx.addIssue({
    code: z5.ZodIssueCode.custom,
    path: ["mode"],
    message: "tools.exec.mode cannot be combined with tools.exec.security or tools.exec.ask"
  });
}
var AgentToolExecSchema = z5.object({
  ...ToolExecBaseShape,
  approvalRunningNoticeMs: z5.number().int().nonnegative().optional()
}).strict().superRefine(addExecPolicyModeConflictIssue).optional();
var ToolExecSchema = z5.object(ToolExecBaseShape).strict().superRefine(addExecPolicyModeConflictIssue).optional();
var ToolFsSchema = z5.object({
  workspaceOnly: z5.boolean().optional()
}).strict().optional();
var ToolLoopDetectionDetectorSchema = z5.object({
  genericRepeat: z5.boolean().optional(),
  knownPollNoProgress: z5.boolean().optional(),
  pingPong: z5.boolean().optional()
}).strict().optional();
var ToolLoopPostCompactionGuardSchema = z5.object({
  windowSize: z5.number().int().positive().optional()
}).strict().optional();
var ToolLoopDetectionSchema = z5.object({
  enabled: z5.boolean().optional(),
  historySize: z5.number().int().positive().optional(),
  warningThreshold: z5.number().int().positive().optional(),
  unknownToolThreshold: z5.number().int().positive().optional(),
  criticalThreshold: z5.number().int().positive().optional(),
  globalCircuitBreakerThreshold: z5.number().int().positive().optional(),
  detectors: ToolLoopDetectionDetectorSchema,
  postCompactionGuard: ToolLoopPostCompactionGuardSchema
}).strict().superRefine((value, ctx) => {
  if (value.warningThreshold !== void 0 && value.criticalThreshold !== void 0 && value.warningThreshold >= value.criticalThreshold) {
    ctx.addIssue({
      code: z5.ZodIssueCode.custom,
      path: ["criticalThreshold"],
      message: "tools.loopDetection.warningThreshold must be lower than criticalThreshold."
    });
  }
  if (value.criticalThreshold !== void 0 && value.globalCircuitBreakerThreshold !== void 0 && value.criticalThreshold >= value.globalCircuitBreakerThreshold) {
    ctx.addIssue({
      code: z5.ZodIssueCode.custom,
      path: ["globalCircuitBreakerThreshold"],
      message: "tools.loopDetection.criticalThreshold must be lower than globalCircuitBreakerThreshold."
    });
  }
}).optional();
var ToolSearchSchema = z5.union([
  z5.boolean(),
  z5.object({
    enabled: z5.boolean().optional(),
    mode: z5.enum(["code", "tools", "directory"]).optional(),
    codeTimeoutMs: z5.number().int().positive().optional(),
    searchDefaultLimit: z5.number().int().positive().optional(),
    maxSearchLimit: z5.number().int().positive().optional()
  }).strict()
]).optional();
var CodeModeSchema = z5.union([
  z5.boolean(),
  z5.object({
    enabled: z5.boolean().optional(),
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
    maxSearchLimit: z5.number().int().positive().optional()
  }).strict()
]).optional();
var SandboxSshSchema = z5.object({
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
  knownHostsData: SecretInputSchema.optional().register(sensitive)
}).strict().optional();
var AgentSandboxSchema = z5.object({
  mode: z5.union([z5.literal("off"), z5.literal("non-main"), z5.literal("all")]).optional(),
  backend: z5.string().min(1).optional(),
  workspaceAccess: z5.union([z5.literal("none"), z5.literal("ro"), z5.literal("rw")]).optional(),
  sessionToolsVisibility: z5.union([z5.literal("spawned"), z5.literal("all")]).optional(),
  scope: z5.union([z5.literal("session"), z5.literal("agent"), z5.literal("shared")]).optional(),
  workspaceRoot: z5.string().optional(),
  docker: SandboxDockerSchema,
  ssh: SandboxSshSchema,
  browser: SandboxBrowserSchema,
  prune: SandboxPruneSchema
}).strict().superRefine((data, ctx) => {
  const blockedBrowserNetworkReason = getBlockedNetworkModeReason({
    network: data.browser?.network,
    allowContainerNamespaceJoin: data.docker?.dangerouslyAllowContainerNamespaceJoin === true
  });
  if (blockedBrowserNetworkReason === "container_namespace_join") {
    ctx.addIssue({
      code: z5.ZodIssueCode.custom,
      path: ["browser", "network"],
      message: 'Sandbox security: browser network mode "container:*" is blocked by default. Set sandbox.docker.dangerouslyAllowContainerNamespaceJoin=true only when you fully trust this runtime.'
    });
  }
}).optional();
var CommonToolPolicyFields = {
  profile: ToolProfileSchema,
  allow: z5.array(z5.string()).optional(),
  alsoAllow: z5.array(z5.string()).optional(),
  deny: z5.array(z5.string()).optional(),
  byProvider: z5.record(z5.string(), ToolPolicyWithProfileSchema).optional(),
  toolsBySender: ToolPolicyBySenderSchema
};
var MessageToolConfigSchema = z5.object({
  allowCrossContextSend: z5.boolean().optional(),
  crossContext: z5.object({
    allowWithinProvider: z5.boolean().optional(),
    allowAcrossProviders: z5.boolean().optional(),
    marker: z5.object({
      enabled: z5.boolean().optional(),
      prefix: z5.string().optional(),
      suffix: z5.string().optional()
    }).strict().optional()
  }).strict().optional(),
  actions: z5.object({
    allow: z5.array(z5.string()).optional()
  }).strict().optional(),
  broadcast: z5.object({
    enabled: z5.boolean().optional()
  }).strict().optional()
}).strict().optional();
var AgentToolsSchema = z5.object({
  ...CommonToolPolicyFields,
  codeMode: CodeModeSchema,
  elevated: z5.object({
    enabled: z5.boolean().optional(),
    allowFrom: ElevatedAllowFromSchema
  }).strict().optional(),
  exec: AgentToolExecSchema,
  fs: ToolFsSchema,
  loopDetection: ToolLoopDetectionSchema,
  message: MessageToolConfigSchema,
  sandbox: z5.object({
    tools: ToolPolicySchema
  }).strict().optional()
}).strict().superRefine((value, ctx) => {
  addAllowAlsoAllowConflictIssue(
    value,
    ctx,
    "agent tools cannot set both allow and alsoAllow in the same scope (merge alsoAllow into allow, or remove allow and use profile + alsoAllow)"
  );
}).optional();
var MemorySearchSchema = z5.object({
  enabled: z5.boolean().optional(),
  sources: z5.array(z5.union([z5.literal("memory"), z5.literal("sessions")])).optional(),
  extraPaths: z5.array(z5.string()).optional(),
  qmd: z5.object({
    extraCollections: z5.array(
      z5.object({
        path: z5.string(),
        name: z5.string().optional(),
        pattern: z5.string().optional()
      }).strict()
    ).optional()
  }).strict().optional(),
  multimodal: z5.object({
    enabled: z5.boolean().optional(),
    modalities: z5.array(z5.union([z5.literal("image"), z5.literal("audio"), z5.literal("all")])).optional(),
    maxFileBytes: z5.number().int().positive().optional()
  }).strict().optional(),
  experimental: z5.object({
    sessionMemory: z5.boolean().optional()
  }).strict().optional(),
  provider: z5.string().optional(),
  remote: z5.object({
    baseUrl: z5.string().optional(),
    apiKey: SecretInputSchema.optional().register(sensitive),
    headers: z5.record(z5.string(), z5.string()).optional(),
    nonBatchConcurrency: z5.number().int().positive().optional(),
    batch: z5.object({
      enabled: z5.boolean().optional(),
      wait: z5.boolean().optional(),
      concurrency: z5.number().int().positive().optional(),
      pollIntervalMs: z5.number().int().nonnegative().optional(),
      timeoutMinutes: z5.number().int().positive().optional()
    }).strict().optional()
  }).strict().optional(),
  fallback: z5.string().optional(),
  model: z5.string().optional(),
  inputType: z5.string().min(1).optional(),
  queryInputType: z5.string().min(1).optional(),
  documentInputType: z5.string().min(1).optional(),
  outputDimensionality: z5.number().int().positive().optional(),
  local: z5.object({
    modelPath: z5.string().optional(),
    modelCacheDir: z5.string().optional(),
    contextSize: z5.union([z5.number().int().positive(), z5.literal("auto")]).optional()
  }).strict().optional(),
  store: z5.object({
    driver: z5.literal("sqlite").optional(),
    fts: z5.object({
      tokenizer: z5.union([z5.literal("unicode61"), z5.literal("trigram")]).optional()
    }).strict().optional(),
    vector: z5.object({
      enabled: z5.boolean().optional(),
      extensionPath: z5.string().optional()
    }).strict().optional()
  }).strict().optional(),
  chunking: z5.object({
    tokens: z5.number().int().positive().optional(),
    overlap: z5.number().int().nonnegative().optional()
  }).strict().optional(),
  sync: z5.object({
    onSessionStart: z5.boolean().optional(),
    onSearch: z5.boolean().optional(),
    watch: z5.boolean().optional(),
    watchDebounceMs: z5.number().int().nonnegative().optional(),
    intervalMinutes: z5.number().int().nonnegative().optional(),
    embeddingBatchTimeoutSeconds: z5.number().int().positive().optional(),
    sessions: z5.object({
      deltaBytes: z5.number().int().nonnegative().optional(),
      deltaMessages: z5.number().int().nonnegative().optional(),
      postCompactionForce: z5.boolean().optional()
    }).strict().optional()
  }).strict().optional(),
  query: z5.object({
    maxResults: z5.number().int().positive().optional(),
    minScore: z5.number().min(0).max(1).optional(),
    hybrid: z5.object({
      enabled: z5.boolean().optional(),
      vectorWeight: z5.number().min(0).max(1).optional(),
      textWeight: z5.number().min(0).max(1).optional(),
      candidateMultiplier: z5.number().int().positive().optional(),
      mmr: z5.object({
        enabled: z5.boolean().optional(),
        lambda: z5.number().min(0).max(1).optional()
      }).strict().optional(),
      temporalDecay: z5.object({
        enabled: z5.boolean().optional(),
        halfLifeDays: z5.number().int().positive().optional()
      }).strict().optional()
    }).strict().optional()
  }).strict().optional(),
  cache: z5.object({
    enabled: z5.boolean().optional(),
    maxEntries: z5.number().int().positive().optional()
  }).strict().optional()
}).strict().optional();
var AgentRuntimeAcpSchema = z5.object({
  agent: z5.string().optional(),
  backend: z5.string().optional(),
  mode: z5.enum(["persistent", "oneshot"]).optional(),
  cwd: z5.string().optional()
}).strict().optional();
var AgentRuntimeSchema = z5.union([
  z5.object({
    type: z5.literal("embedded")
  }).strict(),
  z5.object({
    type: z5.literal("acp"),
    acp: AgentRuntimeAcpSchema
  }).strict()
]).optional();
var AgentRuntimePolicySchema = z5.object({
  id: z5.string().optional()
}).strict().optional();
var AgentModelRuntimeEntrySchema = z5.object({
  alias: z5.string().optional(),
  params: z5.record(z5.string(), z5.unknown()).optional(),
  agentRuntime: AgentRuntimePolicySchema,
  streaming: z5.boolean().optional()
}).strict();
var AgentEntrySchema = z5.object({
  id: z5.string(),
  default: z5.boolean().optional(),
  name: z5.string().optional(),
  description: z5.string().optional(),
  workspace: z5.string().optional(),
  agentDir: z5.string().optional(),
  model: AgentModelSchema.optional(),
  models: z5.record(z5.string(), AgentModelRuntimeEntrySchema).optional(),
  thinkingDefault: z5.enum(["off", "minimal", "low", "medium", "high", "xhigh", "adaptive", "max"]).optional(),
  verboseDefault: z5.enum(["off", "on", "full"]).optional(),
  toolProgressDetail: z5.enum(["explain", "raw"]).optional(),
  reasoningDefault: z5.enum(["on", "off", "stream"]).optional(),
  fastModeDefault: z5.union([z5.boolean(), z5.literal("auto")]).optional(),
  contextInjection: z5.union([z5.literal("always"), z5.literal("continuation-skip"), z5.literal("never")]).optional(),
  bootstrapMaxChars: z5.number().int().positive().optional(),
  bootstrapTotalMaxChars: z5.number().int().positive().optional(),
  experimental: z5.object({
    localModelLean: z5.boolean().optional()
  }).strict().optional(),
  skills: z5.array(z5.string()).optional(),
  memorySearch: MemorySearchSchema,
  humanDelay: HumanDelaySchema.optional(),
  tts: TtsConfigSchema,
  skillsLimits: AgentSkillsLimitsSchema,
  contextLimits: AgentContextLimitsSchema,
  contextTokens: z5.number().int().positive().optional(),
  heartbeat: HeartbeatSchema,
  identity: IdentitySchema,
  groupChat: GroupChatSchema,
  subagents: z5.object({
    delegationMode: z5.enum(["suggest", "prefer"]).optional(),
    allowAgents: z5.array(z5.string()).optional(),
    model: AgentModelSchema.optional(),
    thinking: z5.string().optional(),
    requireAgentId: z5.boolean().optional()
  }).strict().optional(),
  runRetries: AgentRunRetriesConfigSchema.optional(),
  embeddedAgent: AgentEntryEmbeddedAgentConfigSchema.optional(),
  sandbox: AgentSandboxSchema,
  params: z5.record(z5.string(), z5.unknown()).optional(),
  tools: AgentToolsSchema,
  runtime: AgentRuntimeSchema
}).strict();
var ToolsSchema = z5.object({
  ...CommonToolPolicyFields,
  web: ToolsWebSchema,
  media: ToolsMediaSchema,
  links: ToolsLinksSchema,
  sessions: z5.object({
    visibility: z5.enum(["self", "tree", "agent", "all"]).optional()
  }).strict().optional(),
  loopDetection: ToolLoopDetectionSchema,
  toolSearch: ToolSearchSchema,
  codeMode: CodeModeSchema,
  message: MessageToolConfigSchema,
  agentToAgent: z5.object({
    enabled: z5.boolean().optional(),
    allow: z5.array(z5.string()).optional()
  }).strict().optional(),
  elevated: z5.object({
    enabled: z5.boolean().optional(),
    allowFrom: ElevatedAllowFromSchema
  }).strict().optional(),
  exec: ToolExecSchema,
  fs: ToolFsSchema,
  subagents: z5.object({
    tools: ToolPolicySchema
  }).strict().optional(),
  sandbox: z5.object({
    tools: ToolPolicySchema
  }).strict().optional(),
  sessions_spawn: z5.object({
    attachments: z5.object({
      enabled: z5.boolean().optional(),
      maxTotalBytes: z5.number().optional(),
      maxFiles: z5.number().optional(),
      maxFileBytes: z5.number().optional(),
      retainOnSessionKeep: z5.boolean().optional()
    }).strict().optional()
  }).strict().optional(),
  experimental: z5.object({
    planTool: z5.boolean().optional()
  }).strict().optional()
}).strict().superRefine((value, ctx) => {
  addAllowAlsoAllowConflictIssue(
    value,
    ctx,
    "tools cannot set both allow and alsoAllow in the same scope (merge alsoAllow into allow, or remove allow and use profile + alsoAllow)"
  );
}).optional();

// vendor/openclaw/src/config/zod-schema.agent-defaults.ts
var SilentReplyPolicySchema = z6.union([z6.literal("allow"), z6.literal("disallow")]);
var NonNegativeByteSizeSchema = z6.union([
  z6.number().int().nonnegative(),
  z6.string().refine(isValidNonNegativeByteSizeString, "Expected byte size string like 2mb")
]);
var OptionalBootstrapFileNameSchema = z6.enum([
  "SOUL.md",
  "USER.md",
  "HEARTBEAT.md",
  "IDENTITY.md"
]);
var EmbeddedAgentConfigSchema = z6.object({
  projectSettingsPolicy: z6.union([z6.literal("trusted"), z6.literal("sanitize"), z6.literal("ignore")]).optional(),
  executionContract: z6.union([z6.literal("default"), z6.literal("strict-agentic")]).optional()
}).strict();
var SilentReplyPolicyConfigSchema = z6.object({
  group: SilentReplyPolicySchema.optional(),
  internal: SilentReplyPolicySchema.optional()
}).strict();
var AgentDefaultsSchema = z6.object({
  /** Global default provider params applied to all models before per-model and per-agent overrides. */
  params: z6.record(z6.string(), z6.unknown()).optional(),
  model: AgentModelSchema.optional(),
  imageModel: AgentToolModelSchema.optional(),
  imageGenerationModel: AgentToolModelSchema.optional(),
  videoGenerationModel: AgentToolModelSchema.optional(),
  musicGenerationModel: AgentToolModelSchema.optional(),
  voiceModel: AgentToolModelSchema.optional(),
  mediaGenerationAutoProviderFallback: z6.boolean().optional(),
  pdfModel: AgentToolModelSchema.optional(),
  pdfMaxBytesMb: z6.number().positive().optional(),
  pdfMaxPages: z6.number().int().positive().optional(),
  models: z6.record(z6.string(), AgentModelRuntimeEntrySchema).optional(),
  workspace: z6.string().optional(),
  skills: z6.array(z6.string()).optional(),
  silentReply: SilentReplyPolicyConfigSchema.optional(),
  repoRoot: z6.string().optional(),
  promptOverlays: z6.object({
    gpt5: z6.object({
      personality: z6.union([z6.literal("friendly"), z6.literal("on"), z6.literal("off")]).optional()
    }).strict().optional()
  }).strict().optional(),
  skipBootstrap: z6.boolean().optional(),
  skipOptionalBootstrapFiles: z6.array(OptionalBootstrapFileNameSchema).optional(),
  contextInjection: z6.union([z6.literal("always"), z6.literal("continuation-skip"), z6.literal("never")]).optional(),
  bootstrapMaxChars: z6.number().int().positive().optional(),
  bootstrapTotalMaxChars: z6.number().int().positive().optional(),
  experimental: z6.object({
    localModelLean: z6.boolean().optional()
  }).strict().optional(),
  bootstrapPromptTruncationWarning: z6.union([z6.literal("off"), z6.literal("once"), z6.literal("always")]).optional(),
  userTimezone: z6.string().optional(),
  startupContext: z6.object({
    enabled: z6.boolean().optional(),
    applyOn: z6.array(z6.union([z6.literal("new"), z6.literal("reset")])).optional(),
    dailyMemoryDays: z6.number().int().min(1).max(14).optional(),
    maxFileBytes: z6.number().int().min(1).max(64 * 1024).optional(),
    maxFileChars: z6.number().int().min(1).max(1e4).optional(),
    maxTotalChars: z6.number().int().min(1).max(5e4).optional()
  }).strict().optional(),
  contextLimits: AgentContextLimitsSchema,
  timeFormat: z6.union([z6.literal("auto"), z6.literal("12"), z6.literal("24")]).optional(),
  envelopeTimezone: z6.string().optional(),
  envelopeTimestamp: z6.union([z6.literal("on"), z6.literal("off")]).optional(),
  envelopeElapsed: z6.union([z6.literal("on"), z6.literal("off")]).optional(),
  contextTokens: z6.number().int().positive().optional(),
  cliBackends: z6.record(z6.string(), CliBackendSchema).optional(),
  memorySearch: MemorySearchSchema,
  contextPruning: z6.object({
    mode: z6.union([z6.literal("off"), z6.literal("cache-ttl")]).optional(),
    ttl: z6.string().optional(),
    keepLastAssistants: z6.number().int().nonnegative().optional(),
    softTrimRatio: z6.number().min(0).max(1).optional(),
    hardClearRatio: z6.number().min(0).max(1).optional(),
    minPrunableToolChars: z6.number().int().nonnegative().optional(),
    tools: z6.object({
      allow: z6.array(z6.string()).optional(),
      deny: z6.array(z6.string()).optional()
    }).strict().optional(),
    softTrim: z6.object({
      maxChars: z6.number().int().nonnegative().optional(),
      headChars: z6.number().int().nonnegative().optional(),
      tailChars: z6.number().int().nonnegative().optional()
    }).strict().optional(),
    hardClear: z6.object({
      enabled: z6.boolean().optional(),
      placeholder: z6.string().optional()
    }).strict().optional()
  }).strict().optional(),
  compaction: z6.object({
    mode: z6.union([z6.literal("default"), z6.literal("safeguard")]).optional(),
    provider: z6.string().optional(),
    reserveTokens: z6.number().int().nonnegative().optional(),
    keepRecentTokens: z6.number().int().positive().optional(),
    reserveTokensFloor: z6.number().int().nonnegative().optional(),
    maxHistoryShare: z6.number().min(0.1).max(0.9).optional(),
    customInstructions: z6.string().optional(),
    identifierPolicy: z6.union([z6.literal("strict"), z6.literal("off"), z6.literal("custom")]).optional(),
    identifierInstructions: z6.string().optional(),
    recentTurnsPreserve: z6.number().int().min(0).max(12).optional(),
    qualityGuard: z6.object({
      enabled: z6.boolean().optional(),
      maxRetries: z6.number().int().nonnegative().optional()
    }).strict().optional(),
    midTurnPrecheck: z6.object({
      enabled: z6.boolean().optional()
    }).strict().optional(),
    postIndexSync: z6.enum(["off", "async", "await"]).optional(),
    postCompactionSections: z6.array(z6.string()).optional(),
    model: z6.string().optional(),
    timeoutSeconds: z6.number().int().positive().optional(),
    memoryFlush: z6.object({
      enabled: z6.boolean().optional(),
      model: z6.string().optional(),
      softThresholdTokens: z6.number().int().nonnegative().optional(),
      forceFlushTranscriptBytes: NonNegativeByteSizeSchema.optional(),
      prompt: z6.string().optional(),
      systemPrompt: z6.string().optional()
    }).strict().optional(),
    truncateAfterCompaction: z6.boolean().optional(),
    maxActiveTranscriptBytes: NonNegativeByteSizeSchema.optional(),
    notifyUser: z6.boolean().optional()
  }).strict().optional(),
  runRetries: AgentRunRetriesConfigSchema.optional(),
  embeddedAgent: EmbeddedAgentConfigSchema.optional(),
  thinkingDefault: z6.union([
    z6.literal("off"),
    z6.literal("minimal"),
    z6.literal("low"),
    z6.literal("medium"),
    z6.literal("high"),
    z6.literal("xhigh"),
    z6.literal("adaptive"),
    z6.literal("max")
  ]).optional(),
  verboseDefault: z6.union([z6.literal("off"), z6.literal("on"), z6.literal("full")]).optional(),
  toolProgressDetail: z6.union([z6.literal("explain"), z6.literal("raw")]).optional(),
  reasoningDefault: z6.union([z6.literal("off"), z6.literal("on"), z6.literal("stream")]).optional(),
  elevatedDefault: z6.union([z6.literal("off"), z6.literal("on"), z6.literal("ask"), z6.literal("full")]).optional(),
  blockStreamingDefault: z6.union([z6.literal("off"), z6.literal("on")]).optional(),
  blockStreamingBreak: z6.union([z6.literal("text_end"), z6.literal("message_end")]).optional(),
  blockStreamingChunk: BlockStreamingChunkSchema.optional(),
  blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
  humanDelay: HumanDelaySchema.optional(),
  timeoutSeconds: z6.number().int().positive().optional(),
  mediaMaxMb: z6.number().positive().optional(),
  imageMaxDimensionPx: z6.number().int().positive().optional(),
  imageQuality: z6.enum(["auto", "efficient", "balanced", "high"]).optional(),
  typingIntervalSeconds: z6.number().int().positive().optional(),
  typingMode: TypingModeSchema.optional(),
  heartbeat: HeartbeatSchema,
  maxConcurrent: z6.number().int().positive().optional(),
  subagents: z6.object({
    delegationMode: z6.enum(["suggest", "prefer"]).optional(),
    allowAgents: z6.array(z6.string()).optional(),
    maxConcurrent: z6.number().int().positive().optional(),
    maxSpawnDepth: z6.number().int().min(1).max(5).optional().describe(
      "Maximum nesting depth for sub-agent spawning. 1 = no nesting (default), 2 = sub-agents can spawn sub-sub-agents."
    ),
    maxChildrenPerAgent: z6.number().int().min(1).max(20).optional().describe(
      "Maximum number of active children a single agent session can spawn (default: 5)."
    ),
    archiveAfterMinutes: z6.number().int().min(0).optional(),
    model: AgentModelSchema.optional(),
    thinking: z6.string().optional(),
    runTimeoutSeconds: z6.number().int().min(0).optional(),
    announceTimeoutMs: z6.number().int().positive().optional(),
    requireAgentId: z6.boolean().optional()
  }).strict().optional(),
  sandbox: AgentSandboxSchema
}).strict().optional();

// vendor/openclaw/src/config/zod-schema.agents.ts
import { z as z7 } from "zod";
var AgentsSchema = z7.object({
  defaults: z7.lazy(() => AgentDefaultsSchema).optional(),
  list: z7.array(AgentEntrySchema).optional()
}).strict().optional();
var BindingMatchSchema = z7.object({
  channel: z7.string(),
  accountId: z7.string().optional(),
  peer: z7.object({
    kind: z7.union([
      z7.literal("direct"),
      z7.literal("group"),
      z7.literal("channel"),
      /** @deprecated Use `direct` instead. Kept for backward compatibility. */
      z7.literal("dm")
    ]),
    id: z7.string()
  }).strict().optional(),
  guildId: z7.string().optional(),
  teamId: z7.string().optional(),
  roles: z7.array(z7.string()).optional()
}).strict();
var BindingSessionSchema = z7.object({
  dmScope: z7.union([
    z7.literal("main"),
    z7.literal("per-peer"),
    z7.literal("per-channel-peer"),
    z7.literal("per-account-channel-peer")
  ]).optional()
}).strict();
var RouteBindingSchema = z7.object({
  type: z7.literal("route").optional(),
  agentId: z7.string(),
  comment: z7.string().optional(),
  match: BindingMatchSchema,
  session: BindingSessionSchema.optional()
}).strict();
var AcpBindingSchema = z7.object({
  type: z7.literal("acp"),
  agentId: z7.string(),
  comment: z7.string().optional(),
  match: BindingMatchSchema,
  acp: z7.object({
    mode: z7.enum(["persistent", "oneshot"]).optional(),
    label: z7.string().optional(),
    cwd: z7.string().optional(),
    backend: z7.string().optional()
  }).strict().optional()
}).strict().superRefine((value, ctx) => {
  const peerId = normalizeOptionalString(value.match.peer?.id) ?? "";
  if (!peerId) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["match", "peer"],
      message: "ACP bindings require match.peer.id to target a concrete conversation."
    });
  }
});
var BindingsSchema = z7.array(z7.union([RouteBindingSchema, AcpBindingSchema])).optional();
var BroadcastStrategySchema = z7.enum(["parallel", "sequential"]);
var BroadcastSchema = z7.object({
  strategy: BroadcastStrategySchema.optional()
}).catchall(z7.array(z7.string())).optional();
var AudioSchema = z7.object({
  transcription: TranscribeAudioSchema
}).strict().optional();

// vendor/openclaw/src/config/zod-schema.approvals.ts
import { z as z8 } from "zod";
var NativeExecApprovalEnableModeSchema = z8.union([z8.boolean(), z8.literal("auto")]);
var ExecApprovalForwardTargetSchema = z8.object({
  channel: z8.string().min(1),
  to: z8.string().min(1),
  accountId: z8.string().optional(),
  threadId: z8.union([z8.string(), z8.number()]).optional()
}).strict();
var ExecApprovalForwardingSchema = z8.object({
  enabled: z8.boolean().optional(),
  mode: z8.union([z8.literal("session"), z8.literal("targets"), z8.literal("both")]).optional(),
  agentFilter: z8.array(z8.string()).optional(),
  sessionFilter: z8.array(z8.string()).optional(),
  targets: z8.array(ExecApprovalForwardTargetSchema).optional()
}).strict().optional();
var ApprovalsSchema = z8.object({
  exec: ExecApprovalForwardingSchema,
  plugin: ExecApprovalForwardingSchema
}).strict().optional();

// vendor/openclaw/src/config/zod-schema.channels-config.ts
import { z as z10 } from "zod";

// vendor/openclaw/src/config/zod-schema.channels.ts
import { z as z9 } from "zod";
var ChannelHeartbeatVisibilitySchema = z9.object({
  showOk: z9.boolean().optional(),
  showAlerts: z9.boolean().optional(),
  useIndicator: z9.boolean().optional()
}).strict().optional();
var ChannelHealthMonitorSchema = z9.object({
  enabled: z9.boolean().optional()
}).strict().optional();

// vendor/openclaw/src/config/zod-schema.channels-config.ts
var ChannelModelByChannelSchema = z10.record(z10.string(), z10.record(z10.string(), z10.string())).optional();
var ChannelBotLoopProtectionSchema = z10.object({
  enabled: z10.boolean().optional(),
  maxEventsPerWindow: z10.number().int().positive().optional(),
  windowSeconds: z10.number().int().positive().optional(),
  cooldownSeconds: z10.number().int().positive().optional()
}).strict();
function addLegacyChannelAcpBindingIssues(value, ctx, path5 = []) {
  if (!value || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => addLegacyChannelAcpBindingIssues(entry, ctx, [...path5, index]));
    return;
  }
  const record = value;
  const bindings = record.bindings;
  if (bindings && typeof bindings === "object" && !Array.isArray(bindings)) {
    const acp = bindings.acp;
    if (acp && typeof acp === "object") {
      ctx.addIssue({
        code: z10.ZodIssueCode.custom,
        path: [...path5, "bindings", "acp"],
        message: "Legacy channel-local ACP bindings were removed; use top-level bindings[] entries."
      });
    }
  }
  for (const [key, entry] of Object.entries(record)) {
    addLegacyChannelAcpBindingIssues(entry, ctx, [...path5, key]);
  }
}
var ChannelsSchema = z10.object({
  defaults: z10.object({
    groupPolicy: GroupPolicySchema.optional(),
    contextVisibility: ContextVisibilityModeSchema.optional(),
    heartbeat: ChannelHeartbeatVisibilitySchema,
    botLoopProtection: ChannelBotLoopProtectionSchema.optional()
  }).strict().optional(),
  modelByChannel: ChannelModelByChannelSchema
}).passthrough().superRefine((value, ctx) => {
  addLegacyChannelAcpBindingIssues(value, ctx);
}).optional();

// vendor/openclaw/src/config/zod-schema.hooks.ts
import path4 from "node:path";
import { z as z12 } from "zod";

// vendor/openclaw/src/config/zod-schema.installs.ts
import { z as z11 } from "zod";
var InstallSourceSchema = z11.union([
  z11.literal("npm"),
  z11.literal("archive"),
  z11.literal("path"),
  z11.literal("clawhub"),
  z11.literal("git")
]);
var PluginInstallSourceSchema = z11.union([InstallSourceSchema, z11.literal("marketplace")]);
var InstallRecordShape = {
  source: InstallSourceSchema,
  spec: z11.string().optional(),
  sourcePath: z11.string().optional(),
  installPath: z11.string().optional(),
  version: z11.string().optional(),
  resolvedName: z11.string().optional(),
  resolvedVersion: z11.string().optional(),
  resolvedSpec: z11.string().optional(),
  integrity: z11.string().optional(),
  shasum: z11.string().optional(),
  resolvedAt: z11.string().optional(),
  installedAt: z11.string().optional(),
  clawhubUrl: z11.string().optional(),
  clawhubPackage: z11.string().optional(),
  clawhubFamily: z11.union([z11.literal("code-plugin"), z11.literal("bundle-plugin")]).optional(),
  clawhubChannel: z11.union([z11.literal("official"), z11.literal("community"), z11.literal("private")]).optional(),
  artifactKind: z11.union([z11.literal("legacy-zip"), z11.literal("npm-pack")]).optional(),
  artifactFormat: z11.union([z11.literal("zip"), z11.literal("tgz")]).optional(),
  npmIntegrity: z11.string().optional(),
  npmShasum: z11.string().optional(),
  npmTarballName: z11.string().optional(),
  clawpackSha256: z11.string().optional(),
  clawpackSpecVersion: z11.number().int().nonnegative().optional(),
  clawpackManifestSha256: z11.string().optional(),
  clawpackSize: z11.number().int().nonnegative().optional(),
  gitUrl: z11.string().optional(),
  gitRef: z11.string().optional(),
  gitCommit: z11.string().optional()
};
var PluginInstallRecordShape = {
  ...InstallRecordShape,
  source: PluginInstallSourceSchema,
  marketplaceName: z11.string().optional(),
  marketplaceSource: z11.string().optional(),
  marketplacePlugin: z11.string().optional()
};

// vendor/openclaw/src/config/zod-schema.hooks.ts
function isSafeRelativeModulePath(raw) {
  const value = raw.trim();
  if (!value) {
    return false;
  }
  if (path4.isAbsolute(value)) {
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
var SafeRelativeModulePathSchema = z12.string().refine(isSafeRelativeModulePath, "module must be a safe relative path (no absolute paths)");
var HookMappingSchema = z12.object({
  id: z12.string().optional(),
  match: z12.object({
    path: z12.string().optional(),
    source: z12.string().optional()
  }).optional(),
  action: z12.union([z12.literal("wake"), z12.literal("agent")]).optional(),
  wakeMode: z12.union([z12.literal("now"), z12.literal("next-heartbeat")]).optional(),
  name: z12.string().optional(),
  agentId: z12.string().optional(),
  sessionKey: z12.string().optional().register(sensitive),
  messageTemplate: z12.string().optional(),
  textTemplate: z12.string().optional(),
  deliver: z12.boolean().optional(),
  allowUnsafeExternalContent: z12.boolean().optional(),
  // Keep this open-ended so runtime channel plugins (for example feishu) can be
  // referenced without hard-coding every channel id in the config schema.
  // Runtime still validates the resolved value against currently registered channels.
  channel: z12.string().trim().min(1).optional(),
  to: z12.string().optional(),
  model: z12.string().optional(),
  thinking: z12.string().optional(),
  timeoutSeconds: z12.number().int().positive().optional(),
  transform: z12.object({
    module: SafeRelativeModulePathSchema,
    export: z12.string().optional()
  }).strict().optional()
}).strict().optional();
var InternalHookHandlerSchema = z12.object({
  event: z12.string(),
  module: SafeRelativeModulePathSchema,
  export: z12.string().optional()
}).strict();
var HookConfigSchema = z12.object({
  enabled: z12.boolean().optional(),
  env: z12.record(z12.string(), z12.string()).optional()
}).passthrough();
var HookInstallRecordSchema = z12.object({
  ...InstallRecordShape,
  hooks: z12.array(z12.string()).optional()
}).strict();
var InternalHooksSchema = z12.object({
  enabled: z12.boolean().optional(),
  handlers: z12.array(InternalHookHandlerSchema).optional(),
  entries: z12.record(z12.string(), HookConfigSchema).optional(),
  load: z12.object({
    extraDirs: z12.array(z12.string()).optional()
  }).strict().optional(),
  installs: z12.record(z12.string(), HookInstallRecordSchema).optional()
}).strict().optional();
var HooksGmailSchema = z12.object({
  account: z12.string().optional(),
  label: z12.string().optional(),
  topic: z12.string().optional(),
  subscription: z12.string().optional(),
  pushToken: z12.string().optional().register(sensitive),
  hookUrl: z12.string().optional(),
  includeBody: z12.boolean().optional(),
  maxBytes: z12.number().int().positive().optional(),
  renewEveryMinutes: z12.number().int().positive().optional(),
  allowUnsafeExternalContent: z12.boolean().optional(),
  serve: z12.object({
    bind: z12.string().optional(),
    port: z12.number().int().positive().optional(),
    path: z12.string().optional()
  }).strict().optional(),
  tailscale: z12.object({
    mode: z12.union([z12.literal("off"), z12.literal("serve"), z12.literal("funnel")]).optional(),
    path: z12.string().optional(),
    target: z12.string().optional()
  }).strict().optional(),
  model: z12.string().optional(),
  thinking: z12.union([
    z12.literal("off"),
    z12.literal("minimal"),
    z12.literal("low"),
    z12.literal("medium"),
    z12.literal("high")
  ]).optional()
}).strict().optional();

// vendor/openclaw/src/config/zod-schema.proxy.ts
import { z as z13 } from "zod";
function isHttpOrHttpsProxyUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
var ProxyLoopbackModeSchema = z13.enum(["gateway-only", "proxy", "block"]);
var ProxyTlsConfigSchema = z13.object({
  caFile: z13.string().min(1).optional()
}).strict().optional();
var ProxyConfigSchema = z13.object({
  enabled: z13.boolean().optional(),
  proxyUrl: z13.url().refine(isHttpOrHttpsProxyUrl, {
    message: "proxyUrl must use http:// or https://"
  }).register(sensitive).optional(),
  tls: ProxyTlsConfigSchema,
  loopbackMode: ProxyLoopbackModeSchema.optional()
}).strict().optional();

// vendor/openclaw/src/config/zod-schema.session.ts
import { z as z14 } from "zod";
var SessionResetConfigSchema = z14.object({
  mode: z14.union([z14.literal("daily"), z14.literal("idle")]).optional(),
  atHour: z14.number().int().min(0).max(23).optional(),
  idleMinutes: z14.number().int().positive().optional()
}).strict();
var SessionSendPolicySchema = createAllowDenyChannelRulesSchema();
var SessionSchema = z14.object({
  scope: z14.union([z14.literal("per-sender"), z14.literal("global")]).optional(),
  dmScope: z14.union([
    z14.literal("main"),
    z14.literal("per-peer"),
    z14.literal("per-channel-peer"),
    z14.literal("per-account-channel-peer")
  ]).optional(),
  identityLinks: z14.record(z14.string(), z14.array(z14.string())).optional(),
  resetTriggers: z14.array(z14.string()).optional(),
  idleMinutes: z14.number().int().positive().optional(),
  reset: SessionResetConfigSchema.optional(),
  resetByType: z14.object({
    direct: SessionResetConfigSchema.optional(),
    /** @deprecated Use `direct` instead. Kept for backward compatibility. */
    dm: SessionResetConfigSchema.optional(),
    group: SessionResetConfigSchema.optional(),
    thread: SessionResetConfigSchema.optional()
  }).strict().optional(),
  resetByChannel: z14.record(z14.string(), SessionResetConfigSchema).optional(),
  store: z14.string().optional(),
  typingIntervalSeconds: z14.number().int().positive().optional(),
  typingMode: TypingModeSchema.optional(),
  mainKey: z14.string().optional(),
  sendPolicy: SessionSendPolicySchema.optional(),
  writeLock: z14.object({
    acquireTimeoutMs: z14.number().int().positive().optional(),
    staleMs: z14.number().int().positive().optional(),
    maxHoldMs: z14.number().int().positive().optional()
  }).strict().optional(),
  agentToAgent: z14.object({
    maxPingPongTurns: z14.number().int().min(0).max(20).optional()
  }).strict().optional(),
  threadBindings: z14.object({
    enabled: z14.boolean().optional(),
    idleHours: z14.number().nonnegative().optional(),
    maxAgeHours: z14.number().nonnegative().optional(),
    spawnSessions: z14.boolean().optional(),
    defaultSpawnContext: z14.enum(["isolated", "fork"]).optional()
  }).strict().optional(),
  maintenance: z14.object({
    mode: z14.enum(["enforce", "warn"]).optional(),
    pruneAfter: z14.union([z14.string(), z14.number()]).optional(),
    /** @deprecated Use pruneAfter instead. */
    pruneDays: z14.number().int().positive().optional(),
    maxEntries: z14.number().int().positive().optional(),
    rotateBytes: z14.union([z14.string(), z14.number()]).optional(),
    resetArchiveRetention: z14.union([z14.string(), z14.number(), z14.literal(false)]).optional(),
    maxDiskBytes: z14.union([z14.string(), z14.number()]).optional(),
    highWaterBytes: z14.union([z14.string(), z14.number()]).optional()
  }).strict().superRefine((val, ctx) => {
    if (val.pruneAfter !== void 0) {
      try {
        parseDurationMs(normalizeStringifiedOptionalString(val.pruneAfter) ?? "", {
          defaultUnit: "d"
        });
      } catch {
        ctx.addIssue({
          code: z14.ZodIssueCode.custom,
          path: ["pruneAfter"],
          message: "invalid duration (use ms, s, m, h, d)"
        });
      }
    }
    if (val.resetArchiveRetention !== void 0 && val.resetArchiveRetention !== false) {
      try {
        parseDurationMs(normalizeStringifiedOptionalString(val.resetArchiveRetention) ?? "", {
          defaultUnit: "d"
        });
      } catch {
        ctx.addIssue({
          code: z14.ZodIssueCode.custom,
          path: ["resetArchiveRetention"],
          message: "invalid duration (use ms, s, m, h, d)"
        });
      }
    }
    if (val.maxDiskBytes !== void 0) {
      try {
        parseByteSize(normalizeStringifiedOptionalString(val.maxDiskBytes) ?? "", {
          defaultUnit: "b"
        });
      } catch {
        ctx.addIssue({
          code: z14.ZodIssueCode.custom,
          path: ["maxDiskBytes"],
          message: "invalid size (use b, kb, mb, gb, tb)"
        });
      }
    }
    if (val.highWaterBytes !== void 0) {
      try {
        parseByteSize(normalizeStringifiedOptionalString(val.highWaterBytes) ?? "", {
          defaultUnit: "b"
        });
      } catch {
        ctx.addIssue({
          code: z14.ZodIssueCode.custom,
          path: ["highWaterBytes"],
          message: "invalid size (use b, kb, mb, gb, tb)"
        });
      }
    }
  }).optional()
}).strict().optional();
var MessagesSchema = z14.object({
  messagePrefix: z14.string().optional(),
  visibleReplies: VisibleRepliesSchema.optional(),
  responsePrefix: z14.string().optional(),
  usageTemplate: z14.union([z14.string(), z14.record(z14.string(), z14.unknown())]).optional(),
  groupChat: GroupChatSchema,
  queue: QueueSchema,
  inbound: InboundDebounceSchema,
  ackReaction: z14.string().optional(),
  ackReactionScope: z14.enum(["group-mentions", "group-all", "direct", "all", "off", "none"]).optional(),
  removeAckAfterReply: z14.boolean().optional(),
  statusReactions: z14.object({
    enabled: z14.boolean().optional(),
    emojis: z14.object({
      thinking: z14.string().optional(),
      tool: z14.string().optional(),
      coding: z14.string().optional(),
      web: z14.string().optional(),
      deploy: z14.string().optional(),
      build: z14.string().optional(),
      concierge: z14.string().optional(),
      done: z14.string().optional(),
      error: z14.string().optional(),
      stallSoft: z14.string().optional(),
      stallHard: z14.string().optional(),
      compacting: z14.string().optional()
    }).strict().optional(),
    timing: z14.object({
      debounceMs: z14.number().int().min(0).optional(),
      stallSoftMs: z14.number().int().min(0).optional(),
      stallHardMs: z14.number().int().min(0).optional(),
      doneHoldMs: z14.number().int().min(0).optional(),
      errorHoldMs: z14.number().int().min(0).optional()
    }).strict().optional()
  }).strict().optional(),
  suppressToolErrors: z14.boolean().optional(),
  tts: TtsConfigSchema
}).strict().optional();
var CommandsSchema = z14.object({
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
  useAccessGroups: z14.boolean().optional(),
  ownerAllowFrom: z14.array(z14.union([z14.string(), z14.number()])).optional(),
  ownerDisplay: z14.enum(["raw", "hash"]).optional().default("raw"),
  ownerDisplaySecret: z14.string().optional().register(sensitive),
  allowFrom: ElevatedAllowFromSchema.optional()
}).strict().optional().default(
  () => ({
    native: "auto",
    nativeSkills: "auto",
    restart: true,
    ownerDisplay: "raw"
  })
);

// vendor/openclaw/src/config/zod-schema.ts
var BrowserSnapshotDefaultsSchema = z15.object({
  mode: z15.literal("efficient").optional()
}).strict().optional();
var NodeHostSchema = z15.object({
  browserProxy: z15.object({
    enabled: z15.boolean().optional(),
    allowProfiles: z15.array(z15.string()).optional()
  }).strict().optional()
}).strict().optional();
var GatewayRemoteSchemaShape = {
  enabled: z15.boolean().optional(),
  url: z15.string().optional(),
  transport: z15.union([z15.literal("ssh"), z15.literal("direct")]).optional(),
  remotePort: z15.number().int().min(1).max(65535).optional(),
  token: SecretInputSchema.optional().register(sensitive),
  password: SecretInputSchema.optional().register(sensitive),
  tlsFingerprint: z15.string().optional(),
  sshTarget: z15.string().optional(),
  sshIdentity: z15.string().optional()
};
var GatewayRemoteConfigSchema = z15.object(GatewayRemoteSchemaShape).strict().optional();
var TailscaleServiceNameSchema = z15.string().regex(/^svc:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, {
  message: 'Tailscale serviceName must use the "svc:<dns-label>" format, for example "svc:openclaw"'
});
var LegacyCanvasHostSchema = z15.object({
  enabled: z15.boolean().optional(),
  root: z15.string().optional(),
  port: z15.number().int().positive().optional(),
  liveReload: z15.boolean().optional()
}).strict().optional();
var SecuritySchema = z15.object({
  audit: z15.object({
    suppressions: z15.array(
      z15.object({
        checkId: z15.string().min(1),
        titleIncludes: z15.string().min(1).optional(),
        detailIncludes: z15.string().min(1).optional(),
        reason: z15.string().min(1).optional()
      }).strict()
    ).optional()
  }).strict().optional(),
  installPolicy: z15.object({
    enabled: z15.boolean().optional(),
    targets: z15.array(z15.union([z15.literal("skill"), z15.literal("plugin")])).min(1).optional(),
    exec: z15.object({
      source: z15.literal("exec"),
      command: z15.string().min(1),
      args: z15.array(z15.string()).optional(),
      timeoutMs: z15.number().int().min(1).optional(),
      noOutputTimeoutMs: z15.number().int().min(1).optional(),
      maxOutputBytes: z15.number().int().min(1).optional(),
      env: z15.record(z15.string(), z15.string().register(sensitive)).optional(),
      passEnv: z15.array(z15.string()).optional(),
      trustedDirs: z15.array(z15.string()).optional(),
      allowInsecurePath: z15.boolean().optional(),
      allowSymlinkCommand: z15.boolean().optional()
    }).strict().optional()
  }).strict().optional()
}).strict().optional();
var AccessGroupsSchema = z15.record(
  z15.string().min(1),
  z15.discriminatedUnion("type", [
    z15.object({
      type: z15.literal("discord.channelAudience"),
      guildId: z15.string().min(1),
      channelId: z15.string().min(1),
      membership: z15.literal("canViewChannel").optional()
    }).strict(),
    z15.object({
      type: z15.literal("message.senders"),
      members: z15.record(z15.string().min(1), z15.array(z15.string().min(1)))
    }).strict()
  ])
).optional();
var MemoryQmdPathSchema = z15.object({
  path: z15.string(),
  name: z15.string().optional(),
  pattern: z15.string().optional()
}).strict();
var MemoryQmdSessionSchema = z15.object({
  enabled: z15.boolean().optional(),
  exportDir: z15.string().optional(),
  retentionDays: z15.number().int().nonnegative().optional()
}).strict();
var MemoryQmdUpdateSchema = z15.object({
  interval: z15.string().optional(),
  debounceMs: z15.number().int().nonnegative().optional(),
  onBoot: z15.boolean().optional(),
  startup: z15.enum(["off", "idle", "immediate"]).optional(),
  startupDelayMs: z15.number().int().nonnegative().optional(),
  waitForBootSync: z15.boolean().optional(),
  embedInterval: z15.string().optional(),
  commandTimeoutMs: z15.number().int().nonnegative().optional(),
  updateTimeoutMs: z15.number().int().nonnegative().optional(),
  embedTimeoutMs: z15.number().int().nonnegative().optional()
}).strict();
var MemoryQmdLimitsSchema = z15.object({
  maxResults: z15.number().int().positive().optional(),
  maxSnippetChars: z15.number().int().positive().optional(),
  maxInjectedChars: z15.number().int().positive().optional(),
  timeoutMs: z15.number().int().nonnegative().optional()
}).strict();
var MemoryQmdMcporterSchema = z15.object({
  enabled: z15.boolean().optional(),
  serverName: z15.string().optional(),
  startDaemon: z15.boolean().optional()
}).strict();
var LoggingLevelSchema = z15.union([
  z15.literal("silent"),
  z15.literal("fatal"),
  z15.literal("error"),
  z15.literal("warn"),
  z15.literal("info"),
  z15.literal("debug"),
  z15.literal("trace")
]);
var MemoryQmdSchema = z15.object({
  command: z15.string().optional(),
  mcporter: MemoryQmdMcporterSchema.optional(),
  searchMode: z15.union([z15.literal("query"), z15.literal("search"), z15.literal("vsearch")]).optional(),
  rerank: z15.boolean().optional(),
  searchTool: z15.string().trim().min(1).optional(),
  includeDefaultMemory: z15.boolean().optional(),
  paths: z15.array(MemoryQmdPathSchema).optional(),
  sessions: MemoryQmdSessionSchema.optional(),
  update: MemoryQmdUpdateSchema.optional(),
  limits: MemoryQmdLimitsSchema.optional(),
  scope: SessionSendPolicySchema.optional()
}).strict();
var MemorySchema = z15.object({
  backend: z15.union([z15.literal("builtin"), z15.literal("qmd")]).optional(),
  citations: z15.union([z15.literal("auto"), z15.literal("on"), z15.literal("off")]).optional(),
  qmd: MemoryQmdSchema.optional()
}).strict().optional();
var HttpUrlSchema = z15.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Expected http:// or https:// URL");
var McpOAuthClientMetadataUrlSchema = z15.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && url.pathname !== "/";
}, "Expected https:// URL with a non-root pathname");
var ResponsesEndpointUrlFetchShape = {
  allowUrl: z15.boolean().optional(),
  urlAllowlist: z15.array(z15.string()).optional(),
  allowedMimes: z15.array(z15.string()).optional(),
  maxBytes: z15.number().int().positive().optional(),
  maxRedirects: z15.number().int().nonnegative().optional(),
  timeoutMs: z15.number().int().positive().optional()
};
var SkillEntrySchema = z15.object({
  enabled: z15.boolean().optional(),
  apiKey: SecretInputSchema.optional().register(sensitive),
  env: z15.record(z15.string(), z15.string()).optional(),
  config: z15.record(z15.string(), z15.unknown()).optional()
}).strict();
var PluginEntrySchema = z15.object({
  enabled: z15.boolean().optional(),
  hooks: z15.object({
    allowPromptInjection: z15.boolean().optional(),
    allowConversationAccess: z15.boolean().optional(),
    timeoutMs: z15.number().int().positive().max(6e5).optional(),
    timeouts: z15.record(z15.string(), z15.number().int().positive().max(6e5)).optional()
  }).strict().optional(),
  subagent: z15.object({
    allowModelOverride: z15.boolean().optional(),
    allowedModels: z15.array(z15.string()).optional()
  }).strict().optional(),
  llm: z15.object({
    allowModelOverride: z15.boolean().optional(),
    allowedModels: z15.array(z15.string()).optional(),
    allowAgentIdOverride: z15.boolean().optional()
  }).strict().optional(),
  config: z15.record(z15.string(), z15.unknown()).optional()
}).strict();
var TalkProviderEntrySchema = z15.object({
  apiKey: SecretInputSchema.optional().register(sensitive)
}).catchall(z15.unknown());
var TalkRealtimeSchema = z15.object({
  provider: z15.string().optional(),
  providers: z15.record(z15.string(), TalkProviderEntrySchema).optional(),
  model: z15.string().optional(),
  speakerVoice: z15.string().optional(),
  speakerVoiceId: z15.string().optional(),
  voice: z15.string().optional(),
  instructions: z15.string().optional(),
  mode: z15.enum(["realtime", "stt-tts", "transcription"]).optional(),
  transport: z15.enum(["webrtc", "provider-websocket", "gateway-relay", "managed-room"]).optional(),
  brain: z15.enum(["agent-consult", "direct-tools", "none"]).optional(),
  consultRouting: z15.enum(["provider-direct", "force-agent-consult"]).optional()
}).strict().superRefine((realtime, ctx) => {
  const provider = normalizeLowercaseStringOrEmpty(realtime.provider ?? "");
  const providers = realtime.providers ? Object.keys(realtime.providers) : [];
  if (provider && providers.length > 0 && !(provider in realtime.providers)) {
    ctx.addIssue({
      code: z15.ZodIssueCode.custom,
      path: ["provider"],
      message: `talk.realtime.provider must match a key in talk.realtime.providers (missing "${provider}")`
    });
  }
  if (!provider && providers.length > 1) {
    ctx.addIssue({
      code: z15.ZodIssueCode.custom,
      path: ["provider"],
      message: "talk.realtime.provider is required when talk.realtime.providers defines multiple providers"
    });
  }
});
var TalkSchema = z15.object({
  provider: z15.string().optional(),
  providers: z15.record(z15.string(), TalkProviderEntrySchema).optional(),
  realtime: TalkRealtimeSchema.optional(),
  consultThinkingLevel: z15.enum(["off", "minimal", "low", "medium", "high", "xhigh", "adaptive", "max"]).optional(),
  consultFastMode: z15.boolean().optional(),
  speechLocale: z15.string().optional(),
  interruptOnSpeech: z15.boolean().optional(),
  silenceTimeoutMs: z15.number().int().positive().optional()
}).strict().superRefine((talk, ctx) => {
  const provider = normalizeLowercaseStringOrEmpty(talk.provider ?? "");
  const providers = talk.providers ? Object.keys(talk.providers) : [];
  if (provider && providers.length > 0 && !(provider in talk.providers)) {
    ctx.addIssue({
      code: z15.ZodIssueCode.custom,
      path: ["provider"],
      message: `talk.provider must match a key in talk.providers (missing "${provider}")`
    });
  }
  if (!provider && providers.length > 1) {
    ctx.addIssue({
      code: z15.ZodIssueCode.custom,
      path: ["provider"],
      message: "talk.provider is required when talk.providers defines multiple providers"
    });
  }
});
var McpServerSchema = z15.object({
  enabled: z15.boolean().optional(),
  command: z15.string().optional(),
  args: z15.array(z15.string()).optional(),
  env: z15.record(z15.string(), z15.union([z15.string(), z15.number(), z15.boolean()])).optional(),
  cwd: z15.string().optional(),
  workingDirectory: z15.string().optional(),
  url: HttpUrlSchema.optional(),
  transport: z15.union([z15.literal("stdio"), z15.literal("sse"), z15.literal("streamable-http")]).optional(),
  headers: z15.record(
    z15.string(),
    z15.union([z15.string().register(sensitive), z15.number(), z15.boolean()]).register(sensitive)
  ).optional(),
  connectionTimeoutMs: z15.number().finite().positive().optional(),
  connectTimeout: z15.number().finite().positive().optional(),
  connect_timeout: z15.number().finite().positive().optional(),
  requestTimeoutMs: z15.number().finite().positive().optional(),
  timeout: z15.number().finite().positive().optional(),
  supportsParallelToolCalls: z15.boolean().optional(),
  supports_parallel_tool_calls: z15.boolean().optional(),
  auth: z15.literal("oauth").optional(),
  oauth: z15.object({
    scope: z15.string().trim().min(1).optional(),
    redirectUrl: HttpUrlSchema.optional(),
    clientMetadataUrl: McpOAuthClientMetadataUrlSchema.optional()
  }).strict().optional(),
  sslVerify: z15.boolean().optional(),
  ssl_verify: z15.boolean().optional(),
  clientCert: z15.string().optional(),
  client_cert: z15.string().optional(),
  clientKey: z15.string().optional(),
  client_key: z15.string().optional(),
  toolFilter: z15.object({
    include: z15.array(z15.string().trim().min(1)).min(1).optional(),
    exclude: z15.array(z15.string().trim().min(1)).min(1).optional()
  }).strict().optional(),
  codex: z15.object({
    agents: z15.array(
      z15.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/i)
    ).min(1).optional(),
    defaultToolsApprovalMode: z15.enum(["auto", "prompt", "approve"]).optional(),
    default_tools_approval_mode: z15.enum(["auto", "prompt", "approve"]).optional()
  }).strict().optional()
}).superRefine((data, ctx) => {
  if (data.transport === "stdio" && (typeof data.command !== "string" || data.command.trim().length === 0)) {
    ctx.addIssue({
      code: z15.ZodIssueCode.custom,
      message: '"stdio" transport requires a non-empty command',
      path: ["transport"]
    });
  }
}).catchall(z15.unknown());
var McpConfigSchema = z15.object({
  servers: z15.record(z15.string(), McpServerSchema).optional(),
  sessionIdleTtlMs: z15.number().finite().min(0).optional()
}).strict().optional();
var CrestodianSchema = z15.object({
  rescue: z15.object({
    enabled: z15.union([z15.literal("auto"), z15.boolean()]).optional(),
    ownerDmOnly: z15.boolean().optional(),
    pendingTtlMinutes: z15.number().int().positive().optional()
  }).strict().optional()
}).strict().optional();
var CommitmentsSchema = z15.object({
  enabled: z15.boolean().optional(),
  maxPerDay: z15.number().int().positive().optional()
}).strict().optional();
var OpenClawSchema = z15.object({
  $schema: z15.string().optional(),
  meta: z15.object({
    lastTouchedVersion: z15.string().optional(),
    // Accept any string unchanged (backwards-compatible) and coerce numeric Unix
    // timestamps to ISO strings (agent file edits may write Date.now()).
    lastTouchedAt: z15.union([
      z15.string(),
      z15.number().transform((n, ctx) => {
        const d = new Date(n);
        if (Number.isNaN(d.getTime())) {
          ctx.addIssue({ code: z15.ZodIssueCode.custom, message: "Invalid timestamp" });
          return z15.NEVER;
        }
        return d.toISOString();
      }).pipe(z15.string())
    ]).optional()
  }).strict().optional(),
  env: z15.object({
    shellEnv: z15.object({
      enabled: z15.boolean().optional(),
      timeoutMs: z15.number().int().nonnegative().optional()
    }).strict().optional(),
    vars: z15.record(z15.string(), z15.string()).optional()
  }).catchall(z15.string()).optional(),
  wizard: z15.object({
    lastRunAt: z15.string().optional(),
    lastRunVersion: z15.string().optional(),
    lastRunCommit: z15.string().optional(),
    lastRunCommand: z15.string().optional(),
    lastRunMode: z15.union([z15.literal("local"), z15.literal("remote")]).optional()
  }).strict().optional(),
  diagnostics: z15.object({
    enabled: z15.boolean().optional(),
    flags: z15.array(z15.string()).optional(),
    stuckSessionWarnMs: z15.number().int().positive().optional(),
    stuckSessionAbortMs: z15.number().int().positive().optional(),
    memoryPressureSnapshot: z15.boolean().optional(),
    otel: z15.object({
      enabled: z15.boolean().optional(),
      endpoint: z15.string().optional(),
      tracesEndpoint: z15.string().optional(),
      metricsEndpoint: z15.string().optional(),
      logsEndpoint: z15.string().optional(),
      protocol: z15.union([z15.literal("http/protobuf"), z15.literal("grpc")]).optional(),
      headers: z15.record(z15.string(), z15.string()).optional(),
      serviceName: z15.string().optional(),
      traces: z15.boolean().optional(),
      metrics: z15.boolean().optional(),
      logs: z15.boolean().optional(),
      logsExporter: z15.union([z15.literal("otlp"), z15.literal("stdout"), z15.literal("both")]).optional(),
      sampleRate: z15.number().min(0).max(1).optional(),
      flushIntervalMs: z15.number().int().nonnegative().optional(),
      captureContent: z15.union([
        z15.boolean(),
        z15.object({
          enabled: z15.boolean().optional(),
          inputMessages: z15.boolean().optional(),
          outputMessages: z15.boolean().optional(),
          toolInputs: z15.boolean().optional(),
          toolOutputs: z15.boolean().optional(),
          systemPrompt: z15.boolean().optional(),
          toolDefinitions: z15.boolean().optional()
        }).strict()
      ]).optional()
    }).strict().optional(),
    cacheTrace: z15.object({
      enabled: z15.boolean().optional(),
      filePath: z15.string().optional(),
      includeMessages: z15.boolean().optional(),
      includePrompt: z15.boolean().optional(),
      includeSystem: z15.boolean().optional()
    }).strict().optional()
  }).strict().optional(),
  logging: z15.object({
    level: LoggingLevelSchema.optional(),
    file: z15.string().optional(),
    maxFileBytes: z15.number().int().positive().optional(),
    consoleLevel: LoggingLevelSchema.optional(),
    consoleStyle: z15.union([z15.literal("pretty"), z15.literal("compact"), z15.literal("json")]).optional(),
    redactSensitive: z15.union([z15.literal("off"), z15.literal("tools")]).optional(),
    redactPatterns: z15.array(z15.string()).optional()
  }).strict().optional(),
  cli: z15.object({
    banner: z15.object({
      taglineMode: z15.union([z15.literal("random"), z15.literal("default"), z15.literal("off")]).optional()
    }).strict().optional()
  }).strict().optional(),
  crestodian: CrestodianSchema,
  update: z15.object({
    channel: z15.union([z15.literal("stable"), z15.literal("beta"), z15.literal("dev")]).optional(),
    checkOnStart: z15.boolean().optional(),
    auto: z15.object({
      enabled: z15.boolean().optional(),
      stableDelayHours: z15.number().nonnegative().max(168).optional(),
      stableJitterHours: z15.number().nonnegative().max(168).optional(),
      betaCheckIntervalHours: z15.number().positive().max(24).optional()
    }).strict().optional()
  }).strict().optional(),
  browser: z15.object({
    enabled: z15.boolean().optional(),
    evaluateEnabled: z15.boolean().optional(),
    cdpUrl: z15.string().optional(),
    remoteCdpTimeoutMs: z15.number().int().nonnegative().optional(),
    remoteCdpHandshakeTimeoutMs: z15.number().int().nonnegative().optional(),
    localLaunchTimeoutMs: z15.number().int().positive().max(12e4).optional(),
    localCdpReadyTimeoutMs: z15.number().int().positive().max(12e4).optional(),
    actionTimeoutMs: z15.number().int().positive().optional(),
    color: z15.string().optional(),
    executablePath: z15.string().optional(),
    headless: z15.boolean().optional(),
    noSandbox: z15.boolean().optional(),
    attachOnly: z15.boolean().optional(),
    cdpPortRangeStart: z15.number().int().min(1).max(65535).optional(),
    defaultProfile: z15.string().optional(),
    snapshotDefaults: BrowserSnapshotDefaultsSchema,
    ssrfPolicy: z15.object({
      dangerouslyAllowPrivateNetwork: z15.boolean().optional(),
      allowedHostnames: z15.array(z15.string()).optional(),
      hostnameAllowlist: z15.array(z15.string()).optional()
    }).strict().optional(),
    profiles: z15.record(
      z15.string().regex(/^[a-z0-9-]+$/, "Profile names must be alphanumeric with hyphens only"),
      z15.object({
        cdpPort: z15.number().int().min(1).max(65535).optional(),
        cdpUrl: z15.string().optional(),
        userDataDir: z15.string().optional(),
        mcpCommand: z15.string().optional(),
        mcpArgs: z15.array(z15.string()).optional(),
        driver: z15.union([z15.literal("openclaw"), z15.literal("clawd"), z15.literal("existing-session")]).optional(),
        headless: z15.boolean().optional(),
        executablePath: z15.string().optional(),
        attachOnly: z15.boolean().optional(),
        color: HexColorSchema
      }).strict().refine(
        (value) => value.driver === "existing-session" || value.cdpPort || value.cdpUrl,
        {
          message: "Profile must set cdpPort or cdpUrl"
        }
      ).refine((value) => value.driver === "existing-session" || !value.userDataDir, {
        message: 'Profile userDataDir is only supported with driver="existing-session"'
      })
    ).optional(),
    extraArgs: z15.array(z15.string()).optional(),
    tabCleanup: z15.object({
      enabled: z15.boolean().optional(),
      idleMinutes: z15.number().int().nonnegative().optional(),
      maxTabsPerSession: z15.number().int().nonnegative().optional(),
      sweepMinutes: z15.number().int().positive().optional()
    }).strict().optional()
  }).strict().optional(),
  ui: z15.object({
    seamColor: HexColorSchema.optional(),
    assistant: z15.object({
      name: z15.string().max(50).optional(),
      avatar: z15.string().max(2e6).optional()
    }).strict().optional()
  }).strict().optional(),
  tui: z15.object({
    footer: z15.object({
      showRemoteHost: z15.boolean().optional()
    }).strict().optional()
  }).strict().optional(),
  secrets: SecretsConfigSchema,
  auth: z15.object({
    profiles: z15.record(
      z15.string(),
      z15.object({
        provider: z15.string(),
        mode: z15.union([
          z15.literal("api_key"),
          z15.literal("aws-sdk"),
          z15.literal("oauth"),
          z15.literal("token")
        ]),
        email: z15.string().optional(),
        displayName: z15.string().optional()
      }).strict()
    ).optional(),
    order: z15.record(z15.string(), z15.array(z15.string())).optional(),
    cooldowns: z15.object({
      billingBackoffHours: z15.number().positive().optional(),
      billingBackoffHoursByProvider: z15.record(z15.string(), z15.number().positive()).optional(),
      billingMaxHours: z15.number().positive().optional(),
      authPermanentBackoffMinutes: z15.number().positive().optional(),
      authPermanentMaxMinutes: z15.number().positive().optional(),
      failureWindowHours: z15.number().positive().optional(),
      overloadedProfileRotations: z15.number().int().nonnegative().optional(),
      overloadedBackoffMs: z15.number().int().nonnegative().optional(),
      rateLimitedProfileRotations: z15.number().int().nonnegative().optional()
    }).strict().optional()
  }).strict().optional(),
  accessGroups: AccessGroupsSchema,
  acp: z15.object({
    enabled: z15.boolean().optional(),
    dispatch: z15.object({
      enabled: z15.boolean().optional()
    }).strict().optional(),
    backend: z15.string().optional(),
    fallbacks: z15.array(z15.string()).optional(),
    defaultAgent: z15.string().optional(),
    allowedAgents: z15.array(z15.string()).optional(),
    maxConcurrentSessions: z15.number().int().positive().optional(),
    stream: z15.object({
      coalesceIdleMs: z15.number().int().nonnegative().optional(),
      maxChunkChars: z15.number().int().positive().optional(),
      repeatSuppression: z15.boolean().optional(),
      deliveryMode: z15.union([z15.literal("live"), z15.literal("final_only")]).optional(),
      hiddenBoundarySeparator: z15.union([
        z15.literal("none"),
        z15.literal("space"),
        z15.literal("newline"),
        z15.literal("paragraph")
      ]).optional(),
      maxOutputChars: z15.number().int().positive().optional(),
      maxSessionUpdateChars: z15.number().int().positive().optional(),
      tagVisibility: z15.record(z15.string(), z15.boolean()).optional()
    }).strict().optional(),
    runtime: z15.object({
      ttlMinutes: z15.number().int().positive().optional(),
      installCommand: z15.string().optional()
    }).strict().optional()
  }).strict().optional(),
  models: ModelsConfigSchema,
  nodeHost: NodeHostSchema,
  agents: AgentsSchema,
  tools: ToolsSchema,
  security: SecuritySchema,
  bindings: BindingsSchema,
  broadcast: BroadcastSchema,
  audio: AudioSchema,
  media: z15.object({
    preserveFilenames: z15.boolean().optional(),
    ttlHours: z15.number().int().min(1).max(24 * 7).optional()
  }).strict().optional(),
  messages: MessagesSchema,
  commands: CommandsSchema,
  approvals: ApprovalsSchema,
  session: SessionSchema,
  cron: z15.object({
    enabled: z15.boolean().optional(),
    store: z15.string().optional(),
    maxConcurrentRuns: z15.number().int().positive().optional(),
    retry: z15.object({
      maxAttempts: z15.number().int().min(0).max(10).optional(),
      backoffMs: z15.array(z15.number().int().nonnegative()).min(1).max(10).optional(),
      retryOn: z15.array(z15.enum(["rate_limit", "overloaded", "network", "timeout", "server_error"])).min(1).optional()
    }).strict().optional(),
    webhook: HttpUrlSchema.optional(),
    webhookToken: SecretInputSchema.optional().register(sensitive),
    sessionRetention: z15.union([z15.string(), z15.literal(false)]).optional(),
    runLog: z15.object({
      maxBytes: z15.union([z15.string(), z15.number()]).optional(),
      keepLines: z15.number().int().positive().optional()
    }).strict().optional(),
    failureAlert: z15.object({
      enabled: z15.boolean().optional(),
      after: z15.number().int().min(1).optional(),
      cooldownMs: z15.number().int().min(0).optional(),
      includeSkipped: z15.boolean().optional(),
      mode: z15.enum(["announce", "webhook"]).optional(),
      accountId: z15.string().optional()
    }).strict().optional(),
    failureDestination: z15.object({
      channel: z15.string().optional(),
      to: z15.string().optional(),
      accountId: z15.string().optional(),
      mode: z15.enum(["announce", "webhook"]).optional()
    }).strict().optional()
  }).strict().superRefine((val, ctx) => {
    if (val.sessionRetention !== void 0 && val.sessionRetention !== false) {
      try {
        parseDurationMs(normalizeStringifiedOptionalString(val.sessionRetention) ?? "", {
          defaultUnit: "h"
        });
      } catch {
        ctx.addIssue({
          code: z15.ZodIssueCode.custom,
          path: ["sessionRetention"],
          message: "invalid duration (use ms, s, m, h, d)"
        });
      }
    }
    if (val.runLog?.maxBytes !== void 0) {
      try {
        parseByteSize(normalizeStringifiedOptionalString(val.runLog.maxBytes) ?? "", {
          defaultUnit: "b"
        });
      } catch {
        ctx.addIssue({
          code: z15.ZodIssueCode.custom,
          path: ["runLog", "maxBytes"],
          message: "invalid size (use b, kb, mb, gb, tb)"
        });
      }
    }
  }).optional(),
  transcripts: z15.object({
    enabled: z15.boolean().optional(),
    maxUtterances: z15.number().int().min(1).max(1e4).optional(),
    autoStart: z15.array(
      z15.object({
        providerId: z15.string().min(1),
        sessionId: z15.string().min(1).optional(),
        title: z15.string().min(1).optional(),
        accountId: z15.string().min(1).optional(),
        guildId: z15.string().min(1).optional(),
        channelId: z15.string().min(1).optional(),
        meetingUrl: z15.string().min(1).optional()
      }).strict()
    ).optional()
  }).strict().optional(),
  commitments: CommitmentsSchema,
  hooks: z15.object({
    enabled: z15.boolean().optional(),
    path: z15.string().optional(),
    token: z15.string().optional().register(sensitive),
    defaultSessionKey: z15.string().optional(),
    allowRequestSessionKey: z15.boolean().optional(),
    allowedSessionKeyPrefixes: z15.array(z15.string()).optional(),
    allowedAgentIds: z15.array(z15.string()).optional(),
    maxBodyBytes: z15.number().int().positive().optional(),
    presets: z15.array(z15.string()).optional(),
    transformsDir: z15.string().optional(),
    mappings: z15.array(HookMappingSchema).optional(),
    gmail: HooksGmailSchema,
    internal: InternalHooksSchema
  }).strict().optional(),
  web: z15.object({
    enabled: z15.boolean().optional(),
    heartbeatSeconds: z15.number().int().positive().optional(),
    reconnect: z15.object({
      initialMs: z15.number().positive().optional(),
      maxMs: z15.number().positive().optional(),
      factor: z15.number().positive().optional(),
      jitter: z15.number().min(0).max(1).optional(),
      maxAttempts: z15.number().int().min(0).optional()
    }).strict().optional(),
    whatsapp: z15.object({
      keepAliveIntervalMs: z15.number().int().positive().optional(),
      connectTimeoutMs: z15.number().int().positive().optional(),
      defaultQueryTimeoutMs: z15.number().int().positive().optional()
    }).strict().optional()
  }).strict().optional(),
  channels: ChannelsSchema,
  discovery: z15.object({
    wideArea: z15.object({
      enabled: z15.boolean().optional(),
      domain: z15.string().optional()
    }).strict().optional(),
    mdns: z15.object({
      mode: z15.enum(["off", "minimal", "full"]).optional()
    }).strict().optional()
  }).strict().optional(),
  talk: TalkSchema.optional(),
  gateway: z15.object({
    port: z15.number().int().positive().optional(),
    mode: z15.union([z15.literal("local"), z15.literal("remote")]).optional(),
    bind: z15.union([
      z15.literal("auto"),
      z15.literal("lan"),
      z15.literal("loopback"),
      z15.literal("custom"),
      z15.literal("tailnet")
    ]).optional(),
    customBindHost: z15.string().optional(),
    controlUi: z15.object({
      enabled: z15.boolean().optional(),
      basePath: z15.string().optional(),
      root: z15.string().optional(),
      embedSandbox: z15.union([z15.literal("strict"), z15.literal("scripts"), z15.literal("trusted")]).optional(),
      allowExternalEmbedUrls: z15.boolean().optional(),
      chatMessageMaxWidth: z15.string().transform((value) => normalizeControlUiChatMessageMaxWidth(value)).refine((value) => isValidControlUiChatMessageMaxWidth(value), {
        message: "Expected a CSS width value such as 960px, 82%, min(1280px, 82%), or calc(100% - 2rem)"
      }).optional(),
      allowedOrigins: z15.array(z15.string()).optional(),
      dangerouslyAllowHostHeaderOriginFallback: z15.boolean().optional(),
      allowInsecureAuth: z15.boolean().optional(),
      dangerouslyDisableDeviceAuth: z15.boolean().optional()
    }).strict().optional(),
    auth: z15.object({
      mode: z15.union([
        z15.literal("none"),
        z15.literal("token"),
        z15.literal("password"),
        z15.literal("trusted-proxy")
      ]).optional(),
      token: SecretInputSchema.optional().register(sensitive),
      password: SecretInputSchema.optional().register(sensitive),
      allowTailscale: z15.boolean().optional(),
      rateLimit: z15.object({
        maxAttempts: z15.number().optional(),
        windowMs: z15.number().optional(),
        lockoutMs: z15.number().optional(),
        exemptLoopback: z15.boolean().optional()
      }).strict().optional(),
      trustedProxy: z15.object({
        userHeader: z15.string().min(1, "userHeader is required for trusted-proxy mode"),
        requiredHeaders: z15.array(z15.string()).optional(),
        allowUsers: z15.array(z15.string()).optional(),
        allowLoopback: z15.boolean().optional()
      }).strict().optional()
    }).strict().optional(),
    trustedProxies: z15.array(z15.string()).optional(),
    allowRealIpFallback: z15.boolean().optional(),
    tools: z15.object({
      deny: z15.array(z15.string()).optional(),
      allow: z15.array(z15.string()).optional()
    }).strict().optional(),
    handshakeTimeoutMs: z15.number().int().min(1).optional(),
    channelHealthCheckMinutes: z15.number().int().min(0).optional(),
    channelStaleEventThresholdMinutes: z15.number().int().min(1).optional(),
    channelMaxRestartsPerHour: z15.number().int().min(1).optional(),
    tailscale: z15.object({
      mode: z15.union([z15.literal("off"), z15.literal("serve"), z15.literal("funnel")]).optional(),
      resetOnExit: z15.boolean().optional(),
      serviceName: TailscaleServiceNameSchema.optional(),
      preserveFunnel: z15.boolean().optional()
    }).strict().optional(),
    remote: GatewayRemoteConfigSchema,
    reload: z15.object({
      mode: z15.union([
        z15.literal("off"),
        z15.literal("restart"),
        z15.literal("hot"),
        z15.literal("hybrid")
      ]).optional(),
      debounceMs: z15.number().int().min(0).optional(),
      deferralTimeoutMs: z15.number().int().min(0).optional()
    }).strict().optional(),
    tls: z15.object({
      enabled: z15.boolean().optional(),
      autoGenerate: z15.boolean().optional(),
      // Reject blank values without transforming the string. Trimming here would
      // silently rewrite a legitimate filesystem path that contains leading or
      // trailing spaces and persist the trimmed value into validated config;
      // runtime path resolution (resolveUserPath) owns all normalization.
      certPath: z15.string().optional().refine((v) => v === void 0 || v.trim().length > 0, "certPath must not be blank"),
      keyPath: z15.string().optional().refine((v) => v === void 0 || v.trim().length > 0, "keyPath must not be blank"),
      caPath: z15.string().optional()
    }).optional(),
    http: z15.object({
      endpoints: z15.object({
        chatCompletions: z15.object({
          enabled: z15.boolean().optional(),
          maxBodyBytes: z15.number().int().positive().optional(),
          maxImageParts: z15.number().int().nonnegative().optional(),
          maxTotalImageBytes: z15.number().int().positive().optional(),
          images: z15.object({
            ...ResponsesEndpointUrlFetchShape
          }).strict().optional()
        }).strict().optional(),
        responses: z15.object({
          enabled: z15.boolean().optional(),
          maxBodyBytes: z15.number().int().positive().optional(),
          maxUrlParts: z15.number().int().nonnegative().optional(),
          files: z15.object({
            ...ResponsesEndpointUrlFetchShape,
            maxChars: z15.number().int().positive().optional(),
            pdf: z15.object({
              maxPages: z15.number().int().positive().optional(),
              maxPixels: z15.number().int().positive().optional(),
              minTextChars: z15.number().int().nonnegative().optional()
            }).strict().optional()
          }).strict().optional(),
          images: z15.object({
            ...ResponsesEndpointUrlFetchShape
          }).strict().optional()
        }).strict().optional()
      }).strict().optional(),
      securityHeaders: z15.object({
        strictTransportSecurity: z15.union([z15.string(), z15.literal(false)]).optional()
      }).strict().optional()
    }).strict().optional(),
    push: z15.object({
      apns: z15.object({
        relay: z15.object({
          baseUrl: z15.string().optional(),
          timeoutMs: z15.number().int().positive().optional()
        }).strict().optional()
      }).strict().optional()
    }).strict().optional(),
    nodes: z15.object({
      browser: z15.object({
        mode: z15.union([z15.literal("auto"), z15.literal("manual"), z15.literal("off")]).optional(),
        node: z15.string().optional()
      }).strict().optional(),
      pairing: z15.object({
        autoApproveCidrs: z15.array(z15.string()).optional()
      }).strict().optional(),
      allowCommands: z15.array(z15.string()).optional(),
      denyCommands: z15.array(z15.string()).optional()
    }).strict().optional()
  }).strict().superRefine((gateway, ctx) => {
    const effectiveHealthCheckMinutes = gateway.channelHealthCheckMinutes ?? 5;
    if (gateway.channelStaleEventThresholdMinutes != null && effectiveHealthCheckMinutes !== 0 && gateway.channelStaleEventThresholdMinutes < effectiveHealthCheckMinutes) {
      ctx.addIssue({
        code: z15.ZodIssueCode.custom,
        path: ["channelStaleEventThresholdMinutes"],
        message: "channelStaleEventThresholdMinutes should be >= channelHealthCheckMinutes to avoid delayed stale detection"
      });
    }
  }).optional(),
  memory: MemorySchema,
  mcp: McpConfigSchema,
  skills: z15.object({
    allowBundled: z15.array(z15.string()).optional(),
    load: z15.object({
      extraDirs: z15.array(z15.string()).optional(),
      allowSymlinkTargets: z15.array(z15.string()).optional(),
      watch: z15.boolean().optional(),
      watchDebounceMs: z15.number().int().min(0).optional()
    }).strict().optional(),
    install: z15.object({
      preferBrew: z15.boolean().optional(),
      nodeManager: z15.union([z15.literal("npm"), z15.literal("pnpm"), z15.literal("yarn"), z15.literal("bun")]).optional(),
      allowUploadedArchives: z15.boolean().optional()
    }).strict().optional(),
    limits: z15.object({
      maxCandidatesPerRoot: z15.number().int().min(1).optional(),
      maxSkillsLoadedPerSource: z15.number().int().min(1).optional(),
      maxSkillsInPrompt: z15.number().int().min(0).optional(),
      maxSkillsPromptChars: z15.number().int().min(0).optional(),
      maxSkillFileBytes: z15.number().int().min(0).optional()
    }).strict().optional(),
    workshop: z15.object({
      autonomous: z15.object({
        enabled: z15.boolean().optional()
      }).strict().optional(),
      approvalPolicy: z15.union([z15.literal("pending"), z15.literal("auto")]).optional(),
      allowSymlinkTargetWrites: z15.boolean().optional(),
      maxPending: z15.number().int().min(1).optional(),
      maxSkillBytes: z15.number().int().min(1).optional()
    }).strict().optional(),
    entries: z15.record(z15.string(), SkillEntrySchema).optional()
  }).strict().optional(),
  plugins: z15.object({
    enabled: z15.boolean().optional(),
    allow: z15.array(z15.string()).optional(),
    deny: z15.array(z15.string()).optional(),
    load: z15.object({
      paths: z15.array(z15.string()).optional()
    }).strict().optional(),
    slots: z15.object({
      memory: z15.string().optional(),
      contextEngine: z15.string().optional()
    }).strict().optional(),
    entries: z15.record(z15.string(), PluginEntrySchema).optional(),
    bundledDiscovery: z15.enum(["compat", "allowlist"]).optional()
  }).strict().optional(),
  canvasHost: LegacyCanvasHostSchema,
  surfaces: z15.record(
    z15.string(),
    z15.object({
      silentReply: SilentReplyPolicyConfigSchema.optional()
    }).strict()
  ).optional(),
  proxy: ProxyConfigSchema
}).strict().superRefine((cfg, ctx) => {
  const agents = cfg.agents?.list ?? [];
  if (agents.length === 0) {
    return;
  }
  const agentIds = new Set(agents.map((agent) => agent.id));
  const effectiveAgentIds = new Set(agents.map((agent) => normalizeAgentId(agent.id)));
  const bindings = cfg.bindings;
  if (Array.isArray(bindings)) {
    for (let idx = 0; idx < bindings.length; idx += 1) {
      const binding = bindings[idx];
      if (!binding || typeof binding !== "object") {
        continue;
      }
      const agentId = binding.agentId;
      if (typeof agentId === "string" && !effectiveAgentIds.has(normalizeAgentId(agentId))) {
        ctx.addIssue({
          code: z15.ZodIssueCode.custom,
          path: ["bindings", idx, "agentId"],
          message: `Unknown agent id "${agentId}" (not in agents.list).`
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
    for (let idx = 0; idx < ids.length; idx += 1) {
      const agentId = ids[idx];
      if (!agentIds.has(agentId)) {
        ctx.addIssue({
          code: z15.ZodIssueCode.custom,
          path: ["broadcast", peerId, idx],
          message: `Unknown agent id "${agentId}" (not in agents.list).`
        });
      }
    }
  }
});
export {
  OpenClawSchema
};
